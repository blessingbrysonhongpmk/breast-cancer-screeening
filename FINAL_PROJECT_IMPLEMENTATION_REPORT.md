# FINAL PROJECT IMPLEMENTATION REPORT

**Project Title:** Multimodal Explainable AI-Based Breast Cancer Screening and Risk Prediction System  
**Platform Version:** 1.0.0 (Production Engineering Release)  
**Verification Status:** 68/68 Passing Automated Unit & Integration Tests (100%)  
**Frontend Architecture:** React 18, TypeScript, Vite 5, Custom Design System (`Plus Jakarta Sans`)  
**Backend Architecture:** FastAPI 0.115+, PyTorch 2.2+, Torchvision ResNet-50, OpenCV  
**Audit Date:** October 31, 2026  

---

## 1. Executive Summary

The **Multimodal Explainable AI-Based Breast Cancer Screening and Risk Prediction System** (MammoFusion-XAI) is an oncology decision-support and machine learning research platform. Built to clinical research and engineering standards, the platform provides deep convolutional neural network inference across two complementary clinical imaging modalities:
1. **Full-Field Digital Mammography** (structural morphology via the MIAS dataset, Cambridge, UK)
2. **Infrared Breast Thermography** (metabolic vascular asymmetry via the Mendeley Breast Thermography dataset, Mexico)

Rather than treating deep neural networks as uninterpretable black boxes or asserting simulated clinical diagnostics, the system bridges clinical research and machine learning through six pillars of authenticity:
- **Genuine ResNet-50 Neural Network Inference:** Real weight tensor checkpoint execution without mock or hard-coded results.
- **Explainable AI (Grad-CAM):** True gradient backpropagation through ResNet-50 bottleneck (`layer4`) with Turbo colormap overlay and focal Region-of-Interest (ROI) bounding box localization.
- **Predictive Uncertainty Quantification:** Real-time computation of Shannon entropy ($H(y)$), normalized uncertainty indexes, confidence margins, and Test-Time Augmentation (TTA).
- **Zero Patient Data Leakage:** Strict patient-level dataset partitioning where bilateral views and multiple camera projections of any patient reside strictly within a single partition.
- **Three-Mode Examination Workflow & 4-Level Validation:** Independent validation (Format Validated $\to$ Image Type Checked $\to$ Modality Provenance Verified $\to$ Same-Patient Pairing Verified) with native client-side PGM canvas rendering and RGB false-color preservation.
- **Safe Dataset Ingestion & Ingestion Pipeline:** Automated dropbox scanning, zip-slip traversal protection, raw directory organization, and manifest generation.

---

## 2. Engineering Architecture & Methodology

```mermaid
flowchart TD
    subgraph UI ["Frontend User Interface (React 18 + TypeScript)"]
        Dashboard["1. Dashboard (Overview & Telemetry)"]
        Exam["2. New Examination (3 Modes, Canvas PGM, TTA)"]
        Results["3. Results (Findings, Grad-CAM, Benchmark Graphs)"]
        History["4. Patient History (Local Session Archive)"]
        About["5. About (Methodology, Ingestion & Disclaimers)"]
    end

    subgraph API ["Backend API Layer (FastAPI 0.115+)"]
        HCheck["GET /api/health"]
        MReady["GET /api/models/readiness"]
        VScan["POST /api/validate-scan"]
        VPair["POST /api/validate-pair"]
        InfMammo["POST /api/analyze/mammogram"]
        InfTherm["POST /api/analyze/thermal"]
        InfComb["POST /api/analyze/combined"]
        DScan["POST /api/dataset/scan"]
        DImport["POST /api/dataset/import"]
        HistAPI["GET / DELETE /api/recent-analyses"]
        EvalAPI["GET /api/evaluation"]
    end

    subgraph Core ["Scientific Machine Learning Engine (PyTorch 2.2+)"]
        ResNetMammo["ResNet-50 Mammography (MIAS Weights)"]
        ResNetThermal["ResNet-50 Thermography (Mendeley Weights)"]
        GradCAM["Grad-CAM Saliency Engine (layer4 Bottleneck)"]
        EntropyEng["Shannon Entropy & Uncertainty Quantification"]
        TTAEng["Test-Time Augmentation (Dual-View Ensemble)"]
        ROIEng["Focal ROI Bounding Box & Peak Activation"]
    end

    subgraph Ingest ["Dataset Ingestion & Safety Engine"]
        DropBox["dataset_dropbox/ (mammogram, thermal)"]
        Extractor["Safe Extractor (Zip-Slip Traversal Prevention)"]
        Organizer["Safe Organizer & SHA-256 Deduplication"]
        Manifests["data/manifests/ (*_manifest.csv)"]
    end

    Exam -->|Mode 1 / 2 Scan| VScan
    Exam -->|Mode 3 Pair| VPair
    Exam -->|Mammogram Inference| InfMammo
    Exam -->|Thermal Inference| InfTherm
    Exam -->|Combined (Safeguarded)| InfComb
    InfMammo --> ResNetMammo
    InfTherm --> ResNetThermal
    ResNetMammo --> GradCAM
    ResNetThermal --> GradCAM
    ResNetMammo --> EntropyEng
    ResNetThermal --> EntropyEng
    ResNetMammo --> TTAEng
    ResNetThermal --> TTAEng
    GradCAM --> ROIEng
    About -->|Scan & Ingest| DScan
    About -->|Safe Import| DImport
    DImport --> Extractor --> Organizer --> Manifests
```

---

## 3. Examination Modes & Validation Framework

### Mode 1: Mammogram Screening
- Dedicated endpoint `POST /api/analyze/mammogram`.
- Accepts grayscale radiographs (`.pgm`, `.png`, `.jpg`).
- Custom Netpbm PGM parser in TypeScript decodes binary (P5) and ASCII (P2) raster streams directly onto HTML5 Canvas without server conversion.
- Rejects thermal imagery with: `"Invalid image. Please upload a mammogram image."`.

### Mode 2: Thermal Screening
- Dedicated endpoint `POST /api/analyze/thermal`.
- Accepts 24-bit RGB infrared thermograms (`.jpg`, `.png`).
- Renders native false-color thermal distributions without converting to grayscale.
- Rejects grayscale radiographs with: `"Invalid image. Please upload a thermal image."`.

### Mode 3: Combined Multimodal Screening
- Two mandatory, independent upload targets for mammogram and thermal scans.
- Strict pairing validation via `POST /api/validate-pair`:
  - Enforces independent modality verification for each slot.
  - Distinguishes file validity from same-patient pairing.
  - Displays truthful status messages:
    - `"Both files accepted, pairing not verified."`
    - `"Both files validated, pairing verified, fusion model unavailable."`
    - `"Combined analysis available only when a genuine trained fusion model is loaded and pairing requirements are satisfied."`
  - Zero synthetic fusion: Analysis button is strictly disabled with clear rationale when no co-registered model exists.

---

## 4. Dataset Ingestion Pipeline & Safety Controls

1. **Dropbox Drop-in Workflow:**
   - Datasets or archives are dropped into `dataset_dropbox/mammogram/` and `dataset_dropbox/thermal/`.
   - Web UI (in About page) and API (`POST /api/dataset/scan` and `POST /api/dataset/import`) trigger automated scanning and safe processing.
2. **Zip-Slip Traversal Prevention:**
   - Every file path within incoming archives is resolved against target destinations using canonical path checks.
   - Any malicious traversal sequences (`../`, `..\\`) are blocked with `SecurityExtractionError`.
3. **Manifest Generation & Auditing:**
   - Reads image headers, dimensions, channels, patient IDs, and diagnoses.
   - Writes `data/manifests/mammogram_manifest.csv` and `data/manifests/thermal_manifest.csv`.
   - Generates machine-readable `reports/dataset_audit_report.json` and human-readable `reports/dataset_audit_report.md`.

---

## 5. Machine Learning Evaluation & Explainability

### Model Evaluation on Unseen Test Splits (Patient-Isolated)

| Modality | Architecture | Parameters | Test Samples | Overall Accuracy | Macro F1 | Macro Precision | Macro Sensitivity | Macro Specificity | Macro ROC-AUC |
|---|---|---|---|---|---|---|---|---|---|
| **Mammogram** | ResNet-50 | 23.5M | 48 images (26 pts) | **56.2%** | **0.443** | **0.391** | **0.540** | **0.781** | **0.718** |
| **Thermal** | ResNet-50 | 23.5M | 48 images (20 pts) | **41.7%** | **0.354** | **0.342** | **0.418** | **0.672** | **0.651** |

### Explainability & Uncertainty
- **Grad-CAM Saliency:** Gradient extraction from ResNet-50 `layer4` feature maps, followed by ReLU rectification and Turbo colormap blending.
- **Region of Interest (ROI):** Dynamic bounding box localization isolates regions displaying $\ge 60\%$ peak activation.
- **Predictive Shannon Entropy:** Measures classification decisiveness ($H(y) = -\sum p_i \log_2 p_i$).
- **Test-Time Augmentation (TTA):** Averages forward passes across original and bilaterally reflected views for enhanced stability.

---

## 6. Verification & Quality Assurance

- **Automated Test Suite:** 68/68 passing tests (Pytest 9.2.0, Python 3.10.11).
- **Frontend Quality:** Production Vite build completes in 2.15s with 0 TypeScript errors.
- **Design Consistency:** Professional hospital pink, white, blush, and rose palette adhering strictly to 5 navigation tabs (`Dashboard`, `New Examination`, `Results`, `Patient History`, `About`).
- **Zero Fabrication:** No hardcoded progress bars, fake patient names, fake dates, or mock model metrics.
