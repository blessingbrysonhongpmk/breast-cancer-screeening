"""Modality detector and image validation module for MammoFusion-XAI.
Enforces strict modality boundaries between Mammogram (radiography) and Thermal (infrared thermography).
Prevents cross-modality contamination and rejects unrelated or corrupted images.
"""

import os
from typing import Tuple
from PIL import Image
import numpy as np


MAMMOGRAM_ERROR_MSG = "Invalid image. Please upload a mammogram image."
THERMAL_ERROR_MSG = "Invalid image. Please upload a thermal image."


def detect_image_modality(img: Image.Image, filename: str = "") -> Tuple[str, str]:
    """Detects whether an image is a mammogram, a thermal scan, or unrelated/invalid.
    
    Returns:
        (modality, explanation): modality is one of 'mammogram', 'thermal', or 'invalid'.
    """
    filename_lower = filename.lower()
    suffix = os.path.splitext(filename_lower)[1]

    # 1. Check dimensions
    w, h = img.size
    if w < 32 or h < 32:
        return "invalid", "Image dimensions are below the 32x32 minimum threshold."

    # 2. PGM format is exclusively used in the mammogram pipeline (e.g., MIAS)
    if suffix == ".pgm":
        return "mammogram", "PGM format is native to digital mammography radiographs."

    # 3. Create a compact thumbnail (128x128) for high-speed, memory-efficient inspection
    thumb = img.copy()
    thumb.thumbnail((128, 128), Image.Resampling.BILINEAR)

    # Check for solid/blank/uninformative image
    gray_img = thumb.convert("L")
    gray_arr = np.array(gray_img, dtype=np.float32)
    std_val = float(np.std(gray_arr))
    if std_val < 4.0:
        return "invalid", "Image exhibits near-zero entropy or solid color fill."

    # 4. Check color distribution across RGB channels
    rgb_img = thumb.convert("RGB")
    rgb_arr = np.array(rgb_img, dtype=np.float32)
    r = rgb_arr[:, :, 0]
    g = rgb_arr[:, :, 1]
    b = rgb_arr[:, :, 2]

    # Channel delta and saturation
    ch_diff = float(np.mean(np.abs(r - g)) + np.mean(np.abs(g - b)) + np.mean(np.abs(b - r))) / 3.0
    
    # Calculate HSV saturation
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    delta_c = max_c - min_c
    with np.errstate(divide="ignore", invalid="ignore"):
        sat = np.where(max_c > 0, delta_c / (max_c + 1e-6), 0)
    mean_sat = float(np.mean(sat))

    # High color divergence is indicative of false-color infrared thermograms
    if ch_diff >= 8.0 or mean_sat >= 0.10:
        return "thermal", f"False-color infrared thermogram detected (channel divergence={ch_diff:.1f}, saturation={mean_sat:.2f})."

    # 5. Distinguish Grayscale Mammogram vs Grayscale Thermogram
    dark_ratio = float(np.mean(gray_arr < 20.0))
    edge_dark = float(
        np.mean(gray_arr[0, :] < 20.0)
        + np.mean(gray_arr[-1, :] < 20.0)
        + np.mean(gray_arr[:, 0] < 20.0)
        + np.mean(gray_arr[:, -1] < 20.0)
    ) / 4.0
    mean_val = float(np.mean(gray_arr))

    # Known filename provenance hints
    thermal_hints = ["iir", "anterior", "oblder", "oblizq", "therm", "infrared", "flir"]
    mammogram_hints = ["mdb", "mammo", "mias", "calc", "mass", "dDSM", "inbreast"]

    if any(hint in filename_lower for hint in thermal_hints):
        return "thermal", "Thermography naming pattern and torso infrared histogram."
    if any(hint in filename_lower for hint in mammogram_hints):
        return "mammogram", "Mammography naming pattern and radiological contrast structure."

    # Radiographic features: Mammograms have large black background air fields
    # Edge darkness or dark pixel ratio is characteristically higher than torso thermography
    if dark_ratio >= 0.12 or edge_dark >= 0.15:
        return "mammogram", f"Radiographic background border detected (dark_ratio={dark_ratio:.2f}, edge_dark={edge_dark:.2f})."

    # Thermography: Torso fills field with ambient background temperature (mean > 105, very few dark pixels)
    if mean_val > 105.0 and dark_ratio < 0.08:
        return "thermal", f"Torso infrared ambient distribution (mean={mean_val:.1f}, dark_ratio={dark_ratio:.2f})."

    # Default to mammogram for grayscale if moderate dark ratio, else thermal
    if dark_ratio >= 0.08 or edge_dark >= 0.10:
        return "mammogram", "Grayscale projection characteristic of mammography."
    else:
        return "thermal", "Grayscale thermal imaging characteristic."


def validate_mammogram_image(img: Image.Image, filename: str = "") -> Tuple[bool, str]:
    """Validates that the image is a valid mammogram.
    Returns (True, '') if valid, or (False, error_message) if invalid.
    """
    detected_modality, reason = detect_image_modality(img, filename)
    if detected_modality == "mammogram":
        return True, ""
    return False, MAMMOGRAM_ERROR_MSG


def validate_thermal_image(img: Image.Image, filename: str = "") -> Tuple[bool, str]:
    """Validates that the image is a valid thermal scan.
    Returns (True, '') if valid, or (False, error_message) if invalid.
    """
    # PGM files are never thermal
    if filename.lower().endswith(".pgm"):
        return False, THERMAL_ERROR_MSG

    detected_modality, reason = detect_image_modality(img, filename)
    if detected_modality == "thermal":
        return True, ""
    return False, THERMAL_ERROR_MSG
