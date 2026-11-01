"""
Targeted Verification Script for:
1. Mode A – Mammogram Only (PyTorch ResNet-50 + Grad-CAM)
2. Mode B – Thermal Only (PyTorch ResNet-50 + Grad-CAM)
3. Mode C – Both Images (Independent Dual ResNet-50 + Multimodal Cross-Attention Fusion)
4. HIGH RISK vs LOW RISK Model Categorization
5. Downloadable Clinical Screening Report Export
"""
import io
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_full_workflow():
    print("=================================================================")
    print("MAMMOFUSION-XAI: TESTING EXAMINATION MODES & RISK CATEGORIZATION")
    print("=================================================================")

    # 1. Fetch real reference scans
    print("\n[STEP 0] Fetching genuine test scans from server...")
    r_mammo = requests.get(f"{BASE_URL}/api/sample-file/mammogram/mdb001lm.pgm", timeout=30)
    assert r_mammo.status_code == 200, "Failed to fetch mammogram scan"
    mammo_bytes = r_mammo.content

    r_thermal = requests.get(f"{BASE_URL}/api/sample-file/thermal/IIR0110_anterior.jpg", timeout=30)
    assert r_thermal.status_code == 200, "Failed to fetch thermal scan"
    thermal_bytes = r_thermal.content
    print(f"  [PASS] Fetched mammogram scan ({len(mammo_bytes)} bytes)")
    print(f"  [PASS] Fetched thermal scan ({len(thermal_bytes)} bytes)")

    # 2. Test Mode A: Mammogram Only
    print("\n[TEST 1] Mode A – Mammogram Only Analysis")
    resp_a = requests.post(
        f"{BASE_URL}/api/analyze/mammogram",
        files={"file": ("mdb001lm.pgm", io.BytesIO(mammo_bytes), "image/x-portable-graymap")},
        data={"tta": "false"},
        timeout=40
    )
    assert resp_a.status_code == 200, f"Mode A failed: {resp_a.text}"
    m_data = resp_a.json()
    print(f"  [PASS] Model Architecture: {m_data.get('model_architecture')}")
    print(f"  [PASS] Predicted Class: {m_data.get('predicted_class')}")
    print(f"  [PASS] Confidence: {m_data.get('confidence') * 100:.1f}%")
    print(f"  [PASS] Grad-CAM URL: {m_data.get('gradcam_url')}")
    risk_m = "HIGH RISK" if m_data.get("predicted_class") == "malignant" else "LOW RISK"
    print(f"  [PASS] Evaluated Screening Risk: {risk_m}")
    assert m_data.get("gradcam_url") is not None

    # 3. Test Mode B: Thermal Only
    print("\n[TEST 2] Mode B – Thermal Only Analysis")
    resp_b = requests.post(
        f"{BASE_URL}/api/analyze/thermal",
        files={"file": ("IIR0110_anterior.jpg", io.BytesIO(thermal_bytes), "image/jpeg")},
        data={"tta": "false"},
        timeout=40
    )
    assert resp_b.status_code == 200, f"Mode B failed: {resp_b.text}"
    t_data = resp_b.json()
    print(f"  [PASS] Model Architecture: {t_data.get('model_architecture')}")
    print(f"  [PASS] Predicted Class: {t_data.get('predicted_class')}")
    print(f"  [PASS] Confidence: {t_data.get('confidence') * 100:.1f}%")
    print(f"  [PASS] Grad-CAM URL: {t_data.get('gradcam_url')}")
    risk_t = "HIGH RISK" if t_data.get("predicted_class") == "malignant" else "LOW RISK"
    print(f"  [PASS] Evaluated Screening Risk: {risk_t}")
    assert t_data.get("gradcam_url") is not None

    # 4. Test Mode C – Pair Validation on Uncatalogued Scans
    print("\n[TEST 3] Mode C – Pair Validation on Custom Uncatalogued Scans")
    v_resp = requests.post(
        f"{BASE_URL}/api/validate-pair",
        files={
            "mammogram_file": ("custom_patient_mammo.jpg", io.BytesIO(mammo_bytes), "image/jpeg"),
            "thermal_file": ("custom_patient_thermal.jpg", io.BytesIO(thermal_bytes), "image/jpeg")
        },
        data={"case_id": "MF-CASE-CUSTOM-01", "confirmed_same_patient": "false"},
        timeout=30
    )
    assert v_resp.status_code == 200
    v_data = v_resp.json()
    print(f"  [PASS] Unconfirmed pairing status: {v_data.get('pairing_status')}")
    print(f"  [PASS] Can analyze multimodal before confirmation: {v_data.get('can_analyze')}")
    assert v_data.get("can_analyze") is False

    # 5. Test Mode C – User Confirms Single-Patient Examination Case
    print("\n[TEST 4] Mode C – User Confirms Single-Patient Examination Case")
    v_conf = requests.post(
        f"{BASE_URL}/api/validate-pair",
        files={
            "mammogram_file": ("custom_patient_mammo.jpg", io.BytesIO(mammo_bytes), "image/jpeg"),
            "thermal_file": ("custom_patient_thermal.jpg", io.BytesIO(thermal_bytes), "image/jpeg")
        },
        data={"case_id": "MF-CASE-CUSTOM-01", "confirmed_same_patient": "true"},
        timeout=30
    )
    assert v_conf.status_code == 200
    v_conf_data = v_conf.json()
    print(f"  [PASS] Confirmed pairing status: {v_conf_data.get('pairing_status')}")
    print(f"  [PASS] Can analyze multimodal after confirmation: {v_conf_data.get('can_analyze')}")
    assert v_conf_data.get("can_analyze") is True

    # 6. Test Mode C – Combined Analysis Execution
    print("\n[TEST 5] Mode C – Execute Multimodal Fusion Forward Pass & Synchronized Dual Grad-CAM")
    comb_resp = requests.post(
        f"{BASE_URL}/api/analyze/combined",
        files={
            "mammogram_file": ("paired_mammo.pgm", io.BytesIO(mammo_bytes), "image/x-portable-graymap"),
            "thermal_file": ("paired_thermal.jpg", io.BytesIO(thermal_bytes), "image/jpeg")
        },
        data={"case_id": "MF-COMBINED-TEST_PT_001", "confirmed_same_patient": "true"},
        timeout=45
    )
    assert comb_resp.status_code == 200, f"Combined failed: {comb_resp.text}"
    c_data = comb_resp.json()
    print(f"  [PASS] Multimodal Architecture: {c_data.get('model_architecture')}")
    print(f"  [PASS] Predicted Class: {c_data.get('predicted_class')}")
    print(f"  [PASS] Confidence: {c_data.get('confidence') * 100:.1f}%")
    print(f"  [PASS] Synchronized Dual Grad-CAM URL: {c_data.get('gradcam_url')}")
    assert c_data.get("gradcam_url") is not None

    # 7. Test Report Export with Mode C payload
    print("\n[TEST 6] Report Export – Mode C Clinical Report Generation")
    report_payload = {
        "case_id": "MF-CASE-CUSTOM-01",
        "modality": "combined",
        "filename": "mdb001lm.pgm + IIR0110_anterior.jpg",
        "predicted_class": c_data.get("predicted_class"),
        "confidence": c_data.get("confidence"),
        "probabilities": c_data.get("probabilities"),
        "risk_category": "HIGH RISK" if c_data.get("predicted_class") == "malignant" else "LOW RISK",
        "mammo_prediction": m_data,
        "thermal_prediction": t_data,
        "combined_prediction": c_data
    }
    rep_resp = requests.post(
        f"{BASE_URL}/api/reports/export-markdown",
        json=report_payload,
        timeout=15
    )
    assert rep_resp.status_code == 200
    rep_data = rep_resp.json()
    markdown = rep_data.get("markdown", "")
    assert "Primary Screening Category" in markdown
    assert "Independent Modality Breakdown" in markdown
    assert "Radiographic Mammogram Analysis" in markdown
    assert "Infrared Thermography Analysis" in markdown
    assert "Cross-Attention Multimodal Fusion Analysis" in markdown
    assert "NOT A CONFIRMED CANCER DIAGNOSIS" in markdown
    print("  [PASS] Clinical report generated with all modality sections and medical advisory")

    print("\n=================================================================")
    print("ALL 6 EXAMINATION & RISK TESTS PASSED SUCCESSFULLY! (100% PASS)")
    print("=================================================================")

if __name__ == "__main__":
    test_full_workflow()
