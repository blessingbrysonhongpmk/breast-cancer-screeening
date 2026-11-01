"""
Comprehensive Live System and Integration Test for MammoFusion-XAI.
Verifies all live endpoints, model inference, Grad-CAM generation, and frontend availability.
"""

import io
import sys
import requests
from pathlib import Path
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5173"

def run_all_checks():
    print("=======================================================")
    print(" MAMMOFUSION-XAI COMPLETE SYSTEM & INTEGRATION TESTING")
    print("=======================================================")

    passed = 0
    failed = 0

    def assert_test(condition, name, details=""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name} - {details}")
            failed += 1

    # 1. Backend Health Check
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert_test(r.status_code == 200 and r.json().get("status") == "healthy", "1. Backend Health API (/api/health)")
    except Exception as e:
        assert_test(False, "1. Backend Health API (/api/health)", str(e))

    # 2. Model Readiness Check (allowing up to 30s for cold-start model weight verification)
    try:
        r = requests.get(f"{BASE_URL}/api/models/readiness", timeout=30)
        data = r.json()
        assert_test(r.status_code == 200, "2a. Model Readiness HTTP Status 200")
        assert_test(data.get("mammogram", {}).get("ready") is True, "2b. Mammogram ResNet-50 Ready")
        assert_test(data.get("thermal", {}).get("ready") is True, "2c. Thermal ResNet-50 Ready")
        assert_test(data.get("combined", {}).get("ready") is True, "2d. Cross-Attention Combined Model Ready")
        arch = data.get("combined", {}).get("model_architecture", "")
        assert_test("Cross-Attention" in arch, f"2e. Cross-Attention Architecture Reported ({arch})")
        assert_test(data.get("gradcam_ready") is True, "2f. Grad-CAM Engine Ready")
        assert_test(data.get("realtime_inference_ready") is True, "2g. Real-Time Inference Operational")
    except Exception as e:
        assert_test(False, "2. Model Readiness Check", str(e))

    # 3. Dataset Audit & Statistics
    try:
        r = requests.get(f"{BASE_URL}/api/dataset/stats", timeout=10)
        data = r.json()
        total_imgs = data.get("total_images_across_modalities", 0)
        assert_test(r.status_code == 200 and total_imgs > 0, f"3. Dataset Statistics (Total: {total_imgs} images)")
    except Exception as e:
        assert_test(False, "3. Dataset Statistics", str(e))

    # 4. Raw Sample Files Retrieval
    try:
        r1 = requests.get(f"{BASE_URL}/api/sample-file/combined/paired_mammo.pgm", timeout=10)
        r2 = requests.get(f"{BASE_URL}/api/sample-file/combined/paired_thermal.jpg", timeout=10)
        assert_test(r1.status_code == 200 and len(r1.content) > 1000, f"4a. Sample Mammogram File Streaming ({len(r1.content):,} bytes)")
        assert_test(r2.status_code == 200 and len(r2.content) > 1000, f"4b. Sample Thermal File Streaming ({len(r2.content):,} bytes)")
    except Exception as e:
        assert_test(False, "4. Raw Sample File Streaming", str(e))

    # 5. Live Mode 1: Mammogram Inference & Grad-CAM
    try:
        mammo_path = Path("data/raw/paired/mammogram/paired_mammo.pgm")
        if not mammo_path.exists():
            mammo_path = next(Path("data/raw/mammogram").glob("*.pgm"))
        with open(mammo_path, "rb") as f:
            files = {"file": (mammo_path.name, f, "image/x-portable-graymap")}
            r = requests.post(f"{BASE_URL}/api/analyze/mammogram", files=files, timeout=30)
        data = r.json()
        p_class = data.get("predicted_class")
        conf = data.get("confidence", 0)
        assert_test(r.status_code == 200 and data.get("status") == "classified", f"5a. Mode 1 Mammogram Classified ({p_class} @ {conf*100:.1f}%)")
        cam_url = data.get("gradcam_url")
        assert_test(cam_url is not None, "5b. Mode 1 Grad-CAM Generated")
        if cam_url:
            cam_r = requests.get(f"{BASE_URL}{cam_url}", timeout=10)
            assert_test(cam_r.status_code == 200 and "image/jpeg" in cam_r.headers.get("content-type", ""), "5c. Mode 1 Grad-CAM JPEG Downloadable")
    except Exception as e:
        assert_test(False, "5. Mode 1 Mammogram Inference", str(e))

    # 6. Live Mode 2: Thermal Inference & Grad-CAM
    try:
        thermal_path = Path("data/raw/paired/thermal/paired_thermal.jpg")
        if not thermal_path.exists():
            thermal_path = next(Path("data/raw/thermal").glob("*.jpg"))
        with open(thermal_path, "rb") as f:
            files = {"file": (thermal_path.name, f, "image/jpeg")}
            r = requests.post(f"{BASE_URL}/api/analyze/thermal", files=files, timeout=30)
        data = r.json()
        p_class = data.get("predicted_class")
        conf = data.get("confidence", 0)
        assert_test(r.status_code == 200 and data.get("status") == "classified", f"6a. Mode 2 Thermal Classified ({p_class} @ {conf*100:.1f}%)")
        cam_url = data.get("gradcam_url")
        assert_test(cam_url is not None, "6b. Mode 2 Grad-CAM Generated")
        if cam_url:
            cam_r = requests.get(f"{BASE_URL}{cam_url}", timeout=10)
            assert_test(cam_r.status_code == 200 and "image/jpeg" in cam_r.headers.get("content-type", ""), "6c. Mode 2 Grad-CAM JPEG Downloadable")
    except Exception as e:
        assert_test(False, "6. Mode 2 Thermal Inference", str(e))

    # 7. Live Mode 3: Pair Validation
    try:
        m_path = Path("data/raw/paired/mammogram/paired_mammo.pgm")
        t_path = Path("data/raw/paired/thermal/paired_thermal.jpg")
        with open(m_path, "rb") as fm, open(t_path, "rb") as ft:
            files = {
                "mammogram_file": ("paired_mammo.pgm", fm, "image/x-portable-graymap"),
                "thermal_file": ("paired_thermal.jpg", ft, "image/jpeg")
            }
            r = requests.post(f"{BASE_URL}/api/validate-pair", files=files, data={"case_id": "TEST_CASE"}, timeout=10)
        data = r.json()
        assert_test(r.status_code == 200, "7a. Pair Validation Endpoint HTTP 200")
        assert_test(data.get("pairing_status") == "verified", "7b. Same-Patient Pairing Status Verified")
        assert_test(data.get("can_analyze") is True, "7c. can_analyze Flag True")
        assert_test(data.get("fusion_model_available") is True, "7d. Fusion Model Available Flag True")
    except Exception as e:
        assert_test(False, "7. Pair Validation", str(e))

    # 8. Live Mode 3: Combined Cross-Attention Multimodal Inference & Dual Grad-CAM
    try:
        m_path = Path("data/raw/paired/mammogram/paired_mammo.pgm")
        t_path = Path("data/raw/paired/thermal/paired_thermal.jpg")
        with open(m_path, "rb") as fm, open(t_path, "rb") as ft:
            files = {
                "mammogram_file": ("paired_mammo.pgm", fm, "image/x-portable-graymap"),
                "thermal_file": ("paired_thermal.jpg", ft, "image/jpeg")
            }
            r = requests.post(f"{BASE_URL}/api/analyze/combined", files=files, data={"case_id": "MF-COMBINED-TEST_PT_001"}, timeout=20)
        data = r.json()
        assert_test(r.status_code == 200, "8a. Mode 3 Combined HTTP Status 200")
        assert_test(data.get("status") == "classified", "8b. Mode 3 Status Classified")
        arch = data.get("model_architecture")
        assert_test(arch == "Cross-Attention Dual-Branch ResNet-50 Fusion", f"8c. Cross-Attention Architecture Verified ({arch})")
        p_class = data.get("predicted_class")
        assert_test(p_class in ["normal", "benign", "malignant"], f"8d. Prediction Valid: {p_class}")
        conf = data.get("confidence", -1)
        assert_test(0.0 <= conf <= 1.0, f"8e. Confidence Score Valid: {conf}")
        probs = data.get("probabilities", {})
        sum_probs = sum(probs.values())
        assert_test(0.99 <= sum_probs <= 1.01, f"8f. Softmax Distribution Valid (Sum: {sum_probs:.4f})")
        assert_test(data.get("predictive_entropy") is not None, "8g. Uncertainty Quantification (Entropy Calculated)")
        dual_cam_url = data.get("gradcam_url")
        assert_test(dual_cam_url is not None, f"8h. Synchronized Dual Grad-CAM URL Generated ({dual_cam_url})")
        if dual_cam_url:
            cam_r = requests.get(f"{BASE_URL}{dual_cam_url}", timeout=5)
            assert_test(cam_r.status_code == 200 and "image/jpeg" in cam_r.headers.get("content-type", ""), "8i. Dual Grad-CAM JPEG Stitched Heatmap Downloadable")
            img = Image.open(io.BytesIO(cam_r.content))
            assert_test(img.width == 448 and img.height == 224, f"8j. Dual Grad-CAM Stitched Dimensions Valid (Expected 448x224: Actual {img.size})")
    except Exception as e:
        assert_test(False, "8. Mode 3 Cross-Attention Inference", str(e))

    # 9. Evaluation Benchmarks Endpoint
    try:
        r = requests.get(f"{BASE_URL}/api/evaluation", timeout=5)
        data = r.json()
        assert_test(r.status_code == 200, "9a. Evaluation Results HTTP 200")
        assert_test("cross_attention" in data, "9b. Cross-Attention Benchmark Metrics Present")
        assert_test("ensemble" in data, "9c. Probabilistic Ensemble Benchmark Metrics Present")
        acc = data.get("cross_attention", {}).get("test_metrics", {}).get("overall_accuracy")
        assert_test(acc is not None, f"9d. Test Accuracy Documented ({acc})")
    except Exception as e:
        assert_test(False, "9. Evaluation Endpoint", str(e))

    # 10. Frontend Availability
    try:
        r_backend_spa = requests.get(f"{BASE_URL}/", timeout=5)
        assert_test(r_backend_spa.status_code == 200 and '<div id="root">' in r_backend_spa.text, "10a. FastAPI Production SPA (http://127.0.0.1:8000/) Serving")
    except Exception as e:
        assert_test(False, "10a. FastAPI Production SPA", str(e))

    try:
        r_vite = requests.get(f"{FRONTEND_URL}/", timeout=5)
        assert_test(r_vite.status_code == 200 and "vite" in r_vite.text.lower(), "10b. Vite Dev Server (http://127.0.0.1:5173/) Running")
    except Exception as e:
        assert_test(False, "10b. Vite Dev Server", str(e))

    print("-------------------------------------------------------")
    print(f" TOTAL RESULTS: {passed} PASSED / {failed} FAILED")
    print("=======================================================")

    return failed == 0

if __name__ == "__main__":
    success = run_all_checks()
    sys.exit(0 if success else 1)
