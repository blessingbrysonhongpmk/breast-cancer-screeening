# MammoFusion-XAI Risk

> **Multimodal Explainable AI-Based Breast Cancer Screening and Risk Prediction Research Platform**  
> *Academic / Educational Research Prototype — Strictly Not for Medical Diagnosis*

---

## 1. Project Overview

**MammoFusion-XAI Risk** is an academic research platform investigating explainable deep learning (XAI) for breast cancer screening across two distinct medical imaging modalities:
1. **Full-Field Digital Mammography** — MIAS (Mammographic Image Analysis Society, Cambridge, UK; 322 digitized 8-bit PGM raster images).
2. **Infrared Breast Thermography** — Mendeley Thermography Cohort (119 participants, 357 images across Anterior, Left Oblique, and Right Oblique views).

### Crucial Scientific & Multimodal Integrity Guidelines
- **Strict Zero-Fabrication Protocol:** The platform never synthesizes predictions, confidence scores, or decorative Grad-CAM heatmaps.
- **Independent Unimodal Architecture:** Unpaired synthetic multimodal fusion across independent patient cohorts is prohibited. Mammogram and thermal models operate as independent unimodal ResNet-50 classifiers.
- **Patient-Level Stratification:** Patient images are strictly partitioned by patient ID (70% train, 15% validation, 15% test). Images from the same participant never cross split boundaries.
- **Genuine Mathematical Explainability:** Grad-CAM heatmaps are computed directly from PyTorch backpropagated gradients through the final convolutional bottleneck (`layer4`) of the loaded ResNet-50 models.
- **Mandatory Medical Disclaimer:** This software is a research prototype, not a medical device. It must not be used for clinical decision-making or diagnosis.

---

## 2. Technology Stack

- **Backend:** Python 3.10+, FastAPI, Uvicorn, PyTorch, Torchvision, NumPy, Pillow, Pydantic v2.
- **Frontend:** React 19, TypeScript, Vite, Lucide React icons, Vanilla CSS Design System (Ivory / Blush / Deep Plum palette).
- **Explainability:** Grad-CAM (Gradient-weighted Class Activation Mapping) on PyTorch ResNet-50 `layer4`.
- **Testing:** Pytest (42 automated unit and integration tests passing).

---

## 3. Directory Structure

```text
breast cancer screening/
├── .env.example                     # Environment configuration template
├── app/
│   ├── server.py                   # FastAPI backend application & API routes
│   └── static/                     # Compiled React SPA static assets
├── data/
│   ├── raw/                        # Ingested, validated raw images (mammogram, thermal)
│   ├── manifests/                  # CSV manifests with labels & patient metadata
│   ├── cache_thumbnails/           # Resized image thumbnails for browser display
│   └── cache_heatmaps/             # Generated Grad-CAM saliency heatmaps
├── frontend/                       # React 19 + TypeScript + Vite frontend
│   ├── src/
│   │   ├── features/
│   │   │   ├── home/               # Modality selection & system readiness overview
│   │   │   ├── analysis/           # Image upload, format validation, preview & submit
│   │   │   ├── results/            # Prediction probabilities & Grad-CAM explainability
│   │   │   ├── history/            # Session history with clear functionality
│   │   │   └── about/              # Scientific integrity, provenance & disclaimers
│   │   ├── services/api.ts         # Typed API client
│   │   ├── App.tsx                 # Main application layout & navigation
│   │   └── main.tsx                # SPA entry point
│   ├── package.json
│   └── vite.config.ts
├── models/                         # PyTorch model weights
│   ├── mammogram_resnet50.pt       # ResNet-50 weights (3-class: normal, benign, malignant)
│   └── thermal_resnet50.pt         # ResNet-50 weights (3-class: normal, benign, malignant)
├── reports/                        # Audit reports and recent analysis sessions
│   ├── dataset_audit_report.json
│   └── recent_analyses.json
├── src/                            # Core Python ML & data pipeline
│   ├── ingestion/                  # Safe archive scanner & manifest builder
│   ├── preprocessing/              # Evaluation transforms & dataset loaders
│   ├── mammogram/                  # ResNet-50 mammogram classifier
│   ├── thermal/                    # ResNet-50 thermal classifier
│   └── explainability/             # PyTorch Grad-CAM hook implementation
├── tests/                          # Automated test suite (42 tests)
│   ├── test_api_reliability.py    # API validation, security, and inference tests
│   ├── test_deeplearning.py        # PyTorch model architecture & Grad-CAM tests
│   ├── test_archive_safety.py      # Zip Slip security & path validation tests
│   ├── test_manifest_and_idempotence.py
│   ├── test_metadata_parser.py
│   ├── test_scanner_and_identifier.py
│   └── test_transforms.py
├── requirements.txt                # Python backend dependencies
└── README.md
```

---

## 4. Setup & Installation

### A. Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm**

### B. Environment Configuration
Copy `.env.example` to `.env` in the root directory:
```powershell
cp .env.example .env
```
Default configuration values:
```env
APP_HOST=127.0.0.1
APP_PORT=8000
ENV=development
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000
MAX_UPLOAD_SIZE_MB=25
MIN_IMAGE_DIMENSION=32
MODELS_DIR=models
```

### C. Backend Dependencies
```powershell
py -3.10 -m pip install -r requirements.txt
```

### D. Frontend Dependencies
```powershell
cd frontend
npm install
cd ..
```

---

## 5. Running the Application

### Option 1: Unified Production Mode (FastAPI serves compiled SPA)
1. Build the React frontend:
   ```powershell
   cd frontend
   npm run build
   cd ..
   ```
2. Start the FastAPI server:
   ```powershell
   py -3.10 -m uvicorn app.server:app --host 127.0.0.1 --port 8000
   ```
3. Open your browser at: **`http://127.0.0.1:8000`**

### Option 2: Development Mode (Vite Hot-Reload + FastAPI)
1. Start FastAPI backend (terminal 1):
   ```powershell
   py -3.10 -m uvicorn app.server:app --host 127.0.0.1 --port 8000 --reload
   ```
2. Start Vite dev server (terminal 2):
   ```powershell
   cd frontend
   npm run dev
   ```
3. Open your browser at: **`http://127.0.0.1:5173`**

---

## 6. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status and version. |
| `GET` | `/api/models/readiness` | Per-modality model readiness (`mammogram` and `thermal` loaded status). |
| `GET` | `/api/status` | System milestones, disk headroom, and scientific policy. |
| `GET` | `/api/datasets` | Verified dataset audit statistics across modalities. |
| `GET` | `/api/samples` | Curated reference sample list for one-click testing. |
| `GET` | `/api/sample-image/{modality}/{filename}` | Stream browser-compatible JPEG thumbnail. |
| `POST` | `/api/analyze` | Upload image for validation, ResNet-50 inference, and Grad-CAM generation. |
| `GET` | `/api/gradcam-image/{filename}` | Retrieve generated Grad-CAM saliency map. |
| `GET` | `/api/recent-analyses` | Retrieve current session's analysis records. |
| `DELETE` | `/api/recent-analyses` | Clear session analysis history from disk and memory. |
| `GET` | `/api/manifests/export/{modality}` | Download verified CSV manifest. |

### Analysis Request Contract (`POST /api/analyze`)
- **Multipart Form Data:**
  - `file`: Image file (`.png`, `.jpg`, `.jpeg`, `.pgm`), max 25 MB, dimensions >= 32×32 px.
  - `modality`: `"mammogram"` or `"thermal"`.
- **Response Schema (`200 OK`):**
  ```json
  {
    "status": "classified",
    "modality": "mammogram",
    "filename": "mdb001lm.pgm",
    "dimensions": { "width": 1024, "height": 1024 },
    "color_mode": "L",
    "format": "PPM",
    "inference_ready": true,
    "predicted_class": "benign",
    "confidence": 0.8842,
    "probabilities": {
      "normal": 0.0812,
      "benign": 0.8842,
      "malignant": 0.0346
    },
    "gradcam_url": "/api/gradcam-image/cam_abcdef123456.jpg",
    "model_architecture": "ResNet-50 Deep ConvNet",
    "message": "ResNet-50 inference complete...",
    "recommendation": "Review Grad-CAM focal hyperthermia / lesion boundary against radiological screening standard."
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Invalid modality, unsupported file extension, corrupted image bytes.
  - `413 Request Entity Too Large`: Upload exceeds `MAX_UPLOAD_SIZE_MB` (25 MB).
  - `422 Unprocessable Content`: Image dimensions smaller than 32×32 pixels.
  - `404 Not Found`: Sample or heatmap not found.

---

## 7. Model Checkpoints & Architectures

The platform uses PyTorch ResNet-50 classifiers with customized heads:
- **Mammogram Classifier (`src/mammogram/model.py`):** Single-channel grayscale input (`1×224×224`), modified first convolution layer (`conv1`), layer4 feature extractor, adaptive pooling, and 3-class linear classifier (`normal`, `benign`, `malignant`).
- **Thermal Classifier (`src/thermal/model.py`):** 3-channel RGB input (`3×224×224`), ImageNet-standard backbone, layer4 feature extractor, adaptive pooling, and 3-class linear classifier (`normal`, `benign`, `malignant`).
- **Target Grad-CAM Layer:** `model.resnet.layer4` (the deepest convolutional bottleneck).

---

## 8. Running Automated Tests

Run the full automated test suite (42 tests):
```powershell
py -3.10 -m pytest tests/
```

### Test Coverage Highlights:
- **`tests/test_api_reliability.py` (15 tests):** Health check, per-modality model readiness, invalid modalities, unsupported extensions, corrupted image bytes, small image dimensions, 25 MB payload limit, path traversal sanitization, session history clear, real ResNet-50 inference, and Grad-CAM image generation.
- **`tests/test_deeplearning.py` (6 tests):** PyTorch forward passes, checkpoint loading, softmax probability calibration, and Grad-CAM gradient verification.
- **`tests/test_archive_safety.py` (4 tests):** Zip Slip prevention, path safety, and archive extraction validation.
- **`tests/test_transforms.py` (9 tests):** Mammogram CLAHE, thermal normalization, and tensor shapes.
- **`tests/test_manifest_and_idempotence.py` (3 tests):** Manifest schema integrity and re-ingestion idempotence.
- **`tests/test_scanner_and_identifier.py` (4 tests):** Modality classification and metadata detection.
- **`tests/test_metadata_parser.py` (1 test):** MIAS and Mendeley ground truth parsing.

---

## 9. Known Limitations & Research Boundaries

1. **Unpaired Cohorts:** MIAS mammograms and Mendeley thermograms represent different patients. Any claim of paired patient-level multimodal fusion on these datasets would be scientifically invalid.
2. **Class Imbalance:** Ingested datasets exhibit natural medical class imbalances; evaluation metrics must report macro-averaged F1 and per-class recall alongside overall accuracy.
3. **Medical Disclaimer:** This application is strictly an educational and academic research tool. It does not provide clinical diagnoses, medical advice, or treatment guidance. Always consult a qualified medical professional for health concerns.
