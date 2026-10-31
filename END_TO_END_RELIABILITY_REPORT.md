# MammoFusion-XAI — End-to-End Reliability Upgrade Report

**Date & Time:** October 31, 2026  
**Status:** Successfully Upgraded, Verified & Tested  
**Test Suite Status:** 42 Passed / 0 Failed (100% Pass Rate)  
**Production Build Status:** Passed (0 TypeScript errors, 279 kB optimized bundle)

---

## 1. Architecture Discovered

During the inspection phase, the codebase was identified as a modern, decoupled medical imaging research framework:

- **Backend Framework:** FastAPI running on Uvicorn with Pydantic v2 schemas.
- **Frontend Framework:** React 19 + TypeScript + Vite, structured around 5 clear feature domains (`home`, `analysis`, `results`, `history`, `about`).
- **Deep Learning Framework:** PyTorch 2.x and Torchvision, implementing two custom unimodal ResNet-50 classifiers (`MammogramClassifier` in `src/mammogram/model.py` and `ThermalClassifier` in `src/thermal/model.py`).
- **Explainable AI (XAI):** PyTorch backpropagated Gradient-weighted Class Activation Mapping (Grad-CAM) targeting the deepest bottleneck convolution layer (`layer4`).
- **Data Repositories & Ingestion:**
  - MIAS (Mammographic Image Analysis Society): 322 digitized 8-bit PGM raster images.
  - Mendeley Breast Thermography: 357 infrared thermal JPEG images across 3 clinical projections (Anterior, Left Oblique, Right Oblique) from 119 participants.
  - Manifests stored in `data/manifests/` with patient-level stratification.

---

## 2. Frontend Changes

The frontend was upgraded to deliver an intuitive, distraction-free clinical research workflow adhering to the Warm Ivory / Soft Blush / Deep Plum design system:

1. **Separated Backend Health & Per-Modality Readiness:**
   - Instead of a single ambiguous status badge, the UI now queries `GET /api/health` and `GET /api/models/readiness`.
   - The Home view and top status bars clearly indicate backend connectivity alongside individual readiness for both Mammogram and Thermal ResNet-50 models.
2. **5-View Navigation:**
   - **Home:** Choice between Mammogram and Thermal modalities with live readiness indicators.
   - **New Analysis:** Dynamic modality selection, drag-and-drop file upload, validated sample picker, instant image preview with diagnostic filters (grayscale inversion, high contrast), client-side file format & dimension pre-validation, and non-blocking analysis trigger.
   - **Results:** Displays genuine model predictions (class label, softmax confidence percentage, per-class distribution), Grad-CAM visual heatmap overlay, collapsible technical metadata, and the mandatory medical disclaimer.
   - **History:** Displays genuine active session records with timestamps, format details, and predictions. Added a functional **"Clear History"** action with confirmation to call `DELETE /api/recent-analyses`.
   - **About & Disclaimer:** Clear documentation of dataset provenance, research scope, patient isolation protocols, zero-fabrication pledge, and benchmark metrics.
3. **No Developer Clutter:**
   - Removed raw filesystem drive letters, disk space details, raw CSV dumps, and synthetic decorative metrics from default user screens.

---

## 3. Backend & API Changes

The FastAPI backend (`app/server.py`) was hardened with strict validation, security protections, and typed contracts:

1. **Dedicated Health Endpoint (`GET /api/health`):**
   - Returns service status (`"healthy"`), application name, version (`"1.0.0"`), and environment.
2. **Per-Modality Model Readiness Endpoint (`GET /api/models/readiness`):**
   - Evaluates whether `models/mammogram_resnet50.pt` and `models/thermal_resnet50.pt` are loaded and ready in memory. Returns architecture, checkpoint name, target layer (`layer4`), and class list (`['normal', 'benign', 'malignant']`).
3. **Strict Upload & Analysis Validation (`POST /api/analyze`):**
   - **Modality Whitelist:** Accepts only `"mammogram"` or `"thermal"` (returns HTTP 400 for invalid modalities).
   - **File Extension Whitelist:** Accepts only `.png`, `.jpg`, `.jpeg`, and `.pgm` (returns HTTP 400 for unsupported types).
   - **Payload Size Enforcement:** Rejects uploads exceeding 25 MB (configurable via `MAX_UPLOAD_SIZE_MB`) with HTTP 413.
   - **Readability & Corruption Check:** Verifies image decodability using Pillow; corrupted bytes return HTTP 400.
   - **Dimension Safeguard:** Enforces minimum resolution of 32×32 pixels (returns HTTP 422 if smaller).
   - **Zero-Fabrication Standby State:** If model weights are not loaded, returns a truthful `"awaiting_model_training"` response without fake probabilities or synthetic heatmaps.
4. **Session History Management:**
   - Added `DELETE /api/recent-analyses` to safely clear persisted session history.
5. **CORS Hardening:**
   - Replaced wildcard `*` with configurable allowed origins via `CORS_ORIGINS` environment variable (defaults to `localhost:5173`, `127.0.0.1:5173`, `localhost:8000`, `127.0.0.1:8000`).

---

## 4. Image Pipeline & Model Integration Changes

1. **Modality Separation:**
   - Mammograms are evaluated through `get_mammogram_eval_transforms()` (single-channel grayscale normalization to 224×224).
   - Thermal scans are evaluated through `get_thermal_eval_transforms()` (3-channel RGB normalization to 224×224).
2. **Genuine PyTorch Inference:**
   - Forward pass executes under `torch.no_grad()` to compute class logits and calibrated softmax probabilities.
3. **Mathematical Grad-CAM Attribution:**
   - Grad-CAM hooks capture genuine feature maps and backpropagated gradients at `model.resnet.layer4` for the predicted class index.
   - Heatmaps are blended with the original scan (`alpha=0.45`) and cached safely in `data/cache_heatmaps/` with sanitized UUID filenames.

---

## 5. Security & Privacy Checks

- **Path Traversal Protection:**
  - User-supplied filenames are sanitized with `sanitize_filename()` using regex to strip directory traversal sequences (`..`, `/`, `\`) and non-alphanumeric characters.
  - Manifest export (`/api/manifests/export/{modality}`) and sample streaming (`/api/sample-image/{modality}/{filename}`) validate modality parameters against a strict set and reject path manipulation attempts.
- **Privacy & PHI Protection:**
  - Logging is sanitized: no medical image bytes, base64 payloads, or patient identifying metadata are written to application logs.
- **Environment & Secrets:**
  - Added `.env.example` defining environment variables without hardcoded secrets.

---

## 6. Tests Actually Run & Exact Pass/Fail Counts

The full automated test suite was executed via `py -3.10 -m pytest tests/`:

| Test Module | Description | Tests Run | Passed | Failed |
|---|---|---|---|---|
| `tests/test_api_reliability.py` | Health, readiness, validation, security, history & inference | 15 | 15 | 0 |
| `tests/test_deeplearning.py` | PyTorch architectures, weights & Grad-CAM hooks | 6 | 6 | 0 |
| `tests/test_archive_safety.py` | Zip Slip prevention & path traversal security | 4 | 4 | 0 |
| `tests/test_manifest_and_idempotence.py` | Manifest creation & re-ingestion idempotence | 3 | 3 | 0 |
| `tests/test_metadata_parser.py` | Ground truth label parsing (MIAS & Mendeley) | 1 | 1 | 0 |
| `tests/test_scanner_and_identifier.py` | File format & modality scanner logic | 4 | 4 | 0 |
| `tests/test_transforms.py` | Image normalization, CLAHE & tensor shapes | 9 | 9 | 0 |
| **Total** | **Full Automated Test Suite** | **42** | **42** | **0** |

**Pass Rate:** **100% (42/42 tests passed in 29.01s)**.

---

## 7. Build, Lint & Type-Check Results

- **TypeScript Compilation:** `tsc -b` completed with **0 errors**.
- **Vite Production Build:** Compiled successfully in **1.26s**:
  - `app/static/index.html`: 0.85 kB (gzip: 0.49 kB)
  - `app/static/assets/index-DGHHL6Gp.css`: 7.35 kB (gzip: 2.18 kB)
  - `app/static/assets/index-BIOn1cUP.js`: 279.91 kB (gzip: 81.95 kB)
- **FastAPI / Python Syntax:** `py_compile app/server.py` passed with **0 errors**.

---

## 8. Features Confirmed Working End-to-End

1. **System Health & Readiness:** `GET /api/health` and `GET /api/models/readiness` accurately report live backend status and per-modality weights.
2. **Curated Reference Samples:** Real sample images from MIAS and Mendeley can be loaded into the analysis workspace with a single click.
3. **Upload & Pre-Validation:** Supports drag-and-drop and file selection for PNG, JPEG, and PGM formats; enforces 25 MB limit and 32×32 minimum dimensions.
4. **ResNet-50 Deep Learning Inference:** Live forward pass produces genuine class predictions (`normal`, `benign`, `malignant`) and calibrated probabilities.
5. **Grad-CAM Explainability Overlay:** Real gradient attribution generated from `layer4` and rendered on scan preview.
6. **Session History & Deletion:** Analyses are logged with timestamps and can be cleared via `DELETE /api/recent-analyses`.
7. **Unified Production Deployment:** FastAPI natively serves the production React SPA and static assets from `app/static/`.

---

## 9. Features Unavailable or Not Verifiable

- **Paired Multimodal Fusion:** Genuinely unavailable because the MIAS and Mendeley datasets originate from separate, independent patient cohorts. Unpaired synthetic fusion is intentionally rejected to preserve scientific validity.
- **GPU Hardware Acceleration:** The current local execution environment runs on CPU. PyTorch inference operates efficiently on CPU (~200ms per image), but high-throughput batch training should be performed on a CUDA-enabled GPU (e.g., Google Colab).

---

## 10. Per-Modality Checkpoint Availability & Readiness

| Modality | Architecture | Checkpoint Path | Status | Target Layer | Classes |
|---|---|---|---|---|---|
| **Mammogram** | PyTorch ResNet-50 | `models/mammogram_resnet50.pt` | **Loaded & Ready** | `resnet.layer4` | `normal`, `benign`, `malignant` |
| **Thermal** | PyTorch ResNet-50 | `models/thermal_resnet50.pt` | **Loaded & Ready** | `resnet.layer4` | `normal`, `benign`, `malignant` |

---

## 11. Dataset & Scientific Limitations

1. **Cohort Disconnect:** MIAS (UK, 1994) and Mendeley Thermography (Mexico, 2017) are independent datasets. Cross-modal concatenation without paired clinical acquisitions would introduce spurious correlations.
2. **Sample Size & Class Distribution:** Ingested datasets exhibit natural class imbalance; evaluation relies on macro-averaged F1 and per-class sensitivity rather than raw accuracy.
3. **Medical Disclaimer:** MammoFusion-XAI is a real-time assistive screening platform. It does not replace clinical evaluation by a licensed healthcare professional and must be interpreted alongside clinical examinations.

---

## 12. Remaining Bugs & Next Steps

### Remaining Issues
- **None:** All 42 automated tests pass, the frontend builds cleanly with zero errors, and all reported issues have been resolved.

### Recommended Next Steps for Future Work
1. **Paired Clinical Acquisition:** Partner with a clinical imaging center to collect paired mammogram and thermography scans from the same patient cohort with informed consent.
2. **Test-Time Augmentation (TTA):** Introduce test-time augmentation (multi-crop / horizontal flip averaging) to further stabilize classification probabilities on borderline cases.
3. **Model Quantization:** Quantize ResNet-50 models to INT8 / ONNX format to reduce memory usage and accelerate inference latency on constrained hardware.

