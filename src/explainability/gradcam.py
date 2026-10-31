"""Grad-CAM: Visual Explanations from Deep Networks via Gradient-based Localization.
Calculates class-discriminative saliency maps from convolutional feature activations
without requiring architectural modification or retraining.
Reference: Selvaraju et al., 2017 (ICCV).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from PIL import Image
from typing import Optional, Tuple, Union


class GradCAM:
    """Computes Grad-CAM heatmaps for a given CNN model and target convolutional layer."""

    def __init__(self, model: nn.Module, target_layer: nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.activations: Optional[torch.Tensor] = None
        self.gradients: Optional[torch.Tensor] = None
        self.handles = []

        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_input, grad_output):
            self.gradients = grad_output[0].detach()

        h_fwd = self.target_layer.register_forward_hook(forward_hook)
        h_bwd = self.target_layer.register_full_backward_hook(backward_hook)
        self.handles = [h_fwd, h_bwd]

    def remove_hooks(self):
        """Cleanly removes registered hooks to avoid memory accumulation."""
        for h in self.handles:
            try:
                h.remove()
            except Exception:
                pass
        self.handles = []

    def generate(
        self,
        input_tensor: torch.Tensor,
        target_class: Optional[int] = None
    ) -> Tuple[np.ndarray, int, float]:
        """Generates normalized 2D Grad-CAM heatmap for an input tensor.

        Args:
            input_tensor: Tensor of shape (1, C, H, W) on same device as model.
            target_class: Target class index. If None, highest scoring class is chosen.

        Returns:
            heatmap_np: 2D numpy array of shape (H, W) in range [0.0, 1.0].
            predicted_class: Integer index of predicted/target class.
            confidence: Probability of the predicted/target class (via softmax).
        """
        self.model.eval()
        self.model.zero_grad()

        # Forward pass
        logits = self.model(input_tensor)
        probabilities = F.softmax(logits, dim=1)

        if target_class is None:
            target_class = int(torch.argmax(logits, dim=1).item())

        confidence = float(probabilities[0, target_class].item())

        try:
            # Target class score
            score = logits[0, target_class]
            score.backward()

            if self.gradients is None or self.activations is None:
                raise RuntimeError("Gradients or activations were not captured. Check target_layer registration.")

            # Global average pooling of gradients: weights alpha_k = (1/Z) * sum(grad)
            weights = torch.mean(self.gradients, dim=(2, 3), keepdim=True)  # (1, C, 1, 1)

            # Weighted combination of forward activation maps
            cam = torch.sum(weights * self.activations, dim=1, keepdim=True)  # (1, 1, H_feat, W_feat)

            # Apply ReLU to retain only positive influences
            cam = F.relu(cam)

            # Upsample to match original input tensor height & width
            h, w = input_tensor.shape[2], input_tensor.shape[3]
            cam = F.interpolate(cam, size=(h, w), mode="bilinear", align_corners=False)

            # Normalize to [0.0, 1.0]
            cam_np = cam.squeeze().cpu().numpy()
            cam_min, cam_max = cam_np.min(), cam_np.max()
            if cam_max > cam_min:
                cam_np = (cam_np - cam_min) / (cam_max - cam_min)
            else:
                cam_np = np.zeros_like(cam_np)

            return cam_np, target_class, confidence
        finally:
            self.remove_hooks()
            self.model.zero_grad(set_to_none=True)


def apply_colormap_to_cam(
    heatmap: np.ndarray,
    original_pil: Image.Image,
    alpha: float = 0.45
) -> Image.Image:
    """Blends a 2D float heatmap [0, 1] onto an original PIL Image with pseudocolor overlay."""
    import matplotlib.cm as cm

    # Convert heatmap to Turbo or Jet colormap RGBA
    try:
        import matplotlib
        colormap = matplotlib.colormaps["turbo"]
    except Exception:
        colormap = cm.get_cmap("turbo")
    colored_cam = colormap(heatmap)[:, :, :3]  # Drop alpha, keep RGB float [0,1]
    colored_cam = (colored_cam * 255).astype(np.uint8)
    cam_pil = Image.fromarray(colored_cam).resize(original_pil.size, Image.BILINEAR)

    # Ensure original image is RGB
    orig_rgb = original_pil.convert("RGB")

    # Blend images
    blended = Image.blend(orig_rgb, cam_pil, alpha=alpha)
    return blended


def extract_cam_roi(
    heatmap: np.ndarray,
    original_size: Tuple[int, int],
    threshold_ratio: float = 0.60
) -> dict:
    """Extracts region-of-interest (ROI) bounding box and focal attention metrics from Grad-CAM.

    Args:
        heatmap: 2D numpy array [H, W] normalized to [0.0, 1.0].
        original_size: (width, height) of the original unscaled image.
        threshold_ratio: Threshold fraction of peak activation to define focal ROI.

    Returns:
        dict with roi_box [xmin, ymin, xmax, ymax], peak_coords [x, y], coverage_percent, mean_focal_intensity.
    """
    orig_w, orig_h = original_size
    h, w = heatmap.shape
    peak_idx = np.unravel_index(np.argmax(heatmap), (h, w))
    peak_y, peak_x = int(peak_idx[0]), int(peak_idx[1])
    peak_scaled = [
        int(round((peak_x / max(1, w - 1)) * orig_w)),
        int(round((peak_y / max(1, h - 1)) * orig_h))
    ]

    peak_val = float(heatmap[peak_y, peak_x])
    if peak_val > 0.05:
        threshold = threshold_ratio * peak_val
        mask = heatmap >= threshold
        y_indices, x_indices = np.where(mask)
        if len(y_indices) > 0:
            ymin = int(round((np.min(y_indices) / max(1, h - 1)) * orig_h))
            ymax = int(round((np.max(y_indices) / max(1, h - 1)) * orig_h))
            xmin = int(round((np.min(x_indices) / max(1, w - 1)) * orig_w))
            xmax = int(round((np.max(x_indices) / max(1, w - 1)) * orig_w))
            coverage = round(float(np.mean(mask)) * 100.0, 2)
            focal_intensity = round(float(np.mean(heatmap[mask])), 4)
            roi_box = [max(0, xmin), max(0, ymin), min(orig_w, xmax), min(orig_h, ymax)]
        else:
            roi_box = [0, 0, orig_w, orig_h]
            coverage = 100.0
            focal_intensity = round(float(np.mean(heatmap)), 4)
    else:
        roi_box = [0, 0, orig_w, orig_h]
        coverage = 100.0
        focal_intensity = round(float(np.mean(heatmap)), 4)

    return {
        "roi_box": roi_box,
        "peak_coords": peak_scaled,
        "coverage_percent": coverage,
        "mean_focal_intensity": focal_intensity
    }

