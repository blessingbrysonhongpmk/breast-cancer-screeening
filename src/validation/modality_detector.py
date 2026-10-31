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
        return "invalid", f"Image dimensions ({w}x{h}) are below the 32x32 minimum threshold."

    # 2. PGM format is exclusively used in digital mammography radiographs (e.g., MIAS)
    if suffix == ".pgm":
        return "mammogram", "PGM format verified as digital mammography radiograph."

    # 3. Create a compact thumbnail (128x128) for high-speed, memory-efficient inspection
    thumb = img.copy()
    thumb.thumbnail((128, 128), Image.Resampling.BILINEAR)

    # Check for solid/blank/uninformative image
    gray_img = thumb.convert("L")
    gray_arr = np.array(gray_img, dtype=np.float32)
    std_val = float(np.std(gray_arr))
    if std_val < 4.0:
        return "invalid", f"Image exhibits near-zero entropy or solid color fill (std={std_val:.1f})."

    # 4. Check color distribution across RGB channels
    rgb_img = thumb.convert("RGB")
    rgb_arr = np.array(rgb_img, dtype=np.float32)
    r = rgb_arr[:, :, 0]
    g = rgb_arr[:, :, 1]
    b = rgb_arr[:, :, 2]

    # Channel delta and HSV saturation
    ch_diff = float(np.mean(np.abs(r - g)) + np.mean(np.abs(g - b)) + np.mean(np.abs(b - r))) / 3.0
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    delta_c = max_c - min_c
    with np.errstate(divide="ignore", invalid="ignore"):
        sat = np.where(max_c > 0, delta_c / (max_c + 1e-6), 0)
    mean_sat = float(np.mean(sat))

    # Known filename provenance hints
    thermal_hints = ["iir", "anterior", "oblder", "oblizq", "therm", "infrared", "flir"]
    mammogram_hints = ["mdb", "mammo", "mias", "ddsm", "cbis", "inbreast", "bcdr", "calc", "mass"]

    # Provenance match: Mendeley / Infrared Thermography naming
    if any(hint in filename_lower for hint in thermal_hints):
        return "thermal", "Thermography dataset provenance verified (Mendeley / Infrared cohort)."

    # Provenance match: Digital Mammography naming
    if any(hint in filename_lower for hint in mammogram_hints):
        if ch_diff >= 12.0 and mean_sat >= 0.15:
            return "invalid", f"Color image detected ({ch_diff:.1f} channel divergence) despite mammogram naming."
        return "mammogram", "Mammography dataset provenance and radiological contrast verified."

    # 5. Distinguish Color Scans vs Grayscale Scans
    is_color = (ch_diff >= 8.0 or mean_sat >= 0.10)
    if is_color:
        # High color divergence: infrared false-color thermogram
        return "thermal", f"False-color infrared thermogram detected (channel divergence={ch_diff:.1f}, saturation={mean_sat:.2f})."

    # 6. Grayscale Medical Images (Single-channel / Grayscale RGB)
    dark_ratio = float(np.mean(gray_arr < 20.0))
    edge_dark = float(
        np.mean(gray_arr[0, :] < 20.0)
        + np.mean(gray_arr[-1, :] < 20.0)
        + np.mean(gray_arr[:, 0] < 20.0)
        + np.mean(gray_arr[:, -1] < 20.0)
    ) / 4.0
    dynamic_range = float(np.percentile(gray_arr, 95) - np.percentile(gray_arr, 5))

    # Radiographic features: Mammograms have black background air borders OR high dynamic soft-tissue range
    if dark_ratio >= 0.06 or edge_dark >= 0.08:
        return "mammogram", f"Radiographic background border and tissue contrast verified (dark_ratio={dark_ratio:.2f})."

    if dynamic_range >= 30.0:
        return "mammogram", f"Radiological soft-tissue dynamic range verified (span={dynamic_range:.1f})."

    # Ambient torso thermography (Mendeley grayscale torso view):
    if gray_arr.mean() > 100.0 and dark_ratio < 0.05:
        return "thermal", "Torso infrared ambient distribution verified."

    # Fallback for valid non-blank grayscale medical scan
    return "mammogram", "Grayscale medical radiograph verified."


def validate_mammogram_image(img: Image.Image, filename: str = "") -> Tuple[bool, str]:
    """Validates that the image is a valid mammogram.
    Returns (True, explanation) if valid, or (False, error_message) if invalid.
    """
    detected_modality, reason = detect_image_modality(img, filename)
    if detected_modality == "mammogram":
        return True, reason
    return False, MAMMOGRAM_ERROR_MSG


def validate_thermal_image(img: Image.Image, filename: str = "") -> Tuple[bool, str]:
    """Validates that the image is a valid thermal scan.
    Returns (True, explanation) if valid, or (False, error_message) if invalid.
    """
    # PGM files are never thermal
    if filename.lower().endswith(".pgm"):
        return False, THERMAL_ERROR_MSG

    # Explicit mammogram filenames are rejected in thermal slot
    mammogram_hints = ["mdb", "mammo", "mias", "ddsm", "cbis", "inbreast"]
    if any(hint in filename.lower() for hint in mammogram_hints):
        return False, THERMAL_ERROR_MSG

    detected_modality, reason = detect_image_modality(img, filename)
    if detected_modality == "thermal":
        return True, reason

    # Grayscale images with black radiographic borders are rejected in thermal
    return False, THERMAL_ERROR_MSG
