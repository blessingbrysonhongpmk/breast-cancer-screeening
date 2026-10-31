"""Master preprocessing pipeline.
Orchestrates image preprocessing, patient-level splitting, and preprocessed dataset creation.
"""

import os
import sys
import csv
import json
import time
import argparse
from pathlib import Path
from typing import Dict, Any, Optional

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from src.preprocessing.transforms import (
    preprocess_mammogram,
    preprocess_thermal,
    save_preprocessed_image,
)
from src.preprocessing.splitter import patient_level_stratified_split


def preprocess_images_from_manifest(
    manifest_csv: Path,
    raw_image_root: Path,
    output_dir: Path,
    modality: str,
    target_size: int = 224,
    apply_clahe: bool = True,
    dry_run: bool = False
) -> Dict[str, Any]:
    """Reads a manifest CSV, preprocesses each valid image, saves to output_dir as PNG.

    Args:
        manifest_csv: Path to raw manifest CSV.
        raw_image_root: Root dir containing the raw images referenced in manifest.
        output_dir: Destination for preprocessed PNG files.
        modality: 'mammogram' or 'thermal'.
        target_size: Square target dimension (e.g. 224).
        apply_clahe: Whether to apply CLAHE to mammograms.
        dry_run: If True, simulate without writing files.

    Returns:
        Summary dict with counts and any errors.
    """
    manifest_csv = Path(manifest_csv)
    raw_image_root = Path(raw_image_root)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(manifest_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        records = list(reader)

    report = {
        "modality": modality,
        "source_manifest": str(manifest_csv),
        "output_dir": str(output_dir),
        "target_size": target_size,
        "total_source_images": len(records),
        "preprocessed_count": 0,
        "skipped_unannotated": 0,
        "skipped_corrupt": 0,
        "already_existed": 0,
        "errors": [],
        "dry_run": dry_run
    }

    for rec in records:
        rel_path = rec.get("relative_path", "")
        label = rec.get("label", "unannotated").lower()
        validation = rec.get("validation_status", "valid")

        if validation != "valid":
            report["skipped_corrupt"] += 1
            continue

        src_path = raw_image_root / rel_path
        # Output preserves filename stem, changes extension to .png
        out_filename = Path(rel_path).stem + ".png"
        dest_path = output_dir / out_filename

        if dest_path.exists():
            report["already_existed"] += 1
            report["preprocessed_count"] += 1
            continue

        if dry_run:
            report["preprocessed_count"] += 1
            continue

        try:
            if modality == "mammogram":
                result = preprocess_mammogram(
                    src_path,
                    target_size=(target_size, target_size),
                    apply_clahe_enhancement=apply_clahe
                )
            elif modality == "thermal":
                result = preprocess_thermal(
                    src_path,
                    target_size=(target_size, target_size)
                )
            else:
                report["errors"].append(f"Unknown modality: {modality}")
                continue

            if result is None:
                report["skipped_corrupt"] += 1
                report["errors"].append(f"Failed to load: {rel_path}")
                continue

            saved = save_preprocessed_image(result["image"], dest_path)
            if saved:
                report["preprocessed_count"] += 1
            else:
                report["errors"].append(f"Failed to save: {dest_path}")
        except Exception as e:
            report["errors"].append(f"Error processing {rel_path}: {e}")

    return report


def create_preprocessed_manifest(
    original_manifest: Path,
    preprocessed_dir: Path,
    output_manifest: Path
) -> int:
    """Creates an updated manifest pointing to preprocessed PNG files.

    Returns:
        Number of records written.
    """
    original_manifest = Path(original_manifest)
    preprocessed_dir = Path(preprocessed_dir)
    output_manifest = Path(output_manifest)
    output_manifest.parent.mkdir(parents=True, exist_ok=True)

    with open(original_manifest, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        records = list(reader)

    # Add preprocessed_path column
    out_fieldnames = list(fieldnames) + ["preprocessed_path", "preprocessed_size_bytes"]

    count = 0
    out_records = []
    for rec in records:
        rel_path = rec.get("relative_path", "")
        png_filename = Path(rel_path).stem + ".png"
        preprocessed_file = preprocessed_dir / png_filename

        row = dict(rec)
        if preprocessed_file.exists():
            row["preprocessed_path"] = str(preprocessed_file.relative_to(preprocessed_dir.parent.parent)).replace("\\", "/")
            row["preprocessed_size_bytes"] = str(preprocessed_file.stat().st_size)
            count += 1
        else:
            row["preprocessed_path"] = ""
            row["preprocessed_size_bytes"] = "0"
        out_records.append(row)

    with open(output_manifest, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=out_fieldnames)
        writer.writeheader()
        writer.writerows(out_records)

    return count


def run_preprocessing_pipeline(
    workspace_root: Path,
    target_size: int = 224,
    apply_clahe: bool = True,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_seed: int = 42,
    dry_run: bool = False
) -> Dict[str, Any]:
    """Orchestrates the full Milestone 2 preprocessing workflow."""
    workspace_root = Path(workspace_root).resolve()
    raw_dir = workspace_root / "data" / "raw"
    processed_dir = workspace_root / "data" / "processed"
    manifests_dir = workspace_root / "data" / "manifests"
    reports_dir = workspace_root / "reports"

    mammo_raw = raw_dir / "mammogram"
    thermal_raw = raw_dir / "thermal"
    mammo_processed = processed_dir / "mammogram"
    thermal_processed = processed_dir / "thermal"

    mammo_manifest = manifests_dir / "mammogram_manifest.csv"
    thermal_manifest = manifests_dir / "thermal_manifest.csv"

    summary = {
        "status": "pending",
        "target_size": target_size,
        "dry_run": dry_run,
        "mammogram": {},
        "thermal": {},
        "splits": {},
        "errors": []
    }

    # 1. Preprocess Mammograms
    if mammo_manifest.exists():
        print(f"[1/4] Preprocessing mammograms -> {target_size}x{target_size} PNG (CLAHE={'ON' if apply_clahe else 'OFF'})...")
        t0 = time.time()
        mammo_report = preprocess_images_from_manifest(
            mammo_manifest, mammo_raw, mammo_processed,
            modality="mammogram", target_size=target_size,
            apply_clahe=apply_clahe, dry_run=dry_run
        )
        mammo_report["elapsed_seconds"] = round(time.time() - t0, 1)
        summary["mammogram"] = mammo_report
        print(f"      Done: {mammo_report['preprocessed_count']} preprocessed, "
              f"{mammo_report['already_existed']} already existed, "
              f"{mammo_report['skipped_corrupt']} skipped ({mammo_report['elapsed_seconds']}s)")
    else:
        summary["errors"].append("Mammogram manifest not found. Run ingestion first.")

    # 2. Preprocess Thermal
    if thermal_manifest.exists():
        print(f"[2/4] Preprocessing thermal images -> {target_size}x{target_size} PNG...")
        t0 = time.time()
        thermal_report = preprocess_images_from_manifest(
            thermal_manifest, thermal_raw, thermal_processed,
            modality="thermal", target_size=target_size,
            apply_clahe=False, dry_run=dry_run
        )
        thermal_report["elapsed_seconds"] = round(time.time() - t0, 1)
        summary["thermal"] = thermal_report
        print(f"      Done: {thermal_report['preprocessed_count']} preprocessed, "
              f"{thermal_report['already_existed']} already existed, "
              f"{thermal_report['skipped_corrupt']} skipped ({thermal_report['elapsed_seconds']}s)")
    else:
        summary["errors"].append("Thermal manifest not found. Run ingestion first.")

    # 3. Patient-level splits
    print(f"[3/4] Patient-level stratified splitting (seed={random_seed}, "
          f"train={train_ratio}/val={val_ratio}/test={test_ratio})...")
    split_results = {}
    for name, mpath in [("mammogram", mammo_manifest), ("thermal", thermal_manifest)]:
        if mpath.exists():
            split_report = patient_level_stratified_split(
                manifest_path=mpath,
                output_dir=manifests_dir,
                train_ratio=train_ratio,
                val_ratio=val_ratio,
                test_ratio=test_ratio,
                random_seed=random_seed
            )
            split_results[name] = split_report
            leakage = split_report.get("leakage_check", {})
            print(f"      {name}: {split_report['total_patients']} patients -> "
                  f"train={split_report['splits']['train']['patients']}/"
                  f"val={split_report['splits']['val']['patients']}/"
                  f"test={split_report['splits']['test']['patients']} "
                  f"(leakage_free={leakage.get('all_clean', False)})")
    summary["splits"] = split_results

    # 4. Create preprocessed manifests
    print("[4/4] Creating preprocessed manifests with image paths...")
    for name, proc_dir, orig_manifest in [
        ("mammogram", mammo_processed, mammo_manifest),
        ("thermal", thermal_processed, thermal_manifest)
    ]:
        if orig_manifest.exists():
            out_manifest = manifests_dir / f"{name}_preprocessed_manifest.csv"
            count = create_preprocessed_manifest(orig_manifest, proc_dir, out_manifest)
            print(f"      {name}: {count} images linked in {out_manifest.name}")

    # Save preprocessing report
    report_path = reports_dir / "preprocessing_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, default=str)

    summary["status"] = "success" if not summary["errors"] else "completed_with_errors"
    return summary


def main():
    parser = argparse.ArgumentParser(description="MammoFusion-XAI Preprocessing Pipeline")
    parser.add_argument("--target-size", type=int, default=224, help="Square image target size (default: 224)")
    parser.add_argument("--no-clahe", action="store_true", help="Disable CLAHE enhancement for mammograms")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducible splits")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without writing files")
    args = parser.parse_args()

    workspace = Path(__file__).resolve().parent.parent.parent
    print("=" * 60)
    print("MammoFusion-XAI Preprocessing & Splitting Pipeline")
    print("=" * 60)
    print(f"Workspace: {workspace}")
    print(f"Target size: {args.target_size}×{args.target_size}")
    print(f"CLAHE: {'OFF' if args.no_clahe else 'ON'}")
    print(f"Random seed: {args.seed}")
    print()

    summary = run_preprocessing_pipeline(
        workspace_root=workspace,
        target_size=args.target_size,
        apply_clahe=not args.no_clahe,
        random_seed=args.seed,
        dry_run=args.dry_run
    )

    print()
    print("=" * 60)
    print(f"Pipeline Status: {summary['status']}")
    if summary.get("errors"):
        for e in summary["errors"]:
            print(f"  [!] {e}")
    print("=" * 60)


if __name__ == "__main__":
    main()

