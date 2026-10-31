"""Image preprocessing transforms for mammography and thermography.
Applies clinically-motivated transforms: CLAHE for mammograms, standard resize/normalize for both.
All transforms are deterministic and reproducible for the preprocessing-to-disk phase.
Training-time augmentations are handled separately in the Dataset classes.
"""

import cv2
import numpy as np
from PIL import Image
from pathlib import Path
from typing import Dict, Any, Optional, Tuple


def load_image(image_path: Path, grayscale: bool = False) -> Optional[np.ndarray]:
    """Loads an image file robustly, handling PGM (MIAS) and standard formats.

    Returns:
        numpy array in uint8, shape (H, W) for grayscale or (H, W, 3) BGR for color.
        None if the image cannot be read.
    """
    image_path = Path(image_path)
    flag = cv2.IMREAD_GRAYSCALE if grayscale else cv2.IMREAD_COLOR

    # cv2.imread can handle PGM natively
    img = cv2.imread(str(image_path), flag)
    if img is not None:
        return img

    # Fallback: try PIL then convert
    try:
        pil_img = Image.open(image_path)
        if grayscale:
            pil_img = pil_img.convert("L")
            return np.array(pil_img, dtype=np.uint8)
        else:
            pil_img = pil_img.convert("RGB")
            # Convert RGB to BGR for OpenCV consistency
            return cv2.cvtColor(np.array(pil_img, dtype=np.uint8), cv2.COLOR_RGB2BGR)
    except Exception:
        return None


def apply_clahe(
    image: np.ndarray,
    clip_limit: float = 2.0,
    tile_grid_size: Tuple[int, int] = (8, 8)
) -> np.ndarray:
    """Applies Contrast Limited Adaptive Histogram Equalization (CLAHE).
    Standard preprocessing for mammography to enhance tissue contrast
    while avoiding noise amplification.

    Args:
        image: Grayscale uint8 image (H, W).
        clip_limit: Threshold for contrast limiting.
        tile_grid_size: Size of grid for contextual region division.

    Returns:
        CLAHE-enhanced grayscale uint8 image.
    """
    if len(image.shape) != 2:
        raise ValueError(f"CLAHE expects grayscale input, got shape {image.shape}")
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    return clahe.apply(image)


def resize_image(
    image: np.ndarray,
    target_size: Tuple[int, int] = (224, 224),
    interpolation: int = cv2.INTER_AREA
) -> np.ndarray:
    """Resizes image to target_size (width, height).

    Uses INTER_AREA for downscaling (anti-aliased, avoids moiré artifacts)
    and INTER_LINEAR for upscaling.
    """
    h, w = image.shape[:2]
    tw, th = target_size
    if h > th or w > tw:
        interp = cv2.INTER_AREA  # Best for downsampling
    else:
        interp = interpolation
    return cv2.resize(image, (tw, th), interpolation=interp)


def normalize_to_float32(image: np.ndarray) -> np.ndarray:
    """Converts uint8 image to float32 in [0, 1] range."""
    return image.astype(np.float32) / 255.0


def preprocess_mammogram(
    image_path: Path,
    target_size: Tuple[int, int] = (224, 224),
    apply_clahe_enhancement: bool = True,
    clahe_clip_limit: float = 2.0
) -> Optional[Dict[str, Any]]:
    """Full preprocessing pipeline for a single MIAS mammogram image.

    Steps:
        1. Load as grayscale
        2. Apply CLAHE contrast enhancement (optional but recommended)
        3. Resize to target_size
        4. Result is uint8 grayscale, ready to save as PNG

    Returns:
        Dict with 'image' (np.ndarray uint8), 'original_shape', 'preprocessed_shape',
        or None if loading failed.
    """
    img = load_image(image_path, grayscale=True)
    if img is None:
        return None

    original_shape = img.shape

    if apply_clahe_enhancement:
        img = apply_clahe(img, clip_limit=clahe_clip_limit)

    img = resize_image(img, target_size)

    return {
        "image": img,
        "original_shape": original_shape,
        "preprocessed_shape": img.shape,
        "grayscale": True,
        "clahe_applied": apply_clahe_enhancement
    }


def preprocess_thermal(
    image_path: Path,
    target_size: Tuple[int, int] = (224, 224)
) -> Optional[Dict[str, Any]]:
    """Full preprocessing pipeline for a single Mendeley breast thermography image.

    Steps:
        1. Load as color (RGB false-color thermal)
        2. Resize to target_size
        3. Result is uint8 BGR, ready to save as PNG

    Returns:
        Dict with 'image' (np.ndarray uint8 BGR), 'original_shape', 'preprocessed_shape',
        or None if loading failed.
    """
    img = load_image(image_path, grayscale=False)
    if img is None:
        return None

    original_shape = img.shape
    img = resize_image(img, target_size)

    return {
        "image": img,
        "original_shape": original_shape,
        "preprocessed_shape": img.shape,
        "grayscale": False,
        "clahe_applied": False
    }


def save_preprocessed_image(
    image: np.ndarray,
    output_path: Path
) -> bool:
    """Saves a preprocessed image as PNG (lossless, compact for 8-bit data)."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        cv2.imwrite(str(output_path), image, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        return True
    except Exception:
        return False

