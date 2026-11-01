"""
Cross-Attention Multimodal Fusion Architecture for MammoFusion-XAI.

Architecture:
  - Mammogram branch: Frozen ResNet-50 backbone → 2048-dim → Linear(512) [Q, K source]
  - Thermal branch:   Frozen ResNet-50 backbone → 2048-dim → Linear(512) [V source]
  - Cross-Attention:  Multi-head attention where mammogram queries attend over thermal values
  - Bidirectional:    Also computes thermal→mammogram attention; fuses both attended vectors
  - Classification:   Attended fused 1024-dim → LayerNorm → Dropout → 3-class MLP

IMPORTANT DATA DISCLOSURE:
  This model is trained on label-stratified cross-cohort image pairs:
  - Mammograms: MIAS dataset (UK, 1994)
  - Thermograms: Mendeley/DMR-IR datasets (Mexico 2020, Brazil 2014)
  These are NOT genuine same-patient multimodal pairs. No public dataset
  provides matched mammography + thermography from identical patients.
  The cross-attention mechanism learns label-conditional feature correlations,
  not genuine patient-level anatomical alignment. Results are research-only
  and must not be interpreted as clinically validated paired inference.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import resnet50, ResNet50_Weights
from pathlib import Path
from typing import Optional, Tuple


class CrossModalAttention(nn.Module):
    """Multi-head cross-attention between mammogram and thermal feature embeddings.

    Given query Q (from mammography branch) and key/value KV (from thermal branch),
    computes attended thermal features weighted by mammographic query relevance.
    Also computes the reverse: thermal queries attending over mammographic features.
    """

    def __init__(self, embed_dim: int = 512, num_heads: int = 4, dropout: float = 0.1):
        super().__init__()
        assert embed_dim % num_heads == 0, "embed_dim must be divisible by num_heads"
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.head_dim = embed_dim // num_heads
        self.scale = self.head_dim ** -0.5

        # Mammogram → Thermal attention projections
        self.q_mammo = nn.Linear(embed_dim, embed_dim)
        self.k_thermal = nn.Linear(embed_dim, embed_dim)
        self.v_thermal = nn.Linear(embed_dim, embed_dim)
        self.out_mammo2thermal = nn.Linear(embed_dim, embed_dim)

        # Thermal → Mammogram attention projections (bidirectional)
        self.q_thermal = nn.Linear(embed_dim, embed_dim)
        self.k_mammo = nn.Linear(embed_dim, embed_dim)
        self.v_mammo = nn.Linear(embed_dim, embed_dim)
        self.out_thermal2mammo = nn.Linear(embed_dim, embed_dim)

        self.dropout = nn.Dropout(dropout)

    def _attend(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        q_proj: nn.Linear,
        k_proj: nn.Linear,
        v_proj: nn.Linear,
        out_proj: nn.Linear
    ) -> torch.Tensor:
        """Single-direction cross-attention. Input shapes: (B, D)."""
        B = query.shape[0]

        # (B, D) → (B, H, 1, head_dim) for 1-token sequence (global pooled features)
        Q = q_proj(query).view(B, self.num_heads, 1, self.head_dim)
        K = k_proj(key).view(B, self.num_heads, 1, self.head_dim)
        V = v_proj(value).view(B, self.num_heads, 1, self.head_dim)

        # Scaled dot-product attention: (B, H, 1, 1)
        attn_scores = (Q @ K.transpose(-2, -1)) * self.scale
        attn_weights = torch.softmax(attn_scores, dim=-1)
        attn_weights = self.dropout(attn_weights)

        # Attended output: (B, H, 1, head_dim) → (B, D)
        attended = (attn_weights @ V).view(B, self.embed_dim)
        return out_proj(attended)

    def forward(
        self,
        f_mammo: torch.Tensor,
        f_thermal: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Bidirectional cross-attention.

        Args:
            f_mammo: (B, embed_dim) mammogram features
            f_thermal: (B, embed_dim) thermal features

        Returns:
            Tuple of:
              - mammo_attends_thermal: (B, embed_dim) mammographic queries over thermal values
              - thermal_attends_mammo: (B, embed_dim) thermal queries over mammographic values
        """
        mammo_attends_thermal = self._attend(
            f_mammo, f_thermal, f_thermal,
            self.q_mammo, self.k_thermal, self.v_thermal,
            self.out_mammo2thermal
        )
        thermal_attends_mammo = self._attend(
            f_thermal, f_mammo, f_mammo,
            self.q_thermal, self.k_mammo, self.v_mammo,
            self.out_thermal2mammo
        )
        return mammo_attends_thermal, thermal_attends_mammo


class CrossAttentionFusionClassifier(nn.Module):
    """Cross-Attention Multimodal Fusion Classifier.

    Data disclosure: Trained on label-stratified cross-cohort pairs
    (MIAS mammograms + Mendeley/DMR-IR thermograms). Not genuine
    same-patient paired data. Results are research/exploratory only.
    """

    MODEL_TYPE = "CrossAttentionFusion"
    DATA_PAIRING_NOTE = (
        "Label-stratified cross-cohort pairs (MIAS + Mendeley/DMR-IR). "
        "NOT genuine same-patient multimodal data. Research use only."
    )

    def __init__(
        self,
        num_classes: int = 3,
        embed_dim: int = 512,
        num_heads: int = 4,
        dropout: float = 0.2
    ):
        super().__init__()
        self.num_classes = num_classes
        self.embed_dim = embed_dim

        # ── Frozen backbone feature extractors ──────────────────────────────
        self.mammo_backbone = resnet50(weights=None)
        self.mammo_backbone.fc = nn.Identity()
        self.thermal_backbone = resnet50(weights=None)
        self.thermal_backbone.fc = nn.Identity()

        # Freeze — backbones are pretrained unimodal; we only train attention heads
        for p in self.mammo_backbone.parameters():
            p.requires_grad = False
        for p in self.thermal_backbone.parameters():
            p.requires_grad = False

        # ── Feature projection (2048 → embed_dim) ───────────────────────────
        self.mammo_proj = nn.Sequential(
            nn.Linear(2048, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.GELU(),
            nn.Dropout(dropout * 0.5)
        )
        self.thermal_proj = nn.Sequential(
            nn.Linear(2048, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.GELU(),
            nn.Dropout(dropout * 0.5)
        )

        # ── Bidirectional Cross-Attention ────────────────────────────────────
        self.cross_attention = CrossModalAttention(
            embed_dim=embed_dim,
            num_heads=num_heads,
            dropout=dropout * 0.5
        )

        # ── Post-attention normalization & residual ──────────────────────────
        self.norm_mammo = nn.LayerNorm(embed_dim)
        self.norm_thermal = nn.LayerNorm(embed_dim)

        # ── Fusion classification head ────────────────────────────────────────
        # Concatenate: projected_mammo + attended_mammo + projected_thermal + attended_thermal
        # = 4 × embed_dim
        self.fusion_head = nn.Sequential(
            nn.Linear(embed_dim * 4, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(embed_dim, embed_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout * 0.5),
            nn.Linear(embed_dim // 2, num_classes)
        )

    def _project_features(
        self, raw_mammo: torch.Tensor, raw_thermal: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Project 2048-dim backbone features to embed_dim."""
        return self.mammo_proj(raw_mammo), self.thermal_proj(raw_thermal)

    def forward_from_features(
        self, f_mammo_2048: torch.Tensor, f_thermal_2048: torch.Tensor
    ) -> torch.Tensor:
        """Forward pass from pre-extracted 2048-dim features (memory-efficient path)."""
        p_mammo, p_thermal = self._project_features(f_mammo_2048, f_thermal_2048)

        # Cross-attention (bidirectional)
        attended_m2t, attended_t2m = self.cross_attention(p_mammo, p_thermal)

        # Residual + LayerNorm
        r_mammo = self.norm_mammo(p_mammo + attended_m2t)
        r_thermal = self.norm_thermal(p_thermal + attended_t2m)

        # Concatenate all representations
        fused = torch.cat([p_mammo, r_mammo, p_thermal, r_thermal], dim=1)  # (B, 4*D)
        return self.fusion_head(fused)

    def forward(self, x_mammo: torch.Tensor, x_thermal: torch.Tensor) -> torch.Tensor:
        """Full forward pass from raw image tensors (for inference and Grad-CAM).

        When backbone parameters require grad (e.g. during Grad-CAM attribution),
        gradients flow through normally. Otherwise runs in no_grad for efficiency.
        """
        backbones_need_grad = any(
            p.requires_grad for p in self.mammo_backbone.parameters()
        )
        if backbones_need_grad:
            f_mammo = self.mammo_backbone(x_mammo)
            f_thermal = self.thermal_backbone(x_thermal)
        else:
            with torch.no_grad():
                f_mammo = self.mammo_backbone(x_mammo)
                f_thermal = self.thermal_backbone(x_thermal)
        return self.forward_from_features(f_mammo, f_thermal)

    def predict_probabilities(
        self, x_mammo: torch.Tensor, x_thermal: torch.Tensor
    ) -> torch.Tensor:
        """Returns softmax class probabilities."""
        self.eval()
        with torch.no_grad():
            logits = self.forward(x_mammo, x_thermal)
            return torch.softmax(logits, dim=1)

    def load_unimodal_weights(
        self, mammo_checkpoint_path: Path, thermal_checkpoint_path: Path
    ) -> None:
        """Load trained unimodal ResNet-50 backbone weights."""
        device = torch.device("cpu")
        for ckpt_path, backbone in [
            (mammo_checkpoint_path, self.mammo_backbone),
            (thermal_checkpoint_path, self.thermal_backbone)
        ]:
            if ckpt_path and ckpt_path.exists():
                ckpt = torch.load(ckpt_path, map_location=device)
                state = ckpt.get("model_state_dict", ckpt)
                # Extract backbone-only weights (exclude FC head)
                backbone_state = {
                    k.replace("backbone.", ""): v
                    for k, v in state.items()
                    if k.startswith("backbone.") and not k.startswith("backbone.fc")
                }
                if backbone_state:
                    backbone.load_state_dict(backbone_state, strict=False)

    def get_mammogram_target_layer(self) -> nn.Module:
        return self.mammo_backbone.layer4[-1]

    def get_thermal_target_layer(self) -> nn.Module:
        return self.thermal_backbone.layer4[-1]

    def get_target_layer(self) -> nn.Module:
        return self.thermal_backbone.layer4[-1]


class ProbabilisticEnsemble(nn.Module):
    """Learnable alpha-weighted ensemble of mammogram and thermal softmax predictions.

    p_ensemble = alpha * p_mammo + (1 - alpha) * p_thermal

    alpha is a learned scalar initialized to 0.5.
    This is scientifically valid: no same-patient pairing is assumed.
    Each branch is independently trained on its own population.
    """

    MODEL_TYPE = "ProbabilisticEnsemble"

    def __init__(self, num_classes: int = 3):
        super().__init__()
        self.num_classes = num_classes
        # Learnable log-odds weight for alpha
        self.log_alpha = nn.Parameter(torch.zeros(1))  # sigmoid(0) = 0.5

    @property
    def alpha(self) -> float:
        return float(torch.sigmoid(self.log_alpha).item())

    def forward(
        self, p_mammo: torch.Tensor, p_thermal: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            p_mammo: (B, C) softmax probabilities from mammogram model
            p_thermal: (B, C) softmax probabilities from thermal model
        Returns:
            (B, C) weighted ensemble probabilities
        """
        alpha = torch.sigmoid(self.log_alpha)
        return alpha * p_mammo + (1.0 - alpha) * p_thermal

    def get_target_layer(self) -> None:
        return None

    def get_mammogram_target_layer(self) -> None:
        return None

    def get_thermal_target_layer(self) -> None:
        return None

