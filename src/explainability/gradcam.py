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


def generate_cam_images(
    heatmap: np.ndarray,
    original_pil: Image.Image,
    alpha: float = 0.45
) -> Tuple[Image.Image, Image.Image]:
    """Generates both a blended heatmap overlay on the original image AND a standalone raw colormap heatmap.

    Args:
        heatmap: 2D numpy array [H, W] normalized to [0.0, 1.0].
        original_pil: Original PIL image to blend onto.
        alpha: Overlay blend weight [0.0, 1.0].

    Returns:
        (blended_img, raw_heatmap_img): Tuple of two PIL RGB images.
    """
    import matplotlib.cm as cm
    import matplotlib

    try:
        colormap = matplotlib.colormaps["turbo"]
    except Exception:
        colormap = cm.get_cmap("turbo")

    colored = colormap(heatmap)[:, :, :3]  # Drop alpha, float RGB [0, 1]
    colored_uint8 = (colored * 255).astype(np.uint8)

    # Downscale large original images (e.g. 4320x2048) to a max preview dimension of 1024 for memory safety and fast web streaming
    display_pil = original_pil.copy()
    if display_pil.width > 1024 or display_pil.height > 1024:
        display_pil.thumbnail((1024, 1024), Image.Resampling.BILINEAR)

    orig_rgb = display_pil.convert("RGB")
    raw_cam_pil = Image.fromarray(colored_uint8).resize(orig_rgb.size, Image.BILINEAR)
    blended = Image.blend(orig_rgb, raw_cam_pil, alpha=alpha)

    return blended, raw_cam_pil


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




class MultimodalGradCAM:
    """Computes dual Grad-CAM visual heatmaps for two-branch multimodal neural networks."""

    def __init__(self, model: nn.Module, mammo_layer: nn.Module, thermal_layer: nn.Module):
        self.model = model
        self.mammo_layer = mammo_layer
        self.thermal_layer = thermal_layer
        self.mammo_acts = None
        self.mammo_grads = None
        self.thermal_acts = None
        self.thermal_grads = None
        self.handles = []
        self._register_hooks()

    def _register_hooks(self):
        def m_fwd(m, i, o): self.mammo_acts = o.detach()
        def m_bwd(m, gi, go): self.mammo_grads = go[0].detach()
        def t_fwd(m, i, o): self.thermal_acts = o.detach()
        def t_bwd(m, gi, go): self.thermal_grads = go[0].detach()

        h1 = self.mammo_layer.register_forward_hook(m_fwd)
        h2 = self.mammo_layer.register_full_backward_hook(m_bwd)
        h3 = self.thermal_layer.register_forward_hook(t_fwd)
        h4 = self.thermal_layer.register_full_backward_hook(t_bwd)
        self.handles = [h1, h2, h3, h4]

    def remove_hooks(self):
        for h in self.handles:
            try: h.remove()
            except Exception: pass
        self.handles = []

    def generate(
        self,
        xm: torch.Tensor,
        xt: torch.Tensor,
        target_class: Optional[int] = None
    ) -> Tuple[np.ndarray, np.ndarray, int, float]:
        """Generates synchronized saliency heatmaps for both mammogram and thermal branches."""
        self.model.eval()
        self.model.zero_grad()
        
        logits = self.model(xm, xt)
        probs = F.softmax(logits, dim=1)
        if target_class is None:
            target_class = int(torch.argmax(logits, dim=1).item())
        confidence = float(probs[0, target_class].item())

        try:
            score = logits[0, target_class]
            score.backward()

            # Process Mammogram CAM
            if self.mammo_grads is not None and self.mammo_acts is not None:
                w_m = torch.mean(self.mammo_grads, dim=(2, 3), keepdim=True)
                cam_m = F.relu(torch.sum(w_m * self.mammo_acts, dim=1, keepdim=True))
                cam_m = F.interpolate(cam_m, size=(xm.shape[2], xm.shape[3]), mode="bilinear", align_corners=False)
                cam_m_np = cam_m.squeeze().cpu().numpy()
                if cam_m_np.max() > cam_m_np.min():
                    cam_m_np = (cam_m_np - cam_m_np.min()) / (cam_m_np.max() - cam_m_np.min())
                else:
                    cam_m_np = np.zeros_like(cam_m_np)
            else:
                cam_m_np = np.zeros((xm.shape[2], xm.shape[3]), dtype=np.float32)

            # Process Thermal CAM
            if self.thermal_grads is not None and self.thermal_acts is not None:
                w_t = torch.mean(self.thermal_grads, dim=(2, 3), keepdim=True)
                cam_t = F.relu(torch.sum(w_t * self.thermal_acts, dim=1, keepdim=True))
                cam_t = F.interpolate(cam_t, size=(xt.shape[2], xt.shape[3]), mode="bilinear", align_corners=False)
                cam_t_np = cam_t.squeeze().cpu().numpy()
                if cam_t_np.max() > cam_t_np.min():
                    cam_t_np = (cam_t_np - cam_t_np.min()) / (cam_t_np.max() - cam_t_np.min())
                else:
                    cam_t_np = np.zeros_like(cam_t_np)
            else:
                cam_t_np = np.zeros((xt.shape[2], xt.shape[3]), dtype=np.float32)

            return cam_m_np, cam_t_np, target_class, confidence
        finally:
            self.remove_hooks()
            self.model.zero_grad(set_to_none=True)
