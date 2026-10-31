"""PyTorch Dataset classes for mammography and thermography modalities.
Supports both preprocessed-on-disk and on-the-fly transform modes.
Training-time augmentations (random flip, rotation) are applied here.
"""

import csv
import torch
import numpy as np
from torch.utils.data import Dataset
from torchvision import transforms as T
from PIL import Image
from pathlib import Path
from typing import Dict, List, Any, Optional, Callable

# Label encoding: consistent across modalities
LABEL_TO_IDX = {"normal": 0, "benign": 1, "malignant": 2}
IDX_TO_LABEL = {v: k for k, v in LABEL_TO_IDX.items()}
NUM_CLASSES = len(LABEL_TO_IDX)

# ImageNet normalization stats (used for pretrained backbone fine-tuning)
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# Grayscale single-channel normalization (for mammograms without pretrained backbone)
GRAYSCALE_MEAN = [0.5]
GRAYSCALE_STD = [0.5]


def get_mammogram_train_transforms(target_size: int = 224) -> T.Compose:
    """Training-time augmentation transforms for mammograms.
    Grayscale input → 1-channel tensor → replicate to 3 channels for pretrained backbones.
    """
    return T.Compose([
        T.Resize((target_size, target_size)),
        T.RandomHorizontalFlip(p=0.5),
        T.RandomRotation(degrees=10),
        T.RandomAffine(degrees=0, translate=(0.05, 0.05)),
        T.ToTensor(),  # Converts PIL (H,W) → (1, H, W) float [0,1]
        T.Lambda(lambda x: x.repeat(3, 1, 1) if x.shape[0] == 1 else x),  # 1ch → 3ch
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_mammogram_eval_transforms(target_size: int = 224) -> T.Compose:
    """Evaluation-time transforms for mammograms (deterministic, no augmentation)."""
    return T.Compose([
        T.Resize((target_size, target_size)),
        T.ToTensor(),
        T.Lambda(lambda x: x.repeat(3, 1, 1) if x.shape[0] == 1 else x),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_thermal_train_transforms(target_size: int = 224) -> T.Compose:
    """Training-time augmentation transforms for thermal images (RGB false-color)."""
    return T.Compose([
        T.Resize((target_size, target_size)),
        T.RandomHorizontalFlip(p=0.5),
        T.RandomRotation(degrees=10),
        T.ColorJitter(brightness=0.1, contrast=0.1),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_thermal_eval_transforms(target_size: int = 224) -> T.Compose:
    """Evaluation-time transforms for thermal images (deterministic)."""
    return T.Compose([
        T.Resize((target_size, target_size)),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


class MammogramDataset(Dataset):
    """PyTorch Dataset for MIAS mammogram images.

    Loads images from either raw or preprocessed directories.
    Applies torchvision transforms for augmentation and normalization.
    Filters out 'unannotated' samples by default.
    """

    def __init__(
        self,
        manifest_csv: Path,
        image_root_dir: Path,
        transform: Optional[Callable] = None,
        label_column: str = "label",
        path_column: str = "relative_path",
        exclude_unannotated: bool = True
    ):
        self.image_root_dir = Path(image_root_dir)
        self.transform = transform
        self.label_column = label_column
        self.path_column = path_column

        with open(manifest_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            records = list(reader)

        if exclude_unannotated:
            records = [r for r in records if r.get(label_column, "").lower() in LABEL_TO_IDX]

        self.records = records

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        rec = self.records[idx]
        filename = rec.get("filename", "")
        rel_path = rec.get(self.path_column, filename)

        # Check preprocessed 224x224 PNG first for ultra-fast I/O
        stem_png = Path(filename).with_suffix(".png").name
        proc_path = self.image_root_dir / stem_png
        raw_path = self.image_root_dir / rel_path

        img_path = proc_path if proc_path.exists() else raw_path

        # Load as grayscale PIL Image
        try:
            image = Image.open(img_path).convert("L")
        except Exception:
            image = Image.new("L", (224, 224), 0)

        if self.transform:
            image = self.transform(image)

        label_str = rec.get(self.label_column, "normal").lower()
        label_idx = LABEL_TO_IDX.get(label_str, 0)

        return {
            "image": image,
            "label": torch.tensor(label_idx, dtype=torch.long),
            "label_name": label_str,
            "filename": filename,
            "patient_id": rec.get("patient_id", ""),
        }


class ThermalDataset(Dataset):
    """PyTorch Dataset for Mendeley Breast Thermography images.

    Loads RGB thermal false-color images.
    Applies torchvision transforms for augmentation and normalization.
    Filters out 'unannotated' samples by default.
    """

    def __init__(
        self,
        manifest_csv: Path,
        image_root_dir: Path,
        transform: Optional[Callable] = None,
        label_column: str = "label",
        path_column: str = "relative_path",
        exclude_unannotated: bool = True
    ):
        self.image_root_dir = Path(image_root_dir)
        self.transform = transform
        self.label_column = label_column
        self.path_column = path_column

        with open(manifest_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            records = list(reader)

        if exclude_unannotated:
            records = [r for r in records if r.get(label_column, "").lower() in LABEL_TO_IDX]

        self.records = records

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        rec = self.records[idx]
        filename = rec.get("filename", "")
        rel_path = rec.get(self.path_column, filename)

        # Check preprocessed 224x224 PNG first
        stem_png = Path(filename).with_suffix(".png").name
        proc_path = self.image_root_dir / stem_png
        raw_path = self.image_root_dir / rel_path

        img_path = proc_path if proc_path.exists() else raw_path

        try:
            image = Image.open(img_path).convert("RGB")
        except Exception:
            image = Image.new("RGB", (224, 224), (0, 0, 0))

        if self.transform:
            image = self.transform(image)

        label_str = rec.get(self.label_column, "normal").lower()
        label_idx = LABEL_TO_IDX.get(label_str, 0)

        return {
            "image": image,
            "label": torch.tensor(label_idx, dtype=torch.long),
            "label_name": label_str,
            "filename": filename,
            "patient_id": rec.get("patient_id", ""),
        }

