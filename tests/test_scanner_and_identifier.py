"""Unit tests for directory scanner and explicit dataset identification."""

import tempfile
import unittest
import zipfile
from pathlib import Path

from src.ingestion.scanner import scan_directory, estimate_archive_uncompressed_size
from src.ingestion.dataset_identifier import (
    identify_dataset_type,
    DATASET_MIAS,
    DATASET_MENDELEY_THERMAL,
    MODALITY_MAMMOGRAM,
    MODALITY_THERMAL,
    DATASET_UNKNOWN
)


class TestScannerAndIdentifier(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_scanner_detection_and_size_estimation(self):
        """Verify scanner categorizes archives, images, metadata and estimates uncompressed sizes."""
        test_dir = self.base_path / "drop_sample"
        test_dir.mkdir()

        # Create dummy image
        img = test_dir / "sample.pgm"
        img.write_bytes(b"P5\n10 10\n255\n" + b"\x00" * 100)

        # Create dummy archive with known payload
        arch = test_dir / "archive.zip"
        with zipfile.ZipFile(arch, "w") as z:
            z.writestr("inside.txt", b"A" * 500)

        scan_res = scan_directory(test_dir)
        self.assertEqual(scan_res["total_files"], 2)
        self.assertEqual(len(scan_res["images"]), 1)
        self.assertEqual(len(scan_res["archives"]), 1)
        self.assertGreaterEqual(scan_res["estimated_uncompressed_bytes"], 600)

    def test_identify_mias_dataset(self):
        """Verify MIAS detection via mdb###.pgm naming and 00README."""
        mias_dir = self.base_path / "mias_sample"
        mias_dir.mkdir()
        (mias_dir / "mdb001lm.pgm").write_bytes(b"fake pgm")
        (mias_dir / "mdb002rl.pgm").write_bytes(b"fake pgm")
        (mias_dir / "00README.pdf").write_bytes(b"fake pdf")

        ident = identify_dataset_type(mias_dir)
        self.assertEqual(ident["dataset_name"], DATASET_MIAS)
        self.assertEqual(ident["modality"], MODALITY_MAMMOGRAM)
        self.assertEqual(ident["confidence"], "high")
        self.assertFalse(ident["is_ambiguous"])

    def test_identify_thermal_dataset(self):
        """Verify Mendeley Thermography detection via IIR patient folders and Diagnostics.xlsx."""
        thermal_dir = self.base_path / "thermal_sample"
        patient_folder = thermal_dir / "IIR0110"
        patient_folder.mkdir(parents=True)
        (patient_folder / "IIR0110_F.jpg").write_bytes(b"fake jpg")
        (thermal_dir / "Diagnostics.xlsx").write_bytes(b"fake xlsx")

        ident = identify_dataset_type(thermal_dir)
        self.assertEqual(ident["dataset_name"], DATASET_MENDELEY_THERMAL)
        self.assertEqual(ident["modality"], MODALITY_THERMAL)
        self.assertEqual(ident["confidence"], "high")
        self.assertFalse(ident["is_ambiguous"])

    def test_ambiguity_on_empty_or_unknown(self):
        """Verify empty or unknown folders do not make silent guesses."""
        empty_dir = self.base_path / "empty_dir"
        empty_dir.mkdir()

        ident = identify_dataset_type(empty_dir)
        self.assertEqual(ident["dataset_name"], DATASET_UNKNOWN)
        self.assertTrue(ident["is_ambiguous"])


if __name__ == "__main__":
    unittest.main()

