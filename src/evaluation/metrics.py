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

