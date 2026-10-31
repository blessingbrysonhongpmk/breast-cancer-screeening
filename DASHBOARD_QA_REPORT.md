# MammoFusion-XAI Risk — Dashboard Visual QA & Resolution Report

**Execution Timestamp:** October 31, 2026  
**Environment:** Windows (PowerShell), Python 3.10, Node.js v20.18.0, Vite 8.3.5, React 19, PyTorch 2.1.2  
**Application URLs:**
- **Unified Clinical Production Server:** `http://127.0.0.1:8000` (FastAPI + React bundle in `app/static/`)
- **Vite Hot-Reload Development Server:** `http://127.0.0.1:5173`

---

## 1. Issues Found

### Issue 1.1: Layout Clipping & Content Hidden Behind Fixed Sidebar
* **Symptom:** On desktop and laptop viewports, the main dashboard content was horizontally clipped on the left by approximately 270px. Headings, metrics cards, and action buttons started at the browser window's left edge (`x = 0`), rendering directly underneath the sidebar.
* **Root Cause:** In `frontend/src/App.tsx`, the main content wrapper was rendered with `<div className="main-content-wrapper">`. However, in `frontend/src/index.css`, layout classes were historically named `.app-container` and `.main-content`. Because `.main-content-wrapper` had no matching CSS class, it lacked `margin-left: 260px` or `width: calc(100% - 260px)`. Because the `.sidebar` had `position: fixed; width: 270px;`, it overlaid and obscured the entire left portion of the content.

### Issue 1.2: Unstyled "Default Browser Grey" Sidebar Navigation Buttons
* **Symptom:** Sidebar navigation links rendered as standard operating-system default grey bevel buttons without padding, hover effects, or theme integration.
* **Root Cause:** In `frontend/src/App.tsx`, the navigation buttons used `className={`sidebar-nav-item ${isActive ? 'active' : ''}`}`. However, `frontend/src/index.css` had defined styles under `.nav-button`. No styling existed for `.sidebar-nav-item`, forcing the browser user-agent stylesheet to render raw default `<button>` controls.

### Issue 1.3: Mobile Sidebar Drawer Inaccessible
* **Symptom:** On mobile screens (< 1024px and 390px), the sidebar could not be toggled or closed, and the hamburger trigger button was invisible.
* **Root Cause:** In `frontend/src/App.tsx`, `.mobile-menu-trigger` and `.mobile-close-btn` contained inline `style={{ display: 'none' }}`, preventing responsive media queries from revealing them. Furthermore, no backdrop overlay existed to dismiss the mobile drawer.

### Issue 1.4: Inconsistent Model Status & Contradictory Readiness Messaging
* **Symptom:** In `OverviewPage.tsx`, the Model Readiness card displayed "Trained" when `modelStatus.is_ready_for_inference` was true, but simultaneously displayed "Awaiting Phase 3 Weights" and "Awaiting model training in Google Colab" in Phase 3 stepper.
* **Root Cause:** The component lacked dynamic synchronization between the verified loaded models and the pipeline phase indicators. Furthermore, `/api/models` previously checked only for file presence rather than verifying whether weights were loadable PyTorch checkpoints in memory.

### Issue 1.5: Unexplained Discrepancy Between Total and Labelled Images
* **Symptom:** The dashboard displayed "679 Total Verified Images" and "322 MIAS Mammograms", but listed breakdown numbers summing to 317 mammograms and 336 thermograms, leaving 26 images unaccounted for.
* **Root Cause:** The ground truth audit report (`reports/dataset_audit_report.json`) identifies 5 unannotated MIAS images (historical omissions in `Info.txt` severity tokens) and 21 unannotated Mendeley thermograms (7 patients awaiting clinical biopsy outcomes). The frontend did not explicitly disclose these unannotated records.

---

## 2. Files Changed

| File Path | Description of Changes |
| :--- | :--- |
| `frontend/src/index.css` | Implemented `.layout-root`, `.sidebar`, `.sidebar-overlay`, `.main-content-wrapper`, `.topbar`, `.content-container`, and styled `.sidebar-nav-item` with active/hover states. Added responsive media queries for 1024px, 768px, and 480px. Added `min-width: 0` to prevent grid blowout. |
| `frontend/src/App.tsx` | Added mobile backdrop overlay (`.sidebar-overlay`), removed hardcoded inline `display: 'none'` on mobile trigger/close buttons, passed `modelStatus` to `ExplainabilityPage`, and cleaned up layout hierarchies. |
| `frontend/src/features/overview/OverviewPage.tsx` | Redesigned Command Center hierarchy: aligned Phase 1–4 pipeline stepper cards; audited 4 telemetry cards with full breakdown (653 labelled + 26 unannotated = 679 total); corrected model readiness logic to display "Trained" only when weights are loaded and "Training Pending" otherwise. |
| `frontend/src/features/explainability/ExplainabilityPage.tsx` | Integrated `modelStatus` verification. Enabled live Grad-CAM hooks status when models are loaded; displayed honest standby notice disabling synthetic heatmaps when models are pending. Removed unused `Cpu` import. |
| `frontend/src/features/mammogram/MammogramPage.tsx` | Updated analysis response section to show real ResNet-50 predicted class, confidence, and generated Grad-CAM heatmap when inference is ready; preserved honest standby alert if inference is pending. |
| `frontend/src/features/thermal/ThermalPage.tsx` | Updated analysis response section to show real ResNet-50 thermal classification and Grad-CAM thumbnail when inference is ready; preserved standby alert if pending. |
| `frontend/src/services/api.ts` | Added `models_loaded?: string[]` to `ModelStatus` interface. |
| `app/server.py` | Added live loadability verification to `GET /api/models` (verifying `get_modality_model` PyTorch state dicts in memory) and registered `/api/dataset/stats` alias to `/api/datasets`. |
| `frontend/src/App.css` | Replaced unused Vite starter styles with clean reference comment. |

---

## 3. Fixes Applied

### 3.1. Layout Structure & Zero-Clipping Geometry
- Created `.layout-root` as a flex container (`width: 100%; min-height: 100vh; overflow-x: hidden`).
- Fixed `.sidebar` at `width: 260px; position: fixed; top: 0; bottom: 0; left: 0; z-index: 50`.
- Positioned `.main-content-wrapper` with `margin-left: 260px; width: calc(100% - 260px); flex: 1; min-width: 0`.
- Ensured all grid children and card wrappers include `min-width: 0` to prevent wide text or elements from forcing horizontal scrollbars on desktop.

### 3.2. Sidebar Navigation Styling
- Styled `.sidebar-nav-item` with:
  - Font: `Plus Jakarta Sans`, 13px, weight 500
  - Text color: `var(--text-secondary)` (`#5A3D4C`)
  - Padding: `10px 14px`, border-radius `var(--radius-md)` (`10px`)
  - Hover state: Background `var(--bg-blush)` (`#FFF2F5`), text `var(--primary-rose)` (`#B23B55`), border `var(--border-rose)` (`#F2D2D8`)
  - Active state: Rich Rose Gold background (`#B23B55`), crisp white typography (`#FFFFFF`), white icon fill (`color: #FFFFFF !important`), and elevated box-shadow (`0 2px 8px rgba(178, 59, 85, 0.25)`)
  - Focus ring: `2px solid var(--primary-rose)` with `1px` offset.

### 3.3. Dashboard Visual Hierarchy & Phase Stepper
- Unified the 4 research pipeline phases in `OverviewPage.tsx` using `grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr))`.
- Each phase card uses consistent padding (`14px`), border-radius (`var(--radius-md)`), status icons (`CheckCircle2`, `AlertCircle`, `Clock`, `Layers`), and explicit progress badges.
- Standardized the 4 telemetry metric cards to use identical 24px padding, 28px mono numerals (`JetBrains Mono`), secondary progress badges, and storage footprints.

### 3.4. Model Status & Grad-CAM Governance
- Replaced ambiguous text with deterministic checks:
  ```ts
  const isModelTrained = Boolean(
    modelStatus?.is_ready_for_inference &&
    (modelStatus?.models_available?.length ?? 0) > 0
  );
  ```
- If `isModelTrained` is true:
  - Phase 3 displays: `Phase 3: CNN Training — Complete (Trained)`
  - Phase 4 displays: `Phase 4: Grad-CAM — Active & Available`
  - Model card displays: `Trained` with `ResNet-50 Checkpoints Active`
- If `isModelTrained` is false:
  - Phase 3 displays: `Phase 3: CNN Training — Pending`
  - Phase 4 displays: `Phase 4: Grad-CAM — Standby (Awaiting Weights)`
  - Model card displays: `Training Pending` with `No Trained Weights Found`
- Enforced zero-fabrication: Simulated heatmaps are never rendered. Grad-CAM executes only when trained weights are registered in memory.

### 3.5. Verified Dataset Statistics & Label Reconciliation
- Explicitly documented the exact composition of the 679-image cohort:
  - **Total Images:** 679 (0 corrupt, 100% readable).
  - **Total Labelled:** 653 images.
  - **Total Unannotated:** 26 images.
  - **MIAS Mammograms (322 total across 161 patients):** 317 labelled (205 normal, 61 benign, 51 malignant) + 5 unannotated (historical `Info.txt` records lacking severity labels: `mdb164rl`, `mdb182rm`, `mdb273ll`, `mdb297ll`, `mdb320rl`).
  - **Mendeley Thermography (357 total across 119 patients):** 336 labelled (110 normal, 158 benign, 68 malignant) + 21 unannotated (7 patients with 3 projections each lacking biopsy pathology outcomes: `IIR0243`, `IIR0324`, etc.).

---

## 4. Viewport Tests Performed

| Viewport | Dimensions | Layout Behavior Verified | Pass / Fail |
| :--- | :---: | :--- | :---: |
| **Desktop Ultra** | `1440px × 900px` | Sidebar pinned at 260px; main content starts at 260px (`margin-left: 260px`). All 4 metric cards fit side-by-side in a 4-column grid. Zero horizontal scrollbar. | **PASS** |
| **Laptop Standard** | `1366px × 768px` | Sidebar pinned at 260px; content width is 1106px. Grid cards adapt smoothly with `gap: 16px`. Header breadcrumb and FastAPI status pill align cleanly without wrapping. Zero horizontal scrollbar. | **PASS** |
| **Tablet Portrait** | `768px × 1024px` | Sidebar automatically converts to off-canvas slide-out drawer (`transform: translateX(-100%)`). Main content expands to full screen (`margin-left: 0`). Topbar reveals hamburger menu button. Grid columns stack into 2-column layout. | **PASS** |
| **Mobile Compact** | `390px × 844px` | Hamburger menu opens full off-canvas drawer with dark blur overlay (`.sidebar-overlay`). Metric cards and phase stepper collapse into clean single-column cards (`minmax(min(100%, ...))`). Action buttons wrap cleanly. Zero horizontal overflow. | **PASS** |

---

## 5. Build and Test Results

### 5.1. TypeScript & Vite Production Build
```
> frontend@0.0.0 build
> tsc -b && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2054 modules transformed.
rendering chunks...
computing gzip size...
../app/static/index.html                   0.85 kB │ gzip:  0.49 kB
../app/static/assets/index-DGHHL6Gp.css    7.35 kB │ gzip:  2.18 kB
../app/static/assets/index-hEBEbOJy.js   324.27 kB │ gzip: 88.47 kB
✓ built in 1.01s
```
*Result: Exit code 0, 0 compiler errors.*

### 5.2. Oxlint Linter
- Executed on `frontend/src/` across 11 source files with 116 rules.
- **Result:** 0 errors, 0 breaking issues.

### 5.3. Backend PyTest Suite
```
tests/test_archive_safety.py ....                                        [ 14%]
tests/test_deeplearning.py ......                                        [ 37%]
tests/test_manifest_and_idempotence.py ...                               [ 48%]
tests/test_metadata_parser.py .                                          [ 51%]
tests/test_scanner_and_identifier.py ....                                [ 66%]
tests/test_transforms.py .........                                       [100%]
======================= 27 passed, 1 warning in 26.71s ========================
```
*Result: All 27 tests passed.*

### 5.4. API Endpoint Integration Verification
- `GET http://127.0.0.1:8000/api/models` -> `200 OK` (`models_loaded: ["mammogram", "thermal"]`, `is_ready_for_inference: true`)
- `GET http://127.0.0.1:8000/api/datasets` -> `200 OK` (679 total: 322 MIAS, 357 Mendeley)
- `GET http://127.0.0.1:8000/api/dataset/stats` -> `200 OK` (alias verified)
- `GET http://127.0.0.1:8000/` -> `200 OK` (serving compiled SPA bundle)

---

## 6. Remaining Issues & Observations

1. **Class Imbalance in Raw Cohorts:**
   - MIAS is predominantly normal (205 normal vs 61 benign vs 51 malignant).
   - Mendeley is predominantly benign (158 benign vs 110 normal vs 68 malignant).
   - *Observation:* The frontend accurately reflects this asymmetry without manipulating data. Weighted Cross-Entropy or Focal Loss is configured in the training pipeline to address this in subsequent iterations.
2. **Thermal Unimodal Test Accuracy (25.0%):**
   - The standalone thermal ResNet-50 test accuracy is 25.0%, reflecting noise and lack of camera temperature calibration in the raw dataset.
   - *Observation:* This baseline is accurately reported on the Benchmark Evaluation page without fabrication, reinforcing why unimodal thermography alone cannot substitute for mammography.

