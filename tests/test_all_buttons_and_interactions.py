"""
Comprehensive End-to-End Verification Test for all Buttons, User Interactions,
Navigation Flows, and API Endpoints across MammoFusion-XAI.
"""
import sys
import io
import json
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5173"

def run_all_button_and_interaction_tests():
    print("=" * 70)
    print(" MAMMOFUSION-XAI: COMPREHENSIVE FINAL BUTTON & WORKFLOW VERIFICATION")
    print("=" * 70)

    passed = 0
    failed = 0

    def record(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"  [PASS] {name} {f'({details})' if details else ''}")
        else:
            failed += 1
            print(f"  [FAIL] {name} - FAILED: {details}")

    # ---------------------------------------------------------
    # 1. Navigation & App Topbar Buttons
    # ---------------------------------------------------------
    print("\n--- 1. APP TOPBAR & NAVIGATION BACKEND HOOKS ---")
    try:
        r_health = requests.get(f"{BASE_URL}/api/health", timeout=5)
        record("Topbar 'Sync' Button -> /api/health", r_health.status_code == 200 and r_health.json().get("status") == "healthy")
    except Exception as e:
        record("Topbar 'Sync' Button -> /api/health", False, str(e))

    try:
        r_ready = requests.get(f"{BASE_URL}/api/models/readiness", timeout=5)
        data = r_ready.json()
        record("Dashboard Model Readiness Checks", r_ready.status_code == 200 and data.get("mammogram", {}).get("ready") and data.get("combined", {}).get("ready"))
    except Exception as e:
        record("Dashboard Model Readiness Checks", False, str(e))

    # ---------------------------------------------------------
    # 2. Mode 1: Mammogram Screening Buttons
    # ---------------------------------------------------------
    print("\n--- 2. EXAMINATION PAGE: MODE 1 (MAMMOGRAM) BUTTONS ---")
    try:
        r_samples = requests.get(f"{BASE_URL}/api/samples", timeout=5)
        samples = r_samples.json()
        mammo_samples = [s for s in samples if s.get("modality") == "mammogram"]
        record("Drawer 'Select from Reference Dataset' button", len(mammo_samples) > 0, f"{len(mammo_samples)} samples loaded")
    except Exception as e:
        record("Drawer 'Select from Reference Dataset' button", False, str(e))

    # Test Reference Sample Stream (used when clicking sample)
    mammo_sample_file = None
    try:
        r_sf = requests.get(f"{BASE_URL}/api/sample-file/mammogram/mdb001lm.pgm", timeout=10)
        record("Sample Card Selection Button -> /api/sample-file", r_sf.status_code == 200 and len(r_sf.content) > 1000)
        mammo_sample_file = r_sf.content
    except Exception as e:
        record("Sample Card Selection Button -> /api/sample-file", False, str(e))

    # Test Image Validation Button Hook (when dropping or uploading file)
    try:
        r_val = requests.post(
            f"{BASE_URL}/api/validate-scan",
            files={"file": ("mdb001lm.pgm", io.BytesIO(mammo_sample_file), "image/x-portable-graymap")},
            data={"expected_modality": "mammogram"},
            timeout=10
        )
        val_data = r_val.json()
        record("Mammogram File Format & Modality Validation", r_val.status_code == 200 and val_data.get("file_format_status") == "Valid" and val_data.get("image_type_status") == "Verified")
    except Exception as e:
        record("Mammogram File Format & Modality Validation", False, str(e))

    # Test "Run Mammogram Screening" Button
    mammo_result = None
    try:
        r_an = requests.post(
            f"{BASE_URL}/api/analyze/mammogram",
            files={"file": ("mdb001lm.pgm", io.BytesIO(mammo_sample_file), "image/x-portable-graymap")},
            data={"tta": "false"},
            timeout=40
        )
        mammo_result = r_an.json()
        record("'Run Mammogram Screening' Action Button -> ResNet-50", r_an.status_code == 200 and mammo_result.get("predicted_class") in ["normal", "benign", "malignant"])
    except Exception as e:
        record("'Run Mammogram Screening' Action Button -> ResNet-50", False, str(e))

    # ---------------------------------------------------------
    # 3. Mode 2: Thermal Screening Buttons
    # ---------------------------------------------------------
    print("\n--- 3. EXAMINATION PAGE: MODE 2 (THERMAL) BUTTONS ---")
    thermal_sample_file = None
    try:
        r_st = requests.get(f"{BASE_URL}/api/sample-file/thermal/IIR0110_anterior.jpg", timeout=25)
        record("Thermal Sample Selection -> /api/sample-file", r_st.status_code == 200 and len(r_st.content) > 1000)
        thermal_sample_file = r_st.content
    except Exception as e:
        record("Thermal Sample Selection -> /api/sample-file", False, str(e))

    try:
        r_tval = requests.post(
            f"{BASE_URL}/api/validate-scan",
            files={"file": ("IIR0110_anterior.jpg", io.BytesIO(thermal_sample_file), "image/jpeg")},
            data={"expected_modality": "thermal"},
            timeout=25
        )
        tval_data = r_tval.json()
        record("Thermal File Format & Modality Validation", r_tval.status_code == 200 and tval_data.get("file_format_status") == "Valid" and tval_data.get("image_type_status") == "Verified")
    except Exception as e:
        record("Thermal File Format & Modality Validation", False, str(e))

    try:
        r_tan = requests.post(
            f"{BASE_URL}/api/analyze/thermal",
            files={"file": ("IIR0110_anterior.jpg", io.BytesIO(thermal_sample_file), "image/jpeg")},
            data={"tta": "false"},
            timeout=40
        )
        thermal_result = r_tan.json()
        record("'Run Thermal Screening' Action Button -> ResNet-50", r_tan.status_code == 200 and thermal_result.get("predicted_class") in ["normal", "benign", "malignant"])
    except Exception as e:
        record("'Run Thermal Screening' Action Button -> ResNet-50", False, str(e))

    # ---------------------------------------------------------
    # 4. Mode 3: Combined Multimodal Screening Buttons
    # ---------------------------------------------------------
    print("\n--- 4. EXAMINATION PAGE: MODE 3 (COMBINED MULTIMODAL) BUTTONS ---")
    # Button: "Load Verified Pair & Validate"
    paired_mammo_bytes = None
    paired_thermal_bytes = None
    try:
        r_pm = requests.get(f"{BASE_URL}/api/sample-file/combined/paired_mammo.pgm", timeout=30)
        r_pt = requests.get(f"{BASE_URL}/api/sample-file/combined/paired_thermal.jpg", timeout=30)
        paired_mammo_bytes = r_pm.content
        paired_thermal_bytes = r_pt.content
        record("'Load Verified Pair & Validate' Benchmark Button", r_pm.status_code == 200 and r_pt.status_code == 200, f"Mammo: {len(paired_mammo_bytes)}b, Thermal: {len(paired_thermal_bytes)}b")
    except Exception as e:
        record("'Load Verified Pair & Validate' Benchmark Button", False, str(e))

    # Button Action: Pair Validation (Verified Research Pair)
    try:
        r_pval = requests.post(
            f"{BASE_URL}/api/validate-pair",
            files={
                "mammogram_file": ("paired_mammo.pgm", io.BytesIO(paired_mammo_bytes), "image/x-portable-graymap"),
                "thermal_file": ("paired_thermal.jpg", io.BytesIO(paired_thermal_bytes), "image/jpeg")
            },
            data={"case_id": "MF-COMBINED-TEST_PT_001", "confirmed_same_patient": "false"},
            timeout=30
        )
        pval_data = r_pval.json()
        record("Pair Validation: Research Manifest Pair", r_pval.status_code == 200 and pval_data.get("can_analyze") is True and pval_data.get("pairing_status") == "verified")
    except Exception as e:
        record("Pair Validation: Research Manifest Pair", False, str(e))

    # Button Action: Pair Validation for Custom Upload (Before & After Confirmation Button)
    try:
        # Step A: Custom files unconfirmed -> can_analyze: False
        r_cust_unconf = requests.post(
            f"{BASE_URL}/api/validate-pair",
            files={
                "mammogram_file": ("custom_mammo.jpg", io.BytesIO(paired_mammo_bytes), "image/jpeg"),
                "thermal_file": ("custom_thermal.jpg", io.BytesIO(paired_thermal_bytes), "image/jpeg")
            },
            data={"case_id": "TEST-CUSTOM-001", "confirmed_same_patient": "false"},
            timeout=30
        )
        cust_unconf_data = r_cust_unconf.json()
        record("Custom Upload: Unconfirmed Pairing Requires Confirmation", cust_unconf_data.get("can_analyze") is False and cust_unconf_data.get("pairing_status") == "not_verified")

        # Step B: User clicks "Confirm Patient Pair & Enable Analysis" button
        r_cust_conf = requests.post(
            f"{BASE_URL}/api/validate-pair",
            files={
                "mammogram_file": ("custom_mammo.jpg", io.BytesIO(paired_mammo_bytes), "image/jpeg"),
                "thermal_file": ("custom_thermal.jpg", io.BytesIO(paired_thermal_bytes), "image/jpeg")
            },
            data={"case_id": "TEST-CUSTOM-001", "confirmed_same_patient": "true"},
            timeout=30
        )
        cust_conf_data = r_cust_conf.json()
        record("'Confirm Patient Pair & Enable Analysis' Action Button", cust_conf_data.get("can_analyze") is True and cust_conf_data.get("pairing_status") == "verified")
    except Exception as e:
        record("'Confirm Patient Pair & Enable Analysis' Action Button", False, str(e))

    # Button: "Analyze Combined Images" -> Triggers Genuine Cross-Attention Model
    combined_result = None
    try:
        r_comb = requests.post(
            f"{BASE_URL}/api/analyze/combined",
            files={
                "mammogram_file": ("paired_mammo.pgm", io.BytesIO(paired_mammo_bytes), "image/x-portable-graymap"),
                "thermal_file": ("paired_thermal.jpg", io.BytesIO(paired_thermal_bytes), "image/jpeg")
            },
            data={"case_id": "MF-COMBINED-TEST_PT_001", "confirmed_same_patient": "true"},
            timeout=45
        )
        combined_result = r_comb.json()
        record("'Analyze Combined Images' Button -> Cross-Attention Model", r_comb.status_code == 200 and combined_result.get("predicted_class") in ["normal", "benign", "malignant"])
    except Exception as e:
        record("'Analyze Combined Images' Button -> Cross-Attention Model", False, str(e))

    # ---------------------------------------------------------
    # 5. Results Page Buttons & Features
    # ---------------------------------------------------------
    print("\n--- 5. RESULTS PAGE BUTTONS & FEATURES ---")
    if combined_result and combined_result.get("gradcam_url"):
        cam_url = combined_result["gradcam_url"]
        try:
            r_cam = requests.get(f"{BASE_URL}{cam_url}", timeout=5)
            record("Synchronized Dual Grad-CAM Image Stream", r_cam.status_code == 200 and len(r_cam.content) > 1000)
        except Exception as e:
            record("Synchronized Dual Grad-CAM Image Stream", False, str(e))

    # Button: "Download Report" -> /api/reports/export-markdown
    try:
        report_payload = combined_result or mammo_result or {
            "status": "classified",
            "modality": "combined",
            "filename": "paired_mammo.pgm + paired_thermal.jpg",
            "predicted_class": "benign",
            "confidence": 0.99,
            "dimensions": {"width": 1024, "height": 1024},
            "color_mode": "RGB",
            "format": "PGM+JPG",
            "inference_ready": True,
            "message": "Screening complete",
            "recommendation": "Routine screening."
        }
        r_rep = requests.post(
            f"{BASE_URL}/api/reports/export-markdown",
            json=report_payload,
            timeout=5
        )
        rep_data = r_rep.json()
        record("'Download Report' Button -> /api/reports/export-markdown", r_rep.status_code == 200 and "markdown" in rep_data and len(rep_data["markdown"]) > 100)
    except Exception as e:
        record("'Download Report' Button -> /api/reports/export-markdown", False, str(e))

    # Tab 2: "Model Evaluation & Validation Graphs" Button -> /api/evaluation
    try:
        r_eval = requests.get(f"{BASE_URL}/api/evaluation", timeout=5)
        eval_data = r_eval.json()
        record("Evaluation Tab Buttons -> /api/evaluation", r_eval.status_code == 200 and "mammogram" in eval_data and "combined" in eval_data)
    except Exception as e:
        record("Evaluation Tab Buttons -> /api/evaluation", False, str(e))

    # ---------------------------------------------------------
    # 6. Patient History Page Buttons
    # ---------------------------------------------------------
    print("\n--- 6. PATIENT HISTORY PAGE BUTTONS ---")
    try:
        r_hist = requests.get(f"{BASE_URL}/api/recent-analyses", timeout=5)
        hist_records = r_hist.json()
        record("History 'Refresh' Button -> /api/recent-analyses", r_hist.status_code == 200 and isinstance(hist_records, list))
    except Exception as e:
        record("History 'Refresh' Button -> /api/recent-analyses", False, str(e))

    # Button: "Clear History" -> DELETE /api/recent-analyses
    try:
        r_clear = requests.delete(f"{BASE_URL}/api/recent-analyses", timeout=5)
        record("History 'Confirm Clear' Button -> DELETE /api/recent-analyses", r_clear.status_code == 200)
    except Exception as e:
        record("History 'Confirm Clear' Button -> DELETE /api/recent-analyses", False, str(e))

    # Re-insert the test analysis record into history so history remains populated
    try:
        requests.post(
            f"{BASE_URL}/api/reports/export-markdown",
            json=combined_result or mammo_result,
            timeout=5
        )
    except Exception:
        pass

    # ---------------------------------------------------------
    # 7. About Page Buttons: Ingestion Pipeline
    # ---------------------------------------------------------
    print("\n--- 7. ABOUT PAGE BUTTONS ---")
    try:
        r_scan = requests.post(f"{BASE_URL}/api/dataset/scan", timeout=15)
        record("About Page 'Scan Dropbox' Button -> /api/dataset/scan", r_scan.status_code == 200 and "workspace_root" in r_scan.json())
    except Exception as e:
        record("About Page 'Scan Dropbox' Button -> /api/dataset/scan", False, str(e))

    try:
        r_imp = requests.post(f"{BASE_URL}/api/dataset/import", json={"dry_run": True}, timeout=75)
        record("About Page 'Run Safe Ingestion' Button -> /api/dataset/import", r_imp.status_code == 200 and "status" in r_imp.json())
    except Exception as e:
        record("About Page 'Run Safe Ingestion' Button -> /api/dataset/import", False, str(e))

    # ---------------------------------------------------------
    # 8. Web Servers & Frontend SPA Serving
    # ---------------------------------------------------------
    print("\n--- 8. LIVE HOSTING SERVERS ---")
    try:
        r_fe = requests.get(f"{FRONTEND_URL}/#examination", timeout=5)
        record("Vite Dev Server Running at http://127.0.0.1:5173", r_fe.status_code == 200 and "<div id=\"root\">" in r_fe.text)
    except Exception as e:
        record("Vite Dev Server Running at http://127.0.0.1:5173", False, str(e))

    try:
        r_be_spa = requests.get(f"{BASE_URL}/", timeout=5)
        record("FastAPI Production SPA Server at http://127.0.0.1:8000", r_be_spa.status_code == 200 and "<div id=\"root\">" in r_be_spa.text)
    except Exception as e:
        record("FastAPI Production SPA Server at http://127.0.0.1:8000", False, str(e))

    print("\n" + "=" * 70)
    print(f" FINAL SUMMARY: {passed} PASSED / {failed} FAILED (Total: {passed + failed})")
    print("=" * 70)
    return failed == 0

if __name__ == "__main__":
    success = run_all_button_and_interaction_tests()
    sys.exit(0 if success else 1)
