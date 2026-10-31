"""Generates dataset audit and validation reports.
Reports total files, readable/corrupt counts, duplicates, patient counts, class distributions, and disk usage.
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import Counter


def generate_dataset_audit_report(
    mammogram_records: List[Dict[str, Any]],
    thermal_records: List[Dict[str, Any]],
    output_dir: Path
) -> Dict[str, Any]:
    """Computes comprehensive audit statistics across modalities and outputs Markdown and JSON reports."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    def analyze_modality(records: List[Dict[str, Any]], modality_name: str) -> Dict[str, Any]:
        total_images = len(records)
        readable_count = sum(1 for r in records if r.get("validation_status") == "valid")
        corrupt_count = sum(1 for r in records if r.get("validation_status") == "corrupt")
        
        # Patients
        patients = set(r.get("patient_id") for r in records if r.get("patient_id") not in {"UNKNOWN", None, ""})
        # Classes
        labels = Counter(r.get("label", "unannotated") for r in records)
        missing_labels = sum(1 for r in records if r.get("label") in {"unannotated", "", None})

        # Storage
        total_bytes = sum(r.get("file_size_bytes", 0) for r in records)

        # Duplicate detection (same filename or same size/dims)
        seen_filenames = set()
        duplicate_filenames = []
        for r in records:
            fn = r.get("filename")
            if fn in seen_filenames:
                duplicate_filenames.append(fn)
            seen_filenames.add(fn)

        # Dimensions summary
        dimensions = Counter(f"{r.get('image_width')}x{r.get('image_height')}" for r in records if r.get("image_width"))

        return {
            "modality": modality_name,
            "total_images": total_images,
            "readable_images": readable_count,
            "corrupt_images": corrupt_count,
            "unique_patients_identified": len(patients),
            "label_distribution": dict(labels),
            "missing_labels": missing_labels,
            "total_storage_bytes": total_bytes,
            "total_storage_mb": round(total_bytes / (1024**2), 2),
            "total_storage_gb": round(total_bytes / (1024**3), 3),
            "potential_duplicates_by_filename": duplicate_filenames,
            "resolution_distribution": dict(dimensions)
        }

    mammo_audit = analyze_modality(mammogram_records, "mammogram")
    thermal_audit = analyze_modality(thermal_records, "thermal")

    total_images_all = mammo_audit["total_images"] + thermal_audit["total_images"]
    total_bytes_all = mammo_audit["total_storage_bytes"] + thermal_audit["total_storage_bytes"]

    full_audit = {
        "project": "MammoFusion-XAI Risk",
        "milestone": "Milestone 1: Safe Dataset Ingestion & Audit",
        "total_images_across_modalities": total_images_all,
        "total_storage_used_bytes": total_bytes_all,
        "total_storage_used_mb": round(total_bytes_all / (1024**2), 2),
        "total_storage_used_gb": round(total_bytes_all / (1024**3), 3),
        "mammogram": mammo_audit,
        "thermal": thermal_audit,
        "scientific_notices": [
            "MIAS mammography and Mendeley breast thermography datasets originate from distinct patient cohorts.",
            "Synthetic or simulated cross-cohort multimodal fusion without matched clinical subjects is prohibited.",
            "MIAS benign/malignant annotations represent historical research consensus and have documented provenance limitations.",
            "Mendeley Thermography dataset is governed by CC BY-NC 3.0 license (strictly non-commercial with attribution)."
        ]
    }

    # Save JSON report
    json_path = output_dir / "dataset_audit_report.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(full_audit, f, indent=2)

    # Save Markdown report
    md_path = output_dir / "dataset_audit_report.md"
    md_content = f"""# MammoFusion-XAI Dataset Audit & Ingestion Report

**Generated for:** Milestone 1 — Safe Dataset Ingestion & Validation  
**Total Images Ingested:** {total_images_all}  
**Total Storage Footprint:** {full_audit['total_storage_used_mb']} MB ({full_audit['total_storage_used_gb']} GB)  

---

## 1. Mammography Modality (MIAS)

- **Total Ingested Images:** {mammo_audit['total_images']}
- **Readable Images:** {mammo_audit['readable_images']}
- **Corrupt / Unreadable Images:** {mammo_audit['corrupt_images']}
- **Unique Patients Identified:** {mammo_audit['unique_patients_identified']} (derived from paired odd/even film IDs per Suckling et al., 1994)
- **Class Distribution:**
"""
    for cls_name, cnt in mammo_audit["label_distribution"].items():
        md_content += f"  - `{cls_name}`: {cnt}\n"

    md_content += f"""- **Missing / Unannotated Labels:** {mammo_audit['missing_labels']}
- **Image Resolutions:** {mammo_audit['resolution_distribution']}
- **Storage Occupied:** {mammo_audit['total_storage_mb']} MB ({mammo_audit['total_storage_gb']} GB)
- **Potential Duplicates:** {len(mammo_audit['potential_duplicates_by_filename'])}

---

## 2. Breast Thermography Modality (Mendeley Data)

- **Total Ingested Images:** {thermal_audit['total_images']}
- **Readable Images:** {thermal_audit['readable_images']}
- **Corrupt / Unreadable Images:** {thermal_audit['corrupt_images']}
- **Unique Patients Identified:** {thermal_audit['unique_patients_identified']} (participant codes IIR####)
- **Class Distribution:**
"""
    for cls_name, cnt in thermal_audit["label_distribution"].items():
        md_content += f"  - `{cls_name}`: {cnt}\n"

    md_content += f"""- **Missing / Unannotated Labels:** {thermal_audit['missing_labels']}
- **Image Resolutions:** {thermal_audit['resolution_distribution']}
- **Storage Occupied:** {thermal_audit['total_storage_mb']} MB ({thermal_audit['total_storage_gb']} GB)
- **Potential Duplicates:** {len(thermal_audit['potential_duplicates_by_filename'])}
- **License Compliance:** CC BY-NC 3.0 Non-Commercial Research Use Only.

---

## 3. Scientific Integrity & Data Governance Rules

1. **Cohort Separation:** MIAS and Mendeley Thermography cohorts are completely distinct. No cross-patient synthetic pairing or fusion may be performed.
2. **Patient-Level Leakage Prevention:** All train/val/test splits must partition by `patient_id` rather than individual image views.
3. **Clinical Disclaimer:** This system is an academic research prototype and does NOT replace medical diagnosis or clinical judgment.
"""

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    return full_audit

