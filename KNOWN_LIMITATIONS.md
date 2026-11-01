# Known Limitations & Scientific Disclaimers

**Platform:** MammoFusion-XAI  
**Research Scope:** Biomedical Machine Learning & Computer Vision Research  

---

## 1. Scientific & Dataset Cohort Boundaries

### 1.1 Independence of Datasets (Zero Genuine Multimodal Co-Registration)
- **The MIAS Dataset:** Consists of 322 digitized 8-bit PGM film-screen mammograms acquired from 161 female patients in Cambridge, UK.
- **The Mendeley Dataset:** Consists of 357 infrared breast thermograms acquired using a dedicated thermal camera across 119 participants in Mexico.
- **Scientific Implication:** These two cohorts do NOT share a single common patient or participant.
- **Platform Safeguard:** The platform strictly enforces cohort boundary separation. Synthetic cross-cohort pairing (e.g. matching an MIAS mammogram with a Mendeley thermogram to simulate a single patient) is prohibited. Combined multimodal inference remains disabled unless a genuine co-registered clinical dataset is supplied.

---

## 2. Model & Algorithmic Boundaries

### 2.1 Unimodal Baseline Performance
- Current models are unimodal PyTorch ResNet-50 networks trained on limited sample sizes (MIAS has 221 training images; Mendeley has 237 training images).
- While achieving solid diagnostic separation on held-out test splits, class imbalance between `normal`, `benign`, and `malignant` cases limits minority class precision.
- Test-Time Augmentation (TTA) and Shannon entropy quantification provide valuable uncertainty estimates, but cannot substitute for training on larger clinical repositories (e.g., CBIS-DDSM or INbreast).

### 2.2 Explainability Resolution (Grad-CAM)
- Grad-CAM heatmaps are derived from `layer4` of ResNet-50, which has an 8-bit spatial resolution of $7 \times 7$ feature maps before global average pooling.
- Consequently, while Grad-CAM successfully localizes anatomical quadrants containing lesions or hyperthermic asymmetries, it does not provide pixel-level boundary segmentation of microcalcifications.

---

## 3. Computational & Deployment Constraints

### 3.1 Hardware Recommendations
- The system is optimized to run inference smoothly on standard 64-bit multi-core CPUs with 8 GB of RAM.
- GPU acceleration via CUDA is automatically detected if available, but is not required for real-time inference or Grad-CAM generation.
- Full model retraining on the complete dataset requires approximately 15-20 minutes on CPU or 2-3 minutes on an NVIDIA GPU.

### 3.2 Supported Image Formats
- **Mammography:** Netpbm PGM (P5 binary or P2 ASCII), PNG, JPG/JPEG.
- **Thermography:** 24-bit color JPEG, PNG. DICOM format is not currently supported natively and must be pre-converted to PNG/PGM.

---

## 4. Regulatory & Clinical Disclaimer

> [!CAUTION]
> **NOT AN FDA-CLEARED OR CE-MARKED MEDICAL DEVICE**  
> MammoFusion-XAI is an academic research and engineering demonstration platform. It has not been approved for clinical diagnostic use, screening triage, or patient treatment planning by the US Food and Drug Administration (FDA), European Medicines Agency (EMA), or any regulatory authority. All predictions, confidence scores, and visual attention maps are intended solely for academic research, education, and algorithm evaluation. Certified radiological review is mandatory for all patient care decisions.

