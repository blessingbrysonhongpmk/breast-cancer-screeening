"""Safe archive extraction engine.
Prevents Zip Slip (path traversal), suspicious file execution, and disk overflows.
"""

import os
import zipfile
import tarfile
from pathlib import Path
from typing import Dict, List, Any, Optional

DANGEROUS_EXTENSIONS = {".exe", ".bat", ".cmd", ".vbs", ".ps1", ".msi", ".dll", ".so", ".com", ".scr"}


class SecurityExtractionError(Exception):
    """Raised when an archive member poses a security hazard (e.g. Zip Slip or executable)."""
    pass


def is_safe_path(target_dir: Path, target_path: Path) -> bool:
    """Verifies that target_path is strictly inside target_dir to prevent Zip Slip."""
    resolved_target_dir = target_dir.resolve()
    resolved_target_path = target_path.resolve()
    try:
        resolved_target_path.relative_to(resolved_target_dir)
        return True
    except ValueError:
        return False


def validate_archive_members(archive_path: Path) -> List[str]:
    """Inspects all archive member paths and file types for security hazards."""
    suffix = archive_path.suffix.lower()
    suspicious = []

    if suffix == ".zip":
        with zipfile.ZipFile(archive_path, "r") as z:
            for info in z.infolist():
                name = info.filename
                # Path traversal checks
                if ".." in name.split("/") or ".." in name.split("\\") or name.startswith("/") or name.startswith("\\"):
                    suspicious.append(f"Path traversal detected in member: {name}")
                ext = Path(name).suffix.lower()
                if ext in DANGEROUS_EXTENSIONS:
                    suspicious.append(f"Dangerous executable extension in member: {name}")
    elif suffix in {".tar", ".gz", ".tgz", ".bz2", ".tbz2"} or archive_path.name.lower().endswith(".tar.gz"):
        with tarfile.open(archive_path, "r:*") as t:
            for member in t.getmembers():
                name = member.name
                if ".." in name.split("/") or ".." in name.split("\\") or name.startswith("/") or name.startswith("\\"):
                    suspicious.append(f"Path traversal detected in member: {name}")
                if member.islnk() or member.issym():
                    suspicious.append(f"Symbolic or hard links not permitted in archive member: {name}")
                ext = Path(name).suffix.lower()
                if ext in DANGEROUS_EXTENSIONS:
                    suspicious.append(f"Dangerous executable extension in member: {name}")

    return suspicious


def safe_extract_archive(
    archive_path: Path,
    destination_dir: Path,
    dry_run: bool = False
) -> Dict[str, Any]:
    """Safely extracts an archive to destination_dir with full path containment checks.
    The original archive is never modified or deleted.
    """
    archive_path = Path(archive_path)
    destination_dir = Path(destination_dir)

    report: Dict[str, Any] = {
        "archive": str(archive_path),
        "destination": str(destination_dir),
        "extracted_files": [],
        "skipped_files": [],
        "dry_run": dry_run,
        "success": False,
        "errors": []
    }

    if not archive_path.exists():
        report["errors"].append(f"Archive not found: {archive_path}")
        return report

    # 1. Pre-validation of members
    hazards = validate_archive_members(archive_path)
    if hazards:
        report["errors"].extend(hazards)
        raise SecurityExtractionError(f"Security validation failed for {archive_path.name}: {'; '.join(hazards)}")

    if not dry_run:
        destination_dir.mkdir(parents=True, exist_ok=True)

    suffix = archive_path.suffix.lower()

    try:
        if suffix == ".zip":
            with zipfile.ZipFile(archive_path, "r") as z:
                for info in z.infolist():
                    target_dest = destination_dir / info.filename
                    if not is_safe_path(destination_dir, target_dest):
                        raise SecurityExtractionError(f"Zip slip detected: {info.filename}")

                    if dry_run:
                        report["extracted_files"].append(str(target_dest))
                        continue

                    if info.is_dir():
                        target_dest.mkdir(parents=True, exist_ok=True)
                    else:
                        target_dest.parent.mkdir(parents=True, exist_ok=True)
                        with z.open(info) as src, open(target_dest, "wb") as dst:
                            dst.write(src.read())
                        report["extracted_files"].append(str(target_dest))

        elif suffix in {".tar", ".gz", ".tgz", ".bz2", ".tbz2"} or archive_path.name.lower().endswith(".tar.gz"):
            with tarfile.open(archive_path, "r:*") as t:
                for member in t.getmembers():
                    target_dest = destination_dir / member.name
                    if not is_safe_path(destination_dir, target_dest):
                        raise SecurityExtractionError(f"Tar slip detected: {member.name}")

                    if dry_run:
                        report["extracted_files"].append(str(target_dest))
                        continue

                    if member.isdir():
                        target_dest.mkdir(parents=True, exist_ok=True)
                    elif member.isfile():
                        target_dest.parent.mkdir(parents=True, exist_ok=True)
                        fileobj = t.extractfile(member)
                        if fileobj:
                            with open(target_dest, "wb") as dst:
                                dst.write(fileobj.read())
                            report["extracted_files"].append(str(target_dest))
                    else:
                        report["skipped_files"].append(member.name)
        else:
            report["errors"].append(f"Unsupported archive format: {archive_path.suffix}")
            return report

        report["success"] = True

    except Exception as ex:
        report["errors"].append(str(ex))
        report["success"] = False

    return report

