# Dataset Import & Ingestion Guide

**Platform:** MammoFusion-XAI  
**Target Modalities:** Digital Mammography (MIAS) & Infrared Breast Thermography (Mendeley)  
**Safety & Security:** Zip-Slip Traversal Prevention, Image Header Verification, Non-Fabrication Guarantee  

---

## 1. Overview of the Ingestion Pipeline

MammoFusion-XAI includes an automated, resilient, and non-destructive dataset ingestion pipeline. The pipeline scans designated dropbox directories, safely extracts supported archive formats, identifies dataset origins from filenames and metadata structures, organizes images into standard `data/raw/` directories, and generates verified CSV manifests and comprehensive audit reports.

### Pipeline Directory Structure

```
e:\my projects\breast cancer screening\
├── dataset_dropbox/
│   ├── mammogram/          # Drop MIAS archives or raw .pgm / .pdf files here
│   └── thermal/            # Drop Mendeley archives or participant folders here
├── data/
│   ├── raw/
│   │   ├── mammogram/      # Standardized MIAS PGM images and catalog docs
│   │   └── thermal/        # Standardized Mendeley thermal images (by participant)
│   └── manifests/
│       ├── mammogram_manifest.csv
│       └── thermal_manifest.csv
└── reports/
    ├── dataset_audit_report.json
    └── dataset_audit_report.md
```

---

## 2. Ingesting Supported Datasets

### 2.1 Mammography: MIAS Database (UK)

- **Source:** Mammographic Image Analysis Society (Cambridge, UK)
- **Supported Formats:** 8-bit grayscale Netpbm PGM (`.pgm`), accompanied by `.pdf`, `.txt`, `.csv` catalogs.
- **Organization Rule:**
  - Filenames follow the pattern `mdb001.pgm` through `mdb322.pgm`.
  - Bilateral pairing maps `mdb001`/`mdb002` to `MIAS_P001`, up to `mdb321`/`mdb322` to `MIAS_P161`.
- **How to Ingest:**
  1. Place `all-mias.tar.gz`, `all-mias.zip`, or loose `.pgm` files into `dataset_dropbox/mammogram/`.
  2. Run the ingestion pipeline (via CLI or UI).
  3. The pipeline verifies that all 322 images are readable, extracts labels (Normal, Benign, Malignant), tissue background (Fatty, Fatty-Glandular, Dense-Glandular), and coordinates.

### 2.2 Thermography: Mendeley Breast Thermography (Mexico)

- **Source:** Mendeley Data (CC BY-NC 3.0, Mexico)
- **Supported Formats:** Standard 24-bit RGB JPEG (`.jpg`, `.jpeg`, `.png`), accompanied by diagnostic `.xlsx` or `.csv` sheets.
- **Organization Rule:**
  - Organized by participant folder (e.g. `IIR0110/`, `IIR0111/`).
  - Contains three clinical views per session: Anterior (`*front*.jpg`), Left Oblique (`*left*.jpg`), Right Oblique (`*right*.jpg`).
- **How to Ingest:**
  1. Place the downloaded `.zip` or uncompressed participant folders into `dataset_dropbox/thermal/`.
  2. Run the ingestion pipeline.
  3. The pipeline preserves participant hierarchy, reads color modes (RGB), validates dimensions, and parses diagnostic ground truth.

---

## 3. Running the Ingestion Pipeline

### Option A: Via Python Command Line Interface

The master ingestion CLI provides scan-only and dry-run flags:

```bash
# 1. Pre-ingestion scan only (reports file counts and disk space without moving files)
py -3.10 -m src.ingestion.pipeline --scan-only

# 2. Dry run simulation (validates archives and copies in memory without disk writes)
py -3.10 -m src.ingestion.pipeline --dry-run

# 3. Full execution (extracts, copies to data/raw, and regenerates manifests)
py -3.10 -m src.ingestion.pipeline
```

### Option B: Via HTTP REST API

The FastAPI server provides automated ingestion endpoints:

```bash
# Check status and available files in dropbox
curl -X POST http://127.0.0.1:8000/api/dataset/scan

# Execute full ingestion
curl -X POST http://127.0.0.1:8000/api/dataset/import \
     -H "Content-Type: application/json" \
     -d '{"dry_run": false}'
```

### Option C: Via Web User Interface

1. Navigate to the **About** tab in the top navigation bar.
2. Scroll to the **Dataset Ingestion Pipeline** card.
3. Click **Scan Dropbox** to review detected files, sizes, and available disk headroom.
4. Click **Run Safe Ingestion** to trigger server-side extraction and manifest generation.

---

## 4. Security & Safety Controls

1. **Zip-Slip & Path Traversal Protection (`src/ingestion/extractor.py`):**
   - Every file path within incoming archives is resolved against the target destination.
   - Any archive entry containing relative traversal sequences (`../`, `..\\`) or absolute root escapes is blocked and raises a `SecurityExtractionError`.
2. **Idempotence & Non-Destruction:**
   - Existing files in `data/raw/` are inspected via size and SHA-256 fingerprinting. Identical files are safely skipped without redundant I/O.
   - Incoming datasets never overwrite model weights or existing training artifacts.
3. **Strict Cohort Isolation:**
   - The pipeline independently builds `mammogram_manifest.csv` and `thermal_manifest.csv`.
   - Datasets from different geographic cohorts are flagged as having separate patient pools; cross-dataset pairing is strictly barred.

---

## 5. Verification & Manifest Outputs

Upon successful completion, the pipeline outputs:
- `data/manifests/mammogram_manifest.csv`: Image paths, patient IDs, modality, dimensions, labels, tissue density.
- `data/manifests/thermal_manifest.csv`: Image paths, participant IDs, projection angles, RGB channels, diagnostic category.
- `reports/dataset_audit_report.json`: Machine-readable breakdown of readable vs corrupt files, patient counts, and class balance.
- `reports/dataset_audit_report.md`: Human-readable summary for clinical audit and grant compliance.
