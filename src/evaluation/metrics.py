"""Clinical Evaluation Metrics for Multiclass Oncology Triage (Normal, Benign, Malignant).
Computes Sensitivity (Recall), Specificity, Precision, F1-Score, and ROC-AUC
strictly adhering to clinical biostatistical standards.
"""

import numpy as np
from sklearn.metrics import confusion_matrix, classification_report, roc_auc_score, f1_score, precision_score, recall_score
from typing import Dict, Any, List


def compute_clinical_metrics(y_true: List[int], y_pred: List[int], y_prob: np.ndarray) -> Dict[str, Any]:
    """Computes comprehensive multiclass & per-class clinical metrics.

    Classes: 0: Normal, 1: Benign, 2: Malignant
    """
    y_true_arr = np.array(y_true)
    y_pred_arr = np.array(y_pred)
    classes = [0, 1, 2]
    class_names = ["normal", "benign", "malignant"]

    # Confusion matrix
    cm = confusion_matrix(y_true_arr, y_pred_arr, labels=classes)

    # Per-class metrics
    per_class = {}
    for i, name in enumerate(class_names):
        tp = cm[i, i]
        fn = cm[i, :].sum() - tp
        fp = cm[:, i].sum() - tp
        tn = cm.sum() - (tp + fn + fp)

        sensitivity = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
        precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        f1 = float(2 * (precision * sensitivity) / (precision + sensitivity)) if (precision + sensitivity) > 0 else 0.0

        per_class[name] = {
            "tp": int(tp),
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "sensitivity_recall": round(sensitivity, 4),
            "specificity": round(specificity, 4),
            "precision": round(precision, 4),
            "f1_score": round(f1, 4),
        }

    # Macro & Weighted metrics
    macro_f1 = float(f1_score(y_true_arr, y_pred_arr, average="macro", zero_division=0))
    macro_precision = float(precision_score(y_true_arr, y_pred_arr, average="macro", zero_division=0))
    macro_recall = float(recall_score(y_true_arr, y_pred_arr, average="macro", zero_division=0))

    # ROC-AUC (one-vs-rest)
    try:
        if y_prob.shape[1] == 3 and len(np.unique(y_true_arr)) > 1:
            roc_auc = float(roc_auc_score(y_true_arr, y_prob, multi_class="ovr", average="macro"))
        else:
            roc_auc = 0.0
    except Exception:
        roc_auc = 0.0

    overall_accuracy = float(np.mean(y_true_arr == y_pred_arr))

    return {
        "overall_accuracy": round(overall_accuracy, 4),
        "macro_sensitivity_recall": round(macro_recall, 4),
        "macro_specificity": round(float(np.mean([m["specificity"] for m in per_class.values()])), 4),
        "macro_precision": round(macro_precision, 4),
        "macro_f1": round(macro_f1, 4),
        "macro_roc_auc": round(roc_auc, 4),
        "per_class": per_class,
        "confusion_matrix": cm.tolist()
    }


def compute_prediction_uncertainty(probabilities: np.ndarray) -> Dict[str, float]:
    """Computes Shannon predictive entropy and normalized uncertainty metrics.

    Args:
        probabilities: 1D array of class probabilities summing to 1.0.

    Returns:
        dict with:
            - entropy: Shannon entropy H(p) = -sum(p * ln(p))
            - uncertainty_score: Normalized entropy in [0.0, 1.0] relative to uniform distribution
            - confidence_margin: Difference between highest and second-highest class probability
    """
    eps = 1e-12
    p = np.clip(np.asarray(probabilities, dtype=float), eps, 1.0)
    p = p / np.sum(p)
    entropy = -float(np.sum(p * np.log(p)))
    max_entropy = float(np.log(len(p))) if len(p) > 1 else 1.0
    normalized_uncertainty = float(entropy / max_entropy) if max_entropy > 0 else 0.0
    sorted_p = np.sort(p)[::-1]
    margin = float(sorted_p[0] - sorted_p[1]) if len(sorted_p) > 1 else float(sorted_p[0])

    return {
        "entropy": round(entropy, 4),
        "uncertainty_score": round(normalized_uncertainty, 4),
        "confidence_margin": round(margin, 4)
    }


def predict_with_tta(model, input_tensor):
    """Executes Test-Time Augmentation (TTA) via horizontal flip ensemble averaging.

    Args:
        model: PyTorch classifier module in eval mode.
        input_tensor: 4D tensor (1, C, H, W).

    Returns:
        torch.Tensor of averaged logits (1, num_classes).
    """
    import torch
    with torch.no_grad():
        logits_orig = model(input_tensor)
        flipped = torch.flip(input_tensor, dims=[3])
        logits_flipped = model(flipped)
        return (logits_orig + logits_flipped) / 2.0


