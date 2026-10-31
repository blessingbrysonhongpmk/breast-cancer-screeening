"""Builds standardized manifest CSV records for ingested mammogram and thermal datasets.
Extracts image dimensions, format, patient identifiers, and pathology ground truth.
"""

import os
import csv
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from PIL import Image

from src.ingestion.metadata_parser import parse_mias_readme_pdf, parse_thermal_diagnostics_xlsx


def inspect_image_file(image_path: Path) -> Dict[str, Any]:
    """Inspects an image to extract dimensions, color mode, format, and verifies readability."""
    image_path = Path(image_path)
    res = {
        "is_readable": False,
        "width": None,
        "height": None,
        "mode": None,
        "format": None,
        "error": None
    }
    if not image_path.exists():
        res["error"] = "File not found"
        return res

    try:
        with Image.open(image_path) as img:
            res["width"], res["height"] = img.size
            res["mode"] = img.mode
            res["format"] = img.format
            res["is_readable"] = True
    except Exception as ex:
        res["error"] = str(ex)
        # Fallback for Netpbm PGM if PIL fails
        if image_path.suffix.lower() == ".pgm":
            try:
                with open(image_path, "rb") as f:
                    header = f.readline().decode("latin1", errors="ignore").strip()
                    if header == "P5":
                        # Read comments
                        line = f.readline().decode("latin1", errors="ignore").strip()
                        while line.startswith("#"):
                            line = f.readline().decode("latin1", errors="ignore").strip()
                        dims = line.split()
                        if len(dims) == 2:
                            res["width"] = int(dims[0])
                            res["height"] = int(dims[1])
                            res["mode"] = "L"
                            res["format"] = "PGM"
                            res["is_readable"] = True
                            res["error"] = None
            except Exception:
                pass

    return res


def build_mammogram_manifest(
    mammogram_raw_dir: Path,
    metadata_source_dir: Optional[Path] = None,
    output_csv_path: Optional[Path] = None
) -> List[Dict[str, Any]]:
    """Generates manifest records for MIAS mammogram images."""
    mammogram_raw_dir = Path(mammogram_raw_dir)
    records = []

    # Parse metadata if available
    ground_truth_map: Dict[str, Dict[str, Any]] = {}
    search_dirs = [mammogram_raw_dir]
    if metadata_source_dir and Path(metadata_source_dir).exists():
        search_dirs.append(Path(metadata_source_dir))

    for s_dir in search_dirs:
        for p in s_dir.glob("**/*00README*.pdf"):
            parsed = parse_mias_readme_pdf(p)
            for item in parsed:
                # Key by canonical serial e.g. mdb001
                ground_truth_map[f"mdb{item['serial_number']:03d}"] = item

    # Scan raw images
    pgm_files = sorted(list(mammogram_raw_dir.glob("**/*.pgm")))

    for pgm_path in pgm_files:
        filename = pgm_path.name
        serial_match = re.match(r"^mdb(\d{3})", filename, re.IGNORECASE)
        image_serial = f"mdb{int(serial_match.group(1)):03d}" if serial_match else ""
        
        serial_num = int(serial_match.group(1)) if serial_match else None
        patient_id = f"MIAS_P{(serial_num + 1) // 2:03d}" if serial_num else "UNKNOWN"
        laterality = "left" if (serial_num and serial_num % 2 == 1) else "right"

        img_info = inspect_image_file(pgm_path)
        gt = ground_truth_map.get(image_serial, {})

        label = gt.get("label", "normal") if image_serial in ground_truth_map else "unannotated"
        severity = gt.get("severity", "NORM")
        abn_class = gt.get("abnormality_class", "NORM")
        tissue = gt.get("background_tissue", "")

        rel_path = str(pgm_path.relative_to(mammogram_raw_dir)).replace("\\", "/")

        record = {
            "relative_path": rel_path,
            "modality": "mammogram",
            "dataset": "MIAS",
            "filename": filename,
            "patient_id": patient_id,
            "laterality": laterality,
            "image_width": img_info["width"],
            "image_height": img_info["height"],
            "file_type": pgm_path.suffix.lower(),
            "file_size_bytes": pgm_path.stat().st_size,
            "label": label,
            "severity": severity,
            "abnormality_class": abn_class,
            "background_tissue": tissue,
            "label_source": "MIAS_00README.pdf" if image_serial in ground_truth_map else "None",
            "validation_status": "valid" if img_info["is_readable"] else "corrupt",
            "validation_error": img_info["error"] or ""
        }
        records.append(record)

    if output_csv_path and records:
        output_csv_path = Path(output_csv_path)
        output_csv_path.parent.mkdir(parents=True, exist_ok=True)
        keys = list(records[0].keys())
        with open(output_csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(records)

    return records


def build_thermal_manifest(
    thermal_raw_dir: Path,
    metadata_source_dir: Optional[Path] = None,
    output_csv_path: Optional[Path] = None
) -> List[Dict[str, Any]]:
    """Generates manifest records for Mendeley Breast Thermography images."""
    thermal_raw_dir = Path(thermal_raw_dir)
    records = []

    # Parse Diagnostics.xlsx
    diagnostics_map: Dict[str, Dict[str, Any]] = {}
    search_dirs = [thermal_raw_dir]
    if metadata_source_dir and Path(metadata_source_dir).exists():
        search_dirs.append(Path(metadata_source_dir))

    for s_dir in search_dirs:
        for p in s_dir.glob("**/Diagnostics.xlsx"):
            diag_records = parse_thermal_diagnostics_xlsx(p)
            for d in diag_records:
                diagnostics_map[d["patient_id"].upper()] = d

    # Scan thermal images
    image_files = []
    for ext in ("*.jpg", "*.jpeg", "*.png"):
        image_files.extend(thermal_raw_dir.glob(f"**/{ext}"))
    image_files = sorted(image_files)

    for img_path in image_files:
        filename = img_path.name
        # Detect patient code from folder path or filename (e.g. IIR0110)
        patient_code = None
        for part in img_path.parts:
            m = re.match(r"^(IIR\d{4})", part, re.IGNORECASE)
            if m:
                patient_code = m.group(1).upper()
                break

        if not patient_code:
            m = re.match(r"^(IIR\d{4})", filename, re.IGNORECASE)
            if m:
                patient_code = m.group(1).upper()

        patient_id = patient_code or "UNKNOWN"
        diag = diagnostics_map.get(patient_id, {})

        # Determine image view (Frontal, Lateral Left, Lateral Right)
        view = "unspecified"
        fn_lower = filename.lower()
        if "anterior" in fn_lower or "_f" in fn_lower or "frontal" in fn_lower:
            view = "frontal"
        elif "oblizq" in fn_lower or "_l" in fn_lower or "left" in fn_lower:
            view = "lateral_left"
        elif "oblder" in fn_lower or "_r" in fn_lower or "right" in fn_lower:
            view = "lateral_right"

        # Determine specific view label if available
        label = diag.get("patient_label", "unannotated")
        if view == "lateral_left" and diag.get("left_diagnosis"):
            ld = diag["left_diagnosis"]
            label = "malignant" if ld == "PM" else ("benign" if ld == "PB" else ("normal" if ld == "N" else label))
        elif view == "lateral_right" and diag.get("right_diagnosis"):
            rd = diag["right_diagnosis"]
            label = "malignant" if rd == "PM" else ("benign" if rd == "PB" else ("normal" if rd == "N" else label))

        img_info = inspect_image_file(img_path)
        rel_path = str(img_path.relative_to(thermal_raw_dir)).replace("\\", "/")

        record = {
            "relative_path": rel_path,
            "modality": "thermal",
            "dataset": "Mendeley_Thermography",
            "filename": filename,
            "patient_id": patient_id,
            "view": view,
            "image_width": img_info["width"],
            "image_height": img_info["height"],
            "file_type": img_path.suffix.lower(),
            "file_size_bytes": img_path.stat().st_size,
            "label": label,
            "patient_overall_label": diag.get("patient_label", "unannotated"),
            "left_diagnosis": diag.get("left_diagnosis", ""),
            "right_diagnosis": diag.get("right_diagnosis", ""),
            "age_years": diag.get("age_years", ""),
            "temperature_c": diag.get("temperature_c", ""),
            "weight_kg": diag.get("weight_kg", ""),
            "height_cm": diag.get("height_cm", ""),
            "label_source": "Diagnostics.xlsx" if diag else "None",
            "validation_status": "valid" if img_info["is_readable"] else "corrupt",
            "validation_error": img_info["error"] or ""
        }
        records.append(record)

    if output_csv_path and records:
        output_csv_path = Path(output_csv_path)
        output_csv_path.parent.mkdir(parents=True, exist_ok=True)
        keys = list(records[0].keys())
        with open(output_csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(records)

    return records

