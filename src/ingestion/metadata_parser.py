"""Robust metadata and clinical label parsers for MIAS and Mendeley Breast Thermography.
Parses PDF ground truth and Excel XML without requiring third-party binary libraries.
"""

import os
import re
import zlib
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Any, Optional


def parse_mias_readme_pdf(pdf_path: Path) -> List[Dict[str, Any]]:
    """Extracts ground-truth records directly from MIAS 00README.pdf streams."""
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return []

    with open(pdf_path, "rb") as f:
        data = f.read()

    streams = re.findall(rb"stream[\r\n]+(.*?)[\r\n]+endstream", data, re.DOTALL)
    lines = []
    for s in streams:
        try:
            decomp = zlib.decompress(s)
            tjs = re.findall(rb"\[(.*?)\]\s*TJ", decomp, re.DOTALL)
            for tj in tjs:
                parts = re.findall(rb"\((.*?)\)", tj)
                line = "".join([p.decode("latin1", errors="ignore") for p in parts])
                if line.strip():
                    lines.append(line.strip())
            single_tjs = re.findall(rb"\((.*?)\)\s*Tj", decomp)
            for stj in single_tjs:
                line = stj.decode("latin1", errors="ignore")
                if line.strip():
                    lines.append(line.strip())
        except Exception:
            pass

    records = []
    current_mdb = None

    for i, line in enumerate(lines):
        mdb_match = re.match(r"^(mdb\d{3}[a-z]*)", line, re.IGNORECASE)
        if mdb_match:
            raw_id = mdb_match.group(1).lower()
            # Canonical image serial (e.g. mdb001)
            serial_match = re.match(r"^mdb(\d{3})", raw_id)
            if not serial_match:
                continue
            serial_num = int(serial_match.group(1))
            # Patient ID from Note 1: odd/even pairs represent one individual
            patient_id = f"MIAS_P{(serial_num + 1) // 2:03d}"
            laterality = "left" if serial_num % 2 == 1 else "right"

            # Check next line for annotation details
            info_line = lines[i + 1] if i + 1 < len(lines) else ""
            
            # Pattern: [FGD] [CLASS] [B|M] [x] [y] [r]
            parts = info_line.split()
            tissue = None
            abn_class = "NORM"
            severity = "NORM"
            x, y, radius = None, None, None

            idx = 0
            if parts and parts[0] in {"F", "G", "D"}:
                tissue = parts[0]
                idx += 1

            if len(parts) > idx:
                potential_class = parts[idx].upper()
                if potential_class in {"NORM", "CALC", "CIRC", "SPIC", "MISC", "ARCH", "ASYM"}:
                    abn_class = potential_class
                    idx += 1

            if abn_class != "NORM" and len(parts) > idx:
                if parts[idx].upper() in {"B", "M"}:
                    severity = parts[idx].upper()
                    idx += 1

            if len(parts) >= idx + 3:
                try:
                    x = int(parts[idx])
                    y = int(parts[idx + 1])
                    radius = int(parts[idx + 2])
                except ValueError:
                    pass

            label = "normal"
            if severity == "B":
                label = "benign"
            elif severity == "M":
                label = "malignant"

            records.append({
                "image_code": raw_id,
                "serial_number": serial_num,
                "patient_id": patient_id,
                "laterality": laterality,
                "background_tissue": tissue,
                "abnormality_class": abn_class,
                "severity": severity,
                "label": label,
                "center_x": x,
                "center_y": y,
                "radius": radius,
                "raw_info": info_line
            })

    return records


def parse_thermal_diagnostics_xlsx(xlsx_path: Path) -> List[Dict[str, Any]]:
    """Extracts clinical records and diagnosis classifications from Mendeley Diagnostics.xlsx.
    Works natively via standard library zipfile + XML parsing.
    """
    xlsx_path = Path(xlsx_path)
    if not xlsx_path.exists():
        return []

    shared_strings = []
    rows = []

    with zipfile.ZipFile(xlsx_path, "r") as z:
        if "xl/sharedStrings.xml" in z.namelist():
            tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
            shared_strings = ["".join(node.itertext()) for node in tree.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si")]

        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

        for r in sheet.findall(".//s:row", ns):
            row_vals = []
            for c in r.findall("s:c", ns):
                t = c.get("t")
                v = c.find("s:v", ns)
                val = v.text if v is not None else ""
                if t == "s" and val.isdigit():
                    idx = int(val)
                    if idx < len(shared_strings):
                        val = shared_strings[idx]
                row_vals.append(val.strip())
            rows.append(row_vals)

    if not rows:
        return []

    header = [h.strip() for h in rows[0]]
    records = []

    # Columns expected: Image, Left, Right, Weight, Height, Temp, Age
    for row in rows[1:]:
        if not row or not row[0]:
            continue
        patient_code = row[0].strip()
        if not re.match(r"^IIR\d+", patient_code, re.IGNORECASE):
            continue

        left_diag = row[1] if len(row) > 1 else ""
        right_diag = row[2] if len(row) > 2 else ""
        weight = float(row[3]) if len(row) > 3 and row[3].replace(".", "", 1).isdigit() else None
        height = float(row[4]) if len(row) > 4 and row[4].replace(".", "", 1).isdigit() else None
        temp = float(row[5]) if len(row) > 5 and row[5].replace(".", "", 1).isdigit() else None
        age = int(float(row[6])) if len(row) > 6 and row[6].replace(".", "", 1).isdigit() else None

        # Resolve pathology labels: N = Normal, PB = Benign Pathology, PM = Malignant Pathology
        # Determine case-level diagnosis
        if left_diag == "PM" or right_diag == "PM":
            patient_label = "malignant"
        elif left_diag == "PB" or right_diag == "PB":
            patient_label = "benign"
        elif left_diag == "N" and right_diag == "N":
            patient_label = "normal"
        else:
            patient_label = "unspecified"

        records.append({
            "patient_id": patient_code,
            "left_diagnosis": left_diag,
            "right_diagnosis": right_diag,
            "patient_label": patient_label,
            "weight_kg": weight,
            "height_cm": height,
            "temperature_c": temp,
            "age_years": age
        })

    return records

