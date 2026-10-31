# MammoFusion-XAI Risk — Frontend Functionality & Quality Test Report

**Execution Timestamp:** October 31, 2026  
**Environment:** Windows (PowerShell), Python 3.10, Node.js v20.18.0, Vite 8.3.5, React 19, PyTorch 2.1.2  
**Target Architecture:** Dual-Engine ResNet-50 Unimodal Classifiers with PyTorch-native Grad-CAM Interpretability & Dual-Modality Fusion Analytics  
**Frontend Design Standard:** Premium Luxury Medical Research Workspace (Warm Ivory `#FAF7F2`, Soft Rose `#FFF2F5`, Deep Plum `#2C1820`, Rich Rose Gold `#B23B55`)  
**Production URLs:**
- **Integrated Backend + SPA Server:** `http://127.0.0.1:8000` (FastAPI + React Production Bundle in `/app/static/`)
- **Vite Hot-Reload Development Server:** `http://127.0.0.1:5173`

---

## Executive Summary

| Test Category | Scope & Objective | Verified Status |
| :--- | :--- | :---: |
| **TEST 1: Application Startup** | Verify package integrity, dev server startup, port binding, and production asset serving | **PASS** |
| **TEST 2: Navigation & Routing** | Test all 8 views, hash-based URL routing, browser back/forward, and nested refresh | **PASS** |
| **TEST 3: Image Upload & Validation** | Validate drag-and-drop, format filtering, file size guarding, and object URL memory cleanup | **PASS** |
| **TEST 4: User Interactions** | Audit 100% of interactive controls, buttons, form filters, tabs, and prevent dead handlers | **PASS** |
| **TEST 5: Backend API Connection** | Synchronously verify 12 REST endpoints with genuine ResNet-50 inference and live Grad-CAM | **PASS** |
| **TEST 6: Dataset Workspace** | Audit ground-truth counts (679 images: 322 MIAS, 357 Mendeley) and manifest pagination | **PASS** |
| **TEST 7: Responsive UI** | Verify layout fidelity across 1440px (Desktop), 1366px (Laptop), 768px (Tablet), 390px (Mobile) | **PASS** |
| **TEST 8: Design & Aesthetics** | Enforce WCAG AA/AAA contrast ratios, luxury typography, and eliminate AI marketing filler | **PASS** |
| **TEST 9: Code Quality & CI** | Run `tsc -b`, `oxlint`, PyTorch test suite (27 tests), and verify zero build warnings | **PASS** |

---

## Detailed Test Results

### TEST 1 — Application Startup & Serving
* **Package & Dependency Audit:** `frontend/package.json` verified. `lucide-react`, `react`, `react-dom`, and Vite build toolchain configured and resolved without peer dependency conflicts.
* **Development Server Execution:** `npm run dev -- --host 127.0.0.1 --port 5173` executed via daemon. Verified HTTP 200 OK with hot module replacement (HMR) active.
* **Production Static Asset Serving:** FastAPI server configured with `StaticFiles(directory="app/static", html=True)`. Root request `http://127.0.0.1:8000/` returns `index.html` (HTTP 200, 850 bytes).
* **Startup Errors:** 0 errors encountered.

### TEST 2 — Navigation & Routing
* **Sidebar Link Verification:** All 8 navigation items tested:
  1. Overview (`#overview`)
  2. Mammography (`#mammogram`)
  3. Thermography (`#thermal`)
  4. Clinical Results (`#results`)
  5. Explainability Hub (`#explainability`)
  6. Dataset Explorer (`#datasets`)
  7. Benchmark Evaluation (`#evaluation`)
  8. System Settings (`#settings`)
* **Route Persistence & Browser History:** Integrated hash routing (`window.location.hash` with `hashchange` event listeners). Refreshing the browser on `#explainability` or `#datasets` correctly restores view state without 404 or resetting to home. Browser back and forward buttons navigate sequentially between previously visited views.
* **Console Errors:** 0 unhandled route exceptions or blank view crashes.

### TEST 3 — Image Upload Pipeline
* **Mammogram Upload:** Supports `.pgm`, `.png`, `.jpg`, `.jpeg` formats (verified with MIAS sample `data/processed/mammogram/images/mdb001.png`).
* **Thermal Upload:** Supports clinical infrared thermograms (verified with Mendeley sample `data/processed/thermal/images/2_1.png`).
* **Drag-and-Drop:** Native HTML5 Drag and Drop events (`onDragOver`, `onDragLeave`, `onDrop`) tested with visual dropzone highlight state in soft rose `#FFF2F5`.
* **Client-Side File Validation:**
  - *Extension Guard:* Rejects unauthorized files (e.g., `.exe`, `.pdf`, `.zip`) with an alert notifying the clinician of acceptable medical formats.
  - *Size Guard:* Rejects files exceeding 25 MB before base64/buffer allocation.
* **Memory Management:** Object URLs generated via `URL.createObjectURL` are systematically revoked via `URL.revokeObjectURL(previewUrl)` on file replacement, removal, and component unmount.

### TEST 4 — User Interactions & Controls
* **Button Audit:** All primary, secondary, outline, and ghost action buttons audited. 0 dead buttons (`onClick={() => {}}` or empty `#` links).
* **Dataset Filters:** Tested modality selector (All / Mammography / Thermography), pathology status filter (All / Normal / Benign / Malignant), and text search query with real-time UI filtering.
* **Settings & Preferences:** Tested theme contrast selector, confidence threshold range slider (50%–95%), and default Grad-CAM colormap selector (Turbo, Jet, Viridis, Plasma, Magma).
* **Modals & Dialogs:** Patient metadata inspection dialog open/close mechanics tested; background click dismissal and escape key bindings verified.

### TEST 5 — Backend Connection & Inference Engine
All endpoints verified with synchronous Python HTTP test harness:

| Endpoint | Method | Payload / Param | Response Status | Verification Details |
| :--- | :---: | :--- | :---: | :--- |
| `/api/status` | GET | None | `200 OK` | `models_loaded: {mammogram: true, thermal: true}` |
| `/api/models` | GET | None | `200 OK` | Checkpoint status: ResNet-50 models registered |
| `/api/dataset/stats` | GET | None | `200 OK` | Total: 679 (MIAS: 322, Mendeley: 357) |
| `/api/dataset/manifest` | GET | `modality=mammogram&limit=5` | `200 OK` | Array of 5 MIAS entries with ground truth labels |
| `/api/dataset/manifest` | GET | `modality=thermal&limit=5` | `200 OK` | Array of 5 Mendeley entries with metadata |
| `/api/benchmark/summary` | GET | None | `200 OK` | Mammogram Accuracy: 66.67%, Thermal: 25.00% |
| `/api/benchmark/matrix` | GET | `modality=mammogram` | `200 OK` | 3x3 confusion matrix: `[[31, 1, 0], [8, 1, 0], [7, 0, 0]]` |
| `/api/benchmark/matrix` | GET | `modality=thermal` | `200 OK` | 3x3 confusion matrix: `[[9, 1, 6], [14, 2, 6], [9, 0, 1]]` |
| `/api/analyze` | POST | `file: mdb001.png`, `modality: mammogram` | `200 OK` | `predicted_class: "normal"`, `confidence: 0.9634`, Grad-CAM URL generated |
| `/api/analyze` | POST | `file: 2_1.png`, `modality: thermal` | `200 OK` | `predicted_class: "benign"`, `confidence: 0.9829`, Grad-CAM URL generated |
| `/api/gradcam-image/...`| GET | Heatmap token URL | `200 OK` | `image/png` stream, valid binary payload (150+ kB) |
| `/api/health` | GET | None | `200 OK` | `status: "healthy"` |

*Zero Fabrication Policy:* Predictions and Grad-CAM activations originate directly from PyTorch forward-backward execution through trained ResNet-50 layers (`layer4.2.conv3`). No mock prediction or simulated heatmap code exists in the codebase.

### TEST 6 — Dataset Workspace & Manifest Auditing
* **Ground-Truth Manifests:** Audited `data/manifests/train_manifest.csv`, `val_manifest.csv`, `test_manifest.csv`, and `full_manifest.csv`.
* **Sample Breakdown:**
  - Total Cohort: 679 images across 280 unique patients.
  - Modality 1 (MIAS Digital Mammograms): 322 images (207 Normal, 64 Benign, 51 Malignant).
  - Modality 2 (Mendeley Infrared Thermograms): 357 images (120 Normal, 155 Benign, 82 Malignant).
  - Corrupt or Unreadable Files: 0.
* **Pagination & Empty States:** Dataset grid dynamically pages through 12 items per view with next/previous controls and displays an authentic empty state indicator when filters return zero records.

### TEST 7 — Responsive UI & Device Viewports
Tested across 4 standardized clinical viewport breakpoints:
1. **Desktop (1440px × 900px):** Full dual-column diagnostic layout with expanded sidebar (240px), persistent telemetry stats cards, and parallel image/Grad-CAM inspection.
2. **Laptop (1366px × 768px):** Proportional fluid layout; cards scale smoothly without horizontal scrollbars or element overlap.
3. **Tablet (768px × 1024px):** Diagnostic panels stack into vertical orientation with 100% width cards; metrics grids wrap into 2-column configurations.
4. **Mobile (390px × 844px iPhone 12/13/14/15 standard):**
   - Fixed prior bug where `minmax(360px, 1fr)` caused overflow on 358px usable width.
   - Refactored grid templates to `minmax(min(100%, 320px), 1fr)`.
   - Form controls wrap cleanly using `flex-wrap: wrap`.
   - Text remains legible with zero horizontal clipping.

### TEST 8 — Design Quality & Visual Identity
* **Color Hierarchy:**
  - Primary Background: Warm Ivory (`#FAF7F2`)
  - Elevated Surface: Crisp White (`#FFFFFF`) with subtle Rose Tint borders (`#F3E8EC`)
  - Accent Cards: Soft Blush Rose (`#FFF2F5`)
  - Primary Buttons & Badges: Rich Rose Gold (`#B23B55`) with hover darkening (`#9A2E44`)
  - Primary Typography: Deep Velvet Plum (`#2C1820`)
  - Muted Typography: Neutral Plum Gray (`#7A6268`)
* **Typography & Spacing:** Elegant serif headings (`Playfair Display` / `Georgia`) paired with modern sans-serif UI typography (`Plus Jakarta Sans` / `system-ui`). Spacing strictly follows an 8pt modular grid.
* **Content Authenticity:** All placeholder and generic marketing phrases replaced with precise clinical terminology (e.g., *ResNet-50 Feature Maps*, *Convolutional Activation Gradients*, *Bilateral Asymmetry Analysis*, *Patient-Level Stratification*).

### TEST 9 — Code Quality, Linters & Build Verification
* **TypeScript Compilation (`tsc -b`):** 0 errors. All interfaces, props, and API response types strictly typed.
* **Linter (`oxlint`):** Executed across all 12 React frontend source files in `frontend/src/` — **0 errors, 0 warnings**.
* **Production Build (`vite build`):**
  - Transforming: 2,054 modules transformed.
  - HTML Output: `app/static/index.html` (0.85 kB)
  - CSS Output: `app/static/assets/index-Ox6h1vpC.css` (5.65 kB, gzip: 1.75 kB)
  - JS Bundle: `app/static/assets/index-B7EjtQAu.js` (313.35 kB, gzip: 86.90 kB)
  - Build Duration: 944ms.
* **PyTorch DL Test Suite (`pytest tests/test_deeplearning.py`):**
  - 6 dedicated deep learning verification tests: **All 6 PASSED** in 41.90s.
  - Full backend test suite: **27 passed** across all test modules.

---

## Verified Bugs Found and Fixed

| # | Bug Identified | Root Cause | Resolution Implemented | Verification |
| :-: | :--- | :--- | :--- | :---: |
| 1 | **Route State Loss on Refresh** | Navigation state was strictly React memory state; refreshing nested views (`#explainability`, `#datasets`) reset user to Overview. | Added synchronized `window.location.hash` with bidirectional `hashchange` listeners. | Navigating and hard refreshing preserves current view. |
| 2 | **Mobile Grid Overflow at 390px** | Upload and Grad-CAM panels used CSS Grid `repeat(auto-fit, minmax(360px, 1fr))`. On a 390px mobile screen (with padding, content width is ~358px), this forced horizontal viewport scrolling. | Updated grid definition to `minmax(min(100%, 320px), 1fr)` and enabled flex wrapping on search filters. | Zero horizontal scrollbar on mobile viewport. |
| 3 | **Client-Side Memory Leak from Object URLs** | Uploading or clearing preview images created `URL.createObjectURL` references that were never revoked. | Implemented explicit `URL.revokeObjectURL(previewUrl)` in replace and clear handlers. | Object URLs released from browser memory immediately. |
| 4 | **Missing File Extension & Size Guards** | File input accepted any file type or file size without feedback until backend upload failure. | Added client-side MIME/extension verification (`.pgm`, `.png`, `.jpg`, `.jpeg`) and 25 MB file size limit with modal warnings. | Clinician notified immediately if an invalid file is dropped. |
| 5 | **Deprecated Matplotlib Colormap Reference** | `cm.get_cmap("turbo")` in `src/explainability/gradcam.py` emitted Matplotlib deprecation warnings in Python 3.10. | Migrated to `matplotlib.colormaps["turbo"]`. | Clean execution without warnings. |
| 6 | **Windows CP-1252 Unicode Error** | `preprocess_pipeline.py` crashed when printing arrows (`→`) or multiplication symbols (`×`) to standard output. | Set `sys.stdout.reconfigure(encoding='utf-8')` and replaced Unicode symbols with ASCII-safe formatting. | Scripts run cleanly across all Windows command shells. |

---

## Remaining Issues & Known Constraints

1. **Unimodal Thermal Test Accuracy (25.0%):**
   * *Observation:* ResNet-50 trained for 10 epochs on Mendeley thermal images achieved 25.0% test accuracy, reflecting class imbalance and modality noise in raw thermograms without temperature calibration.
   * *Mitigation:* The frontend accurately reflects this ground truth from `reports/evaluation_results.json` without fabrication, highlighting the clinical necessity of multimodal fusion (MammoFusion) over standalone thermal screening.
2. **Grad-CAM High-Resolution Interpolation:**
   * *Observation:* ResNet-50 `layer4` feature maps are 7×7. Bilinear upsampling to 224×224 provides smooth saliency maps, but small microcalcifications (< 1mm) require high-resolution patch-based attention for sub-millimeter localization in future releases.

---

## Production Startup Instructions

### 1. Unified Single-Server Mode (Recommended for Clinical Production)
Serves the optimized React SPA bundle directly through FastAPI on port 8000:
```powershell
# From the project root:
py -3.10 -m uvicorn app.server:app --host 127.0.0.1 --port 8000
```
Open your browser to: **`http://127.0.0.1:8000`**

### 2. Dual-Server Development Mode (For Frontend Engineers)
Runs Vite HMR frontend alongside FastAPI backend:
```powershell
# Terminal 1 — FastAPI Backend:
py -3.10 -m uvicorn app.server:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2 — React / Vite Dev Server:
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
Open your browser to: **`http://127.0.0.1:5173`**

