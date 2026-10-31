"""FastAPI backend server for MammoFusion-XAI Risk frontend.
Provides genuine, non-fabricated API endpoints for dataset audits, model status,
sample image streaming, and analysis requests.
"""

import io
import os
import csv
import json
from pathlib import Path
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MANIFESTS_DIR = PROJECT_ROOT / "data" / "manifests"
REPORTS_DIR = PROJECT_ROOT / "reports"
RAW_DIR = PROJECT_ROOT / "data" / "raw"
MODELS_DIR = PROJECT_ROOT / "models"
STATIC_DIR = PROJECT_ROOT / "app" / "static"
HEATMAPS_DIR = PROJECT_ROOT / "data" / "cache_heatmaps"
HEATMAPS_DIR.mkdir(parents=True, exist_ok=True)

LOADED_MODELS: Dict[str, Any] = {}

def get_modality_model(modality: str):
    """Loads and caches trained PyTorch ResNet-50 weights for inference."""
    if modality in LOADED_MODELS:
        return LOADED_MODELS[modality]

    candidates = list(MODELS_DIR.glob(f"{modality}*.pt"))
    if not candidates:
        return None

    ckpt_path = candidates[0]
    try:
        import torch
        device = torch.device("cpu")
        checkpoint = torch.load(ckpt_path, map_location=device)
        if modality == "mammogram":
            from src.mammogram.model import MammogramClassifier
            model = MammogramClassifier(num_classes=3, pretrained=False)
        else:
            from src.thermal.model import ThermalClassifier
            model = ThermalClassifier(num_classes=3, pretrained=False)

        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        LOADED_MODELS[modality] = model
        return model
    except Exception as ex:
        print(f"Error loading model {ckpt_path}: {ex}")
        return None


def _append_recent_analysis(record: Dict[str, Any]):
    """Appends analysis event to reports/recent_analyses.json."""
    recent_file = REPORTS_DIR / "recent_analyses.json"
    recent_file.parent.mkdir(parents=True, exist_ok=True)
    analyses = []
    if recent_file.exists():
        try:
            with open(recent_file, "r", encoding="utf-8") as f:
                analyses = json.load(f)
        except Exception:
            analyses = []
    analyses.insert(0, record)
    analyses = analyses[:25]  # Keep latest 25
    with open(recent_file, "w", encoding="utf-8") as f:
        json.dump(analyses, f, indent=2)

app = FastAPI(
    title="MammoFusion-XAI Risk Platform",
    description="Multimodal Explainable AI for Breast Cancer Screening & Risk Research",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
def get_system_status() -> Dict[str, Any]:
    """Returns system status, active directory, and disk availability."""
    import shutil
    usage = shutil.disk_usage(str(PROJECT_ROOT))
    return {
        "project": "MammoFusion-XAI Risk",
        "milestones": {
            "milestone_1_ingestion": "Complete (679 images verified)",
            "milestone_2_preprocessing": "Complete (CLAHE, Stratified Splitting)",
            "milestone_3_modeling": "Pending (Google Colab / Local CPU)"
        },
        "disk": {
            "free_gb": round(usage.free / (1024**3), 2),
            "total_gb": round(usage.total / (1024**3), 2),
            "drive": str(PROJECT_ROOT.drive)
        },
        "scientific_policy": "Strict zero-fabrication protocol: No synthetic multimodal fusion, no decorative heatmaps, no fake predictions."
    }


@app.get("/api/datasets")
@app.get("/api/dataset/stats")
def get_dataset_statistics() -> Dict[str, Any]:
    """Returns genuine dataset audit data from reports/dataset_audit_report.json and manifests."""
    audit_file = REPORTS_DIR / "dataset_audit_report.json"
    if audit_file.exists():
        with open(audit_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Fallback to manifests if report not found
    mammo_records = []
    mammo_csv = MANIFESTS_DIR / "mammogram_manifest.csv"
    if mammo_csv.exists():
        with open(mammo_csv, "r", encoding="utf-8") as f:
            mammo_records = list(csv.DictReader(f))

    thermal_records = []
    thermal_csv = MANIFESTS_DIR / "thermal_manifest.csv"
    if thermal_csv.exists():
        with open(thermal_csv, "r", encoding="utf-8") as f:
            thermal_records = list(csv.DictReader(f))

    return {
        "total_images_across_modalities": len(mammo_records) + len(thermal_records),
        "mammogram": {
            "total_images": len(mammo_records),
            "unique_patients_identified": len(set(r.get("patient_id") for r in mammo_records if r.get("patient_id"))),
            "readable_images": sum(1 for r in mammo_records if r.get("validation_status") == "valid")
        },
        "thermal": {
            "total_images": len(thermal_records),
            "unique_patients_identified": len(set(r.get("patient_id") for r in thermal_records if r.get("patient_id"))),
            "readable_images": sum(1 for r in thermal_records if r.get("validation_status") == "valid")
        }
    }


@app.get("/api/models")
def get_models_status() -> Dict[str, Any]:
    """Inspects models directory for real trained weights and verifies loadability."""
    model_files = []
    if MODELS_DIR.exists():
        for ext in ("*.pt", "*.pth", "*.onnx", "*.h5"):
            model_files.extend([f.name for f in MODELS_DIR.glob(ext)])

    # Verify which models are actually loaded or loadable
    verified_loaded = []
    for modality in ["mammogram", "thermal"]:
        try:
            m = get_modality_model(modality)
            if m is not None:
                verified_loaded.append(modality)
        except Exception:
            pass

    is_ready = len(verified_loaded) > 0

    return {
        "models_available": model_files,
        "models_loaded": verified_loaded,
        "is_ready_for_inference": is_ready,
        "status_message": (
            f"Loaded {len(verified_loaded)} verified PyTorch ResNet-50 models ({', '.join(verified_loaded)})."
            if is_ready
            else "Training Pending: No compatible trained weights found in models/."
        ),
        "milestone_stage": "Stage 3 Deep Learning Ready" if is_ready else "Training Pending"
    }


@app.get("/api/samples")
def get_sample_images() -> List[Dict[str, Any]]:
    """Returns curated real sample images from the ingested datasets for one-click testing."""
    return [
        {
            "id": "mammo_1",
            "modality": "mammogram",
            "filename": "mdb001lm.pgm",
            "label": "benign",
            "patient_id": "MIAS_P001",
            "view": "Left CC/MLO",
            "tissue": "Fatty-glandular",
            "description": "MIAS Suckling et al. reference case with well-defined circumscribed mass."
        },
        {
            "id": "mammo_2",
            "modality": "mammogram",
            "filename": "mdb002rl.pgm",
            "label": "benign",
            "patient_id": "MIAS_P001",
            "view": "Right CC/MLO",
            "tissue": "Fatty-glandular",
            "description": "Contralateral breast image from Patient 1."
        },
        {
            "id": "mammo_3",
            "modality": "mammogram",
            "filename": "mdb003ll.pgm",
            "label": "normal",
            "patient_id": "MIAS_P002",
            "view": "Left CC/MLO",
            "tissue": "Dense-glandular",
            "description": "Dense glandular tissue, confirmed normal screening case."
        },
        {
            "id": "thermal_1",
            "modality": "thermal",
            "filename": "IIR0110_anterior.jpg",
            "label": "benign",
            "patient_id": "IIR0110",
            "view": "Frontal (Anterior)",
            "description": "Mendeley infrared thermal image (Anterior view) for participant IIR0110."
        },
        {
            "id": "thermal_2",
            "modality": "thermal",
            "filename": "IIR0110_oblder.jpg",
            "label": "benign",
            "patient_id": "IIR0110",
            "view": "Right Lateral (Oblicua Derecha)",
            "description": "Mendeley infrared thermal image (Right Oblique view)."
        },
        {
            "id": "thermal_3",
            "modality": "thermal",
            "filename": "IIR0110_oblizq.jpg",
            "label": "benign",
            "patient_id": "IIR0110",
            "view": "Left Lateral (Oblicua Izquierda)",
            "description": "Mendeley infrared thermal image (Left Oblique view)."
        }
    ]


CACHE_DIR = PROJECT_ROOT / "data" / "cache_thumbnails"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/api/sample-image/{modality}/{filename}")
def stream_sample_image(modality: str, filename: str):
    """Streams a sample image converted to browser-compatible thumbnail PNG/JPEG with local caching."""
    cached_thumb = CACHE_DIR / f"{filename}.jpg"
    if cached_thumb.exists():
        return FileResponse(str(cached_thumb), media_type="image/jpeg")

    if modality == "mammogram":
        file_path = RAW_DIR / "mammogram" / filename
    elif modality == "thermal":
        matches = list((RAW_DIR / "thermal").glob(f"**/{filename}"))
        file_path = matches[0] if matches else (RAW_DIR / "thermal" / filename)
    else:
        raise HTTPException(status_code=400, detail="Unknown modality")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Sample image not found on disk")

    try:
        with Image.open(file_path) as img:
            # Resize for fast, beautiful web rendering if large
            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            rgb = img.convert("RGB")
            rgb.save(cached_thumb, "JPEG", quality=88)
            return FileResponse(str(cached_thumb), media_type="image/jpeg")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Image conversion failed: {ex}")


@app.post("/api/analyze")
async def analyze_uploaded_image(
    file: UploadFile = File(...),
    modality: str = Form("mammogram")
) -> Dict[str, Any]:
    """Handles image upload and analysis.
    Verifies image integrity and strictly adheres to zero-fabrication policy when models are untrained.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    try:
        pil_img = Image.open(io.BytesIO(contents))
        width, height = pil_img.size
        mode = pil_img.mode
        format_name = pil_img.format or "UNKNOWN"
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {ex}")

    # Inspect model readiness
    model = get_modality_model(modality)

    if model is None:
        # Honest scientific protocol response
        return {
            "status": "awaiting_model_training",
            "modality": modality,
            "filename": file.filename,
            "dimensions": {"width": width, "height": height},
            "color_mode": mode,
            "format": format_name,
            "inference_ready": False,
            "message": (
                "Image uploaded and validated successfully. Model weights are currently awaiting training in Milestone 3. "
                "Per project governance rules, decorative heatmaps, fake prediction scores, and speculative risk categories are prohibited."
            ),
            "recommendation": "Use Google Colab or the local training module once Milestone 3 begins to train weights with patient-level stratification."
        }

    # Genuine Deep Learning Forward Pass & Grad-CAM attribution
    try:
        import torch
        import numpy as np
        import time

        if modality == "mammogram":
            from src.preprocessing.dataset import get_mammogram_eval_transforms
            transform = get_mammogram_eval_transforms()
            input_tensor = transform(pil_img.convert("L")).unsqueeze(0)
        else:
            from src.preprocessing.dataset import get_thermal_eval_transforms
            transform = get_thermal_eval_transforms()
            input_tensor = transform(pil_img.convert("RGB")).unsqueeze(0)

        # Forward pass for class probabilities
        with torch.no_grad():
            logits = model(input_tensor)
            probs = torch.softmax(logits, dim=1)[0].numpy()

        classes = ["normal", "benign", "malignant"]
        pred_idx = int(np.argmax(probs))
        pred_label = classes[pred_idx]
        conf = float(probs[pred_idx])

        # Genuine Grad-CAM visual attribution
        from src.explainability.gradcam import GradCAM, apply_colormap_to_cam
        gradcam = GradCAM(model, model.get_target_layer())
        cam_np, _, _ = gradcam.generate(input_tensor, target_class=pred_idx)

        # Create blended visualization
        blended = apply_colormap_to_cam(cam_np, pil_img, alpha=0.45)
        cam_filename = f"cam_{int(time.time()*1000)}.jpg"
        blended.save(HEATMAPS_DIR / cam_filename, "JPEG", quality=90)

        record_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "modality": modality,
            "filename": file.filename,
            "dimensions": {"width": width, "height": height},
            "status": "classified",
            "inference_ready": True,
            "predicted_class": pred_label,
            "confidence": round(conf, 4),
            "probabilities": {
                "normal": round(float(probs[0]), 4),
                "benign": round(float(probs[1]), 4),
                "malignant": round(float(probs[2]), 4)
            },
            "gradcam_url": f"/api/gradcam-image/{cam_filename}"
        }
        _append_recent_analysis(record_entry)

        return {
            "status": "classified",
            "modality": modality,
            "filename": file.filename,
            "dimensions": {"width": width, "height": height},
            "color_mode": mode,
            "format": format_name,
            "inference_ready": True,
            "predicted_class": pred_label,
            "confidence": round(conf, 4),
            "probabilities": {
                "normal": round(float(probs[0]), 4),
                "benign": round(float(probs[1]), 4),
                "malignant": round(float(probs[2]), 4)
            },
            "gradcam_url": f"/api/gradcam-image/{cam_filename}",
            "model_architecture": "ResNet-50 Deep ConvNet",
            "message": f"ResNet-50 inference complete. Classified as {pred_label.upper()} with {conf*100:.1f}% confidence. Grad-CAM visual saliency generated from layer4 bottleneck gradients.",
            "recommendation": "Review Grad-CAM focal hyperthermia / lesion boundary against radiological screening standard."
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Inference execution failed: {ex}")


@app.get("/api/gradcam-image/{filename}")
def get_gradcam_image(filename: str):
    """Serves generated Grad-CAM heatmap overlays."""
    file_path = HEATMAPS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Grad-CAM heatmap not found")
    return FileResponse(str(file_path), media_type="image/jpeg")


@app.get("/api/evaluation")
def get_evaluation_benchmark() -> Dict[str, Any]:
    """Returns test set evaluation benchmark results."""
    eval_file = REPORTS_DIR / "evaluation_results.json"
    if eval_file.exists():
        with open(eval_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "status": "pending_training",
        "message": "Evaluation results will be generated after model training."
    }


@app.get("/api/manifests/records")
def get_manifest_records(modality: str = "all", limit: int = 100, search: str = "") -> Dict[str, Any]:
    """Returns real records from the manifest CSVs with search and filter capabilities."""
    records = []
    
    if modality in {"all", "mammogram"}:
        mammo_csv = MANIFESTS_DIR / "mammogram_manifest.csv"
        if mammo_csv.exists():
            with open(mammo_csv, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    row["modality"] = "mammogram"
                    records.append(row)

    if modality in {"all", "thermal"}:
        thermal_csv = MANIFESTS_DIR / "thermal_manifest.csv"
        if thermal_csv.exists():
            with open(thermal_csv, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    row["modality"] = "thermal"
                    records.append(row)

    if search:
        search_lower = search.lower()
        records = [
            r for r in records 
            if search_lower in r.get("filename", "").lower() 
            or search_lower in r.get("patient_id", "").lower()
            or search_lower in r.get("label", "").lower()
            or search_lower in r.get("abnormality_class", "").lower()
        ]

    total_count = len(records)
    return {
        "total": total_count,
        "returned": min(limit, total_count),
        "records": records[:limit]
    }


@app.get("/api/manifests/export/{modality}")
def export_manifest_csv(modality: str):
    """Provides direct CSV downloads for manifests."""
    if modality == "mammogram":
        file_path = MANIFESTS_DIR / "mammogram_manifest.csv"
        fn = "MIAS_Mammogram_Manifest.csv"
    elif modality == "thermal":
        file_path = MANIFESTS_DIR / "thermal_manifest.csv"
        fn = "Mendeley_Thermography_Manifest.csv"
    else:
        raise HTTPException(status_code=400, detail="Unknown modality")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Manifest file not found")

    return FileResponse(
        str(file_path),
        media_type="text/csv",
        filename=fn
    )


@app.get("/api/recent-analyses")
def get_recent_analyses() -> List[Dict[str, Any]]:
    """Returns genuine recent analysis records, or empty list if none exist."""
    recent_file = REPORTS_DIR / "recent_analyses.json"
    if recent_file.exists():
        try:
            with open(recent_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


# Mount static files
STATIC_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR = STATIC_DIR / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
def serve_index():
    """Serves the main luxury dashboard index.html."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>MammoFusion-XAI Frontend Loading...</h1>")
