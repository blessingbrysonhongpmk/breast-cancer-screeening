"""Unit tests for metadata parsing (MIAS rules and Thermal Diagnostics XML)."""

import tempfile
import unittest
import zipfile
from pathlib import Path

from src.ingestion.metadata_parser import (
    parse_thermal_diagnostics_xlsx
)


class TestMetadataParser(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_thermal_diagnostics_xlsx_xml_parsing(self):
        """Verify XML/ZIP parsing of Diagnostics.xlsx correctly parses clinical attributes and pathology."""
        dummy_xlsx = self.base_path / "Diagnostics.xlsx"

        # Construct minimal valid OpenXML spreadsheet
        content_types = (
            b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            b'<Default Extension="xml" ContentType="application/xml"/>'
            b'</Types>'
        )
        sheet_xml = (
            b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            b'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            b'<sheetData>'
            b'<row r="1">'
            b'<c r="A1" t="s"><v>0</v></c>'
            b'<c r="B1" t="s"><v>1</v></c>'
            b'<c r="C1" t="s"><v>2</v></c>'
            b'<c r="D1" t="s"><v>3</v></c>'
            b'<c r="E1" t="s"><v>4</v></c>'
            b'<c r="F1" t="s"><v>5</v></c>'
            b'<c r="G1" t="s"><v>6</v></c>'
            b'</row>'
            b'<row r="2">'
            b'<c r="A2" t="s"><v>7</v></c>'  # IIR0110
            b'<c r="B2" t="s"><v>8</v></c>'  # PB
            b'<c r="C2" t="s"><v>9</v></c>'  # N
            b'<c r="D2"><v>55.5</v></c>'
            b'<c r="E2"><v>162.0</v></c>'
            b'<c r="F2"><v>36.5</v></c>'
            b'<c r="G2"><v>45</v></c>'
            b'</row>'
            b'</sheetData>'
            b'</worksheet>'
        )
        shared_strings = (
            b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            b'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="10" uniqueCount="10">'
            b'<si><t>Image</t></si>'
            b'<si><t>Left</t></si>'
            b'<si><t>Right</t></si>'
            b'<si><t>Weight</t></si>'
            b'<si><t>Height</t></si>'
            b'<si><t>Temp</t></si>'
            b'<si><t>Age</t></si>'
            b'<si><t>IIR0110</t></si>'
            b'<si><t>PB</t></si>'
            b'<si><t>N</t></si>'
            b'</sst>'
        )

        with zipfile.ZipFile(dummy_xlsx, "w") as z:
            z.writestr("[Content_Types].xml", content_types)
            z.writestr("xl/worksheets/sheet1.xml", sheet_xml)
            z.writestr("xl/sharedStrings.xml", shared_strings)

        parsed = parse_thermal_diagnostics_xlsx(dummy_xlsx)
        self.assertEqual(len(parsed), 1)
        rec = parsed[0]
        self.assertEqual(rec["patient_id"], "IIR0110")
        self.assertEqual(rec["left_diagnosis"], "PB")
        self.assertEqual(rec["right_diagnosis"], "N")
        self.assertEqual(rec["patient_label"], "benign")
        self.assertEqual(rec["age_years"], 45)


if __name__ == "__main__":
    unittest.main()

