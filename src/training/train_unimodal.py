"""Training and Evaluation Pipeline for Unimodal Oncological Triage Models.
Trains ResNet-50 classifiers on patient-stratified splits for Mammography and Thermography.
Evaluates final checkpoints on held-out test sets with clinical metrics.
"""

import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, Any, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import numpy as np

# Prevent CPU memory overload on host
torch.set_num_threads(2)

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from src.preprocessing.dataset import (
    MammogramDataset,
    ThermalDataset,
    get_mammogram_train_transforms,
    get_mammogram_eval_transforms,
    get_thermal_train_transforms,
    get_thermal_eval_transforms,
    LABEL_TO_IDX
)
from src.mammogram.model import MammogramClassifier
from src.thermal.model import ThermalClassifier
from src.evaluation.metrics import compute_clinical_metrics


def train_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device
) -> Tuple[float, float]:
    """Runs a single training epoch."""
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for batch in loader:
        images = batch["image"].to(device)
        labels = batch["label"].to(device)

        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * images.size(0)
        preds = torch.argmax(logits, dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    epoch_loss = total_loss / max(total, 1)
    epoch_acc = correct / max(total, 1)
    return epoch_loss, epoch_acc


def evaluate_dataset(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device
) -> Tuple[float, Dict[str, Any]]:
    """Evaluates model on validation or test split and computes clinical metrics."""
    model.eval()
    criterion = nn.CrossEntropyLoss()
    total_loss = 0.0
    total = 0

    all_preds = []
    all_targets = []
    all_probs = []

    with torch.no_grad():
        for batch in loader:
            images = batch["image"].to(device)
            labels = batch["label"].to(device)

            logits = model(images)
            loss = criterion(logits, labels)
            total_loss += loss.item() * images.size(0)
            total += labels.size(0)

            probs = torch.softmax(logits, dim=1).cpu().numpy()
            preds = np.argmax(probs, axis=1)

            all_preds.extend(preds.tolist())
            all_targets.extend(labels.cpu().numpy().tolist())
            all_probs.append(probs)

    eval_loss = total_loss / max(total, 1)
    probs_matrix = np.concatenate(all_probs, axis=0) if all_probs else np.zeros((0, 3))
    metrics = compute_clinical_metrics(all_targets, all_preds, probs_matrix)
    metrics["loss"] = round(eval_loss, 4)
    return eval_loss, metrics


def train_modality(
    modality: str,
    project_root: Path,
    epochs: int = 5,
    batch_size: int = 16,
    learning_rate: float = 1e-4,
    device_name: str = "cpu"
) -> Dict[str, Any]:
    """Trains and tests a deep CNN for the specified modality."""
    manifests_dir = project_root / "data" / "manifests"
    raw_dir = project_root / "data" / "raw"
    models_dir = project_root / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    device = torch.device(device_name if torch.cuda.is_available() and device_name != "cpu" else "cpu")
    print(f"\n============================================================")
    print(f"Training Deep Learning Architecture for: {modality.upper()}")
    print(f"Device: {device} | Epochs: {epochs} | Batch Size: {batch_size}")
    print(f"============================================================")

    # Prepare datasets & transforms
    processed_dir = project_root / "data" / "processed"
    if modality == "mammogram":
        train_manifest = manifests_dir / "mammogram_manifest_train.csv"
        val_manifest = manifests_dir / "mammogram_manifest_val.csv"
        test_manifest = manifests_dir / "mammogram_manifest_test.csv"
        image_root = processed_dir / "mammogram" if (processed_dir / "mammogram").exists() else raw_dir / "mammogram"

        train_ds = MammogramDataset(train_manifest, image_root, transform=get_mammogram_train_transforms())
        val_ds = MammogramDataset(val_manifest, image_root, transform=get_mammogram_eval_transforms())
        test_ds = MammogramDataset(test_manifest, image_root, transform=get_mammogram_eval_transforms())

        model = MammogramClassifier(num_classes=3, pretrained=False).to(device)
        model_save_path = models_dir / "mammogram_resnet50.pt"
        if model_save_path.exists():
            try:
                ckpt = torch.load(model_save_path, map_location=device)
                model.load_state_dict(ckpt["model_state_dict"], strict=False)
                print(f"Loaded existing checkpoint from {model_save_path.name} for transfer fine-tuning.", flush=True)
            except Exception as ex:
                print(f"Initializing weights: {ex}", flush=True)

    elif modality == "thermal":
        train_manifest = manifests_dir / "thermal_manifest_train.csv"
        val_manifest = manifests_dir / "thermal_manifest_val.csv"
        test_manifest = manifests_dir / "thermal_manifest_test.csv"
        image_root = processed_dir / "thermal" if (processed_dir / "thermal").exists() else raw_dir / "thermal"

        train_ds = ThermalDataset(train_manifest, image_root, transform=get_thermal_train_transforms())
        val_ds = ThermalDataset(val_manifest, image_root, transform=get_thermal_eval_transforms())
        test_ds = ThermalDataset(test_manifest, image_root, transform=get_thermal_eval_transforms())

        model = ThermalClassifier(num_classes=3, pretrained=False).to(device)
        model_save_path = models_dir / "thermal_resnet50.pt"
        if model_save_path.exists():
            try:
                ckpt = torch.load(model_save_path, map_location=device)
                model.load_state_dict(ckpt["model_state_dict"], strict=False)
                print(f"Loaded existing checkpoint from {model_save_path.name} for transfer fine-tuning.", flush=True)
            except Exception as ex:
                print(f"Initializing weights: {ex}", flush=True)
    else:
        raise ValueError(f"Unknown modality: {modality}")

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, drop_last=False)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    print(f"Dataset Partitions: Train={len(train_ds)}, Val={len(val_ds)}, Test={len(test_ds)}", flush=True)

    # Class weighting to handle imbalance
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-3)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_loss = float("inf")
    best_weights = None

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_metrics = evaluate_dataset(model, val_loader, device)
        scheduler.step()
        elapsed = time.time() - t0

        print(f"Epoch [{epoch:02d}/{epochs:02d}] ({elapsed:.1f}s) | "
              f"Train Loss: {train_loss:.4f}, Acc: {train_acc*100:.1f}% | "
              f"Val Loss: {val_loss:.4f}, Macro-F1: {val_metrics['macro_f1']:.4f}, "
              f"Acc: {val_metrics['overall_accuracy']*100:.1f}%", flush=True)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_weights = {k: v.cpu() for k, v in model.state_dict().items()}

    # Save best checkpoint
    if best_weights is not None:
        model.load_state_dict(best_weights)
        torch.save({
            "model_state_dict": best_weights,
            "architecture": "ResNet-50",
            "modality": modality,
            "num_classes": 3,
            "classes": ["normal", "benign", "malignant"],
            "best_val_loss": best_val_loss,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }, model_save_path)
        print(f"Saved optimized model weights to: {model_save_path.name}", flush=True)

    # Evaluate on held-out test split
    print(f"Running final evaluation on held-out Test split ({len(test_ds)} images)...", flush=True)
    test_loss, test_metrics = evaluate_dataset(model, test_loader, device)

    print(f"Test Benchmark Results for {modality.upper()}:", flush=True)
    print(f"  Accuracy:    {test_metrics['overall_accuracy']*100:.2f}%", flush=True)
    print(f"  Macro-F1:    {test_metrics['macro_f1']:.4f}", flush=True)
    print(f"  Sensitivity: {test_metrics['macro_sensitivity_recall']:.4f}", flush=True)
    print(f"  Specificity: {test_metrics['macro_specificity']:.4f}", flush=True)
    print(f"  ROC-AUC:     {test_metrics['macro_roc_auc']:.4f}", flush=True)

    return {
        "modality": modality,
        "checkpoint": str(model_save_path.name),
        "test_metrics": test_metrics,
        "test_loss": test_loss,
        "train_samples": len(train_ds),
        "val_samples": len(val_ds),
        "test_samples": len(test_ds)
    }


def main():
    parser = argparse.ArgumentParser(description="Train Unimodal ResNet-50 Models")
    parser.add_argument("--epochs", type=int, default=1, help="Number of epochs (default: 1)")
    parser.add_argument("--batch-size", type=int, default=8, help="Batch size (default: 8)")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate (default: 1e-4)")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent.parent
    reports_dir = project_root / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    results = {}
    for modality in ["mammogram", "thermal"]:
        res = train_modality(
            modality=modality,
            project_root=project_root,
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.lr
        )
        results[modality] = res

    # Save comprehensive evaluation report
    eval_file = reports_dir / "evaluation_results.json"
    with open(eval_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\n============================================================")
    print(f"All Unimodal Deep Learning Models Trained & Evaluated!")
    print(f"Report saved to: {eval_file}")
    print(f"============================================================")


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        import traceback
        traceback.print_exc()
        sys.exit(1)
