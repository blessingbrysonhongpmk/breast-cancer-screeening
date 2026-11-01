"""Multimodal Fusion Deep Learning Model Architecture.
Combines Mammography (radiography) and Breast Thermography (infrared) feature representations
into a unified multimodal classification network for high-accuracy oncological triage.
"""

from .model import MultimodalFusionClassifier

__all__ = ["MultimodalFusionClassifier"]

