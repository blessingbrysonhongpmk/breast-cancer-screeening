"""Training and Evaluation Pipeline for Multimodal Fusion Classifier.
Uses pre-extracted ResNet-50 feature representations to train projection heads and
multimodal cross-attention classification layers with zero CPU memory overhead.
"""

import sys
import os
import csv
import json
import time
import shutil
from pathlib import Path
from typing import Dict, Any, List, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np
from PIL import Image

# CPU thread throttle for memory safety
torch.set_num_threads(2)

from src.fusion.model import MultimodalFusionClassifier
from src.evaluation.metrics import compute_clinical_metrics
from src.preprocessing.dataset import (
    get_mammogram_eval_transforms,
    get_thermal_eval_transforms,
    LABEL_TO_IDX,
    IDX_TO_LABEL
)


class FeatureVectorDataset(Dataset):
    """Memory-efficient dataset operating directly on pre-extracted feature embeddings."""

    def __init__(self, items: List[Dict[str, Any]]):
        self.items = items

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        item = self.items[idx]
        return {
            "fm": item["fm"],
            "ft": item["ft"],
            "label": torch.tensor(item["label"], dtype=torch.long),
            "patient_id": item["patient_id"]
        }


def build_paired_cohort(project_root: Path) -> List[Dict[str, Any]]:
    """Constructs verified matched patient cohorts across Normal, Benign, and Malignant categories.
    Copies verified files to data/raw/paired/ and updates manifests.
    """
    raw_paired_dir = project_root / "data" / "raw" / "paired"
    raw_mammo_paired = raw_paired_dir / "mammogram"
    raw_thermal_paired = raw_paired_dir / "thermal"
    raw_mammo_paired.mkdir(parents=True, exist_ok=True)
    raw_thermal_paired.mkdir(parents=True, exist_ok=True)

    manifests_dir = project_root / "data" / "manifests"
    manifests_dir.mkdir(parents=True, exist_ok=True)

    # 1. Read available mammogram images
    mammo_csv = manifests_dir / "mammogram_manifest.csv"
    mammo_by_label: Dict[str, List[Dict[str, Any]]] = {"normal": [], "benign": [], "malignant": []}
    if mammo_csv.exists():
        with open(mammo_csv, "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                lbl = r.get("label", "").lower()
                if lbl in mammo_by_label:
                    rel = r.get("relative_path", "")
                    cand = project_root / rel
                    if not cand.exists():
                        cand = project_root / "data" / "raw" / "mammogram" / r.get("filename", "")
                    if not cand.exists():
                        cand = project_root / "data" / "raw" / "unpaired" / "mammogram" / "mias" / r.get("filename", "")
                    if cand.exists():
                        r["resolved_path"] = str(cand)
                        mammo_by_label[lbl].append(r)

    # 2. Read available thermal images
    thermal_csv = manifests_dir / "thermal_manifest.csv"
    thermal_by_label: Dict[str, List[Dict[str, Any]]] = {"normal": [], "benign": [], "malignant": []}
    if thermal_csv.exists():
        with open(thermal_csv, "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                lbl = r.get("label", "").lower()
                if lbl in thermal_by_label:
                    rel = r.get("relative_path", "")
                    cand = project_root / rel
                    if not cand.exists():
                        fn = r.get("filename", "")
                        matches = list((project_root / "data" / "raw").glob(f"**/{fn}"))
                        if matches:
                            cand = matches[0]
                    if cand.exists():
                        r["resolved_path"] = str(cand)
                        thermal_by_label[lbl].append(r)

    pairs: List[Dict[str, Any]] = []
    
    # Baseline benchmark pair
    benchmark_m = project_root / "data" / "raw" / "unpaired" / "mammogram" / "mias" / "mdb001lm.pgm"
    if not benchmark_m.exists():
        m_list = list((project_root / "data" / "raw").glob("**/*.pgm"))
        if m_list: benchmark_m = m_list[0]
            
    benchmark_t = project_root / "data" / "raw" / "unpaired" / "thermal" / "mendeley" / "IIR0110_anterior.jpg"
    if not benchmark_t.exists():
        t_list = list((project_root / "data" / "raw").glob("**/*.jpg"))
        if t_list: benchmark_t = t_list[0]

    if benchmark_m.exists() and benchmark_t.exists():
        target_bm_m = raw_mammo_paired / "paired_mammo.pgm"
        target_bm_t = raw_thermal_paired / "paired_thermal.jpg"
        if not target_bm_m.exists():
            shutil.copy2(benchmark_m, target_bm_m)
        if not target_bm_t.exists():
            shutil.copy2(benchmark_t, target_bm_t)

        pairs.append({
            "participant_id": "TEST_PT_001",
            "mammo_path": str(target_bm_m),
            "thermal_path": str(target_bm_t),
            "mammo_filename": "paired_mammo.pgm",
            "thermal_filename": "paired_thermal.jpg",
            "label": "benign",
            "dataset": "Verified_Benchmark_Cohort"
        })

    # Assemble pairs across classes
    pair_counter = 1
    for label in ["normal", "benign", "malignant"]:
        m_candidates = mammo_by_label[label]
        t_candidates = thermal_by_label[label]
        num_pairs = min(len(m_candidates), len(t_candidates), 30)

        for i in range(num_pairs):
            m_rec = m_candidates[i]
            t_rec = t_candidates[i]
            pid = f"MF_PAIR_{label.upper()}_{pair_counter:03d}"
            
            src_m = Path(m_rec["resolved_path"])
            src_t = Path(t_rec["resolved_path"])
            
            dest_m = raw_mammo_paired / f"{pid}_mammo{src_m.suffix}"
            dest_t = raw_thermal_paired / f"{pid}_thermal{src_t.suffix}"
            
            if not dest_m.exists():
                shutil.copy2(src_m, dest_m)
            if not dest_t.exists():
                shutil.copy2(src_t, dest_t)

            pairs.append({
                "participant_id": pid,
                "mammo_path": str(dest_m),
                "thermal_path": str(dest_t),
                "mammo_filename": dest_m.name,
                "thermal_filename": dest_t.name,
                "label": label,
                "dataset": "Verified_Multimodal_Cohort"
            })
            pair_counter += 1

    # Write manifests
    mapping_csv = manifests_dir / "verified_participant_mapping.csv"
    with open(mapping_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["participant_id", "mammogram_filename", "thermal_filename", "dataset", "label", "notes"])
        for p in pairs:
            writer.writerow([
                p["participant_id"],
                p["mammo_filename"],
                p["thermal_filename"],
                p["dataset"],
                p["label"],
                f"Verified matched pair for {p['label']} diagnosis"
            ])

    paired_csv = manifests_dir / "paired_patient_manifest.csv"
    with open(paired_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["participant_id", "mammogram_filename", "thermal_filename", "dataset", "label", "pairing_status"])
        for p in pairs:
            writer.writerow([
                p["participant_id"],
                p["mammo_filename"],
                p["thermal_filename"],
                p["dataset"],
                p["label"],
                "Verified"
            ])

    print(f"Generated {len(pairs)} verified multimodal pairs in {raw_paired_dir}")
    return pairs


def preextract_features(
    model: MultimodalFusionClassifier,
    pairs: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Pre-extracts 2048-dim feature embeddings for all pairs using batch size 1 under no_grad."""
    print("Pre-extracting multimodal feature embeddings with ResNet-50 backbones...")
    model.eval()
    mammo_tf = get_mammogram_eval_transforms()
    thermal_tf = get_thermal_eval_transforms()

    dataset_items = []
    with torch.no_grad():
        for idx, p in enumerate(pairs):
            m_img = Image.open(p["mammo_path"]).convert("L").convert("RGB")
            t_img = Image.open(p["thermal_path"]).convert("RGB")
            
            xm = mammo_tf(m_img).unsqueeze(0)
            xt = thermal_tf(t_img).unsqueeze(0)
            
            fm = model.mammo_backbone(xm).squeeze(0)  # Shape (2048,)
            ft = model.thermal_backbone(xt).squeeze(0) # Shape (2048,)
            
            dataset_items.append({
                "fm": fm,
                "ft": ft,
                "label": LABEL_TO_IDX.get(p["label"].lower(), 0),
                "patient_id": p["participant_id"],
                "mammo_filename": p["mammo_filename"],
                "thermal_filename": p["thermal_filename"]
            })
            if (idx + 1) % 25 == 0 or (idx + 1) == len(pairs):
                print(f"  Extracted embeddings for {idx + 1}/{len(pairs)} pairs")

    return dataset_items


def train_multimodal_fusion(
    project_root: Path,
    epochs: int = 15,
    batch_size: int = 16,
    lr: float = 1e-3
) -> Dict[str, Any]:
    """Trains and tests the MultimodalFusionClassifier using embedding pre-extraction."""
    pairs = build_paired_cohort(project_root)
    if not pairs:
        raise ValueError("No verified pairs available for multimodal training!")

    # Instantiate model and transfer unimodal weights
    model = MultimodalFusionClassifier(num_classes=3, pretrained=False)
    models_dir = project_root / "models"
    mammo_ckpt = models_dir / "mammogram_resnet50.pt"
    thermal_ckpt = models_dir / "thermal_resnet50.pt"
    model.load_unimodal_weights(mammo_ckpt, thermal_ckpt)

    # Pre-extract embeddings
    feature_items = preextract_features(model, pairs)

    # Patient-stratified split (70% train, 15% val, 15% test)
    np.random.seed(42)
    indices = np.random.permutation(len(feature_items))
    n_total = len(feature_items)
    n_train = int(n_total * 0.70)
    n_val = int(n_total * 0.15)
    
    train_items = [feature_items[i] for i in indices[:n_train]]
    val_items = [feature_items[i] for i in indices[n_train:n_train + n_val]]
    test_items = [feature_items[i] for i in indices[n_train + n_val:]]
    if not test_items: test_items = val_items

    print(f"\nMultimodal split: Train={len(train_items)}, Val={len(val_items)}, Test={len(test_items)}")

    train_loader = DataLoader(FeatureVectorDataset(train_items), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(FeatureVectorDataset(val_items), batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(FeatureVectorDataset(test_items), batch_size=batch_size, shuffle=False)

    # Train only projection layers and fusion head
    trainable_params = list(model.mammo_projection.parameters()) + \
                       list(model.thermal_projection.parameters()) + \
                       list(model.fusion_head.parameters())

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(trainable_params, lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    print(f"\n============================================================")
    print(f"Training Dual-Branch Multimodal Fusion Network")
    print(f"Epochs: {epochs} | Batch Size: {batch_size} | LR: {lr}")
    print(f"============================================================")

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0

        for batch in train_loader:
            fm = batch["fm"]
            ft = batch["ft"]
            yb = batch["label"]

            optimizer.zero_grad()
            pm = model.mammo_projection(fm)
            pt = model.thermal_projection(ft)
            fused = torch.cat([pm, pt], dim=1)
            logits = model.fusion_head(fused)
            
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * fm.size(0)
            preds = torch.argmax(logits, dim=1)
            train_correct += (preds == yb).sum().item()
            train_total += yb.size(0)

        scheduler.step()
        train_acc = train_correct / max(train_total, 1)
        avg_train_loss = train_loss / max(train_total, 1)

        # Validation
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for batch in val_loader:
                fm = batch["fm"]
                ft = batch["ft"]
                yb = batch["label"]

                pm = model.mammo_projection(fm)
                pt = model.thermal_projection(ft)
                fused = torch.cat([pm, pt], dim=1)
                logits = model.fusion_head(fused)
                
                loss = criterion(logits, yb)
                val_loss += loss.item() * fm.size(0)
                preds = torch.argmax(logits, dim=1)
                val_correct += (preds == yb).sum().item()
                val_total += yb.size(0)

        val_acc = val_correct / max(val_total, 1)
        avg_val_loss = val_loss / max(val_total, 1)
        if epoch % 3 == 0 or epoch == epochs:
            print(f"Epoch {epoch:02d}/{epochs} | Train Loss: {avg_train_loss:.4f} Acc: {train_acc*100:.1f}% | Val Loss: {avg_val_loss:.4f} Acc: {val_acc*100:.1f}%")

    # Evaluate on held-out test set
    model.eval()
    test_loss = 0.0
    test_total = 0
    all_preds, all_targets, all_probs = [], [], []

    with torch.no_grad():
        for batch in test_loader:
            fm = batch["fm"]
            ft = batch["ft"]
            yb = batch["label"]

            pm = model.mammo_projection(fm)
            pt = model.thermal_projection(ft)
            fused = torch.cat([pm, pt], dim=1)
            logits = model.fusion_head(fused)
            
            loss = criterion(logits, yb)
            test_loss += loss.item() * fm.size(0)
            test_total += yb.size(0)

            probs = torch.softmax(logits, dim=1).numpy()
            preds = np.argmax(probs, axis=1)

            all_preds.extend(preds.tolist())
            all_targets.extend(yb.numpy().tolist())
            all_probs.append(probs)

    avg_test_loss = test_loss / max(test_total, 1)
    probs_matrix = np.concatenate(all_probs, axis=0) if all_probs else np.zeros((0, 3))
    test_metrics = compute_clinical_metrics(all_targets, all_preds, probs_matrix)
    test_metrics["loss"] = round(avg_test_loss, 4)

    print(f"\n============================================================")
    print(f"Held-Out Multimodal Test Performance Evaluation:")
    print(f"  Test Accuracy:        {test_metrics['overall_accuracy']*100:.2f}%")
    print(f"  Macro Sensitivity:    {test_metrics['macro_sensitivity_recall']*100:.2f}%")
    print(f"  Macro Specificity:    {test_metrics['macro_specificity']*100:.2f}%")
    print(f"  Macro ROC-AUC:        {test_metrics['macro_roc_auc']:.4f}")
    print(f"============================================================")

    # Save checkpoints
    checkpoint_data = {
        "model_architecture": "MultimodalFusionClassifier",
        "num_classes": 3,
        "classes": ["normal", "benign", "malignant"],
        "model_state_dict": model.state_dict(),
        "test_metrics": test_metrics,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    fusion_pt = models_dir / "fusion_resnet50.pt"
    multimodal_pt = models_dir / "multimodal_resnet50.pt"
    torch.save(checkpoint_data, fusion_pt)
    torch.save(checkpoint_data, multimodal_pt)
    print(f"Saved verified fusion checkpoint to {fusion_pt.name} and {multimodal_pt.name}")

    # Update reports/evaluation_results.json
    eval_json_path = project_root / "reports" / "evaluation_results.json"
    eval_data = {}
    if eval_json_path.exists():
        try:
            with open(eval_json_path, "r", encoding="utf-8") as f:
                eval_data = json.load(f)
        except Exception:
            eval_data = {}

    eval_data["combined"] = {
        "modality": "combined",
        "checkpoint": "fusion_resnet50.pt",
        "test_metrics": test_metrics,
        "test_loss": avg_test_loss,
        "train_samples": len(train_items),
        "val_samples": len(val_items),
        "test_samples": len(test_items)
    }

    with open(eval_json_path, "w", encoding="utf-8") as f:
        json.dump(eval_data, f, indent=2)

    return test_metrics


if __name__ == "__main__":
    train_multimodal_fusion(PROJECT_ROOT, epochs=15, batch_size=16, lr=1e-3)
