"""Unit tests for manifest generation, repeat-run idempotency, and audit reporting."""

import tempfile
import unittest
import csv
from pathlib import Path
from PIL import Image

from src.ingestion.organizer import safe_copy_file
from src.ingestion.manifest_builder import inspect_image_file, build_mammogram_manifest, build_thermal_manifest
from src.ingestion.audit_reporter import generate_dataset_audit_report


class TestManifestAndIdempotence(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_idempotent_safe_copy(self):
        """Verify safe_copy_file copies initially and skips identical files on repeat runs."""
        src = self.base_path / "source.txt"
        src.write_text("dataset test content", encoding="utf-8")
        dst = self.base_path / "dest" / "source.txt"

        # First run: should copy
        res1 = safe_copy_file(src, dst)
        self.assertTrue(res1["copied"])
        self.assertFalse(res1["already_existed"])

        # Second run: should recognize identical and skip
        res2 = safe_copy_file(src, dst)
        self.assertFalse(res2["copied"])
        self.assertTrue(res2["already_existed"])

    def test_image_inspection(self):
        """Verify PIL image inspection reads dimensions and format properly."""
        img_path = self.base_path / "test_image.jpg"
        img = Image.new("RGB", (64, 48), color="red")
        img.save(img_path)

        info = inspect_image_file(img_path)
        self.assertTrue(info["is_readable"])
        self.assertEqual(info["width"], 64)
        self.assertEqual(info["height"], 48)

    def test_audit_reporter_generation(self):
        """Verify Markdown and JSON audit reports are generated with accurate counts."""
        sample_mammo = [
            {
                "filename": "mdb001lm.pgm",
                "patient_id": "MIAS_P001",
                "label": "benign",
                "validation_status": "valid",
                "file_size_bytes": 1000,
                "image_width": 1024,
                "image_height": 1024
            },
            {
                "filename": "mdb002rl.pgm",
                "patient_id": "MIAS_P001",
                "label": "normal",
                "validation_status": "valid",
                "file_size_bytes": 1000,
                "image_width": 1024,
                "image_height": 1024
            }
        ]
        sample_thermal = [
            {
                "filename": "IIR0110_F.jpg",
                "patient_id": "IIR0110",
                "label": "malignant",
                "validation_status": "valid",
                "file_size_bytes": 2000,
                "image_width": 640,
                "image_height": 480
            }
        ]

        report_dir = self.base_path / "reports"
        audit = generate_dataset_audit_report(sample_mammo, sample_thermal, report_dir)

        self.assertEqual(audit["total_images_across_modalities"], 3)
        self.assertEqual(audit["mammogram"]["unique_patients_identified"], 1)
        self.assertEqual(audit["thermal"]["unique_patients_identified"], 1)

        self.assertTrue((report_dir / "dataset_audit_report.json").exists())
        self.assertTrue((report_dir / "dataset_audit_report.md").exists())


if __name__ == "__main__":
    unittest.main()

