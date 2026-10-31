# API Documentation & Endpoint Specification

**Platform:** MammoFusion-XAI  
**Framework:** FastAPI 0.115+ (ASGI / Uvicorn)  
**Host & Port:** `http://127.0.0.1:8000`  
**Security:** Sanitized filenames, path traversal prevention, CORS restrictions, no fabricated payloads.  

---

## 1. System Health & Model Telemetry

### `GET /api/health`
Returns the operational health and environment state of the backend service.
- **Request:** None
- **Response `200 OK`:**
  ```json
  {
    "status": "healthy",
    "service": "MammoFusion-XAI Breast Imaging Research Platform",
    "version": "1.0.0",
    "environment": "development"
  }
  ```

### `GET /api/models/readiness`
Performs genuine verification of model checkpoints, loads PyTorch weights into memory, executes a dummy tensor forward pass, and verifies Grad-CAM attachment.
- **Request:** None
- **Response `200 OK`:**
  ```json
  {
    "mammogram": {
      "ready": true,
      "status_text": "ResNet-50 Checkpoint Loaded (3-class)",
      "model_architecture": "ResNet-50 (Unimodal Mammography)",
      "checkpoint": "models/mammogram_resnet50.pt",
      "target_layer": "layer4",
      "num_classes": 3,
      "classes": ["normal", "benign", "malignant"],
      "device": "cpu"
    },
    "thermal": {
      "ready": true,
      "status_text": "ResNet-50 Checkpoint Loaded (3-class)",
      "model_architecture": "ResNet-50 (Unimodal Thermal)",
      "checkpoint": "models/thermal_resnet50.pt",
      "target_layer": "layer4",
      "num_classes": 3,
      "classes": ["normal", "benign", "malignant"],
      "device": "cpu"
    },
    "combined": {
      "ready": false,
      "status_text": "Multimodal fusion model not configured. Cohorts are separate.",
      "model_architecture": "Multimodal Early/Late Fusion ResNet",
      "checkpoint": null,
      "target_layer": null,
      "num_classes": 3,
      "classes": ["normal", "benign", "malignant"],
      "device": "cpu"
    },
    "gradcam_ready": true,
    "realtime_inference_ready": true,
    "all_ready": false
  }
  ```

### `GET /api/status`
Returns deep system diagnostics including memory utilization, active device (CPU/CUDA), loaded checkpoint hashes, and security status.

---

## 2. Modality & Pair Validation Endpoints

### `POST /api/validate-scan`
Validates uploaded image bytes, checks headers, determines dimensions and color mode, and verifies modality compatibility across 4 scientific evidence levels.
- **Content-Type:** `multipart/form-data`
- **Parameters:**
  - `file`: File upload (`.png`, `.jpg`, `.jpeg`, `.pgm`)
  - `expected_modality`: `"mammogram"` | `"thermal"`
- **Response `200 OK`:**
  ```json
  {
    "valid_format": true,
    "format": "PGM",
    "dimensions": { "width": 1024, "height": 1024 },
    "size_bytes": 1048576,
    "modality_verified": true,
    "detected_modality": "mammogram",
    "expected_modality": "mammogram",
    "verification_level": "image_type_checked",
    "image_type_passed": true,
    "provenance_verified": false,
    "message": "Image type check passed",
    "validation_reason": "Grayscale radiograph with 1024x1024 dimensions"
  }
  ```

### `POST /api/validate-pair`
Evaluates two independent scans for patient-level identity matching and same-session pairing evidence.
- **Content-Type:** `multipart/form-data`
- **Parameters:**
  - `mammogram_file`: Mammogram image file
  - `thermal_file`: Thermal image file
- **Response `200 OK`:**
  ```json
  {
    "pairing_status": "pairing_mismatch",
    "is_paired": false,
    "same_patient_verified": false,
    "mammogram_patient_id": "MIAS_P045",
    "thermal_participant_id": "IIR0112",
    "status_message": "Pairing mismatch — mammogram (MIAS) and thermal (Mendeley) belong to different study cohorts.",
    "combined_status_code": "pairing_mismatch",
    "can_analyze": false
  }
  ```

---

## 3. Inference & Explainability Endpoints

### `POST /api/analyze/mammogram` & `POST /api/analyze/thermal`
Executes real PyTorch ResNet-50 inference and generates Grad-CAM explainability artifacts for a single uploaded scan.
- **Content-Type:** `multipart/form-data`
- **Parameters:**
  - `file`: Image file
  - `tta`: Boolean (optional, default `false`) — Enables Test-Time Augmentation.
- **Response `200 OK`:**
  ```json
  {
    "status": "classified",
    "modality": "mammogram",
    "filename": "mdb028.pgm",
    "dimensions": { "width": 1024, "height": 1024 },
    "color_mode": "L",
    "format": "PGM",
    "inference_ready": true,
    "predicted_class": "normal",
    "confidence": 0.842,
    "probabilities": {
      "normal": 0.842,
      "benign": 0.115,
      "malignant": 0.043
    },
    "gradcam_url": "/api/gradcam-image/cam_f812a0.jpg",
    "model_architecture": "ResNet-50 (Unimodal Mammography)",
    "message": "Inference and Grad-CAM generated successfully.",
    "recommendation": "Routine periodic radiological screening recommended.",
    "predictive_entropy": 0.385,
    "uncertainty_score": 0.241,
    "confidence_margin": 0.727,
    "roi_bounding_box": [120, 140, 260, 310],
    "attention_coverage_percent": 14.2,
    "tta_applied": false
  }
  ```

### `POST /api/analyze/combined`
Strict multimodal analysis endpoint.
- **Enforcement:** If a genuine paired fusion checkpoint is not loaded, or if the two images do not share verified patient identity, returns:
  - **HTTP `400 Bad Request`:**
    ```json
    {
      "detail": "Combined analysis unavailable: No genuine paired multimodal fusion model is configured, and cross-dataset pairing is scientifically invalid."
    }
    ```

### `GET /api/gradcam-image/{filename}`
Streams the generated JPEG heatmap overlay. Filename is strictly sanitized against path traversal.

---

## 4. Dataset Management & Manifest Endpoints

### `GET /api/datasets` & `GET /api/dataset/stats`
Returns genuine manifest and audit counts from `reports/dataset_audit_report.json`.

### `POST /api/dataset/scan`
Scans `dataset_dropbox/mammogram` and `dataset_dropbox/thermal` without making any file alterations.
- **Response `200 OK`:** Returns file counts, image counts, total sizes, and free disk space.

### `POST /api/dataset/import`
Safely extracts archives, copies files into `data/raw/`, rebuilds manifests in `data/manifests/`, and produces audit reports.
- **Body:** `{"dry_run": false}`

### `GET /api/manifests/records?modality=all&limit=100&search=`
Returns parsed records from CSV manifests with full search and filtering.

### `GET /api/manifests/export/{modality}`
Streams the raw CSV manifest file (`attachment; filename=..._manifest.csv`).

---

## 5. Evaluation & Session Records

### `GET /api/evaluation`
Returns the complete empirical benchmark evaluation dictionary from `reports/evaluation_results.json`.

### `GET /api/recent-analyses` & `DELETE /api/recent-analyses`
Retrieves or clears recent examination records stored in `reports/recent_analyses.json`.

### `POST /api/reports/export-markdown`
Accepts an `AnalysisResponse` object and returns a formatted research publication markdown report.
