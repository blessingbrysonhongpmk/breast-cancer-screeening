"""Master ingestion pipeline for MammoFusion-XAI.
Orchestrates scanning, archive safety checks, format identification, safe organization,
manifest generation, and comprehensive audit reporting.
"""

import os
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional

from src.ingestion.scanner import scan_directory, get_free_disk_space
from src.ingestion.extractor import safe_extract_archive, SecurityExtractionError
from src.ingestion.dataset_identifier import (
    identify_dataset_type,
    DATASET_MIAS,
    DATASET_MENDELEY_THERMAL,
    MODALITY_MAMMOGRAM,
    MODALITY_THERMAL
)
from src.ingestion.organizer import safe_copy_file
from src.ingestion.manifest_builder import build_mammogram_manifest, build_thermal_manifest
from src.ingestion.audit_reporter import generate_dataset_audit_report


def run_ingestion_pipeline(
    workspace_root: Path,
    dropbox_dir: Optional[Path] = None,
    raw_dir: Optional[Path] = None,
    manifests_dir: Optional[Path] = None,
    reports_dir: Optional[Path] = None,
    dry_run: bool = False,
    scan_only: bool = False,
    auto_detect_workspace_datasets: bool = True
) -> Dict[str, Any]:
    """Executes the complete safe dataset ingestion and audit workflow."""
    workspace_root = Path(workspace_root).resolve()
    dropbox_dir = Path(dropbox_dir or (workspace_root / "dataset_dropbox")).resolve()
    raw_dir = Path(raw_dir or (workspace_root / "data" / "raw")).resolve()
    manifests_dir = Path(manifests_dir or (workspace_root / "data" / "manifests")).resolve()
    reports_dir = Path(reports_dir or (workspace_root / "reports")).resolve()

    mammo_drop = dropbox_dir / "mammogram"
    thermal_drop = dropbox_dir / "thermal"

    mammo_raw = raw_dir / "mammogram"
    thermal_raw = raw_dir / "thermal"

    mammo_drop.mkdir(parents=True, exist_ok=True)
    thermal_drop.mkdir(parents=True, exist_ok=True)
    mammo_raw.mkdir(parents=True, exist_ok=True)
    thermal_raw.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    summary: Dict[str, Any] = {
        "workspace_root": str(workspace_root),
        "status": "pending",
        "dry_run": dry_run,
        "actions_taken": [],
        "warnings": [],
        "errors": [],
        "mammogram_ingested_count": 0,
        "thermal_ingested_count": 0,
        "reports_generated": []
    }

    # 1. Check if dropbox folders have files
    mammo_scan = scan_directory(mammo_drop)
    thermal_scan = scan_directory(thermal_drop)

    mammo_has_content = (mammo_scan["total_files"] > 0)
    thermal_has_content = (thermal_scan["total_files"] > 0)

    # If drop folder is empty, check for pre-existing folders in workspace
    if auto_detect_workspace_datasets and (not mammo_has_content or not thermal_has_content):
        summary["actions_taken"].append("Scanning workspace root for pre-existing dataset folders...")
        for item in workspace_root.iterdir():
            if item.is_dir() and item.name not in {"dataset_dropbox", "data", "notebooks", "src", "models", "app", "reports", "tests", "docs", ".git", ".gemini", "env", "venv", ".venv"}:
                ident = identify_dataset_type(item)
                if ident["dataset_name"] == DATASET_MIAS and not mammo_has_content:
                    summary["actions_taken"].append(f"Auto-detected MIAS dataset in workspace: '{item.name}'")
                    mammo_drop = item
                    mammo_scan = scan_directory(mammo_drop)
                    mammo_has_content = True
                elif ident["dataset_name"] == DATASET_MENDELEY_THERMAL and not thermal_has_content:
                    summary["actions_taken"].append(f"Auto-detected Mendeley Thermography dataset in workspace: '{item.name}'")
                    thermal_drop = item
                    thermal_scan = scan_directory(thermal_drop)
                    thermal_has_content = True

    if not mammo_has_content and not thermal_has_content:
        summary["status"] = "waiting_for_downloads"
        instructions = (
            "No dataset files detected in 'dataset_dropbox/' or project root.\n"
            "Please place downloaded datasets into:\n"
            f"  - MIAS mammography: {workspace_root / 'dataset_dropbox' / 'mammogram'}\n"
            f"  - Mendeley thermography: {workspace_root / 'dataset_dropbox' / 'thermal'}\n"
            "Then re-run this pipeline: `py -3.10 run_ingestion.py`"
        )
        summary["instructions"] = instructions
        return summary

    # If scan-only, output pre-ingestion analysis without modifying data/raw
    if scan_only:
        summary["status"] = "scan_complete"
        summary["pre_ingestion_scan"] = {
            "mammogram": {
                "source": str(mammo_drop),
                "total_files": mammo_scan["total_files"],
                "images_found": len(mammo_scan["images"]),
                "metadata_found": len(mammo_scan["metadata_files"]),
                "size_mb": round(mammo_scan["total_file_size_bytes"] / (1024**2), 2),
                "size_gb": round(mammo_scan["total_file_size_bytes"] / (1024**3), 3),
            },
            "thermal": {
                "source": str(thermal_drop),
                "total_files": thermal_scan["total_files"],
                "images_found": len(thermal_scan["images"]),
                "metadata_found": len(thermal_scan["metadata_files"]),
                "size_mb": round(thermal_scan["total_file_size_bytes"] / (1024**2), 2),
                "size_gb": round(thermal_scan["total_file_size_bytes"] / (1024**3), 3),
            },
            "available_disk_gb": round(get_free_disk_space(workspace_root) / (1024**3), 2),
            "safety_buffer_gb": 3.0
        }
        return summary

    # 2. Extract any archives found in drop folders
    for label, scan_info, target_drop in [("mammogram", mammo_scan, mammo_drop), ("thermal", thermal_scan, thermal_drop)]:
        for arch in scan_info["archives"]:
            arch_path = Path(arch["path"])
            dest_extract = target_drop / arch_path.stem
            summary["actions_taken"].append(f"Extracting archive safely: {arch_path.name} -> {dest_extract.name}")
            try:
                ext_report = safe_extract_archive(arch_path, dest_extract, dry_run=dry_run)
                if not ext_report["success"]:
                    summary["errors"].extend(ext_report["errors"])
            except SecurityExtractionError as sec_err:
                summary["errors"].append(f"Security error: {sec_err}")

    # 3. Organize Mammogram files into data/raw/mammogram
    if mammo_has_content:
        mammo_ident = identify_dataset_type(mammo_drop)
        if mammo_ident["is_ambiguous"]:
            summary["warnings"].append(f"Mammogram scan ambiguity: {mammo_ident['ambiguity_reason']}")
        
        # Collect and copy all MIAS files (images and PDFs)
        for root, _, files in os.walk(mammo_drop):
            for f in files:
                src_file = Path(root) / f
                if src_file.suffix.lower() in {".pgm", ".pdf", ".txt", ".csv"}:
                    dest_file = mammo_raw / f
                    res = safe_copy_file(src_file, dest_file, dry_run=dry_run)
                    if res["copied"] or res["already_existed"]:
                        summary["mammogram_ingested_count"] += 1
                    if res["error"]:
                        summary["errors"].append(res["error"])

    # 4. Organize Thermal files into data/raw/thermal
    if thermal_has_content:
        thermal_ident = identify_dataset_type(thermal_drop)
        if thermal_ident["is_ambiguous"]:
            summary["warnings"].append(f"Thermal scan ambiguity: {thermal_ident['ambiguity_reason']}")

        # Collect and copy thermal files preserving participant structure
        for root, _, files in os.walk(thermal_drop):
            for f in files:
                src_file = Path(root) / f
                # Preserve participant subfolder if present
                rel_parts = src_file.relative_to(thermal_drop).parts
                dest_file = thermal_raw.joinpath(*rel_parts)

                if src_file.suffix.lower() in {".jpg", ".jpeg", ".png", ".xlsx", ".csv", ".txt", ".pdf"}:
                    res = safe_copy_file(src_file, dest_file, dry_run=dry_run)
                    if res["copied"] or res["already_existed"]:
                        summary["thermal_ingested_count"] += 1
                    if res["error"]:
                        summary["errors"].append(res["error"])

    # 5. Build Manifests
    mammo_manifest_path = manifests_dir / "mammogram_manifest.csv"
    thermal_manifest_path = manifests_dir / "thermal_manifest.csv"

    mammo_records = build_mammogram_manifest(
        mammogram_raw_dir=mammo_raw,
        metadata_source_dir=mammo_drop,
        output_csv_path=mammo_manifest_path
    )
    thermal_records = build_thermal_manifest(
        thermal_raw_dir=thermal_raw,
        metadata_source_dir=thermal_drop,
        output_csv_path=thermal_manifest_path
    )

    summary["actions_taken"].append(f"Created mammogram manifest: {mammo_manifest_path.name} ({len(mammo_records)} rows)")
    summary["actions_taken"].append(f"Created thermal manifest: {thermal_manifest_path.name} ({len(thermal_records)} rows)")

    # 6. Generate Comprehensive Audit Report
    audit_data = generate_dataset_audit_report(
        mammogram_records=mammo_records,
        thermal_records=thermal_records,
        output_dir=reports_dir
    )
    summary["reports_generated"].append(str(reports_dir / "dataset_audit_report.md"))
    summary["reports_generated"].append(str(reports_dir / "dataset_audit_report.json"))
    summary["audit_summary"] = audit_data
    summary["status"] = "success"

    return summary


def main():
    parser = argparse.ArgumentParser(description="MammoFusion-XAI Safe Dataset Ingestion Pipeline")
    parser.add_argument("--scan-only", action="store_true", help="Only scan dropboxes and report status without copying")
    parser.add_argument("--dry-run", action="store_true", help="Simulate pipeline actions without writing files")
    parser.add_argument("--source-dir", type=str, default=None, help="Custom dataset source directory")
    args = parser.parse_args()

    workspace = Path(__file__).resolve().parent.parent.parent
    print(f"=== MammoFusion-XAI Safe Dataset Ingestion Pipeline ===")
    print(f"Workspace: {workspace}")

    summary = run_ingestion_pipeline(
        workspace_root=workspace,
        dry_run=args.dry_run,
        scan_only=args.scan_only
    )

    print("\n--- Pipeline Execution Summary ---")
    print(f"Status: {summary['status']}")
    for action in summary.get("actions_taken", []):
        print(f"  [+] {action}")
    if summary.get("warnings"):
        print("\nWarnings:")
        for w in summary["warnings"]:
            print(f"  [!] {w}")
    if summary.get("errors"):
        print("\nErrors:")
        for e in summary["errors"]:
            print(f"  [-] {e}")

    if summary.get("pre_ingestion_scan"):
        scan = summary["pre_ingestion_scan"]
        print("\n--- Pre-Ingestion Scan Report ---")
        print(f"Available Host Disk Space: {scan['available_disk_gb']} GB")
        print(f"Safety Buffer Reserved:    {scan['safety_buffer_gb']} GB")
        print("\n[MIAS Mammography]")
        print(f"  Source:         {scan['mammogram']['source']}")
        print(f"  Images Found:   {scan['mammogram']['images_found']} PGM files")
        print(f"  Metadata Files: {scan['mammogram']['metadata_found']}")
        print(f"  Footprint:      {scan['mammogram']['size_mb']} MB ({scan['mammogram']['size_gb']} GB)")
        print("\n[Mendeley Breast Thermography]")
        print(f"  Source:         {scan['thermal']['source']}")
        print(f"  Images Found:   {scan['thermal']['images_found']} JPG files")
        print(f"  Metadata Files: {scan['thermal']['metadata_found']}")
        print(f"  Footprint:      {scan['thermal']['size_mb']} MB ({scan['thermal']['size_gb']} GB)")
        total_req_gb = scan['mammogram']['size_gb'] + scan['thermal']['size_gb']
        print(f"\nTotal Space Required for Raw Storage: {total_req_gb:.2f} GB")
        if scan['available_disk_gb'] > total_req_gb + scan['safety_buffer_gb']:
            print("Disk Check: PASSED (Sufficient disk space available with safety buffer)")
        else:
            print("Disk Check: WARNING (Free space is tight)")
        print("\nTo proceed with safe ingestion into data/raw/ and generate manifests, run:")
        print("  py -3.10 run_ingestion.py")

    if summary.get("instructions"):
        print(f"\n{summary['instructions']}")

    if summary["status"] == "success":
        audit = summary.get("audit_summary", {})
        print("\n--- Ingestion Statistics ---")
        print(f"Total Ingested Images: {audit.get('total_images_across_modalities')}")
        print(f"Total Storage Used: {audit.get('total_storage_used_mb')} MB")
        print(f"Mammogram Images (MIAS): {audit.get('mammogram', {}).get('total_images')}")
        print(f"Thermal Images (Mendeley): {audit.get('thermal', {}).get('total_images')}")
        print(f"Audit reports written to: {workspace / 'reports'}")
        print("Pipeline completed successfully.")


if __name__ == "__main__":
    main()
