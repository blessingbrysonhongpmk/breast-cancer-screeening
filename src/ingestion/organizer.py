"""Dataset organizer: copies validated images and metadata into data/raw structure.
Preserves original downloads, original filenames, and full provenance.
"""

import os
import shutil
import hashlib
from pathlib import Path
from typing import Dict, List, Any, Optional

from src.ingestion.scanner import get_free_disk_space


def compute_file_sha256(filepath: Path) -> str:
    """Computes SHA256 checksum for file verification and idempotency."""
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


def safe_copy_file(
    source_file: Path,
    dest_file: Path,
    dry_run: bool = False
) -> Dict[str, Any]:
    """Copies source_file to dest_file safely.
    If dest_file already exists with identical size and hash, skips copy (idempotent).
    """
    source_file = Path(source_file)
    dest_file = Path(dest_file)

    result = {
        "source": str(source_file),
        "destination": str(dest_file),
        "copied": False,
        "already_existed": False,
        "dry_run": dry_run,
        "error": None
    }

    if not source_file.exists():
        result["error"] = f"Source file not found: {source_file}"
        return result

    if dest_file.exists():
        # Check if identical
        try:
            if source_file.stat().st_size == dest_file.stat().st_size:
                # Same size, check fast hash
                if compute_file_sha256(source_file) == compute_file_sha256(dest_file):
                    result["already_existed"] = True
                    return result
        except OSError as e:
            result["error"] = f"Error comparing existing file: {e}"
            return result

    if dry_run:
        result["copied"] = True
        return result

    try:
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, dest_file)
        result["copied"] = True
    except Exception as ex:
        result["error"] = f"Failed copying {source_file.name} to {dest_file}: {ex}"

    return result


def organize_dataset_files(
    file_manifest: List[Dict[str, Any]],
    destination_root: Path,
    min_free_space_buffer_bytes: int = 3 * 1024 * 1024 * 1024,
    dry_run: bool = False
) -> Dict[str, Any]:
    """Organizes and copies identified dataset files into destination_root.
    Validates host disk headroom before initiating copy.
    """
    destination_root = Path(destination_root)
    total_copy_size = sum(f.get("file_size", 0) for f in file_manifest if not f.get("already_present", False))
    available_space = get_free_disk_space(destination_root)

    report = {
        "destination_root": str(destination_root),
        "total_files_planned": len(file_manifest),
        "total_bytes_needed": total_copy_size,
        "available_disk_bytes": available_space,
        "has_sufficient_space": True,
        "copied_count": 0,
        "skipped_identical_count": 0,
        "errors": [],
        "dry_run": dry_run
    }

    if available_space < (total_copy_size + min_free_space_buffer_bytes):
        report["has_sufficient_space"] = False
        shortfall = (total_copy_size + min_free_space_buffer_bytes) - available_space
        report["errors"].append(
            f"Insufficient disk space on {destination_root.drive}. "
            f"Needs {total_copy_size / (1024**3):.2f} GB + {min_free_space_buffer_bytes / (1024**3):.1f} GB safety buffer, "
            f"but only {available_space / (1024**3):.2f} GB available (shortfall: {shortfall / (1024**3):.2f} GB)."
        )
        return report

    for item in file_manifest:
        src = Path(item["source_path"])
        dst = Path(item["dest_path"])

        copy_res = safe_copy_file(src, dst, dry_run=dry_run)
        if copy_res["error"]:
            report["errors"].append(copy_res["error"])
        elif copy_res["already_existed"]:
            report["skipped_identical_count"] += 1
        elif copy_res["copied"]:
            report["copied_count"] += 1

    return report

