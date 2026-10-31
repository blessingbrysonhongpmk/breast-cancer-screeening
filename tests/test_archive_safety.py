"""Unit tests for archive security, zip-slip defense, and dangerous file screening."""

import os
import io
import zipfile
import tempfile
import unittest
from pathlib import Path

from src.ingestion.extractor import (
    safe_extract_archive,
    validate_archive_members,
    is_safe_path,
    SecurityExtractionError
)


class TestArchiveSafety(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_safe_path_containment(self):
        """Verify is_safe_path permits valid subpaths and blocks path escapes."""
        target_dir = self.base_path / "extract_dest"
        target_dir.mkdir()

        valid_sub = target_dir / "folder" / "image.pgm"
        self.assertTrue(is_safe_path(target_dir, valid_sub))

        evil_sub = target_dir / ".." / "evil.txt"
        self.assertFalse(is_safe_path(target_dir, evil_sub))

    def test_zip_slip_rejection(self):
        """Verify archives with relative path traversal ('..') are caught and rejected."""
        malicious_zip = self.base_path / "malicious.zip"
        with zipfile.ZipFile(malicious_zip, "w") as z:
            z.writestr("../outside_sandbox.txt", "dangerous payload")

        hazards = validate_archive_members(malicious_zip)
        self.assertTrue(any("Path traversal" in h for h in hazards))

        dest_dir = self.base_path / "sandbox"
        with self.assertRaises(SecurityExtractionError):
            safe_extract_archive(malicious_zip, dest_dir)

    def test_dangerous_executable_rejection(self):
        """Verify archives with dangerous executable formats (.exe, .bat) trigger security flags."""
        exe_zip = self.base_path / "executable.zip"
        with zipfile.ZipFile(exe_zip, "w") as z:
            z.writestr("benign_looking_payload.exe", b"\x4D\x5A\x90\x00")

        hazards = validate_archive_members(exe_zip)
        self.assertTrue(any("Dangerous executable" in h for h in hazards))

        dest_dir = self.base_path / "sandbox2"
        with self.assertRaises(SecurityExtractionError):
            safe_extract_archive(exe_zip, dest_dir)

    def test_valid_archive_extraction(self):
        """Verify safe extraction of clean images and text files."""
        clean_zip = self.base_path / "clean_dataset.zip"
        with zipfile.ZipFile(clean_zip, "w") as z:
            z.writestr("subfolder/image01.jpg", b"dummy image data")
            z.writestr("metadata.txt", b"participant_id: 1234")

        dest_dir = self.base_path / "clean_extracted"
        report = safe_extract_archive(clean_zip, dest_dir)
        self.assertTrue(report["success"])
        self.assertTrue((dest_dir / "subfolder" / "image01.jpg").exists())
        self.assertTrue((dest_dir / "metadata.txt").exists())
        # Ensure original archive was preserved
        self.assertTrue(clean_zip.exists())


if __name__ == "__main__":
    unittest.main()

