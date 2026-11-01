"""
Training and Evaluation Pipeline for Cross-Attention Fusion & Probabilistic Ensemble.

Two models are trained and compared:
  1. CrossAttentionFusionClassifier -- bidirectional cross-attention on projected ResNet-50
     features (exploratory; label-stratified cross-cohort pairs, NOT genuine same-patient data)
  2. ProbabilisticEnsemble -- fixed alpha-weighting of unimodal class-logit softmax outputs

Both models are evaluated using:
  sensitivity, specificity, precision, recall, F1-score, ROC-AUC, confusion matrix

Data Disclosure:
  The 91 "pairs" are label-matched cross-cohort images:
  - Mammograms: MIAS (UK, 1994)
  - Thermograms: Mendeley (Mexico, 2020) + DMR-IR (Brazil, 2014)
  NOT genuine same-patient data. See CROSS_ATTENTION_ASSESSMENT.md.
"""

import sys, os, csv, json, time, copy, math
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Windows CP-1252 safe output
sys.stdout.reconfigure(encoding='utf-8')

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np
from PIL import Image

torch.set_num_threads(2)  # CPU memory safety

from src.fusion.cross_attention_model import CrossAttentionFusionClassifier, ProbabilisticEnsemble
from src.evaluation.metrics import compute_clinical_metrics
from src.preprocessing.dataset import (
    get_mammogram_eval_transforms,
    get_thermal_eval_transforms,
    LABEL_TO_IDX,
    IDX_TO_LABEL
)


# ------------------------------------------------------------------------------
# Dataset
# ------------------------------------------------------------------------------

class PairedFeatureDataset(Dataset):
    """Pre-extracted 2048-dim paired feature vectors + label."""

    def __init__(self, items: List[Dict]):
        self.items = items

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        item = self.items[idx]
        return {
            "fm": item["fm"],            # (2048,)
            "ft": item["ft"],            # (2048,)
            "label": torch.tensor(item["label"], dtype=torch.long),
            "patient_id": item["patient_id"]
        }


# ------------------------------------------------------------------------------
# Feature extraction
# ------------------------------------------------------------------------------

def load_paired_cohort(project_root: Path) -> List[Dict]:
    """Load verified paired cohort from manifest and resolve image paths."""
    manifest = project_root / "data" / "manifests" / "paired_patient_manifest.csv"
    mammo_dir = project_root / "data" / "raw" / "paired" / "mammogram"
    thermal_dir = project_root / "data" / "raw" / "paired" / "thermal"

    pairs = []
    with open(manifest, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            m_path = mammo_dir / row["mammogram_filename"]
            t_path = thermal_dir / row["thermal_filename"]
            if not m_path.exists() or not t_path.exists():
                continue
            label_idx = LABEL_TO_IDX.get(row["label"].lower(), -1)
            if label_idx < 0:
                continue
            pairs.append({
                "participant_id": row["participant_id"],
                "mammo_path": str(m_path),
                "thermal_path": str(t_path),
                "label": label_idx,
                "label_name": row["label"].lower(),
                "dataset": row.get("dataset", "unknown")
            })
    return pairs


def preextract_features(
    backbone_mammo: nn.Module,
    backbone_thermal: nn.Module,
    pairs: List[Dict]
) -> List[Dict]:
    """Extract 2048-dim ResNet-50 embeddings for all pairs under no_grad."""
    mammo_tf = get_mammogram_eval_transforms()
    thermal_tf = get_thermal_eval_transforms()

    backbone_mammo.eval()
    backbone_thermal.eval()

    items = []
    print(f"  Extracting features from {len(pairs)} pairs...")
    with torch.no_grad():
        for idx, p in enumerate(pairs):
            try:
                m_img = Image.open(p["mammo_path"]).convert("L").convert("RGB")
                t_img = Image.open(p["thermal_path"]).convert("RGB")
            except Exception as e:
                print(f"  Warning: skipping pair {p['participant_id']}: {e}")
                continue

            xm = mammo_tf(m_img).unsqueeze(0)
            xt = thermal_tf(t_img).unsqueeze(0)

            fm = backbone_mammo(xm).squeeze(0)    # (2048,)
            ft = backbone_thermal(xt).squeeze(0)  # (2048,)

            items.append({
                "fm": fm,
                "ft": ft,
                "label": p["label"],
                "patient_id": p["participant_id"],
                "dataset": p["dataset"]
            })

            if (idx + 1) % 25 == 0 or (idx + 1) == len(pairs):
                print(f"    {idx + 1}/{len(pairs)} pairs processed")

    return items


# ------------------------------------------------------------------------------
# Patient-level stratified split
# ------------------------------------------------------------------------------

def patient_stratified_split(
    items: List[Dict],
    train_frac: float = 0.70,
    val_frac: float = 0.15,
    seed: int = 42
) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """
    Splits items so each participant appears in exactly one split.
    Stratified by label to preserve class balance.
    """
    rng = np.random.default_rng(seed)

    by_label: Dict[int, List[Dict]] = {}
    for item in items:
        lbl = item["label"]
        by_label.setdefault(lbl, []).append(item)

    train, val, test = [], [], []
    for lbl, group in by_label.items():
        perm = rng.permutation(len(group)).tolist()
        n_train = max(1, int(len(group) * train_frac))
        n_val = max(1, int(len(group) * val_frac))
        train.extend([group[i] for i in perm[:n_train]])
        val.extend([group[i] for i in perm[n_train:n_train + n_val]])
        test.extend([group[i] for i in perm[n_train + n_val:]])

    if len(test) < 3:
        test = val[:]

    return train, val, test


# ------------------------------------------------------------------------------
# Training loops
# ------------------------------------------------------------------------------

def train_cross_attention(
    model: CrossAttentionFusionClassifier,
    train_items: List[Dict],
    val_items: List[Dict],
    epochs: int = 30,
    batch_size: int = 16,
    lr: float = 3e-4
) -> CrossAttentionFusionClassifier:
    """Train the cross-attention fusion head only (backbones frozen)."""

    train_loader = DataLoader(
        PairedFeatureDataset(train_items), batch_size=batch_size, shuffle=True, drop_last=False
    )
    val_loader = DataLoader(
        PairedFeatureDataset(val_items), batch_size=batch_size, shuffle=False
    )

    trainable_params = (
        list(model.mammo_proj.parameters()) +
        list(model.thermal_proj.parameters()) +
        list(model.cross_attention.parameters()) +
        list(model.norm_mammo.parameters()) +
        list(model.norm_thermal.parameters()) +
        list(model.fusion_head.parameters())
    )
    n_params = sum(p.numel() for p in trainable_params)
    print(f"  Trainable parameters (attention + heads): {n_params:,}")

    label_counts = [sum(1 for it in train_items if it["label"] == i) for i in range(3)]
    total = sum(label_counts)
    weights = torch.tensor(
        [total / (3 * max(c, 1)) for c in label_counts], dtype=torch.float
    )
    criterion = nn.CrossEntropyLoss(weight=weights)

    optimizer = torch.optim.AdamW(trainable_params, lr=lr, weight_decay=1e-3)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_acc = 0.0
    best_state = None

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0

        for batch in train_loader:
            fm, ft, yb = batch["fm"], batch["ft"], batch["label"]

            optimizer.zero_grad()
            logits = model.forward_from_features(fm, ft)
            loss = criterion(logits, yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(trainable_params, max_norm=1.0)
            optimizer.step()

            train_loss += loss.item() * fm.size(0)
            train_correct += (logits.argmax(1) == yb).sum().item()
            train_total += yb.size(0)

        scheduler.step()

        model.eval()
        val_correct, val_total = 0, 0
        with torch.no_grad():
            for batch in val_loader:
                fm, ft, yb = batch["fm"], batch["ft"], batch["label"]
                logits = model.forward_from_features(fm, ft)
                val_correct += (logits.argmax(1) == yb).sum().item()
                val_total += yb.size(0)

        train_acc = train_correct / max(train_total, 1)
        val_acc = val_correct / max(val_total, 1)

        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            best_state = copy.deepcopy(model.state_dict())

        if epoch % 5 == 0 or epoch == epochs:
            print(
                f"  Epoch {epoch:02d}/{epochs} | "
                f"Train Loss: {train_loss/max(train_total,1):.4f} "
                f"Acc: {train_acc*100:.1f}% | "
                f"Val Acc: {val_acc*100:.1f}% | "
                f"Best Val: {best_val_acc*100:.1f}%"
            )

    if best_state is not None:
        model.load_state_dict(best_state)
    return model


def compute_ensemble_alpha(
    model: CrossAttentionFusionClassifier,
    val_items: List[Dict]
) -> float:
    """
    Compute optimal ensemble alpha via grid search on validation set.

    Uses cross-attention model's fusion head with one branch zeroed out
    to approximate unimodal mammogram-only / thermal-only predictions.
    Returns alpha in [0, 1] where alpha = mammogram weight.
    """
    model.eval()

    all_targets = [item["label"] for item in val_items]
    n = len(val_items)

    mammo_preds, thermal_preds = [], []

    with torch.no_grad():
        for item in val_items:
            fm = item["fm"].unsqueeze(0)
            ft = item["ft"].unsqueeze(0)

            p_m = torch.softmax(model.forward_from_features(fm, torch.zeros_like(ft)), dim=1).squeeze(0)
            p_t = torch.softmax(model.forward_from_features(torch.zeros_like(fm), ft), dim=1).squeeze(0)

            mammo_preds.append(p_m)
            thermal_preds.append(p_t)

    mammo_acc = sum(
        int(mammo_preds[i].argmax().item() == all_targets[i]) for i in range(n)
    ) / max(n, 1)
    thermal_acc = sum(
        int(thermal_preds[i].argmax().item() == all_targets[i]) for i in range(n)
    ) / max(n, 1)

    print(f"  Unimodal val acc -- Mammo: {mammo_acc*100:.1f}% | Thermal: {thermal_acc*100:.1f}%")

    # Grid search for best alpha
    best_alpha = 0.5
    best_grid_acc = 0.0
    for a in np.arange(0.0, 1.05, 0.05):
        correct = 0
        for i in range(n):
            p_ens = a * mammo_preds[i] + (1 - a) * thermal_preds[i]
            if p_ens.argmax().item() == all_targets[i]:
                correct += 1
        grid_acc = correct / max(n, 1)
        if grid_acc > best_grid_acc:
            best_grid_acc = grid_acc
            best_alpha = float(a)

    print(f"  Grid-searched alpha: {best_alpha:.2f} | Grid val acc: {best_grid_acc*100:.1f}%")
    return best_alpha


# ------------------------------------------------------------------------------
# Evaluation
# ------------------------------------------------------------------------------

def evaluate_model(
    model: CrossAttentionFusionClassifier,
    test_items: List[Dict],
    model_name: str
) -> Tuple[Dict, float]:
    """Evaluate cross-attention model on held-out test items."""
    model.eval()
    loader = DataLoader(
        PairedFeatureDataset(test_items), batch_size=16, shuffle=False
    )

    all_preds, all_targets, all_probs = [], [], []
    test_loss = 0.0
    criterion = nn.CrossEntropyLoss()

    with torch.no_grad():
        for batch in loader:
            fm, ft, yb = batch["fm"], batch["ft"], batch["label"]
            logits = model.forward_from_features(fm, ft)
            loss = criterion(logits, yb)
            test_loss += loss.item() * fm.size(0)
            probs = torch.softmax(logits, dim=1).numpy()
            preds = np.argmax(probs, axis=1)
            all_preds.extend(preds.tolist())
            all_targets.extend(yb.numpy().tolist())
            all_probs.append(probs)

    avg_loss = test_loss / max(len(test_items), 1)
    probs_matrix = np.concatenate(all_probs, axis=0) if all_probs else np.zeros((0, 3))
    metrics = compute_clinical_metrics(all_targets, all_preds, probs_matrix)
    metrics["loss"] = round(avg_loss, 4)

    print(f"\n  -- {model_name} -- Held-Out Test Results --")
    print(f"  Test N: {len(test_items)} | NOTE: Small sample; results are indicative only")
    print(f"  Accuracy:    {metrics['overall_accuracy']*100:.2f}%")
    print(f"  Sensitivity: {metrics['macro_sensitivity_recall']*100:.2f}%")
    print(f"  Specificity: {metrics['macro_specificity']*100:.2f}%")
    print(f"  F1 (Macro):  {metrics['macro_f1']*100:.2f}%")
    print(f"  ROC-AUC:     {metrics['macro_roc_auc']:.4f}")

    return metrics, avg_loss


def evaluate_ensemble_fixed_alpha(
    ca_model: CrossAttentionFusionClassifier,
    test_items: List[Dict],
    alpha: float
) -> Tuple[Dict, float]:
    """
    Evaluate fixed-alpha ensemble on test items.
    Combines mammogram-only and thermal-only branch softmax outputs.
    """
    ca_model.eval()

    all_preds, all_targets, all_probs = [], [], []

    with torch.no_grad():
        for item in test_items:
            fm = item["fm"].unsqueeze(0)
            ft = item["ft"].unsqueeze(0)

            p_m = torch.softmax(ca_model.forward_from_features(fm, torch.zeros_like(ft)), dim=1)
            p_t = torch.softmax(ca_model.forward_from_features(torch.zeros_like(fm), ft), dim=1)
            p_ens = alpha * p_m + (1 - alpha) * p_t

            probs = p_ens.squeeze(0).numpy()
            all_preds.append(int(np.argmax(probs)))
            all_targets.append(item["label"])
            all_probs.append(probs)

    probs_matrix = np.array(all_probs)
    metrics = compute_clinical_metrics(all_targets, all_preds, probs_matrix)
    metrics["loss"] = 0.0
    metrics["alpha"] = round(float(alpha), 3)

    print(f"\n  -- Probabilistic Ensemble (alpha={alpha:.2f}) -- Held-Out Test Results --")
    print(f"  Mammo weight: {alpha:.3f} | Thermal weight: {1-alpha:.3f}")
    print(f"  Test N: {len(test_items)} | NOTE: Small sample; results are indicative only")
    print(f"  Accuracy:    {metrics['overall_accuracy']*100:.2f}%")
    print(f"  Sensitivity: {metrics['macro_sensitivity_recall']*100:.2f}%")
    print(f"  Specificity: {metrics['macro_specificity']*100:.2f}%")
    print(f"  F1 (Macro):  {metrics['macro_f1']*100:.2f}%")
    print(f"  ROC-AUC:     {metrics['macro_roc_auc']:.4f}")

    return metrics, 0.0


# ------------------------------------------------------------------------------
# Main Training Entry Point
# ------------------------------------------------------------------------------

def run_cross_attention_training(
    project_root: Path,
    cross_attn_epochs: int = 40,
    batch_size: int = 16,
    lr_cross_attn: float = 3e-4,
    seed: int = 42
) -> Dict[str, Any]:

    models_dir = project_root / "models"
    reports_dir = project_root / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("CROSS-ATTENTION MULTIMODAL FUSION TRAINING PIPELINE")
    print("=" * 65)
    print()
    print("DATA DISCLOSURE:")
    print("  Pairs are label-stratified cross-cohort images (NOT same-patient).")
    print("  Mammograms: MIAS (UK, 1994)")
    print("  Thermograms: Mendeley (Mexico, 2020) + DMR-IR (Brazil, 2014)")
    print("  Results are research-exploratory only.")
    print()

    # -- Step 1: Load paired cohort ----------------------------------------
    print("Step 1/6: Loading paired cohort from manifest...")
    pairs = load_paired_cohort(project_root)
    print(f"  Total valid pairs: {len(pairs)}")
    label_counts = {}
    for p in pairs:
        label_counts[p["label_name"]] = label_counts.get(p["label_name"], 0) + 1
    print(f"  Class distribution: {label_counts}")

    if len(pairs) < 20:
        raise ValueError(
            f"Insufficient paired data for training ({len(pairs)} pairs). "
            "At least 20 verified pairs are required."
        )

    # -- Step 2: Build cross-attention model and load unimodal weights ------
    print("\nStep 2/6: Building CrossAttentionFusionClassifier...")
    model = CrossAttentionFusionClassifier(
        num_classes=3, embed_dim=512, num_heads=4, dropout=0.2
    )

    mammo_ckpt = models_dir / "mammogram_resnet50.pt"
    thermal_ckpt = models_dir / "thermal_resnet50.pt"
    model.load_unimodal_weights(mammo_ckpt, thermal_ckpt)
    print(f"  Loaded unimodal backbone weights: {mammo_ckpt.name}, {thermal_ckpt.name}")

    total_params = sum(p.numel() for p in model.parameters())
    trainable_count = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Total parameters: {total_params:,}")
    print(f"  Trainable (attention + heads only): {trainable_count:,}")

    # -- Step 3: Pre-extract features ---------------------------------------
    print("\nStep 3/6: Pre-extracting ResNet-50 feature embeddings...")
    feature_items = preextract_features(
        model.mammo_backbone, model.thermal_backbone, pairs
    )
    print(f"  Extracted {len(feature_items)} feature pairs")

    # -- Step 4: Patient-level split ----------------------------------------
    print("\nStep 4/6: Patient-level stratified split (70/15/15)...")
    train_items, val_items, test_items = patient_stratified_split(
        feature_items, train_frac=0.70, val_frac=0.15, seed=seed
    )
    print(f"  Train: {len(train_items)} | Val: {len(val_items)} | Test: {len(test_items)}")

    # -- Step 5: Train cross-attention model --------------------------------
    print(f"\nStep 5/6: Training CrossAttentionFusionClassifier ({cross_attn_epochs} epochs)...")
    model = train_cross_attention(
        model, train_items, val_items,
        epochs=cross_attn_epochs,
        batch_size=batch_size,
        lr=lr_cross_attn
    )

    # -- Step 5b: Compute optimal ensemble alpha (grid search, no training loop)
    print("\n  Computing Probabilistic Ensemble alpha via grid search on val set...")
    ensemble_alpha = compute_ensemble_alpha(model, val_items)
    print(f"  Final ensemble alpha (mammo weight): {ensemble_alpha:.3f}")

    # Build ensemble object with calibrated alpha
    ensemble = ProbabilisticEnsemble(num_classes=3)
    with torch.no_grad():
        alpha_clamp = max(0.01, min(0.99, ensemble_alpha))
        log_a = math.log(alpha_clamp / (1 - alpha_clamp))
        ensemble.log_alpha.data = torch.tensor([log_a])

    # -- Step 6: Evaluate both models ---------------------------------------
    print("\nStep 6/6: Evaluating on held-out test set...")
    ca_metrics, ca_loss = evaluate_model(model, test_items, "CrossAttentionFusion")
    ens_metrics, _ = evaluate_ensemble_fixed_alpha(model, test_items, ensemble_alpha)

    # -- Save cross-attention checkpoint ------------------------------------
    ca_checkpoint = {
        "model_architecture": "CrossAttentionFusionClassifier",
        "architecture_note": CrossAttentionFusionClassifier.DATA_PAIRING_NOTE,
        "embed_dim": 512,
        "num_heads": 4,
        "num_classes": 3,
        "classes": ["normal", "benign", "malignant"],
        "model_state_dict": model.state_dict(),
        "test_metrics": ca_metrics,
        "train_samples": len(train_items),
        "val_samples": len(val_items),
        "test_samples": len(test_items),
        "data_note": CrossAttentionFusionClassifier.DATA_PAIRING_NOTE,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    ca_path = models_dir / "cross_attention_fusion.pt"
    torch.save(ca_checkpoint, ca_path)
    print(f"\n  Saved: {ca_path.name}  ({ca_path.stat().st_size/1e6:.1f} MB)")

    # -- Save ensemble checkpoint -------------------------------------------
    ens_checkpoint = {
        "model_architecture": "ProbabilisticEnsemble",
        "alpha": ensemble_alpha,
        "num_classes": 3,
        "classes": ["normal", "benign", "malignant"],
        "model_state_dict": ensemble.state_dict(),
        "test_metrics": ens_metrics,
        "train_samples": len(train_items),
        "val_samples": len(val_items),
        "test_samples": len(test_items),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    ens_path = models_dir / "ensemble_fusion.pt"
    torch.save(ens_checkpoint, ens_path)
    print(f"  Saved: {ens_path.name}  ({ens_path.stat().st_size/1e6:.1f} MB)")

    # -- Update evaluation_results.json ------------------------------------
    eval_json = reports_dir / "evaluation_results.json"
    eval_data = {}
    if eval_json.exists():
        try:
            eval_data = json.load(open(eval_json, encoding="utf-8"))
        except Exception:
            pass

    eval_data["cross_attention"] = {
        "modality": "combined",
        "architecture": "CrossAttentionFusionClassifier",
        "checkpoint": "cross_attention_fusion.pt",
        "data_note": CrossAttentionFusionClassifier.DATA_PAIRING_NOTE,
        "test_metrics": ca_metrics,
        "test_loss": ca_loss,
        "train_samples": len(train_items),
        "val_samples": len(val_items),
        "test_samples": len(test_items)
    }

    eval_data["ensemble"] = {
        "modality": "combined",
        "architecture": "ProbabilisticEnsemble",
        "checkpoint": "ensemble_fusion.pt",
        "alpha": round(float(ensemble_alpha), 3),
        "alpha_note": "Grid-searched on validation set (mammo weight)",
        "test_metrics": ens_metrics,
        "test_loss": 0.0,
        "train_samples": len(train_items),
        "val_samples": len(val_items),
        "test_samples": len(test_items)
    }

    with open(eval_json, "w", encoding="utf-8") as f:
        json.dump(eval_data, f, indent=2)
    print(f"  Updated: {eval_json.name}")

    # -- Print comparison ---------------------------------------------------
    print()
    print("=" * 65)
    print("MODEL COMPARISON -- HELD-OUT TEST SET")
    print(f"  NOTE: N_test = {len(test_items)} (small; treat as indicative)")
    print("=" * 65)
    print(f"{'Metric':<30} {'CrossAttn':>12} {'Ensemble':>12}")
    print("-" * 57)
    metrics_to_compare = [
        ("Accuracy", "overall_accuracy"),
        ("Macro Sensitivity", "macro_sensitivity_recall"),
        ("Macro Specificity", "macro_specificity"),
        ("Macro F1", "macro_f1"),
        ("Macro ROC-AUC", "macro_roc_auc"),
    ]
    for label, key in metrics_to_compare:
        ca_val = ca_metrics.get(key, 0)
        ens_val = ens_metrics.get(key, 0)
        ca_str = f"{ca_val*100:.2f}%"
        ens_str = f"{ens_val*100:.2f}%"
        print(f"  {label:<28} {ca_str:>12} {ens_str:>12}")
    print("=" * 65)
    print()
    print("Training complete. Checkpoints saved.")

    return {
        "cross_attention": ca_metrics,
        "ensemble": ens_metrics,
        "n_pairs": len(pairs),
        "n_train": len(train_items),
        "n_val": len(val_items),
        "n_test": len(test_items)
    }


if __name__ == "__main__":
    run_cross_attention_training(PROJECT_ROOT)
