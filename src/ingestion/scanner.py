"""Safe scanner for dataset dropboxes and archive analysis.
Evaluates file sizes, archive uncompressed footprint, and host disk space.
"""

import os
import shutil
import zipfile
import tarfile
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

SUPPORTED_ARCHIVES = {".zip", ".tar", ".gz", ".tgz", ".bz2", ".tbz2"}
SUPPORTED_IMAGE_EXTENSIONS = {".pgm", ".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
SUPPORTED_METADATA_EXTENSIONS = {".xlsx", ".xls", ".csv", ".tsv", ".txt", ".pdf", ".json", ".xml"}


def get_free_disk_space(path: Path) -> int:
    """Returns free disk space in bytes for the volume hosting `path`."""
    try:
        usage = shutil.disk_usage(str(path.resolve()))
        return usage.free
    except Exception:
        # Fallback for Windows drive root
        drive = os.path.splitdrive(str(path.resolve()))[0]
        if drive:
            usage = shutil.disk_usage(drive + "\\")
            return usage.free
        return 0


def estimate_archive_uncompressed_size(archive_path: Path) -> Tuple[int, List[str]]:
    """Estimates uncompressed extraction size and list of internal member paths without extracting."""
    total_size = 0
    members = []
    suffix = archive_path.suffix.lower()

    if suffix == ".zip":
        with zipfile.ZipFile(archive_path, "r") as z:
            for info in z.infolist():
                total_size += info.file_size
                members.append(info.filename)
    elif suffix in {".tar", ".gz", ".tgz", ".bz2", ".tbz2"} or archive_path.name.lower().endswith(".tar.gz"):
        mode = "r:*"
        with tarfile.open(archive_path, mode) as t:
            for member in t.getmembers():
                total_size += member.size
                members.append(member.name)
    else:
        # Not an archive, return file size
        total_size = archive_path.stat().st_size
        members.append(archive_path.name)

    return total_size, members


def scan_directory(
    target_dir: Path,
    min_free_space_buffer_bytes: int = 3 * 1024 * 1024 * 1024  # 3 GB buffer
) -> Dict[str, Any]:
    """Recursively scans a directory for archives, images, and metadata files.
    Calculates storage requirements and validates whether host drive has adequate headroom.
    """
    target_dir = Path(target_dir)
    results: Dict[str, Any] = {
        "target_dir": str(target_dir),
        "exists": target_dir.exists(),
        "archives": [],
        "images": [],
        "metadata_files": [],
        "other_files": [],
        "total_files": 0,
        "total_file_size_bytes": 0,
        "estimated_uncompressed_bytes": 0,
        "available_disk_bytes": 0,
        "has_sufficient_space": True,
        "space_shortfall_bytes": 0,
        "warnings": [],
        "errors": []
    }

    if not target_dir.exists():
        results["warnings"].append(f"Directory does not exist: {target_dir}")
        return results

    free_space = get_free_disk_space(target_dir)
    results["available_disk_bytes"] = free_space

    for root, _, files in os.walk(target_dir):
        for fname in files:
            fpath = Path(root) / fname
            try:
                fsize = fpath.stat().st_size
            except OSError as err:
                results["warnings"].append(f"Cannot access file {fpath}: {err}")
                continue

            results["total_files"] += 1
            results["total_file_size_bytes"] += fsize

            suffix = fpath.suffix.lower()
            is_tar_gz = fpath.name.lower().endswith(".tar.gz")

            if suffix in SUPPORTED_ARCHIVES or is_tar_gz:
                try:
                    uncomp_size, members = estimate_archive_uncompressed_size(fpath)
                    results["estimated_uncompressed_bytes"] += uncomp_size
                    results["archives"].append({
                        "path": str(fpath),
                        "filename": fpath.name,
                        "file_size": fsize,
                        "estimated_uncompressed_size": uncomp_size,
                        "member_count": len(members),
                        "sample_members": members[:5]
                    })
                except Exception as ex:
                    results["errors"].append(f"Corrupt or unreadable archive {fpath.name}: {ex}")
            elif suffix in SUPPORTED_IMAGE_EXTENSIONS:
                results["images"].append({
                    "path": str(fpath),
                    "filename": fpath.name,
                    "file_size": fsize,
                    "suffix": suffix
                })
                results["estimated_uncompressed_bytes"] += fsize
            elif suffix in SUPPORTED_METADATA_EXTENSIONS:
                results["metadata_files"].append({
                    "path": str(fpath),
                    "filename": fpath.name,
                    "file_size": fsize,
                    "suffix": suffix
                })
                results["estimated_uncompressed_bytes"] += fsize
            else:
                results["other_files"].append({
                    "path": str(fpath),
                    "filename": fpath.name,
                    "file_size": fsize,
                    "suffix": suffix
                })
                results["estimated_uncompressed_bytes"] += fsize

    # Check disk safety: Required = Estimated uncompressed + Safety buffer
    required_space = results["estimated_uncompressed_bytes"] + min_free_space_buffer_bytes
    if free_space < required_space:
        results["has_sufficient_space"] = False
        results["space_shortfall_bytes"] = required_space - free_space
        results["warnings"].append(
            f"Low disk space: {free_space / (1024**3):.2f} GB available, "
            f"need {required_space / (1024**3):.2f} GB (including safety buffer of {min_free_space_buffer_bytes / (1024**3):.1f} GB)."
        )

    return results

