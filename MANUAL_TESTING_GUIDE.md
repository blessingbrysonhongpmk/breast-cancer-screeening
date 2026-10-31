# MammoFusion-XAI: Manual Testing & Verification Guide

This document provides step-by-step procedures to manually and automatically verify the functionality, integrity, and authenticity of the **MammoFusion-XAI** platform across all supported modes and environmental conditions.

---

## 1. Quick Verification Commands

### Run Full Automated Test Suite (54 Tests)
```powershell
py -3.10 -m pytest tests/ -v
```

### Run Dashboard Truth & Environmental Tests
```powershell
py -3.10 -m pytest tests/test_dashboard_functionality_and_truth.py -v
```

### Run 3-Mode Examination & Modality Validation Tests
```powershell
py -3.10 -m pytest tests/test_examination_modes_and_modality_validation.py -v
```

---

## 2. Testing the 4 Environmental Conditions

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
1. **Stop the Backend Server** (Ctrl+C in terminal or kill task-3552).
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

## 3. Testing the 3 Examination Modes

Navigate to **New Examination** (`/examination`):

### Mode 1: Mammogram Screening
1. **Select Tab:** "Mammogram Screening".
2. **Upload Valid Mammogram:** Select a MIAS PGM image or grayscale mammogram PNG/JPG.
   - Preview loads immediately.
   - Modality detector confirms grayscale breast anatomy.
   - Click **"Run Mammogram Analysis"**.
   - Progress bar displays real-time inference steps.
   - Redirects to **Results** page with genuine ResNet-50 probabilities and true Grad-CAM heatmap on `layer4`.
3. **Negative Test (Cross-Modality Rejection):**
   - Upload a colorful thermal image into the Mammogram mode.
   - UI immediately blocks submission and presents the exact error:
     > **"Invalid image. Please upload a mammogram image."**
   - Backend endpoint (`POST /api/analyze/mammogram`) strictly returns HTTP 400 with the same message if bypassed.

---

### Mode 2: Thermal Screening
1. **Select Tab:** "Thermal Screening".
2. **Upload Valid Thermal Image:** Select an RGB thermogram from the Mendeley dataset.
   - Preview loads immediately.
   - Modality detector verifies color palette / temperature distribution.
   - Click **"Run Thermal Analysis"**.
   - Redirects to **Results** page with genuine ResNet-50 classification.
3. **Negative Test (Cross-Modality Rejection):**
   - Upload a grayscale mammogram into Thermal mode.
   - UI immediately blocks submission and presents the exact error:
     > **"Invalid image. Please upload a thermal image."**
   - Backend endpoint (`POST /api/analyze/thermal`) strictly returns HTTP 400 with the same message if bypassed.

---

### Mode 3: Combined Multimodal Screening
1. **Select Tab:** "Combined Multimodal Screening".
2. **Verify Two Mandatory Upload Dropzones:**
   - Dropzone 1: Mammogram Image (requires valid mammogram; rejects thermograms).
   - Dropzone 2: Thermal Image (requires valid thermogram; rejects mammograms).
3. **Upload Workflow:**
   - Upload only a mammogram: Button remains disabled (`"Upload both images to analyze"`).
   - Upload both images: Both previews appear with replacement and removal buttons.
4. **Multimodal Model Status Verification:**
   - Action button displays: **"Combined analysis model is not yet available."**
   - Button is disabled (`disabled={true}`).
   - Subtext explains: *"The Multimodal Fusion model requires paired patient data and is currently pending training. Individual screening modes are fully operational."*
5. **Backend Safety:**
   - If a request is sent directly to `POST /api/analyze/combined`, the server validates both modalities and returns **HTTP 503** with message `"Combined analysis model is not yet available."`.
   - **Zero fake records** are written to the database or recent analyses history.

---

## 4. Scientific Truth & Non-Fabrication Summary

| Feature / Metric | Backend Verification Mechanism | UI Display Truth |
|---|---|---|
| **System Status** | `GET /api/health` response verification | `Online` vs `Offline` (no hardcoded state) |
| **Mammogram Model** | PyTorch model instantiation + checkpoint check | `Model Ready` vs `Unavailable` |
| **Thermal Model** | PyTorch model instantiation + checkpoint check | `Model Ready` vs `Unavailable` |
| **Grad-CAM** | PyTorch hook execution test on `layer4` | `Available` vs `Unavailable` |
| **Real-time Analysis** | Live model forward pass verification | `Active` vs `Standby` |
| **Project Readiness** | Dynamic: $\frac{\text{Verified Items}}{4} \times 100\%$ | Dynamic SVG donut (0% - 100%) |
| **Last Analysis** | `GET /api/recent-analyses` most recent entry | Real timestamp or "No examinations yet" |
| **Combined Screening** | `POST /api/analyze/combined` HTTP 503 guard | Button disabled with explanatory message |
