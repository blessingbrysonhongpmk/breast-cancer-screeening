"""Deep Learning Model Architecture for Mammography Classification.
Uses a ResNet-50 deep convolutional network with pretrained transfer learning weights
and custom fine-tuning heads tailored to 3-class oncological triage (Normal, Benign, Malignant).
Includes hooks and references for Grad-CAM saliency extraction.
"""

import torch
import torch.nn as nn
from torchvision.models import resnet50, ResNet50_Weights
from typing import Dict, Any, Tuple, Optional


class MammogramClassifier(nn.Module):
    """Deep ResNet-50 Convolutional Neural Network for Mammogram Triage."""

    def __init__(self, num_classes: int = 3, pretrained: bool = True):
        super().__init__()
        self.num_classes = num_classes

        # Load ResNet-50 backbone
        try:
            weights = ResNet50_Weights.DEFAULT if pretrained else None
            self.backbone = resnet50(weights=weights)
        except Exception:
            # Fallback for offline environments without internet access
            self.backbone = resnet50(weights=None)

        # Replace classification head (in_features = 2048 for ResNet-50)
        in_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.35),
            nn.Linear(512, num_classes)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass. Expects tensor of shape (B, 3, 224, 224)."""
        return self.backbone(x)

    def get_target_layer(self) -> nn.Module:
        """Returns the final convolutional block of layer4 for Grad-CAM localization."""
        return self.backbone.layer4[-1]

    def predict_probabilities(self, x: torch.Tensor) -> torch.Tensor:
        """Returns softmax class probabilities."""
        self.eval()
        with torch.no_grad():
            logits = self.forward(x)
            return torch.softmax(logits, dim=1)

