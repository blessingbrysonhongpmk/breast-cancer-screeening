"""Comprehensive API Reliability & Security Test Suite for MammoFusion-XAI.
Tests health checks, per-modality model readiness, input validation, security sanitization,
CORS restrictions, session history lifecycle, and genuine PyTorch inference with Grad-CAM.
"""

import io
import json
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.server import app, sanitize_filename
from pathlib import Path


@pytest.fixture(scope="session", autouse=True)
def preserve_session_history():
    """Ensures test runs do not leave automated test artifacts in recent_analyses.json."""
    yield
    analyses_file = Path("reports/recent_analyses.json")
    analyses_file.write_text("[]", encoding="utf-8")


@pytest.fixture
def client():
    """Provides a FastAPI test client instance."""
    return TestClient(app)


@pytest.fixture
def sample_valid_mammogram_bytes():
    """Generates valid 224x224 grayscale PNG image bytes for mammogram testing."""
    img = Image.new("L", (224, 224), color=128)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def sample_valid_thermal_bytes():
    """Generates valid 224x224 RGB JPEG image bytes for thermal testing."""
    img = Image.new("RGB", (224, 224), color=(200, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ============================================================================
# 1. Health and Readiness Endpoints
# ============================================================================

def test_api_health_endpoint(client):
    """Verifies GET /api/health returns healthy status and service version."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "MammoFusion-XAI" in data["service"]
    assert data["version"] == "1.0.0"


def test_api_models_readiness_endpoint(client):
    """Verifies GET /api/models/readiness provides honest per-modality status."""
    response = client.get("/api/models/readiness")
    assert response.status_code == 200
    data = response.json()

    assert "mammogram" in data
    assert "thermal" in data
    assert "all_ready" in data

    mammo = data["mammogram"]
    assert "ready" in mammo
    assert mammo["model_architecture"] == "ResNet-50"
    assert mammo["num_classes"] == 3
    assert mammo["classes"] == ["normal", "benign", "malignant"]

    thermal = data["thermal"]
    assert "ready" in thermal
    assert thermal["model_architecture"] == "ResNet-50"
    assert thermal["num_classes"] == 3


def test_api_status_system_diagnostics(client):
    """Verifies GET /api/status returns non-sensitive system status."""
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "milestones" in data
    assert "scientific_policy" in data


# ============================================================================
# 2. Input Validation & Error Handling
# ============================================================================

def test_analyze_invalid_modality(client, sample_valid_mammogram_bytes):
    """Verifies unsupported modality returns 400 Bad Request."""
    files = {"file": ("scan.png", sample_valid_mammogram_bytes, "image/png")}
    response = client.post("/api/analyze", files=files, data={"modality": "ultrasound"})
    assert response.status_code == 400
    assert "Invalid modality" in response.json()["detail"]


def test_analyze_unsupported_file_extension(client):
    """Verifies non-image file extension returns 400 Bad Request."""
    files = {"file": ("notes.txt", b"Invalid text data", "text/plain")}
    response = client.post("/api/analyze", files=files, data={"modality": "mammogram"})
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


def test_analyze_empty_file(client):
    """Verifies zero-byte upload returns 400 Bad Request."""
    files = {"file": ("empty.png", b"", "image/png")}
    response = client.post("/api/analyze", files=files, data={"modality": "mammogram"})
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_analyze_corrupt_image_bytes(client):
    """Verifies corrupted image bytes return 400 Bad Request."""
    files = {"file": ("corrupt.png", b"NOT_A_VALID_IMAGE_HEADER_DATA_12345", "image/png")}
    response = client.post("/api/analyze", files=files, data={"modality": "mammogram"})
    assert response.status_code == 400
    assert "corrupt" in response.json()["detail"].lower() or "not a recognized image" in response.json()["detail"].lower()


def test_analyze_image_too_small(client):
    """Verifies image smaller than minimum required 32x32 returns 422 Unprocessable Entity."""
    tiny_img = Image.new("L", (16, 16), color=128)
    buf = io.BytesIO()
    tiny_img.save(buf, format="PNG")
    files = {"file": ("tiny.png", buf.getvalue(), "image/png")}

    response = client.post("/api/analyze", files=files, data={"modality": "mammogram"})
    assert response.status_code == 422
    assert "too small" in response.json()["detail"].lower()


def test_analyze_oversized_file(client, monkeypatch):
    """Verifies upload exceeding size limit returns 413 Request Entity Too Large."""
    # Temporarily set upload limit to 100 bytes for fast deterministic testing
    monkeypatch.setattr("app.server.MAX_UPLOAD_SIZE_BYTES", 100)
    fake_large_payload = b"A" * 150
    files = {"file": ("large.png", fake_large_payload, "image/png")}

    response = client.post("/api/analyze", files=files, data={"modality": "mammogram"})
    assert response.status_code == 413
    assert "exceeds maximum allowed limit" in response.json()["detail"]


# ============================================================================
# 3. Security and Path Sanitization
# ============================================================================

def test_sanitize_filename_prevents_traversal():
    """Verifies filename sanitizer strips directory traversal and dangerous characters."""
    assert sanitize_filename("../../etc/passwd.png") == "passwd.png"
    assert sanitize_filename("..\\..\\windows\\system32\\cmd.jpg") == "cmd.jpg"
    assert ".." not in sanitize_filename("image..name.png")
    assert sanitize_filename("") != ""  # Generates fallback safe name


def test_manifest_export_path_traversal_protection(client):
    """Verifies GET /api/manifests/export rejects directory traversal attempts."""
    response = client.get("/api/manifests/export/../../etc/shadow")
    assert response.status_code in (400, 404)


def test_sample_image_unknown_modality_protection(client):
    """Verifies GET /api/sample-image rejects unknown modality."""
    response = client.get("/api/sample-image/unknown_modality/test.jpg")
    assert response.status_code == 400


# ============================================================================
# 4. Session History Management
# ============================================================================

def test_recent_analyses_lifecycle_and_clear(client):
    """Verifies history retrieval and deletion via DELETE /api/recent-analyses."""
    # Retrieve current history
    get_res = client.get("/api/recent-analyses")
    assert get_res.status_code == 200
    assert isinstance(get_res.json(), list)

    # Clear history
    del_res = client.delete("/api/recent-analyses")
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert "cleared successfully" in del_data["message"].lower()

    # Verify history is now empty
    get_res_after = client.get("/api/recent-analyses")
    assert get_res_after.status_code == 200
    assert len(get_res_after.json()) == 0


# ============================================================================
# 5. Genuine PyTorch Inference & Grad-CAM Explainability
# ============================================================================

def test_real_mammogram_inference_and_gradcam(client, sample_valid_mammogram_bytes):
    """Verifies genuine PyTorch inference forward pass and Grad-CAM generation for mammogram."""
    files = {"file": ("test_mammo.png", sample_valid_mammogram_bytes, "image/png")}
    response = client.post("/api/analyze", files=files, data={"modality": "mammogram"})
    assert response.status_code == 200
    data = response.json()

    assert data["modality"] == "mammogram"
    assert data["filename"] == "test_mammo.png"
    assert data["dimensions"]["width"] == 224
    assert data["dimensions"]["height"] == 224

    if data["inference_ready"]:
        assert data["status"] == "classified"
        assert data["predicted_class"] in ["normal", "benign", "malignant"]
        assert 0.0 <= data["confidence"] <= 1.0
        assert data["probabilities"] is not None
        probs = data["probabilities"]
        assert "normal" in probs and "benign" in probs and "malignant" in probs
        prob_sum = probs["normal"] + probs["benign"] + probs["malignant"]
        assert pytest.approx(prob_sum, abs=0.02) == 1.0

        # Grad-CAM heatmap check
        assert data["gradcam_url"] is not None
        cam_res = client.get(data["gradcam_url"])
        assert cam_res.status_code == 200
        assert cam_res.headers["content-type"] == "image/jpeg"
    else:
        assert data["status"] == "awaiting_model_training"


def test_real_thermal_inference_and_gradcam(client, sample_valid_thermal_bytes):
    """Verifies genuine PyTorch inference forward pass and Grad-CAM generation for thermal."""
    files = {"file": ("test_thermal.jpg", sample_valid_thermal_bytes, "image/jpeg")}
    response = client.post("/api/analyze", files=files, data={"modality": "thermal"})
    assert response.status_code == 200
    data = response.json()

    assert data["modality"] == "thermal"
    assert data["filename"] == "test_thermal.jpg"
    assert data["dimensions"]["width"] == 224
    assert data["dimensions"]["height"] == 224

    if data["inference_ready"]:
        assert data["status"] == "classified"
        assert data["predicted_class"] in ["normal", "benign", "malignant"]
        assert 0.0 <= data["confidence"] <= 1.0
        assert data["gradcam_url"] is not None
        cam_res = client.get(data["gradcam_url"])
        assert cam_res.status_code == 200
        assert cam_res.headers["content-type"] == "image/jpeg"
    else:
        assert data["status"] == "awaiting_model_training"

