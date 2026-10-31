"""Test suite for the Three Examination Modes and Strict Modality Boundaries.
Verifies all 8 testing requirements specified by the user:
1. Mammogram mode accepts a valid mammogram.
2. Mammogram mode rejects a thermal image.
3. Thermal mode accepts a valid thermal image.
4. Thermal mode rejects a mammogram.
5. Combined mode refuses to proceed with only one image.
6. Combined mode rejects incorrect image types in either field.
7. Combined mode accepts both validated images but produces a result only if the genuine fusion model is available.
8. Missing model weights never produce fake predictions.
"""

import io
import pytest
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient

from app.server import app, LOADED_MODELS
from src.validation.modality_detector import (
    validate_mammogram_image,
    validate_thermal_image,
    detect_image_modality,
    MAMMOGRAM_ERROR_MSG,
    THERMAL_ERROR_MSG,
)

client = TestClient(app)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
THERMAL_SAMPLE = PROJECT_ROOT / "data" / "raw" / "thermal" / "Breast Thermography" / "IIR0110" / "IIR0110_anterior.jpg"


def _create_synthetic_pgm_bytes():
    """Generates a compact PGM radiograph (224x224) with black background border."""
    img = Image.new("L", (224, 224), color=0)
    for y in range(40, 180):
        for x in range(40, 180):
            img.putpixel((x, y), 150)
    buf = io.BytesIO()
    img.save(buf, format="PPM")
    buf.seek(0)
    return buf.getvalue()


def _create_synthetic_mammogram_png_bytes():
    """Generates a synthetic grayscale mammogram PNG."""
    img = Image.new("L", (224, 224), color=0)
    for y in range(40, 180):
        for x in range(40, 180):
            img.putpixel((x, y), 150)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


def _create_synthetic_thermal_bytes():
    """Generates a synthetic false-color infrared image with high RGB divergence."""
    img = Image.new("RGB", (224, 224), color=(255, 30, 10))
    for y in range(40, 180):
        for x in range(40, 180):
            img.putpixel((x, y), (10, 220, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()


# ----------------------------------------------------------------------
# Scenario 1: Mammogram mode accepts a valid mammogram
# ----------------------------------------------------------------------
def test_scenario_1_mammogram_accepts_valid_mammogram():
    """Mode 1: POST /api/analyze/mammogram accepts genuine mammogram and runs inference."""
    pgm_bytes = _create_synthetic_pgm_bytes()

    response = client.post(
        "/api/analyze/mammogram",
        files={"file": ("sample_mammo.pgm", pgm_bytes, "image/x-portable-graymap")}
    )
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["modality"] == "mammogram"
    assert data["inference_ready"] is True
    assert data["predicted_class"] in {"normal", "benign", "malignant"}
    assert data["confidence"] > 0.0
    assert "layer4" in data["message"]


# ----------------------------------------------------------------------
# Scenario 2: Mammogram mode rejects a thermal image
# ----------------------------------------------------------------------
def test_scenario_2_mammogram_rejects_thermal_image():
    """Mode 1: POST /api/analyze/mammogram strictly rejects thermal scans."""
    if THERMAL_SAMPLE.exists():
        with open(THERMAL_SAMPLE, "rb") as f:
            thermal_bytes = f.read()
            fn = "IIR0110_anterior.jpg"
    else:
        thermal_bytes = _create_synthetic_thermal_bytes()
        fn = "thermal_infrared.jpg"

    response = client.post(
        "/api/analyze/mammogram",
        files={"file": (fn, thermal_bytes, "image/jpeg")}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == MAMMOGRAM_ERROR_MSG


# ----------------------------------------------------------------------
# Scenario 3: Thermal mode accepts a valid thermal image
# ----------------------------------------------------------------------
def test_scenario_3_thermal_accepts_valid_thermal():
    """Mode 2: POST /api/analyze/thermal accepts genuine thermal image and runs inference."""
    if THERMAL_SAMPLE.exists():
        with open(THERMAL_SAMPLE, "rb") as f:
            thermal_bytes = f.read()
            fn = "IIR0110_anterior.jpg"
    else:
        thermal_bytes = _create_synthetic_thermal_bytes()
        fn = "thermal_sample.jpg"

    response = client.post(
        "/api/analyze/thermal",
        files={"file": (fn, thermal_bytes, "image/jpeg")}
    )
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["modality"] == "thermal"
    assert data["inference_ready"] is True
    assert data["predicted_class"] in {"normal", "benign", "malignant"}
    assert data["confidence"] > 0.0


# ----------------------------------------------------------------------
# Scenario 4: Thermal mode rejects a mammogram
# ----------------------------------------------------------------------
def test_scenario_4_thermal_rejects_mammogram():
    """Mode 2: POST /api/analyze/thermal strictly rejects mammograms (including PGM)."""
    pgm_bytes = _create_synthetic_pgm_bytes()

    response = client.post(
        "/api/analyze/thermal",
        files={"file": ("mdb001lm.pgm", pgm_bytes, "image/x-portable-graymap")}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == THERMAL_ERROR_MSG


# ----------------------------------------------------------------------
# Scenario 5: Combined mode refuses to proceed with only one image
# ----------------------------------------------------------------------
def test_scenario_5_combined_refuses_single_image():
    """Mode 3: POST /api/analyze/combined fails if either mandatory image is missing."""
    file_bytes = _create_synthetic_mammogram_png_bytes()

    # Missing thermal image
    res1 = client.post(
        "/api/analyze/combined",
        files={"mammogram_file": ("scan.png", file_bytes, "image/png")}
    )
    assert res1.status_code == 422, f"Expected 422 for missing thermal file, got {res1.status_code}"

    # Missing mammogram image
    res2 = client.post(
        "/api/analyze/combined",
        files={"thermal_file": ("thermal.jpg", _create_synthetic_thermal_bytes(), "image/jpeg")}
    )
    assert res2.status_code == 422, f"Expected 422 for missing mammogram file, got {res2.status_code}"


# ----------------------------------------------------------------------
# Scenario 6: Combined mode rejects incorrect image types in either field
# ----------------------------------------------------------------------
def test_scenario_6_combined_rejects_inverted_modalities():
    """Mode 3: Cross-rejection in dual upload fields:
    - Thermal image in mammogram field -> 400 "Invalid image. Please upload a mammogram image."
    - Mammogram image in thermal field -> 400 "Invalid image. Please upload a thermal image."
    """
    mammo_bytes = _create_synthetic_pgm_bytes()
    thermal_bytes = _create_synthetic_thermal_bytes()

    # 1. Thermal image incorrectly placed in mammogram field
    res_bad_mammo = client.post(
        "/api/analyze/combined",
        files={
            "mammogram_file": ("thermal_in_mammo.jpg", thermal_bytes, "image/jpeg"),
            "thermal_file": ("thermal_valid.jpg", thermal_bytes, "image/jpeg"),
        }
    )
    assert res_bad_mammo.status_code == 400
    assert res_bad_mammo.json()["detail"] == MAMMOGRAM_ERROR_MSG

    # 2. Mammogram image incorrectly placed in thermal field
    res_bad_thermal = client.post(
        "/api/analyze/combined",
        files={
            "mammogram_file": ("mammo_valid.pgm", mammo_bytes, "image/x-portable-graymap"),
            "thermal_file": ("mammo_in_thermal.pgm", mammo_bytes, "image/x-portable-graymap"),
        }
    )
    assert res_bad_thermal.status_code == 400
    assert res_bad_thermal.json()["detail"] == THERMAL_ERROR_MSG


# ----------------------------------------------------------------------
# Scenario 7: Combined mode accepts both validated images but produces a result
#             ONLY if the genuine fusion model is available.
# ----------------------------------------------------------------------
def test_scenario_7_combined_returns_503_when_no_fusion_model():
    """Mode 3: Validates both images, but returns 503 Service Unavailable with
    'Combined analysis model is not yet available.' because no genuine fusion model exists.
    """
    mammo_bytes = _create_synthetic_pgm_bytes()
    thermal_bytes = _create_synthetic_thermal_bytes()

    response = client.post(
        "/api/analyze/combined",
        data={"case_id": "MF-CASE-2026-TEST"},
        files={
            "mammogram_file": ("valid_mammo.pgm", mammo_bytes, "image/x-portable-graymap"),
            "thermal_file": ("valid_thermal.jpg", thermal_bytes, "image/jpeg"),
        }
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Combined analysis model is not yet available."


# ----------------------------------------------------------------------
# Scenario 8: Missing model weights never produce fake predictions
# ----------------------------------------------------------------------
def test_scenario_8_missing_weights_never_produce_fake_predictions(monkeypatch):
    """Missing model weights must return awaiting_model_training and never fabricate scores."""
    from app import server

    # Simulate missing model
    monkeypatch.setattr(server, "get_modality_model", lambda mod: None)

    mammo_bytes = _create_synthetic_pgm_bytes()

    response = client.post(
        "/api/analyze/mammogram",
        files={"file": ("sample_mammo.pgm", mammo_bytes, "image/x-portable-graymap")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "awaiting_model_training"
    assert data["inference_ready"] is False
    assert data["predicted_class"] is None
    assert data["confidence"] is None
    assert data["probabilities"] is None
    assert data["gradcam_url"] is None


# ----------------------------------------------------------------------
# Scenario 9: Separate validation endpoint verifies format vs modality
# ----------------------------------------------------------------------
def test_scenario_9_validate_scan_endpoint_distinguishes_format_and_modality():
    """Endpoint POST /api/validate-scan must report separate file format and modality verification."""
    mammo_bytes = _create_synthetic_pgm_bytes()
    thermal_bytes = _create_synthetic_thermal_bytes()

    # 1. Valid Mammogram PGM in mammogram mode
    res1 = client.post(
        "/api/validate-scan",
        files={"file": ("scan.pgm", mammo_bytes, "image/x-portable-graymap")},
        data={"expected_modality": "mammogram"}
    )
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["valid_format"] is True
    assert d1["modality_verified"] is True
    assert d1["detected_modality"] == "mammogram"
    assert d1["error"] is None

    # 2. Valid Thermal JPG in thermal mode
    res2 = client.post(
        "/api/validate-scan",
        files={"file": ("thermal.jpg", thermal_bytes, "image/jpeg")},
        data={"expected_modality": "thermal"}
    )
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["valid_format"] is True
    assert d2["modality_verified"] is True
    assert d2["detected_modality"] == "thermal"
    assert d2["error"] is None

    # 3. Cross-Modality: Thermal in Mammogram Mode -> format valid, but modality rejected
    res3 = client.post(
        "/api/validate-scan",
        files={"file": ("thermal.jpg", thermal_bytes, "image/jpeg")},
        data={"expected_modality": "mammogram"}
    )
    assert res3.status_code == 200
    d3 = res3.json()
    assert d3["valid_format"] is True  # Format is valid JPEG
    assert d3["modality_verified"] is False  # But modality is rejected!
    assert d3["error"] == MAMMOGRAM_ERROR_MSG

    # 4. Cross-Modality: PGM in Thermal Mode -> format and modality rejected
    res4 = client.post(
        "/api/validate-scan",
        files={"file": ("scan.pgm", mammo_bytes, "image/x-portable-graymap")},
        data={"expected_modality": "thermal"}
    )
    assert res4.status_code == 200
    d4 = res4.json()
    assert d4["valid_format"] is False
    assert d4["modality_verified"] is False
    assert d4["error"] == THERMAL_ERROR_MSG


# ----------------------------------------------------------------------
# Scenario 10: All 8 pair upload and validation combinations
# ----------------------------------------------------------------------
def test_scenario_10_all_pair_upload_and_validation_combinations():
    """Verifies all 8 user-specified combinations:
    1. Neither image uploaded -> 422 Unprocessable (missing fields)
    2. Mammogram only -> 422 Unprocessable (missing thermal_file)
    3. Thermal only -> 422 Unprocessable (missing mammogram_file)
    4. Both uploaded (validated independently)
    5. Invalid mammogram + valid thermal -> 400 Bad Request (MAMMOGRAM_ERROR_MSG)
    6. Valid mammogram + invalid thermal -> 400 Bad Request (THERMAL_ERROR_MSG)
    7. Both valid images -> validated through backend
    8. Both valid images but fusion model missing -> 503 Service Unavailable ("Combined analysis model is not yet available.")
    """
    valid_mammo = _create_synthetic_pgm_bytes()
    valid_thermal = _create_synthetic_thermal_bytes()
    invalid_mammo_color = _create_synthetic_thermal_bytes()  # Colorful thermal in mammogram slot
    invalid_thermal_pgm = _create_synthetic_pgm_bytes()      # PGM in thermal slot

    # Combination 1: Neither image uploaded
    res1 = client.post("/api/analyze/combined", data={"case_id": "MF-TEST-1"})
    assert res1.status_code == 422

    # Combination 2: Mammogram only
    res2 = client.post(
        "/api/analyze/combined",
        files={"mammogram_file": ("mammo.pgm", valid_mammo, "image/x-portable-graymap")},
        data={"case_id": "MF-TEST-2"}
    )
    assert res2.status_code == 422

    # Combination 3: Thermal only
    res3 = client.post(
        "/api/analyze/combined",
        files={"thermal_file": ("thermal.jpg", valid_thermal, "image/jpeg")},
        data={"case_id": "MF-TEST-3"}
    )
    assert res3.status_code == 422

    # Combination 5: Invalid mammogram + valid thermal
    res5 = client.post(
        "/api/analyze/combined",
        files={
            "mammogram_file": ("thermal_in_mammo.jpg", invalid_mammo_color, "image/jpeg"),
            "thermal_file": ("thermal.jpg", valid_thermal, "image/jpeg")
        },
        data={"case_id": "MF-TEST-5"}
    )
    assert res5.status_code == 400
    assert res5.json()["detail"] == MAMMOGRAM_ERROR_MSG

    # Combination 6: Valid mammogram + invalid thermal
    res6 = client.post(
        "/api/analyze/combined",
        files={
            "mammogram_file": ("mammo.pgm", valid_mammo, "image/x-portable-graymap"),
            "thermal_file": ("pgm_in_thermal.pgm", invalid_thermal_pgm, "image/x-portable-graymap")
        },
        data={"case_id": "MF-TEST-6"}
    )
    assert res6.status_code == 400
    assert res6.json()["detail"] == THERMAL_ERROR_MSG

    # Combination 7 & 8: Both valid images, but fusion model not yet available
    res78 = client.post(
        "/api/analyze/combined",
        files={
            "mammogram_file": ("mammo.pgm", valid_mammo, "image/x-portable-graymap"),
            "thermal_file": ("thermal.jpg", valid_thermal, "image/jpeg")
        },
        data={"case_id": "MF-TEST-78"}
    )
    assert res78.status_code == 503
    assert res78.json()["detail"] == "Combined analysis model is not yet available."


