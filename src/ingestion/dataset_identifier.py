"""Explicit rule-based identifier for dataset modalities.
Avoids silent guessing and validates files strictly against known schemas.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional

MODALITY_MAMMOGRAM = "mammogram"
MODALITY_THERMAL = "thermal"
MODALITY_UNKNOWN = "unknown"

DATASET_MIAS = "MIAS"
DATASET_MENDELEY_THERMAL = "Mendeley_Thermography"
DATASET_UNKNOWN = "Unknown"

# Exact filename regex for MIAS mammogram images (mdb001lm.pgm, etc.)
MIAS_PGM_REGEX = re.compile(r"^mdb\d{3}[a-z]{2}\.pgm$", re.IGNORECASE)

# Exact folder / ID regex for Mendeley Breast Thermography (IIR0110, etc.)
THERMAL_PATIENT_REGEX = re.compile(r"^IIR\d{4}$", re.IGNORECASE)


def identify_dataset_type(directory_or_files: Any) -> Dict[str, Any]:
    """Inspects file lists and folder structure to definitively identify dataset provenance.
    Never guesses silently.
    """
    file_list = []
    dir_path = None

    if isinstance(directory_or_files, (str, Path)):
        p = Path(directory_or_files)
        if p.is_dir():
            dir_path = p
            for root, _, files in os.walk(p):
                for f in files:
                    file_list.append(Path(root) / f)
        elif p.is_file():
            file_list.append(p)
    elif isinstance(directory_or_files, list):
        file_list = [Path(f) for f in directory_or_files]

    total_files = len(file_list)
    mias_matches = [f for f in file_list if MIAS_PGM_REGEX.match(f.name)]
    mias_readme = [f for f in file_list if "00readme" in f.name.lower() or "excerpta" in f.name.lower()]

    thermal_diag = [f for f in file_list if f.name.lower() in {"diagnostics.xlsx", "diagnostics.xls", "diagnostics.csv"}]
    thermal_patients = set()
    for f in file_list:
        for part in f.parts:
            if THERMAL_PATIENT_REGEX.match(part):
                thermal_patients.add(part.upper())

    result = {
        "dataset_name": DATASET_UNKNOWN,
        "modality": MODALITY_UNKNOWN,
        "confidence": "none",
        "matched_rules": [],
        "mias_image_count": len(mias_matches),
        "thermal_patient_count": len(thermal_patients),
        "has_thermal_diagnostics": len(thermal_diag) > 0,
        "has_mias_readme": len(mias_readme) > 0,
        "is_ambiguous": False,
        "ambiguity_reason": ""
    }

    # Evaluate MIAS criteria
    is_mias = len(mias_matches) > 0
    # Evaluate Thermal criteria
    is_thermal = (len(thermal_diag) > 0) or (len(thermal_patients) > 0)

    if is_mias and is_thermal:
        result["is_ambiguous"] = True
        result["ambiguity_reason"] = "Directory contains both MIAS mammograms and Mendeley Thermography files. Separate modalities required."
        return result

    if is_mias:
        result["dataset_name"] = DATASET_MIAS
        result["modality"] = MODALITY_MAMMOGRAM
        result["confidence"] = "high"
        result["matched_rules"].append(f"Found {len(mias_matches)} PGM files matching MIAS naming convention (mdb###XX.pgm)")
        if mias_readme:
            result["matched_rules"].append("Found MIAS 00README / reference documentation")
        return result

    if is_thermal:
        result["dataset_name"] = DATASET_MENDELEY_THERMAL
        result["modality"] = MODALITY_THERMAL
        result["confidence"] = "high"
        if thermal_diag:
            result["matched_rules"].append(f"Found Diagnostics metadata spreadsheet ({thermal_diag[0].name})")
        if thermal_patients:
            result["matched_rules"].append(f"Found {len(thermal_patients)} participant folders matching IIR#### pattern")
        return result

    result["is_ambiguous"] = True
    result["ambiguity_reason"] = "No supported dataset signatures detected. Must match either MIAS (mdb*.pgm) or Mendeley Thermography (IIR* / Diagnostics.xlsx)."
    return result

