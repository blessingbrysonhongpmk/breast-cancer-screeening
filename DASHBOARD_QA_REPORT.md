# MammoFusion-XAI — Dashboard QA & Truthfulness Audit Report

**Date of Audit:** October 31, 2026  
**Platform Version:** 1.0.0 (Research & Educational Platform)  
**Verification Method:** End-to-End API Integration & Unit Testing (`pytest tests/test_dashboard_functionality_and_truth.py`)

---

## 1. Executive Summary

This audit confirms that the **MammoFusion-XAI Dashboard** has been completely overhauled to eliminate all hardcoded statuses, static progress percentages, and simulated metrics. Every displayed status, checklist item, date, and connection indicator is directly derived from real backend API responses.

---

## 2. Item-by-Item Verification Matrix

| # | Dashboard Element | Previous Behavior | Verified Updated Implementation | Status |
|---|---|---|---|---|
| **1** | **Project Readiness Indicator** | Hardcoded static `95%` ring regardless of backend state. | Replaced with dynamic completion calculated from documented, verifiable capabilities: Mammogram Model (25%), Thermal Model (25%), Grad-CAM Engine (25%), Real-time Analysis (25%). Shows `--%` / `0%` when offline, and exact verified percentage when online. | **Verified Truthful** |
| **2** | **Mammogram Model Status** | Hardcoded green checkmark. | Displays green checkmark only when `models/mammogram_resnet50.pt` exists and forward verification succeeds. Shows amber/gray warning when checkpoint is missing. | **Verified Truthful** |
| **3** | **Thermal Model Status** | Hardcoded green checkmark. | Displays green checkmark only when `models/thermal_resnet50.pt` exists and forward verification succeeds. Shows amber/gray warning when checkpoint is missing. | **Verified Truthful** |
| **4** | **Grad-CAM Explanation Status** | Hardcoded green checkmark. | Verified via backend inspection of `target_layer="layer4"`. Active only when compatible model architecture is loaded. | **Verified Truthful** |
| **5** | **Real-Time Analysis Status** | Hardcoded green checkmark. | Verified active only when backend API is reachable and at least one unimodal model is loaded. | **Verified Truthful** |
| **6** | **System Status (Backend)** | Static "Backend Connected". | Dynamically queries `/api/health`. Renders: <br>• **Online** (`#15803D`, green badge)<br>• **Offline** (`#DC2626`, red badge)<br>• **Checking...** (`#D97706`, amber badge). | **Verified Truthful** |
| **7** | **Last Analysis** | Hardcoded static text `Oct 31, 2026 • 06:49 PM`. | Dynamically retrieved from `reports/recent_analyses.json` via `GET /api/recent-analyses`. Displays actual formatted timestamp and classification. If zero records exist, truthfully displays `"No examinations yet"`. | **Verified Truthful** |
| **8** | **Action Cards Navigation** | N/A | Verified: <br>• `New Examination` → navigates to `examination`<br>• `View Results` → navigates to `results`<br>• `Patient History` → navigates to `history`<br>• `Learn More` → navigates to `about`. | **Verified Functional** |

---

## 3. Four Environmental Test Scenarios

The dashboard was systematically validated under all four environmental conditions:

### Condition A: Backend Running & Models Loaded
- **Backend Status:** `Online` (green indicator, verified from `/api/health`).
- **Checklist:** Mammogram (Ready), Thermal (Ready), Grad-CAM (Active), Real-time (Operational).
- **Project Readiness Gauge:** `100%` (4 of 4 capabilities active).
- **Model Status:** `Models Ready (2/2)`.
- **Last Analysis:** Displays exact timestamp of last genuine examination from `reports/recent_analyses.json`.

### Condition B: Backend Stopped / Offline
- **Backend Status:** `Offline` (red indicator).
- **Checklist:** Displays neutral/gray status; no green checkmarks.
- **Project Readiness Gauge:** `0%` (or `--%` during checking).
- **Model Status:** `Models Standby`.
- **Last Analysis:** Cleanly reports `"No examinations yet"` or `"Checking records..."`.

### Condition C: Model Weights Missing
- **Backend Status:** `Online`.
- **Checklist:** Missing modality displays `Model not available` with warning indicator.
- **Project Readiness Gauge:** Drops proportionally (e.g. 50% if 1 model missing, 0% if both missing).
- **Model Status:** Truthfully shows `Partial (1/2 Ready)` or `Models Standby`.
- **Zero Fabrication:** No simulated predictions or fake labels are generated.

### Condition D: Combined Multimodal Screening Status
- **Combined Analysis Mode:** The UI displays the dual-upload interface (Mammogram + Thermal) with independent validation.
- **Fusion Model Readiness:** The backend reports `ready=False` and `status_text="Combined analysis model is not yet available."`.
- **Execution Safeguard:** The "Analyze Combined Images" button is disabled and backend returns HTTP 503 `Service Unavailable` without creating fabricated records.

---

## 4. Summary of Connected vs. Pending Features

- **Genuinely Functional & Data-Backed:**
  - Backend health check (`GET /api/health`)
  - Unimodal Mammogram ResNet-50 inference (`POST /api/analyze/mammogram`)
  - Unimodal Thermal ResNet-50 inference (`POST /api/analyze/thermal`)
  - Bottleneck Grad-CAM visual attribution (`resnet.layer4`)
  - Shannon entropy & normalized predictive uncertainty scoring
  - Session analysis history & Markdown report export (`GET /api/recent-analyses`)
  - Modality boundary validation (rejecting cross-modality or corrupt images)

- **Awaiting Model Training:**
  - Multimodal Late-Fusion model (requires clinically paired cohort training data; currently disabled per zero-fabrication research policy).
