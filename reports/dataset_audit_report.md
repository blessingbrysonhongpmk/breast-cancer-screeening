# MammoFusion-XAI Dataset Audit & Ingestion Report

**Generated for:** Milestone 1 — Safe Dataset Ingestion & Validation  
**Total Images Ingested:** 679  
**Total Storage Footprint:** 3317.01 MB (3.239 GB)  

---

## 1. Mammography Modality (MIAS)

- **Total Ingested Images:** 322
- **Readable Images:** 322
- **Corrupt / Unreadable Images:** 0
- **Unique Patients Identified:** 161 (derived from paired odd/even film IDs per Suckling et al., 1994)
- **Class Distribution:**
  - `benign`: 61
  - `normal`: 205
  - `malignant`: 51
  - `unannotated`: 5
- **Missing / Unannotated Labels:** 5
- **Image Resolutions:** {'4320x2048': 101, '4320x2600': 149, '4320x1600': 48, '5200x4000': 24}
- **Storage Occupied:** 3240.71 MB (3.165 GB)
- **Potential Duplicates:** 0

---

## 2. Breast Thermography Modality (Mendeley Data)

- **Total Ingested Images:** 357
- **Readable Images:** 357
- **Corrupt / Unreadable Images:** 0
- **Unique Patients Identified:** 119 (participant codes IIR####)
- **Class Distribution:**
  - `benign`: 158
  - `normal`: 110
  - `malignant`: 68
  - `unannotated`: 21
- **Missing / Unannotated Labels:** 21
- **Image Resolutions:** {'320x240': 357}
- **Storage Occupied:** 76.3 MB (0.075 GB)
- **Potential Duplicates:** 0
- **License Compliance:** CC BY-NC 3.0 Non-Commercial Research Use Only.

---

## 3. Scientific Integrity & Data Governance Rules

1. **Cohort Separation:** MIAS and Mendeley Thermography cohorts are completely distinct. No cross-patient synthetic pairing or fusion may be performed.
2. **Patient-Level Leakage Prevention:** All train/val/test splits must partition by `patient_id` rather than individual image views.
3. **Clinical Disclaimer:** This system is an academic research prototype and does NOT replace medical diagnosis or clinical judgment.
