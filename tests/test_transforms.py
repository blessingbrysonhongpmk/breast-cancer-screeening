"""Unit tests for image transforms, CLAHE, and preprocessing functions."""

import tempfile
import unittest
import numpy as np
from pathlib import Path
from PIL import Image

from src.preprocessing.transforms import (
    load_image,
    apply_clahe,
    resize_image,
    normalize_to_float32,
    preprocess_mammogram,
    preprocess_thermal,
    save_preprocessed_image,
)


class TestImageTransforms(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_load_grayscale_image(self):
        """Verify loading a grayscale image returns correct shape."""
        img_path = self.base / "test_gray.png"
        Image.new("L", (100, 80), color=128).save(img_path)
        img = load_image(img_path, grayscale=True)
        self.assertIsNotNone(img)
        self.assertEqual(img.shape, (80, 100))  # (H, W)
        self.assertEqual(img.dtype, np.uint8)

    def test_load_color_image(self):
        """Verify loading an RGB image returns 3-channel BGR array."""
        img_path = self.base / "test_color.jpg"
        Image.new("RGB", (64, 48), color=(255, 0, 0)).save(img_path)
        img = load_image(img_path, grayscale=False)
        self.assertIsNotNone(img)
        self.assertEqual(img.shape, (48, 64, 3))

    def test_clahe_enhancement(self):
        """Verify CLAHE runs without error and preserves shape."""
        gray = np.random.randint(0, 256, (100, 100), dtype=np.uint8)
        enhanced = apply_clahe(gray)
        self.assertEqual(enhanced.shape, gray.shape)
        self.assertEqual(enhanced.dtype, np.uint8)

    def test_clahe_rejects_color(self):
        """CLAHE must reject non-grayscale input."""
        color = np.random.randint(0, 256, (100, 100, 3), dtype=np.uint8)
        with self.assertRaises(ValueError):
            apply_clahe(color)

    def test_resize_image(self):
        """Verify resize produces exact target dimensions."""
        img = np.random.randint(0, 256, (4320, 2600), dtype=np.uint8)
        resized = resize_image(img, target_size=(224, 224))
        self.assertEqual(resized.shape, (224, 224))

    def test_normalize_to_float32(self):
        """Verify normalization maps [0,255] to [0.0, 1.0]."""
        img = np.array([[0, 128, 255]], dtype=np.uint8)
        norm = normalize_to_float32(img)
        self.assertEqual(norm.dtype, np.float32)
        self.assertAlmostEqual(norm[0, 0], 0.0)
        self.assertAlmostEqual(norm[0, 2], 1.0)

    def test_preprocess_mammogram_end_to_end(self):
        """Full mammogram preprocessing pipeline on a synthetic PGM-like image."""
        img_path = self.base / "mdb_test.png"
        Image.new("L", (1024, 1024), color=100).save(img_path)
        result = preprocess_mammogram(img_path, target_size=(224, 224))
        self.assertIsNotNone(result)
        self.assertEqual(result["image"].shape, (224, 224))
        self.assertTrue(result["clahe_applied"])

    def test_preprocess_thermal_end_to_end(self):
        """Full thermal preprocessing pipeline on a synthetic color image."""
        img_path = self.base / "thermal_test.jpg"
        Image.new("RGB", (320, 240), color=(200, 100, 50)).save(img_path)
        result = preprocess_thermal(img_path, target_size=(224, 224))
        self.assertIsNotNone(result)
        self.assertEqual(result["image"].shape, (224, 224, 3))

    def test_save_preprocessed_image(self):
        """Verify PNG save and file existence."""
        img = np.random.randint(0, 256, (224, 224), dtype=np.uint8)
        out_path = self.base / "output" / "saved.png"
        success = save_preprocessed_image(img, out_path)
        self.assertTrue(success)
        self.assertTrue(out_path.exists())
        self.assertGreater(out_path.stat().st_size, 0)


if __name__ == "__main__":
    unittest.main()

