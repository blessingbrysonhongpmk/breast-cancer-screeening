# MammoFusion-XAI: Manual Testing & Verification Guide

This document provides step-by-step procedures to manually and automatically verify the functionality, integrity, and authenticity of the **MammoFusion-XAI** platform across all supported modes and environmental conditions.

---

## 1. Quick Verification Commands

### Run Full Automated Test Suite (61 Tests)
```powershell
py -3.10 -m pytest tests/ -v
```

### Run 3-Mode Examination & Modality Validation Tests (9 Tests)
```powershell
py -3.10 -m pytest tests/test_examination_modes_and_modality_validation.py -v
```

### Run Dashboard Truth & Environmental Tests (4 Tests)
```powershell
py -3.10 -m pytest tests/test_dashboard_functionality_and_truth.py -v
```

### Run API Reliability & Security Tests (15 Tests)
```powershell
py -3.10 -m pytest tests/test_api_reliability.py -v
```

---

## 2. Verification of New Examination Features

### 1. Mammogram Preview & PGM Radiograph Rendering
- **Actual Uploaded Radiograph Rendered:** Supported formats include `.pgm`, `.png`, `.jpg`, and `.jpeg`. When a raw Netpbm `.pgm` file (e.g. from MIAS: `mdb001lm.pgm`, 4320×2048 px) is uploaded, the client-side PGM decoder ([`frontend/src/utils/pgmDecoder.ts`](file:///e:/my%20projects/breast%20cancer%20screening/frontend/src/utils/pgmDecoder.ts)) parses binary `P5` bytes directly into a Canvas data URL and renders the actual breast radiograph on screen.
- **No Text-Only Placeholders:** The interface renders the actual breast tissue, density structure, and pectoral boundaries. Text placeholders like *"PGM Radiograph Loaded"* have been eliminated.
- **Aspect Ratio Preservation:** Images are contained within dark radiology viewports using `object-fit: contain` to prevent optical distortion.
- **Zoom / Fullscreen Modal:** Clicking the **Zoom View** (`<Maximize2 />`) button opens a high-resolution lightbox inspection modal with image dimensions and contrast/invert diagnostic filters.

### 2. Thermal Image Preview & False-Color Palette
- **Native RGB Preservation:** Thermal images (e.g., from Mendeley Thermography: `IIR0110_anterior.jpg`) are displayed in their original false-color thermal palette without forced grayscale conversion.
- **Metadata Display:** Filename, dimensions (e.g., `640×480 px`), and an **RGB Thermal Palette** badge are prominently displayed.
- **Zoom / Inspection View:** Thermal images also feature the Zoom View lightbox for detailed inspection of thermal hotspots.

### 3. Four Levels of Scientific Evidence & Validation States
The platform rigorously distinguishes between four levels of validation evidence:
1. **Level 1 — File Format Validated:** Verifies readable bytes, valid dimensions ($\ge 224\times 224$ px), file size $\le 25$ MB, and supported container format.
2. **Level 2 — Image Type Checked:** Algorithmic appearance checks (grayscale histogram, air-tissue borders, or RGB color divergence) verify that the image matches modality criteria. If the image is a custom/unindexed user upload without manifest provenance, the UI displays strictly **`"Image type check passed"`** (never "Verified Mammogram Radiograph" or "Verified False-Color Thermogram").
3. **Level 3 — Modality Provenance Verified:** Confirms the scan against trusted clinical study records (`mammogram_manifest.csv` or `thermal_manifest.csv`). The UI displays **`"Modality provenance verified ({dataset}: {patient_id})"`**.
4. **Level 4 — Same-Patient Pairing Verified:** Evaluated via `POST /api/validate-pair`. Requires both scans to originate from the same verified participant and cohort.

### 4. Verified Reference Samples Marked as TEST DATA
- **Prominent Tagging:** All curated reference scans from the MIAS and Mendeley repositories are explicitly tagged with `[TEST DATA]` chips.
- **Clear Research Context:** The reference sample drawer clearly states: *"TEST DATA: Research reference scan for algorithm verification (Not live patient records)."*
- **No Synthetic Pairing:** Because MIAS (UK) and Mendeley (Mexico) represent independent patient cohorts with zero shared participants, arbitrary pairing of unrelated images has been eliminated. The Combined Screening mode explicitly informs the user that paired scans must originate from clinical PACS or paired study uploads.

### 5. Combined Multimodal Screening Safeguards
- **Dual Mandatory Dropzones:** Requires both a validated mammogram radiograph and a validated infrared thermogram.
- **Analyze Button Guarded:** Disabled whenever the genuine multimodal fusion model is unavailable or pairing is unverified.
- **Dedicated Pairing Status:** Displays exact clinical status:
  - `Pairing not verified`
  - `Pairing verified from trusted dataset metadata`
  - `Pairing mismatch`
- **Exact Status Messages:**
  - *"Both files accepted, pairing not verified."*
  - *"Both files validated, pairing verified, fusion model unavailable."*
  - *"Pairing mismatch — Scans belong to different participants or cohorts."*
- **Multimodal Notice:** *"Combined analysis available only when a genuine trained fusion model is loaded and pairing requirements are satisfied."*
- **Zero Fabrication Policy:** Prohibits averaging or synthesizing unimodal scores into fake risk metrics. Direct calls to `POST /api/analyze/combined` return **HTTP 503 Service Unavailable**.

---

## 3. Testing the 4 Environmental Conditions

### Condition A: Normal Operation (Backend Online, All Models Loaded)
1. **Start Backend Server:**
   ```powershell
   py -3.10 -m uvicorn app.server:app --host 127.0.0.1 --port 8000
   ```
2. **Start Frontend Server:**
   ```powershell
   cd frontend
   npm run dev
   ```
3. **Verify Dashboard at `http://127.0.0.1:5173`:**
   - **System Status Card:** Displays **"Backend Connected"** with a green pulse dot and `Online` badge.
   - **Model Status Card:** Displays **"Models Ready (2/2)"** with a green chip.
   - **Project Overview Checklist:**
     - Mammogram Model: Green check (`Model Ready`)
     - Thermal Model: Green check (`Model Ready`)
     - Grad-CAM Explanation: Green check (`Available`)
     - Real-time Analysis: Green check (`Active`)
   - **Project Readiness Gauge:** Shows **100%** (calculated dynamically: 4/4 verified capabilities).
   - **Last Analysis Card:** Shows genuine timestamp, filename, and classification badge from the latest session, or **"No examinations yet"** if history is empty.

---

### Condition B: Backend Offline (Server Stopped)
1. **Stop the Backend Server** (Ctrl+C in terminal).
2. **Refresh the Frontend (`http://127.0.0.1:5173`):**
   - **System Status Card:** Updates to **"Backend Disconnected"** with a red dot and `Offline` badge.
   - **Model Status Card:** Shows **"Unavailable"** (gray/red).
   - **Checklist:** Items display warning / missing icons.
   - **Project Readiness Gauge:** Shows **0%** (0/4 capabilities verified).
   - **Safety:** No fake mock data or fabricated predictions are displayed.

---

### Condition C: Missing Weights (Simulating Model Standby)
1. **Temporarily Rename or Move Model Weights:**
   ```powershell
   Rename-Item models\mammogram_resnet50.pt models\mammogram_resnet50.pt.bak
   ```
2. **Query Model Readiness:**
   ```powershell
   curl http://127.0.0.1:8000/api/models/readiness
   ```
   *Expected Response:*
   ```json
   {
     "mammogram": {
       "ready": false,
       "status_text": "Model checkpoint not found or failed to load.",
       "checkpoint": null
     },
     "thermal": {
       "ready": true,
       "status_text": "Model Ready",
       "checkpoint": "thermal_resnet50.pt"
     },
     "all_ready": false
   }
   ```
3. **Verify Dashboard:**
   - Model Status updates to **"Partial (1/2 Ready)"**.
   - Mammogram Model checklist item displays an alert/missing indicator.
   - Project Readiness Gauge dynamically scales to **75%** (3/4 verified).
4. **Restore Model Weights:**
   ```powershell
   Rename-Item models\mammogram_resnet50.pt.bak models\mammogram_resnet50.pt
   ```

---

### Condition D: Zero Examination History (Empty State)
1. **Clear Analysis History:**
   ```powershell
   curl -X DELETE http://127.0.0.1:8000/api/recent-analyses
   ```
2. **Verify Dashboard & History Pages:**
   - **Dashboard Last Analysis Card:** Displays **"No examinations yet"** and subtitle *"Submit an image in New Examination to see recent records."*.
   - **Patient History Page:** Displays a clean empty state with icon and button navigating to New Examination.
   - **Results Page:** Displays empty state prompting the user to run an analysis first.

---

## 4. Testing Image Validation and Patient-Pair Verification Separately

### 4.1 Testing Image Validation Separately (Endpoints: `/api/validate-scan`)
Image validation evaluates individual image integrity, formatting, heuristic properties, and manifest provenance.

1. **Test Arbitrary Valid Mammogram (Image type check passed, unverified provenance):**
   ```powershell
   curl -F "file=@tests/fixtures/sample_mammo.pgm" -F "expected_modality=mammogram" http://127.0.0.1:8000/api/validate-scan
   ```
   - **Expected Verification Level:** `image_type_checked`
   - **Provenance Verified:** `false`
   - **UI Badge:** `"Image type check passed"` (Never displays "Verified Mammogram Radiograph")

2. **Test Manifest-Backed Mammogram (Modality provenance verified):**
   ```powershell
   curl -F "file=@data/raw/mammogram/mdb001lm.pgm" -F "expected_modality=mammogram" http://127.0.0.1:8000/api/validate-scan
   ```
   - **Expected Verification Level:** `provenance_verified`
   - **Provenance Verified:** `true`
   - **Provenance Source:** `MIAS`
   - **Patient ID:** `MIAS_P001`
   - **UI Badge:** `"Modality provenance verified (MIAS: MIAS_P001)"`

3. **Test Cross-Modality Rejection (Thermal into Mammogram Mode):**
   ```powershell
   curl -F "file=@data/raw/thermal/Breast Thermography/IIR0110/IIR0110_anterior.jpg" -F "expected_modality=mammogram" http://127.0.0.1:8000/api/validate-scan
   ```
   - **Expected Verification Level:** `format_validated`
   - **Modality Verified:** `false`
   - **UI Alert:** `"Invalid image. Please upload a mammogram image."`

---

### 4.2 Testing Patient-Pair Verification Separately (Endpoint: `/api/validate-pair`)
Pair verification evaluates cross-modal compatibility, clinical cohort provenance, and same-patient pairing.

| Scenario | Input Mammogram | Input Thermal Scan | Expected Pairing Status | Combined Status Displayed | Analyze Button |
|---|---|---|---|---|---|
| **Neither Uploaded** | *None* | *None* | `empty` | **"No images uploaded"** | **Disabled** |
| **Mammogram Only** | `mdb001lm.pgm` | *None* | `incomplete` | **"Mammogram uploaded — Thermal image required"** | **Disabled** |
| **Thermal Only** | *None* | `IIR0110_anterior.jpg` | `incomplete` | **"Thermal image uploaded — Mammogram required"** | **Disabled** |
| **Invalid Image** | `sample.pgm` | `inverted_pgm.pgm` (invalid thermal) | `invalid` | **"Pair validation failed"** | **Disabled** |
| **Unverified Scans** | `custom_mammo.pgm` (unindexed) | `custom_thermal.jpg` (unindexed) | `not_verified` | **"Both files accepted, pairing not verified."** | **Disabled** |
| **Cohort Mismatch** | `mdb001lm.pgm` (MIAS UK, `MIAS_P001`) | `IIR0110_anterior.jpg` (Mendeley, `IIR0110`) | `mismatch` | **"Pairing mismatch — Scans belong to different participants or cohorts."** | **Disabled** |
| **Verified Same-Patient Pair** | Paired Study Mammogram (`PT_001`) | Paired Study Thermogram (`PT_001`) | `verified` | **"Both files validated, pairing verified, fusion model unavailable."** | **Disabled** |

**Multimodal Requirement Notice:**
In all combined modes where fusion inference cannot proceed, the interface displays:
> *"Combined analysis available only when a genuine trained fusion model is loaded and pairing requirements are satisfied."*

---

## 5. Test Suite Execution Summary

| Test File | Total Tests | Status | Execution Time |
|---|---|---|---|
| `tests/test_advanced_backend.py` | 6 | **PASS** | 0.85s |
| `tests/test_api_reliability.py` | 15 | **PASS** | 4.12s |
| `tests/test_archive_safety.py` | 4 | **PASS** | 0.12s |
| `tests/test_dashboard_functionality_and_truth.py` | 4 | **PASS** | 9.79s |
| `tests/test_deeplearning.py` | 6 | **PASS** | 3.45s |
| `tests/test_examination_modes_and_modality_validation.py` | 14 | **PASS** | 16.78s |
| `tests/test_manifest_and_idempotence.py` | 3 | **PASS** | 0.22s |
| `tests/test_metadata_parser.py` | 1 | **PASS** | 0.08s |
| `tests/test_scanner_and_identifier.py` | 4 | **PASS** | 0.18s |
| `tests/test_transforms.py` | 9 | **PASS** | 0.95s |
| **Total Automated Tests** | **66** | **ALL PASS** | **36.54s** |
