# MammoFusion-XAI — Final End-to-End Truth & Functionality Audit Report

**Date of Audit:** October 31, 2026  
**Auditor:** Antigravity AI Senior Engineer  
**System Evaluated:** MammoFusion-XAI Breast Imaging Research Platform  
**Environment:** Python 3.10.11 (Win32), PyTorch 2.x, FastAPI 0.115, React 19 + TypeScript + Vite 8.3.5  
**Active Endpoints:** Frontend at `http://127.0.0.1:5173` | Backend API at `http://127.0.0.1:8000`  

---

## 1. Backend Health & Readiness Verification

### Endpoint: `GET /api/health`
- **HTTP Status:** `200 OK`
- **Verified Response Payload:**
  ```json
  {
    "status": "healthy",
    "service": "MammoFusion-XAI Breast Imaging Research Platform",
    "version": "1.0.0",
    "environment": "development"
  }
  ```
- **Reachability Assessment:** The FastAPI ASGI server is actively running on `127.0.0.1:8000`, accepting connections, and enforcing CORS policies restricted to localhost development ports (`5173`, `3000`, `8080`).

---

## 2. Mammogram Model Readiness & Inference Verification

### Verification Methodology:
Rather than checking file existence alone, the backend runs a forward pass with dummy tensor `(1, 3, 224, 224)` on the PyTorch model checkpoint before marking it ready.

- **Checkpoint File:** `models/mammogram_resnet50.pt` (98.5 MB)
- **Model Backbone:** `MammogramClassifier` (`torchvision.models.resnet50` with custom classification head for 3 classes: `normal`, `benign`, `malignant`)
- **Target Explainability Layer:** `resnet.layer4` (Bottleneck convolution blocks)
- **Verified Status:** `ready: True`, `status_text: "Model Ready"`, `device: "cpu"`
- **Live PyTorch Forward Pass Test:**
  - **Input:** 224×224 Grayscale PNG mammography scan
  - **HTTP Status:** `200 OK`
  - **Predicted Class:** `normal`
  - **Confidence:** `0.4463` (44.63%)
  - **Softmax Distribution:**
    - `normal`: `0.4463`
    - `benign`: `0.2948`
    - `malignant`: `0.2589`
    - *Sum of Probabilities:* `1.0000`
  - **Grad-CAM Heatmap URL:** `/api/gradcam-image/cam_6578ef03c78f.jpg` (`200 OK`, 3,431 bytes valid JPEG)

---

## 3. Thermal Model Readiness & Inference Verification

### Verification Methodology:
The thermal checkpoint is loaded into `ThermalClassifier` and tested with an end-to-end forward pass before reporting readiness.

- **Checkpoint File:** `models/thermal_resnet50.pt` (98.5 MB)
- **Model Backbone:** `ThermalClassifier` (`torchvision.models.resnet50` with custom classification head for 3 classes: `normal`, `benign`, `malignant`)
- **Target Explainability Layer:** `resnet.layer4`
- **Verified Status:** `ready: True`, `status_text: "Model Ready"`, `device: "cpu"`
- **Live PyTorch Forward Pass Test:**
  - **Input:** 224×224 3-channel RGB Infrared Thermogram
  - **HTTP Status:** `200 OK`
  - **Predicted Class:** `normal`
  - **Confidence:** `0.4761` (47.61%)
  - **Softmax Distribution:**
    - `normal`: `0.4761`
    - `benign`: `0.2242`
    - `malignant`: `0.2997`
    - *Sum of Probabilities:* `1.0000`
  - **Grad-CAM Heatmap URL:** `/api/gradcam-image/cam_35ffe3b6372e.jpg` (`200 OK`, 1,414 bytes valid JPEG)

---

## 4. Upload Validation & Security Testing

All upload validations are enforced both client-side in the React application and server-side in `app/server.py`. Every edge-case was verified via automated integration tests:

| Validation Scenario | Test Input | HTTP Status | Verified System Response |
| :--- | :--- | :--- | :--- |
| **Invalid Modality** | `modality="ultrasound"` | `400 Bad Request` | `"Invalid modality. Supported: mammogram, thermal"` |
| **Disallowed File Extension** | `notes.txt` | `400 Bad Request` | `"Unsupported file format. Supported: .png, .jpg, .jpeg, .pgm"` |
| **Zero-Byte Empty Upload** | 0 bytes payload | `400 Bad Request` | `"Uploaded file is empty"` |
| **Corrupt Image Bytes** | Random non-image bytes | `400 Bad Request` | `"Uploaded file is corrupt or not a recognized image format"` |
| **Dimensions Below Minimum** | 16×16 px image | `422 Unprocessable` | `"Image dimensions (16x16) are too small. Minimum required: 32x32 pixels"` |
| **Oversized File** | Payload > 25 MB | `413 Too Large` | `"File size exceeds maximum allowed limit of 25.0 MB"` |
| **Path Traversal Attack** | `../../etc/passwd.png` | `200 OK (Sanitized)` | Sanitized by `sanitize_filename` to `passwd.png`; directory traversal thwarted |
| **Consecutive Dots Traversal** | `image..name.png` | `200 OK (Sanitized)` | Sanitized to `image_name.png` |
| **Manifest Path Traversal** | `GET /api/manifests/export/../../shadow` | `404 Not Found` | Request rejected; strict containment to `reports/manifests/` |

---

## 5. Results Page Truthfulness & State Management

The Results Page (`frontend/src/features/results/ResultsPage.tsx`) was audited for truthfulness:
1. **Empty State:** When no genuine analysis has occurred in the active session, the page does not display zeroed or dummy charts. Instead, it renders a clean empty state card stating *"No Analysis Performed Yet"* with an action button linking directly to the Analysis workspace.
2. **Research Metrics vs Clinical Diagnosis:**
   - Section heading: `"Model Prediction (Research Output — Not a Clinical Diagnosis)"`.
   - Explanatory footnote: `"* Softmax activation scores represent model output distributions across research training categories and are not clinical probabilities."`
3. **Grad-CAM Synchronization:** Grad-CAM overlays are rendered only from the live URL returned by the backend PyTorch backward pass. If Grad-CAM fails or model weights are missing, no fabricated heatmap is displayed.
4. **Technical Details Drawer:** Displays genuine metadata:
   - Target filename (sanitized)
   - Dimensions (`width × height`)
   - Color Mode (`L` for grayscale, `RGB` for thermogram)
   - Architecture: `ResNet-50`
   - Verification timestamp in ISO 8601
   - Complete softmax distribution breakdown across `normal`, `benign`, and `malignant` classes.

---

## 6. Analysis History Authenticity & Persistence Audit

### Investigation of Pre-Existing History Records:
- **Findings:** The two records observed in the session history (`test_mammo.png` and `test_thermal.jpg`) were generated by automated tests in `tests/test_api_reliability.py` calling the real `/api/analyze` endpoint.
- **Remediation Applied:**
  1. Automated test suite in `tests/test_api_reliability.py` was equipped with a session teardown fixture `preserve_session_history` that clears `reports/recent_analyses.json` so test runs never pollute the user session.
  2. `reports/recent_analyses.json` was purged of test artifacts and initialized to `[]`.
  3. The page was updated to explicitly state: `"Session Analysis History — Genuine scans analyzed during your current session. Stored locally for active review."`
  4. The record persistence schema in `app/server.py` was updated so that `record_entry` stores all fields of `AnalysisResponse`. When a user clicks **View** on any historical scan, the Results Page opens with 100% field parity (no missing metadata, exact class, confidence, softmax probabilities, and Grad-CAM overlay).
  5. Added a functional **Clear History** button with a confirmation step that calls `DELETE /api/recent-analyses`.

---

## 7. Grad-CAM Implementation & Gradient Truthfulness

### Mathematical Verification:
The Grad-CAM module (`src/explainability/gradcam.py`) was audited:
1. **Target Layer Hook:** Registers PyTorch forward and backward hooks on `model.get_target_layer()` (`resnet.layer4[-1]`).
2. **Gradient Computation:**
   - Runs `model.zero_grad()`
   - Selects target score $y^c$ for predicted class $c$
   - Computes backward gradients $\frac{\partial y^c}{\partial A^k}$
   - Applies global average pooling to obtain importance weights:
     $$\alpha_k^c = \frac{1}{Z} \sum_i \sum_j \frac{\partial y^c}{\partial A_{i,j}^k}$$
   - Computes weighted combination:
     $$L_{\text{Grad-CAM}}^c = \text{ReLU}\left( \sum_k \alpha_k^c A^k \right)$$
3. **Colormap Blending:** Normalizes map to $[0.0, 1.0]$, applies Turbo colormap, and blends with the input image at 50% opacity.
4. **Verification Result:** Passed all unit tests (`test_colormap_blending`, `test_gradcam_generation`) and verified on live inference requests. Heatmaps correspond directly to actual feature activations and gradients.

---

## 8. Summary of Tests Executed & Outcomes

### A. Python Backend & Model Test Suite (`pytest`)
**Command:** `py -3.10 -m pytest tests/ -v`  
**Result:** **42 passed in 40.45s (100% Pass Rate)**

```text
============================= test session starts =============================
platform win32 -- Python 3.10.11, pytest-9.2.0, pluggy-1.7.0
rootdir: E:\my projects\breast cancer screening
collected 42 items

tests/test_api_reliability.py::test_api_health_endpoint PASSED           [  2%]
tests/test_api_reliability.py::test_api_models_readiness_endpoint PASSED [  4%]
tests/test_api_reliability.py::test_api_status_system_diagnostics PASSED [  7%]
tests/test_api_reliability.py::test_analyze_invalid_modality PASSED      [  9%]
tests/test_api_reliability.py::test_analyze_unsupported_file_extension PASSED [ 11%]
tests/test_api_reliability.py::test_analyze_empty_file PASSED            [ 14%]
tests/test_api_reliability.py::test_analyze_corrupt_image_bytes PASSED   [ 16%]
tests/test_api_reliability.py::test_analyze_image_too_small PASSED       [ 19%]
tests/test_api_reliability.py::test_analyze_oversized_file PASSED        [ 21%]
tests/test_api_reliability.py::test_sanitize_filename_prevents_traversal PASSED [ 23%]
tests/test_api_reliability.py::test_manifest_export_path_traversal_protection PASSED [ 26%]
tests/test_api_reliability.py::test_sample_image_unknown_modality_protection PASSED [ 28%]
tests/test_api_reliability.py::test_recent_analyses_lifecycle_and_clear PASSED [ 30%]
tests/test_api_reliability.py::test_real_mammogram_inference_and_gradcam PASSED [ 33%]
tests/test_api_reliability.py::test_real_thermal_inference_and_gradcam PASSED [ 35%]
tests/test_archive_safety.py::TestArchiveSafety::test_dangerous_executable_rejection PASSED [ 38%]
tests/test_archive_safety.py::TestArchiveSafety::test_safe_path_containment PASSED [ 40%]
tests/test_archive_safety.py::TestArchiveSafety::test_valid_archive_extraction PASSED [ 42%]
tests/test_archive_safety.py::TestArchiveSafety::test_zip_slip_rejection PASSED [ 45%]
tests/test_deeplearning.py::TestDeepLearningModels::test_mammogram_classifier_forward PASSED [ 47%]
tests/test_deeplearning.py::TestDeepLearningModels::test_target_layers_exist PASSED [ 50%]
tests/test_deeplearning.py::TestDeepLearningModels::test_thermal_classifier_forward PASSED [ 52%]
tests/test_deeplearning.py::TestGradCAM::test_colormap_blending PASSED   [ 54%]
tests/test_deeplearning.py::TestGradCAM::test_gradcam_generation PASSED  [ 57%]
tests/test_deeplearning.py::TestClinicalMetrics::test_metrics_calculation PASSED [ 59%]
tests/test_manifest_and_idempotence.py::TestManifestAndIdempotence::test_audit_reporter_generation PASSED [ 61%]
tests/test_manifest_and_idempotence.py::TestManifestAndIdempotence::test_idempotent_safe_copy PASSED [ 64%]
tests/test_manifest_and_idempotence.py::TestManifestAndIdempotence::test_image_inspection PASSED [ 66%]
tests/test_metadata_parser.py::TestMetadataParser::test_thermal_diagnostics_xlsx_xml_parsing PASSED [ 69%]
tests/test_scanner_and_identifier.py::TestScannerAndIdentifier::test_ambiguity_on_empty_or_unknown PASSED [ 71%]
tests/test_scanner_and_identifier.py::TestScannerAndIdentifier::test_identify_mias_dataset PASSED [ 73%]
tests/test_scanner_and_identifier.py::TestScannerAndIdentifier::test_identify_thermal_dataset PASSED [ 76%]
tests/test_scanner_and_identifier.py::TestScannerAndIdentifier::test_scanner_detection_and_size_estimation PASSED [ 78%]
tests/test_transforms.py::TestImageTransforms::test_clahe_enhancement PASSED [ 80%]
tests/test_transforms.py::TestImageTransforms::test_clahe_rejects_color PASSED [ 83%]
tests/test_transforms.py::TestImageTransforms::test_load_color_image PASSED [ 85%]
tests/test_transforms.py::TestImageTransforms::test_load_grayscale_image PASSED [ 88%]
tests/test_transforms.py::TestImageTransforms::test_normalize_to_float32 PASSED [ 90%]
tests/test_transforms.py::TestImageTransforms::test_preprocess_mammogram_end_to_end PASSED [ 92%]
tests/test_transforms.py::TestImageTransforms::test_preprocess_thermal_end_to_end PASSED [ 95%]
tests/test_transforms.py::TestImageTransforms::test_resize_image PASSED  [ 97%]
tests/test_transforms.py::TestImageTransforms::test_save_preprocessed_image PASSED [100%]
======================= 42 passed, 4 warnings in 40.45s =======================
```

### B. Frontend TypeScript & Production Build
**Command:** `npm --prefix frontend run build`  
**Result:** **Success in 3.60s (0 errors)**
- TypeScript compiler (`tsc -b`): Clean, 0 type errors.
- Vite bundler: Built production bundle into `app/static/`:
  - `../app/static/index.html`: 0.86 kB
  - `../app/static/assets/index-DGHHL6Gp.css`: 7.35 kB
  - `../app/static/assets/index-DhmSPJHe.js`: 280.33 kB

---

## 9. Features Not Implemented or Prohibited by Scientific Policy

1. **Paired Multimodal Fusion (Prohibited by Scientific Integrity):**
   - *Status:* Explicitly disabled and prohibited.
   - *Scientific Rationale:* The MIAS cohort (UK mammography database, 1990s) and the Mendeley cohort (Brazilian infrared thermography database, 2018) comprise completely independent, unlinked patient populations. Synthetically pairing an arbitrary MIAS scan with an arbitrary Mendeley scan to simulate "multimodal fusion" would represent scientific falsification. The platform strictly analyzes each modality independently.
2. **CUDA GPU Acceleration:**
   - *Status:* Running on CPU.
   - *Hardware Constraint:* The current Windows host does not have an active CUDA PyTorch environment configured. CPU inference latency is ~300-800ms per image, which is acceptable for research evaluation.

---

## 10. Summary of Resolved Issues & Current Status

| Component | Initial Status | Issue Identified | Resolution Applied | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Model Readiness** | Assumed from file existence | File could exist but fail on forward pass | Implemented active dummy forward pass verification in `get_modality_model()` | Verified live via `/api/models/readiness` |
| **Platform Branding** | "Clinical Screening System" | Overstated medical claims | Renamed to "Breast Imaging Research Platform" across HTML, UI, and API | Verified in `frontend/index.html`, `App.tsx`, `HomePage.tsx` |
| **Session History** | Polluted with test files | Pytest suite left `test_mammo.png` and `test_thermal.jpg` in JSON | Added pytest teardown fixture to preserve clean state and reset JSON to `[]` | Verified empty on startup |
| **History Parity** | Partial metadata saved | Clicking "View" in History lacked full analysis fields | Saved full `AnalysisResponse` record in `recent_analyses.json` | Verified full field parity |
| **Filename Sanitization** | `..` in middle permitted | Regex replaced only leading `..` | Added regex to purge all consecutive dots `re.sub(r'\.{2,}', '_', base)` | Verified with `test_sanitize_filename_prevents_traversal` |

---

## Verification Commands for Local Reproduction:
1. **Start FastAPI Backend:**
   ```powershell
   py -3.10 -m uvicorn app.server:app --host 127.0.0.1 --port 8000
   ```
2. **Start Frontend Dev Server:**
   ```powershell
   cd frontend
   npm run dev -- --host 127.0.0.1 --port 5173
   ```
3. **Execute Full Test Suite:**
   ```powershell
   py -3.10 -m pytest tests/ -v
   ```
4. **Compile Production Frontend Build:**
   ```powershell
   cd frontend
   npm run build
   ```

