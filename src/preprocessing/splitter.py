"""Patient-level stratified train/validation/test splitter.
Ensures no patient (identified by patient_id) appears in more than one split,
preventing data leakage across views of the same individual.
"""

import csv
import random
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any, Tuple, Optional


def _assign_patient_label(records: List[Dict[str, Any]], label_key: str = "label") -> str:
    """Determines a single patient-level label from multiple image records.
    Uses the most severe diagnosis: malignant > benign > normal > unannotated.
    """
    severity_rank = {"malignant": 3, "benign": 2, "normal": 1, "unannotated": 0}
    best_label = "unannotated"
    best_rank = -1
    for r in records:
        lbl = r.get(label_key, "unannotated").lower()
        rank = severity_rank.get(lbl, 0)
        if rank > best_rank:
            best_rank = rank
            best_label = lbl
    return best_label


def patient_level_stratified_split(
    manifest_path: Path,
    output_dir: Path,
    patient_id_column: str = "patient_id",
    label_column: str = "label",
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_seed: int = 42,
    min_patients_per_class: int = 2
) -> Dict[str, Any]:
    """Splits a manifest CSV into train/val/test sets at the patient level.

    Algorithm:
        1. Group all image records by patient_id.
        2. Assign each patient a single label (most severe diagnosis).
        3. For each label class, shuffle patients and allocate to train/val/test
           proportionally (stratified).
        4. Write separate manifest CSVs for each split.
        5. Never split a patient's images across multiple sets.

    Args:
        manifest_path: Path to manifest CSV from Milestone 1.
        output_dir: Directory to write train/val/test manifest CSVs.
        patient_id_column: Column name for patient identifier.
        label_column: Column name for image-level label.
        train_ratio, val_ratio, test_ratio: Split proportions (must sum to 1.0).
        random_seed: Seed for reproducible splitting.
        min_patients_per_class: Minimum patients needed per class for stratification.

    Returns:
        Dict with split statistics and output file paths.
    """
    assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 1e-6, \
        f"Ratios must sum to 1.0, got {train_ratio + val_ratio + test_ratio}"

    manifest_path = Path(manifest_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Read manifest
    with open(manifest_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        all_records = list(reader)

    if not all_records:
        return {"error": "Empty manifest", "total_records": 0}

    # 2. Group by patient
    patient_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for rec in all_records:
        pid = rec.get(patient_id_column, "UNKNOWN")
        patient_groups[pid].append(rec)

    # 3. Assign patient-level labels
    patient_labels: Dict[str, str] = {}
    for pid, records in patient_groups.items():
        patient_labels[pid] = _assign_patient_label(records, label_column)

    # 4. Group patients by their label class
    class_patients: Dict[str, List[str]] = defaultdict(list)
    for pid, lbl in patient_labels.items():
        class_patients[lbl].append(pid)

    # 5. Stratified split within each class
    rng = random.Random(random_seed)
    train_pids, val_pids, test_pids = set(), set(), set()

    for cls_label, pids in sorted(class_patients.items()):
        rng.shuffle(pids)
        n = len(pids)
        n_train = max(1, round(n * train_ratio))
        n_val = max(1, round(n * val_ratio)) if n > 2 else 0
        n_test = n - n_train - n_val

        # Guard: ensure test has at least 1 if enough patients
        if n_test < 1 and n > 2:
            n_test = 1
            n_train = n - n_val - n_test

        train_pids.update(pids[:n_train])
        val_pids.update(pids[n_train:n_train + n_val])
        test_pids.update(pids[n_train + n_val:])

    # 6. Assign records to splits and add split column
    def assign_split(records, split_name, fieldnames_out):
        out = []
        for r in records:
            row = dict(r)
            row["split"] = split_name
            out.append(row)
        return out

    if fieldnames and "split" not in fieldnames:
        fieldnames_out = list(fieldnames) + ["split"]
    else:
        fieldnames_out = list(fieldnames)

    train_records, val_records, test_records = [], [], []
    for pid, records in patient_groups.items():
        if pid in train_pids:
            train_records.extend(assign_split(records, "train", fieldnames_out))
        elif pid in val_pids:
            val_records.extend(assign_split(records, "val", fieldnames_out))
        elif pid in test_pids:
            test_records.extend(assign_split(records, "test", fieldnames_out))

    # 7. Write split manifests
    stem = manifest_path.stem  # e.g., "mammogram_manifest"
    paths = {}
    for split_name, split_records in [("train", train_records), ("val", val_records), ("test", test_records)]:
        out_path = output_dir / f"{stem}_{split_name}.csv"
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames_out)
            writer.writeheader()
            writer.writerows(split_records)
        paths[split_name] = str(out_path)

    # 8. Compute statistics
    from collections import Counter
    train_labels = Counter(r[label_column] for r in train_records)
    val_labels = Counter(r[label_column] for r in val_records)
    test_labels = Counter(r[label_column] for r in test_records)

    report = {
        "manifest_source": str(manifest_path),
        "random_seed": random_seed,
        "ratios": {"train": train_ratio, "val": val_ratio, "test": test_ratio},
        "total_patients": len(patient_groups),
        "total_images": len(all_records),
        "splits": {
            "train": {
                "patients": len(train_pids),
                "images": len(train_records),
                "label_distribution": dict(train_labels),
                "output_path": paths.get("train")
            },
            "val": {
                "patients": len(val_pids),
                "images": len(val_records),
                "label_distribution": dict(val_labels),
                "output_path": paths.get("val")
            },
            "test": {
                "patients": len(test_pids),
                "images": len(test_records),
                "label_distribution": dict(test_labels),
                "output_path": paths.get("test")
            }
        },
        "patient_class_distribution": {cls: len(pids) for cls, pids in class_patients.items()},
        "leakage_check": {
            "train_val_overlap": len(train_pids & val_pids),
            "train_test_overlap": len(train_pids & test_pids),
            "val_test_overlap": len(val_pids & test_pids),
            "all_clean": len(train_pids & val_pids) == 0 and len(train_pids & test_pids) == 0 and len(val_pids & test_pids) == 0
        }
    }

    return report

