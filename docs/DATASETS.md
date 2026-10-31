# Dataset Sources, Licenses, and Limitations

**Project:** MammoFusion-XAI Risk  
**Research Title:** Multimodal Explainable AI-Based Breast Cancer Screening and Risk Prediction System  
**Document Status:** Milestone 1 Verified Specification  

---

## 1. Mammography Dataset: MIAS (Mammographic Image Analysis Society)

- **Official Repository:** University of Cambridge  
  https://www.repository.cam.ac.uk/items/b6a97f0c-3b9b-40ad-8f18-3d121eef1459
- **Citation Reference:**  
  > J. Suckling, et al. (1994). "The Mammographic Image Analysis Society Digital Mammogram Database." *Excerpta Medica, International Congress Series*, vol. 1069, pp. 375–378.
- **Specification:**
  - **Total Images:** 322 images (161 pairs of left/right views).
  - **Format:** PGM (P5 grayscale raster, uncompressed).
  - **Resolution:** 1024 × 1024 pixels (or original digitized resolutions ~200μm).
  - **Annotations Provided:** Background tissue character (`F` = Fatty, `G` = Fatty-glandular, `D` = Dense-glandular), abnormality class (`CALC`, `CIRC`, `SPIC`, `MISC`, `ARCH`, `ASYM`, `NORM`), severity (`B` = Benign, `M` = Malignant), lesion center coordinates (x, y), and approximate radius.
- **Critical Limitations & Scientific Context:**
  - As highlighted in comprehensive reviews (e.g., *Nature Scientific Data*, 2023: https://www.nature.com/articles/s41597-023-02430-6), the clinical provenance and definitive histological/pathological confirmation for some MIAS benign/malignant labels are historically incomplete or uncertain.
  - **Project Rule:** MIAS ground truth labels must be treated as research benchmark annotations, not guaranteed definitive ground-truth clinical biopsy outcomes. All publications and reports from this project must explicitly declare this limitation.

---

## 2. Breast Thermal Dataset: Mendeley Data (Thermography)

- **Dataset Record:** Mendeley Data  
  https://data.mendeley.com/datasets/mhrt4svjxc/1
- **Associated Publication:**  
  *Research description / protocol*: https://pmc.ncbi.nlm.nih.gov/articles/PMC11131078/
- **License:** **Creative Commons Attribution-NonCommercial 3.0 Unported (CC BY-NC 3.0)**
  - *Non-Commercial Restriction:* This dataset must strictly NOT be used for commercial product development or commercial deployment.
  - *Attribution:* Dataset creators must be cited in all documentation and derivative models.
- **Cohort Specifications:**
  - **Participants:** 119 women.
  - **Views:** 3 views per participant (Frontal, Lateral Left, Lateral Right), totaling 357 images.
  - **Format:** JPEG RGB thermal false-color images.
  - **Clinical Metadata (`Diagnostics.xlsx`):** Patient ID (`Image` code), Left diagnosis, Right diagnosis (`N` = Normal, `PB` = Benign Pathology, `PM` = Malignant Pathology), Weight (kg), Height (cm), Core Body Temperature (°C), Age (years).
  - **Cohort Composition:** The diagnostic subset contains 84 benign cases and 35 malignant cases. Completely healthy screening cases without pathology are not present in this diagnostic subset.

---

## 3. High-Capacity Dataset: CBIS-DDSM (Deferred)

- **Repository:** The Cancer Imaging Archive (TCIA)  
  https://www.cancerimagingarchive.net/collection/cbis-ddsm/
- **Storage Profile:** ~163.5 GB for the complete collection.
- **Decision:** Because the local machine has less than 20 GB free disk space, downloading the full CBIS-DDSM archive would immediately saturate the disk. Local ingestion is restricted to MIAS and Mendeley thermography. CBIS-DDSM will only be evaluated via cloud environments (e.g., Google Colab with Google Drive) or tightly scoped small subsets.

---

## 4. Fundamental Scientific Protocol: Non-Matched Multimodal Integrity

1. **Independent Cohort Boundary:**  
   The MIAS mammogram collection and the Mendeley breast thermography collection are completely independent, acquired at different institutions, on different subjects, in different decades.
2. **Strict Prohibition on Synthetic Paired Fusion:**  
   Under no circumstances will images from MIAS and the thermography dataset be concatenated, paired randomly, or merged to train a "multimodal" network claiming patient-level multimodal risk prediction. Doing so produces pseudoscientific artifacts and data leakage.
3. **Modality-Specific Modeling:**  
   MammoFusion-XAI begins by building, validating, and explaining distinct, standalone unimodal pipelines:
   - Mammography CAD / feature extractor (MIAS)
   - Thermography CAD / feature extractor (Mendeley)
   A joint fusion network will strictly be reserved for true co-registered, matched patient pairs with verified consent and compatible labels.
4. **Research Disclaimer:**  
   This software is an educational, scientific exploration and research prototype. It does not provide medical diagnoses and must not be used as clinical decision support.

