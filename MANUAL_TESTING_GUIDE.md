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

### 3. Separate Validation States: Format vs Modality Verification
- **Dual Validation Pipeline:**
  1. **File Format & Dimensions:** Verifies readable bytes, supported extensions, dimensions $\ge 32\times 32$ px, and file size $\le 25$ MB.
  2. **Modality Verification:** Enforces strict boundary checks (color divergence, saturation, luminance distribution, radiographic background borders) via `POST /api/validate-scan`.
- **UI State Separation:**
  - Valid Mammogram: Shows `✓ File Format & Dimensions: Valid (PGM • 4320×2048 px • 8.4 MB)` AND `✓ Modality Verification: Verified Mammogram`.
  - Thermal Uploaded into Mammogram Mode: Shows `✓ File Format: Valid (JPEG • 640×480 px)` BUT `✕ Modality Verification: Rejected — Invalid image. Please upload a mammogram image.`
  - PGM Uploaded into Thermal Mode: Shows `✕ File Format: Unsupported format '.pgm'` AND `✕ Modality Verification: Rejected — Invalid image. Please upload a thermal image.`

### 4. Verified Reference Samples Marked as TEST DATA
- **Prominent Tagging:** All curated reference scans from the MIAS and Mendeley repositories are explicitly tagged with `[TEST DATA]` chips.
- **Clear Research Context:** The reference sample drawer clearly states: *"TEST DATA: Research reference scan for algorithm verification (Not live patient records)."*
- **No Synthetic Pairing:** Because MIAS (UK) and Mendeley (Mexico) represent independent patient cohorts with zero shared participants, arbitrary pairing of unrelated images has been eliminated. The Combined Screening mode explicitly informs the user that paired scans must originate from clinical PACS or paired study uploads.

### 5. Combined Multimodal Screening Safeguards
- **Dual Mandatory Dropzones:** Requires both a validated mammogram radiograph and a validated infrared thermogram.
- **Analyze Button Permanently Disabled:** Displays **`"Combined analysis model is not yet available."`** (`disabled={true}`).
- **Zero Fabrication Policy:** Explanatory alert explains that genuine multimodal fusion requires a trained joint fusion model with paired patient provenance. The system strictly prohibits averaging or combining unimodal scores into synthetic risk metrics.
- **Backend Guard:** Direct calls to `POST /api/analyze/combined` return **HTTP 503 Service Unavailable** with zero history corruption.

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

## 4. Test Suite Execution Summary

| Test File | Total Tests | Status | Execution Time |
|---|---|---|---|
| `tests/test_advanced_backend.py` | 6 | **PASS** | 0.85s |
| `tests/test_api_reliability.py` | 15 | **PASS** | 4.12s |
| `tests/test_archive_safety.py` | 4 | **PASS** | 0.12s |
| `tests/test_dashboard_functionality_and_truth.py` | 4 | **PASS** | 8.87s |
| `tests/test_deeplearning.py` | 6 | **PASS** | 3.45s |
| `tests/test_examination_modes_and_modality_validation.py` | 9 | **PASS** | 14.79s |
| `tests/test_manifest_and_idempotence.py` | 3 | **PASS** | 0.22s |
| `tests/test_metadata_parser.py` | 1 | **PASS** | 0.08s |
| `tests/test_scanner_and_identifier.py` | 4 | **PASS** | 0.18s |
| `tests/test_transforms.py` | 9 | **PASS** | 0.95s |
| **Total Automated Tests** | **61** | **ALL PASS** | **24.54s** |
