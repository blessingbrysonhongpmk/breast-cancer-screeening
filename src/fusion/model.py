"""Dual-Branch Multimodal Deep Learning Fusion Architecture.
Combines Mammography (X-ray radiography) and Breast Thermography (infrared pseudocolor)
feature extractors into a unified multimodal network for high-accuracy oncological triage.
"""

import torch
import torch.nn as nn
from torchvision.models import resnet50, ResNet50_Weights
from typing import Dict, Any, Tuple, Optional
from pathlib import Path


class MultimodalFusionClassifier(nn.Module):
    """Two-Branch ResNet-50 Multimodal Fusion Network for Breast Cancer Screening.
    
    Architecture:
      - Branch A: Mammogram ResNet-50 deep feature extractor (2048-dim representation)
      - Branch B: Thermal ResNet-50 deep feature extractor (2048-dim representation)
      - Modality Projection: Individual 512-dim normalized embedding spaces
      - Cross-Modal Fusion: Concatenation (1024-dim) followed by a deep MLP triage classifier
      - Target Layers: Dedicated Layer4 bottlenecks for independent mammogram & thermal Grad-CAM
    """

    def __init__(self, num_classes: int = 3, pretrained: bool = False, freeze_backbones: bool = True):
        super().__init__()
        self.num_classes = num_classes
        self.freeze_backbones = freeze_backbones

        # 1. Mammography Branch (ResNet-50)
        try:
            m_weights = ResNet50_Weights.DEFAULT if pretrained else None
            self.mammo_backbone = resnet50(weights=m_weights)
        except Exception:
            self.mammo_backbone = resnet50(weights=None)
        
        # Strip final FC layer to retain 2048-dim pooled features
        self.mammo_in_features = self.mammo_backbone.fc.in_features
        self.mammo_backbone.fc = nn.Identity()

        # 2. Breast Thermography Branch (ResNet-50)
        try:
            t_weights = ResNet50_Weights.DEFAULT if pretrained else None
            self.thermal_backbone = resnet50(weights=t_weights)
        except Exception:
            self.thermal_backbone = resnet50(weights=None)
            
        self.thermal_in_features = self.thermal_backbone.fc.in_features
        self.thermal_backbone.fc = nn.Identity()

        # 3. Modality-Specific Feature Projection Layers
        self.mammo_projection = nn.Sequential(
            nn.Linear(self.mammo_in_features, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.25)
        )

        self.thermal_projection = nn.Sequential(
            nn.Linear(self.thermal_in_features, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.25)
        )

        # 4. Cross-Modal Fusion Head (1024 -> 256 -> 3)
        self.fusion_head = nn.Sequential(
            nn.Linear(1024, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.30),
            nn.Linear(256, num_classes)
        )

        if self.freeze_backbones:
            for p in self.mammo_backbone.parameters():
                p.requires_grad = False
            for p in self.thermal_backbone.parameters():
                p.requires_grad = False

    def forward(self, x_mammo: torch.Tensor, x_thermal: torch.Tensor) -> torch.Tensor:
        """Forward pass for multimodal pair.
        
        Args:
            x_mammo: Tensor of shape (B, 3, 224, 224) - Preprocessed mammogram
            x_thermal: Tensor of shape (B, 3, 224, 224) - Preprocessed thermogram
            
        Returns:
            Tensor of shape (B, 3) - Logits for Normal, Benign, Malignant
        """
        if self.freeze_backbones and self.training:
            with torch.no_grad():
                f_mammo = self.mammo_backbone(x_mammo)
                f_thermal = self.thermal_backbone(x_thermal)
        else:
            f_mammo = self.mammo_backbone(x_mammo)
            f_thermal = self.thermal_backbone(x_thermal)

        p_mammo = self.mammo_projection(f_mammo)
        p_thermal = self.thermal_projection(f_thermal)
        fused = torch.cat([p_mammo, p_thermal], dim=1)  # Shape (B, 1024)
        return self.fusion_head(fused)

    def predict_probabilities(
        self, x_mammo: torch.Tensor, x_thermal: torch.Tensor
    ) -> torch.Tensor:
        """Returns softmax class probabilities for the paired input."""
        self.eval()
        with torch.no_grad():
            logits = self.forward(x_mammo, x_thermal)
            return torch.softmax(logits, dim=1)

    def get_mammogram_target_layer(self) -> nn.Module:
        """Returns the final convolutional block of mammogram branch layer4 for Grad-CAM."""
        return self.mammo_backbone.layer4[-1]

    def get_thermal_target_layer(self) -> nn.Module:
        """Returns the final convolutional block of thermal branch layer4 for Grad-CAM."""
        return self.thermal_backbone.layer4[-1]

    def get_target_layer(self) -> nn.Module:
        """Default target layer interface for single-branch Grad-CAM callers."""
        return self.thermal_backbone.layer4[-1]

    def load_unimodal_weights(
        self, mammo_checkpoint_path: Path, thermal_checkpoint_path: Path
    ) -> None:
        """Transfers trained unimodal ResNet-50 weights into the fusion branches."""
        device = torch.device("cpu")
        
        if mammo_checkpoint_path and mammo_checkpoint_path.exists():
            mammo_ckpt = torch.load(mammo_checkpoint_path, map_location=device)
            state_dict = mammo_ckpt.get("model_state_dict", mammo_ckpt)
            backbone_state = {
                k.replace("backbone.", ""): v
                for k, v in state_dict.items()
                if k.startswith("backbone.") and not k.startswith("backbone.fc")
            }
            if backbone_state:
                self.mammo_backbone.load_state_dict(backbone_state, strict=False)

        if thermal_checkpoint_path and thermal_checkpoint_path.exists():
            thermal_ckpt = torch.load(thermal_checkpoint_path, map_location=device)
            state_dict = thermal_ckpt.get("model_state_dict", thermal_ckpt)
            backbone_state = {
                k.replace("backbone.", ""): v
                for k, v in state_dict.items()
                if k.startswith("backbone.") and not k.startswith("backbone.fc")
            }
            if backbone_state:
                self.thermal_backbone.load_state_dict(backbone_state, strict=False)
