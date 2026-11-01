"""Creates patient-level stratified train/val/test splits for both Mammography and Thermography datasets.
Prevents patient-level data leakage across views.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.preprocessing.splitter import patient_level_stratified_split
MANIFESTS_DIR = PROJECT_ROOT / "data" / "manifests"


def run_split_pipeline():
    print("=" * 60)
    print("PHASE 4: PATIENT-LEVEL STRATIFIED DATASET SPLITS")
    print("=" * 60)

    # 1. Thermal Split (DMR-IR + Mendeley)
    thermal_manifest = MANIFESTS_DIR / "thermal_manifest.csv"
    print(f"\nSplitting Thermal Dataset from: {thermal_manifest}")
    thermal_res = patient_level_stratified_split(
        manifest_path=thermal_manifest,
        output_dir=MANIFESTS_DIR,
        patient_id_column="patient_id",
        label_column="label",
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        random_seed=42
    )
    print(f"Thermal Split Results:")
    print(f"  Train: {thermal_res['train_images']} images ({thermal_res['train_patients']} patients)")
    print(f"  Val:   {thermal_res['val_images']} images ({thermal_res['val_patients']} patients)")
    print(f"  Test:  {thermal_res['test_images']} images ({thermal_res['test_patients']} patients)")
    print(f"  Patient Leakage: {thermal_res.get('patient_leakage', False)}")

    # Rename to standard thermal_manifest_train/val/test.csv
    # Note: patient_level_stratified_split outputs: <stem>_train.csv, <stem>_val.csv, <stem>_test.csv
    print(f"  Outputs: {thermal_res['train_file']}, {thermal_res['val_file']}, {thermal_res['test_file']}")

    # 2. Mammogram Split (MIAS)
    mammo_manifest = MANIFESTS_DIR / "mammogram_manifest.csv"
    print(f"\nSplitting Mammogram Dataset from: {mammo_manifest}")
    mammo_res = patient_level_stratified_split(
        manifest_path=mammo_manifest,
        output_dir=MANIFESTS_DIR,
        patient_id_column="patient_id",
        label_column="label",
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        random_seed=42
    )
    print(f"Mammogram Split Results:")
    print(f"  Train: {mammo_res['train_images']} images ({mammo_res['train_patients']} patients)")
    print(f"  Val:   {mammo_res['val_images']} images ({mammo_res['val_patients']} patients)")
    print(f"  Test:  {mammo_res['test_images']} images ({mammo_res['test_patients']} patients)")
    print(f"  Patient Leakage: {mammo_res.get('patient_leakage', False)}")

    return thermal_res, mammo_res


if __name__ == "__main__":
    run_split_pipeline()
