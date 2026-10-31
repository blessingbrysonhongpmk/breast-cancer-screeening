"""Tests for advanced backend capabilities:
1. Predictive Shannon Entropy & Normalized Uncertainty Scoring.
2. Test-Time Augmentation (TTA) dual-view ensemble inference.
3. Grad-CAM Region-of-Interest (ROI) focal localization & bounding box estimation.
4. Peer-review Markdown research study report generation.
"""

import io
import pytest
import numpy as np
import torch
from PIL import Image
from fastapi.testclient import TestClient

from app.server import app
from src.evaluation.metrics import compute_prediction_uncertainty, predict_with_tta
from src.explainability.gradcam import extract_cam_roi
from src.mammogram.model import MammogramClassifier


@pytest.fixture
def client():
    return TestClient(app)


def test_predictive_uncertainty_confident():
    """Verifies that high-confidence prediction yields near-zero entropy and uncertainty."""
    confident_probs = np.array([0.98, 0.01, 0.01])
    metrics = compute_prediction_uncertainty(confident_probs)
    assert metrics["entropy"] < 0.2
    assert metrics["uncertainty_score"] < 0.2
    assert metrics["confidence_margin"] > 0.9


def test_predictive_uncertainty_equivocal():
    """Verifies that borderline uniform probabilities yield high entropy and uncertainty."""
    equivocal_probs = np.array([0.3333, 0.3333, 0.3334])
    metrics = compute_prediction_uncertainty(equivocal_probs)
    assert pytest.approx(metrics["uncertainty_score"], abs=0.05) == 1.0
    assert metrics["confidence_margin"] < 0.05


def test_predict_with_tta():
    """Verifies Test-Time Augmentation averages original and horizontally flipped forward passes."""
    model = MammogramClassifier(num_classes=3, pretrained=False)
    model.eval()
    dummy_input = torch.randn(1, 3, 224, 224)
    logits_tta = predict_with_tta(model, dummy_input)
    assert logits_tta.shape == (1, 3)
    assert not torch.isnan(logits_tta).any()


def test_extract_cam_roi_bounding_box():
    """Verifies Grad-CAM ROI extraction computes valid coordinates and coverage metrics."""
    # Synthetic heatmap with bright focal spot in top-left
    cam = np.zeros((224, 224), dtype=np.float32)
    cam[20:60, 30:70] = 0.9  # 40x40 hot spot

    roi = extract_cam_roi(cam, original_size=(1024, 1024), threshold_ratio=0.6)
    assert "roi_box" in roi
    assert len(roi["roi_box"]) == 4
    xmin, ymin, xmax, ymax = roi["roi_box"]
    assert xmin < xmax
    assert ymin < ymax
    assert 0 <= xmin <= 1024
    assert 0 <= ymin <= 1024
    assert roi["coverage_percent"] > 0.0
    assert 0.0 <= roi["mean_focal_intensity"] <= 1.0
    assert "peak_coords" in roi
    assert len(roi["peak_coords"]) == 2


def test_export_research_report_markdown_endpoint(client):
    """Verifies POST /api/reports/export-markdown generates structured research report."""
    sample_payload = {
        "filename": "scan_sample.png",
        "modality": "mammogram",
        "predicted_class": "benign",
        "confidence": 0.884,
        "probabilities": {"normal": 0.05, "benign": 0.884, "malignant": 0.066},
        "dimensions": {"width": 1024, "height": 1024},
        "color_mode": "L",
        "predictive_entropy": 0.412,
        "uncertainty_score": 0.375,
        "confidence_margin": 0.818,
        "attention_coverage_percent": 8.45,
        "peak_activation_coords": [320, 480],
        "tta_applied": True
    }
    res = client.post("/api/reports/export-markdown", json=sample_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["filename"].startswith("MammoFusion_Report_")
    md = data["markdown"]
    assert "# MammoFusion-XAI — Research Study Analysis Report" in md
    assert "BENIGN" in md
    assert "88.4%" in md
    assert "Dual-view ensemble" in md
    assert "Predictive Shannon Entropy" in md


def test_analyze_with_advanced_metrics(client):
    """Verifies POST /api/analyze returns advanced metrics and supports optional TTA flag."""
    img = Image.new("L", (224, 224), color=0)
    for y in range(40, 180):
        for x in range(40, 180):
            img.putpixel((x, y), 140)
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    files = {"file": ("test_advanced.png", buf.getvalue(), "image/png")}
    res = client.post("/api/analyze", files=files, data={"modality": "mammogram", "tta": "true"})
    assert res.status_code == 200
    data = res.json()
    assert data["tta_applied"] is True
    assert data["predictive_entropy"] is not None
    assert data["uncertainty_score"] is not None
    assert data["confidence_margin"] is not None
    assert data["roi_bounding_box"] is not None
    assert data["attention_coverage_percent"] is not None
    assert data["peak_activation_coords"] is not None

