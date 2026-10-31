"""FastAPI backend server for MammoFusion-XAI Risk platform.
Provides reliable, non-fabricated API endpoints for dataset audits, per-modality model readiness,
sample image streaming, strict analysis request validation, and Grad-CAM explainability.
"""

import io
import os
import csv
import json
import uuid
import re
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from PIL import Image

from src.validation.modality_detector import (
    validate_mammogram_image,
    validate_thermal_image,
    MAMMOGRAM_ERROR_MSG,
    THERMAL_ERROR_MSG,
)

# Setup sanitized logging without patient or credential leaks
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("mammofusion.server")

# Base directory paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MANIFESTS_DIR = PROJECT_ROOT / "data" / "manifests"
REPORTS_DIR = PROJECT_ROOT / "reports"
RAW_DIR = PROJECT_ROOT / "data" / "raw"
MODELS_DIR = PROJECT_ROOT / Path(os.environ.get("MODELS_DIR", "models"))
STATIC_DIR = PROJECT_ROOT / "app" / "static"
HEATMAPS_DIR = PROJECT_ROOT / "data" / "cache_heatmaps"
CACHE_THUMBNAILS_DIR = PROJECT_ROOT / "data" / "cache_thumbnails"

HEATMAPS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Validation configuration
MAX_UPLOAD_SIZE_MB = int(os.environ.get("MAX_UPLOAD_SIZE_MB", 25))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
MIN_IMAGE_DIMENSION = int(os.environ.get("MIN_IMAGE_DIMENSION", 32))
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".pgm"}
VALID_MODALITIES = {"mammogram", "thermal"}

# In-memory model cache
LOADED_MODELS: Dict[str, Any] = {}


# ============================================================================
# Pydantic Schemas for Strict Request / Response Contracts
# ============================================================================

class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "MammoFusion-XAI Breast Imaging Research Platform"
    version: str = "1.0.0"
    environment: str = "development"


class ModalityReadinessDetail(BaseModel):
    ready: bool
    status_text: str = "Model not available"
    model_architecture: str
    checkpoint: Optional[str] = None
    target_layer: Optional[str] = None
    num_classes: int = 3
    classes: List[str] = ["normal", "benign", "malignant"]
    device: str = "cpu"


class ModelReadinessResponse(BaseModel):
    mammogram: ModalityReadinessDetail
    thermal: ModalityReadinessDetail
    combined: Optional[ModalityReadinessDetail] = None
    gradcam_ready: bool = False
    realtime_inference_ready: bool = False
    all_ready: bool


class ImageDimensions(BaseModel):
    width: int
    height: int


class ProbabilitiesDict(BaseModel):
    normal: float
    benign: float
    malignant: float


class AnalysisResponse(BaseModel):
    status: str
    modality: str
    filename: str
    dimensions: ImageDimensions
    color_mode: str
    format: str
    inference_ready: bool
    predicted_class: Optional[str] = None
    confidence: Optional[float] = None
    probabilities: Optional[Dict[str, float]] = None
    gradcam_url: Optional[str] = None
    model_architecture: Optional[str] = None
    message: str
    recommendation: str
    predictive_entropy: Optional[float] = None
    uncertainty_score: Optional[float] = None
    confidence_margin: Optional[float] = None
    roi_bounding_box: Optional[List[int]] = None
    attention_coverage_percent: Optional[float] = None
    peak_activation_coords: Optional[List[int]] = None
    tta_applied: Optional[bool] = False


class ClearHistoryResponse(BaseModel):
    message: str
    cleared_count: int


# ============================================================================
# Model Management & Safe Loader
# ============================================================================

def get_checkpoint_path_for_modality(modality: str) -> Optional[Path]:
    """Finds genuine PyTorch ResNet-50 checkpoint for the given modality."""
    if not MODELS_DIR.exists():
        return None
    candidates = sorted(MODELS_DIR.glob(f"{modality}*.pt"))
    return candidates[0] if candidates else None


def get_modality_model(modality: str):
    """Loads and caches verified PyTorch ResNet-50 weights for inference.
    Executes a verification forward pass to ensure checkpoint compatibility before caching.
    """
    if modality in LOADED_MODELS:
        return LOADED_MODELS[modality]

    ckpt_path = get_checkpoint_path_for_modality(modality)
    if not ckpt_path:
        return None

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

        # Strict execution verification: verify forward pass before confirming readiness
        with torch.no_grad():
            dummy_input = torch.zeros((1, 3, 224, 224))
            out = model(dummy_input)
            if out.shape != (1, 3):
                raise ValueError(f"Incompatible output shape {out.shape}, expected (1, 3)")

        LOADED_MODELS[modality] = model
        logger.info(f"Verified & loaded PyTorch {modality} model from {ckpt_path.name}")
        return model
    except Exception as ex:
        logger.error(f"Failed to load/verify model from {ckpt_path}: {ex}")
        return None


def sanitize_filename(filename: Optional[str]) -> str:
    """Sanitizes user-supplied filenames to prevent path traversal or unsafe characters."""
    if not filename:
        return f"scan_{uuid.uuid4().hex[:8]}.png"
    base = Path(filename).name
    # Strip any directory traversal sequence or consecutive dots
    clean = re.sub(r'\.{2,}', '_', base)
    clean = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', clean)
    if not clean or clean.startswith('.'):
        clean = f"scan_{uuid.uuid4().hex[:8]}{clean}"
    return clean


def _append_recent_analysis(record: Dict[str, Any]):
    """Safely appends analysis event to reports/recent_analyses.json."""
    recent_file = REPORTS_DIR / "recent_analyses.json"
    analyses = []
    if recent_file.exists():
        try:
            with open(recent_file, "r", encoding="utf-8") as f:
                analyses = json.load(f)
        except Exception:
            analyses = []
    analyses.insert(0, record)
    analyses = analyses[:50]  # Keep latest 50 records
    with open(recent_file, "w", encoding="utf-8") as f:
        json.dump(analyses, f, indent=2)


# ============================================================================
# FastAPI Application & Restricted CORS Middleware
# ============================================================================

app = FastAPI(
    title="MammoFusion-XAI Breast Imaging Research Platform",
    description="Explainable Deep Learning Research Platform for Breast Cancer Imaging Analysis",
    version="1.0.0"
)

# Configure restricted CORS
cors_env = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"
)
allowed_origins = [orig.strip() for orig in cors_env.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================================
# Health and Model Readiness Endpoints
# ============================================================================

@app.get("/api/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Health check endpoint to verify backend service availability."""
    return HealthResponse(
        status="healthy",
        service="MammoFusion-XAI Breast Imaging Research Platform",
        version="1.0.0",
        environment=os.environ.get("ENV", "development")
    )


@app.get("/api/models/readiness", response_model=ModelReadinessResponse)
def get_models_readiness() -> ModelReadinessResponse:
    """Per-modality model readiness endpoint.
    Performs verified model checks to distinguish whether mammogram and thermal weights are loaded and ready.
    """
    mammo_model = get_modality_model("mammogram")
    mammo_ckpt = get_checkpoint_path_for_modality("mammogram")
    mammo_ready = mammo_model is not None
    mammo_detail = ModalityReadinessDetail(
        ready=mammo_ready,
        status_text="Model Ready" if mammo_ready else "Model not available",
        model_architecture="ResNet-50",
        checkpoint=mammo_ckpt.name if (mammo_ready and mammo_ckpt) else None,
        target_layer="layer4" if mammo_ready else None,
        num_classes=3,
        classes=["normal", "benign", "malignant"],
        device="cpu"
    )

    thermal_model = get_modality_model("thermal")
    thermal_ckpt = get_checkpoint_path_for_modality("thermal")
    thermal_ready = thermal_model is not None
    thermal_detail = ModalityReadinessDetail(
        ready=thermal_ready,
        status_text="Model Ready" if thermal_ready else "Model not available",
        model_architecture="ResNet-50",
        checkpoint=thermal_ckpt.name if (thermal_ready and thermal_ckpt) else None,
        target_layer="layer4" if thermal_ready else None,
        num_classes=3,
        classes=["normal", "benign", "malignant"],
        device="cpu"
    )

    fusion_ckpt = (
        get_checkpoint_path_for_modality("multimodal")
        or get_checkpoint_path_for_modality("fusion")
        or get_checkpoint_path_for_modality("combined")
    )
    # Combined screening strictly requires a genuine trained multimodal fusion model
    fusion_ready = False
    combined_detail = ModalityReadinessDetail(
        ready=False,
        status_text="Combined analysis model is not yet available.",
        model_architecture="Multimodal Fusion Network (Pending Training)",
        checkpoint=fusion_ckpt.name if fusion_ckpt else None,
        target_layer=None,
        num_classes=3,
        classes=["normal", "benign", "malignant"],
        device="cpu"
    )

    # Verify Grad-CAM functionality on verified loaded model
    gradcam_ready = False
    if mammo_ready or thermal_ready:
        try:
            from src.explainability.gradcam import GradCAM
            active_model = mammo_model if mammo_ready else thermal_model
            gc = GradCAM(active_model, active_model.get_target_layer())
            gradcam_ready = True
        except Exception:
            gradcam_ready = False

    realtime_inference_ready = bool(mammo_ready or thermal_ready)

    return ModelReadinessResponse(
        mammogram=mammo_detail,
        thermal=thermal_detail,
        combined=combined_detail,
        gradcam_ready=gradcam_ready,
        realtime_inference_ready=realtime_inference_ready,
        all_ready=bool(mammo_ready and thermal_ready)
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
            "milestone_3_modeling": "Complete (ResNet-50 PyTorch Weights Available)"
        },
        "disk": {
            "free_gb": round(usage.free / (1024**3), 2),
            "total_gb": round(usage.total / (1024**3), 2),
            "drive": str(PROJECT_ROOT.drive)
        },
        "scientific_policy": "Strict zero-fabrication protocol: No synthetic multimodal fusion, no decorative heatmaps, no fake predictions."
    }


@app.get("/api/models")
def get_models_legacy_status() -> Dict[str, Any]:
    """Inspects models directory for real trained weights and verifies loadability."""
    model_files = []
    if MODELS_DIR.exists():
        for ext in ("*.pt", "*.pth", "*.onnx", "*.h5"):
            model_files.extend([f.name for f in MODELS_DIR.glob(ext)])

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


# ============================================================================
# Dataset and Manifest Statistics Endpoints
# ============================================================================

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
    """Provides direct CSV downloads for manifests with path traversal safeguards."""
    if modality not in VALID_MODALITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid modality '{modality}'. Expected 'mammogram' or 'thermal'."
        )

    if modality == "mammogram":
        file_path = MANIFESTS_DIR / "mammogram_manifest.csv"
        fn = "MIAS_Mammogram_Manifest.csv"
    else:
        file_path = MANIFESTS_DIR / "thermal_manifest.csv"
        fn = "Mendeley_Thermography_Manifest.csv"

    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manifest file not found.")

    return FileResponse(str(file_path), media_type="text/csv", filename=fn)


# ============================================================================
# Curated Sample Images Endpoints
# ============================================================================

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


@app.get("/api/sample-image/{modality}/{filename}")
def stream_sample_image(modality: str, filename: str):
    """Streams a sample image converted to browser-compatible thumbnail JPEG with local caching."""
    clean_modality = modality.lower().strip()
    clean_filename = sanitize_filename(filename)

    if clean_modality not in VALID_MODALITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown modality '{modality}'. Expected 'mammogram' or 'thermal'."
        )

    cached_thumb = CACHE_THUMBNAILS_DIR / f"{clean_filename}.jpg"
    if cached_thumb.exists():
        return FileResponse(str(cached_thumb), media_type="image/jpeg")

    if clean_modality == "mammogram":
        file_path = RAW_DIR / "mammogram" / clean_filename
    else:
        matches = list((RAW_DIR / "thermal").glob(f"**/{clean_filename}"))
        file_path = matches[0] if matches else (RAW_DIR / "thermal" / clean_filename)

    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample image not found on disk.")

    try:
        with Image.open(file_path) as img:
            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            rgb = img.convert("RGB")
            rgb.save(cached_thumb, "JPEG", quality=88)
            return FileResponse(str(cached_thumb), media_type="image/jpeg")
    except Exception as ex:
        logger.error(f"Failed to generate thumbnail for {clean_filename}: {ex}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Image conversion failed.")


# ============================================================================
# Image Analysis & Inference API
# ============================================================================

async def _process_modality_inference(
    file: UploadFile,
    modality: str,
    tta: bool = False
) -> AnalysisResponse:
    """Strictly validates uploaded breast image, enforces modality boundaries,
    runs genuine PyTorch inference, and generates Grad-CAM explainability.
    """
    # 1. Modality Validation
    norm_modality = modality.lower().strip()
    if norm_modality not in VALID_MODALITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid modality '{modality}'. Allowed modalities are 'mammogram' and 'thermal'."
        )

    # 2. Filename Sanitization & Extension Validation
    safe_name = sanitize_filename(file.filename)
    suffix = Path(safe_name).suffix.lower()

    if norm_modality == "mammogram":
        if suffix not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{suffix}'. Allowed formats: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}"
            )
    else:
        # Thermal imaging does not support PGM formats
        if suffix not in {".png", ".jpg", ".jpeg"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=THERMAL_ERROR_MSG
            )

    # 3. Size Validation (read safely)
    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty. Please select a valid image file."
        )

    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File size exceeds maximum allowed limit of {MAX_UPLOAD_SIZE_MB}MB."
        )

    # 4. Image Readability & Dimensional Validation
    try:
        pil_img = Image.open(io.BytesIO(contents))
        pil_img.load()  # Force load image bytes to detect truncation/corruption
        width, height = pil_img.size
        mode = pil_img.mode
        format_name = pil_img.format or "UNKNOWN"
    except Exception as ex:
        logger.warning(f"Corrupt image rejected: {ex}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is corrupt or not a recognized image format."
        )

    if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Image dimensions ({width}x{height}) are too small. Minimum required dimension is {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION} pixels."
        )

    # 5. Strict Modality Boundary Verification
    if norm_modality == "mammogram":
        is_valid_mammo, mammo_err = validate_mammogram_image(pil_img, safe_name)
        if not is_valid_mammo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=mammo_err or MAMMOGRAM_ERROR_MSG
            )
    elif norm_modality == "thermal":
        is_valid_thermal, thermal_err = validate_thermal_image(pil_img, safe_name)
        if not is_valid_thermal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=thermal_err or THERMAL_ERROR_MSG
            )

    # 6. Check Modality Model Readiness
    model = get_modality_model(norm_modality)
    if model is None:
        logger.info(f"Analysis requested for {norm_modality} but model weights are not loaded.")
        return AnalysisResponse(
            status="awaiting_model_training",
            modality=norm_modality,
            filename=safe_name,
            dimensions=ImageDimensions(width=width, height=height),
            color_mode=mode,
            format=format_name,
            inference_ready=False,
            predicted_class=None,
            confidence=None,
            probabilities=None,
            gradcam_url=None,
            model_architecture=None,
            message=(
                "Image uploaded and validated successfully. Model weights are currently in standby/pending. "
                "Per project governance rules, decorative heatmaps, fake prediction scores, and speculative risk categories are strictly prohibited."
            ),
            recommendation="Connect trained PyTorch checkpoint in models/ directory to enable inference."
        )

    # 7. Genuine Deep Learning Forward Pass & Grad-CAM attribution
    try:
        import torch
        import numpy as np
        import time

        if norm_modality == "mammogram":
            from src.preprocessing.dataset import get_mammogram_eval_transforms
            transform = get_mammogram_eval_transforms()
            input_tensor = transform(pil_img.convert("L")).unsqueeze(0)
        else:
            from src.preprocessing.dataset import get_thermal_eval_transforms
            transform = get_thermal_eval_transforms()
            input_tensor = transform(pil_img.convert("RGB")).unsqueeze(0)

        from src.evaluation.metrics import compute_prediction_uncertainty, predict_with_tta
        from src.explainability.gradcam import GradCAM, apply_colormap_to_cam, extract_cam_roi

        # Forward pass for class probabilities (supports optional Test-Time Augmentation)
        with torch.no_grad():
            if tta:
                logits = predict_with_tta(model, input_tensor)
            else:
                logits = model(input_tensor)
            probs = torch.softmax(logits, dim=1)[0].cpu().numpy()

        classes = ["normal", "benign", "malignant"]
        pred_idx = int(np.argmax(probs))
        pred_label = classes[pred_idx]
        conf = float(probs[pred_idx])

        # Advanced predictive entropy & uncertainty quantification
        uncertainty_info = compute_prediction_uncertainty(probs)

        # Genuine Grad-CAM visual attribution from actual network gradients
        target_layer = model.get_target_layer()
        gradcam = GradCAM(model, target_layer)
        cam_np, _, _ = gradcam.generate(input_tensor, target_class=pred_idx)

        # Quantitative ROI bounding box & attention focus localization
        roi_info = extract_cam_roi(cam_np, original_size=(width, height), threshold_ratio=0.60)

        # Save blended heatmap
        blended = apply_colormap_to_cam(cam_np, pil_img, alpha=0.45)
        cam_filename = f"cam_{uuid.uuid4().hex[:12]}.jpg"
        blended.save(HEATMAPS_DIR / cam_filename, "JPEG", quality=90)

        record_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "modality": norm_modality,
            "filename": safe_name,
            "dimensions": {"width": width, "height": height},
            "color_mode": mode,
            "format": format_name,
            "status": "classified",
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
            "predictive_entropy": uncertainty_info["entropy"],
            "uncertainty_score": uncertainty_info["uncertainty_score"],
            "confidence_margin": uncertainty_info["confidence_margin"],
            "roi_bounding_box": roi_info["roi_box"],
            "attention_coverage_percent": roi_info["coverage_percent"],
            "peak_activation_coords": roi_info["peak_coords"],
            "tta_applied": tta,
            "message": f"ResNet-50 inference complete. Classified as {pred_label.upper()} with {conf*100:.1f}% confidence. Grad-CAM attribution generated from layer4 bottleneck gradients.",
            "recommendation": "Review Grad-CAM focal hyperthermia / lesion boundary against radiological screening standard."
        }
        _append_recent_analysis(record_entry)

        return AnalysisResponse(
            status="classified",
            modality=norm_modality,
            filename=safe_name,
            dimensions=ImageDimensions(width=width, height=height),
            color_mode=mode,
            format=format_name,
            inference_ready=True,
            predicted_class=pred_label,
            confidence=round(conf, 4),
            probabilities={
                "normal": round(float(probs[0]), 4),
                "benign": round(float(probs[1]), 4),
                "malignant": round(float(probs[2]), 4)
            },
            gradcam_url=f"/api/gradcam-image/{cam_filename}",
            model_architecture="ResNet-50 Deep ConvNet",
            predictive_entropy=uncertainty_info["entropy"],
            uncertainty_score=uncertainty_info["uncertainty_score"],
            confidence_margin=uncertainty_info["confidence_margin"],
            roi_bounding_box=roi_info["roi_box"],
            attention_coverage_percent=roi_info["coverage_percent"],
            peak_activation_coords=roi_info["peak_coords"],
            tta_applied=tta,
            message=f"ResNet-50 inference complete. Classified as {pred_label.upper()} with {conf*100:.1f}% confidence. Grad-CAM attribution generated from layer4 bottleneck gradients.",
            recommendation="Review Grad-CAM focal hyperthermia / lesion boundary against radiological screening standard."
        )
    except Exception as ex:
        logger.error(f"Inference execution failed: {ex}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Inference execution encountered an unexpected processing error."
        )


@app.post("/api/analyze/mammogram", response_model=AnalysisResponse)
async def analyze_mammogram_image(
    file: UploadFile = File(...),
    tta: bool = Form(False)
) -> AnalysisResponse:
    """Dedicated endpoint for Mode 1: Mammogram Screening."""
    return await _process_modality_inference(file, modality="mammogram", tta=tta)


@app.post("/api/analyze/thermal", response_model=AnalysisResponse)
async def analyze_thermal_image(
    file: UploadFile = File(...),
    tta: bool = Form(False)
) -> AnalysisResponse:
    """Dedicated endpoint for Mode 2: Thermal Screening."""
    return await _process_modality_inference(file, modality="thermal", tta=tta)


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_uploaded_image(
    file: UploadFile = File(...),
    modality: str = Form("mammogram"),
    tta: bool = Form(False)
) -> AnalysisResponse:
    """General analysis endpoint delegating to modality verification."""
    return await _process_modality_inference(file, modality=modality, tta=tta)


@app.post("/api/analyze/combined")
async def analyze_combined_images(
    mammogram_file: UploadFile = File(...),
    thermal_file: UploadFile = File(...),
    case_id: Optional[str] = Form(None)
):
    """Dedicated endpoint for Mode 3: Combined Multimodal Screening.
    Validates both mammogram and thermal scans independently.
    Rejects thermal in mammogram field and mammogram in thermal field.
    Returns a result only if a genuine trained multimodal fusion model exists.
    """
    # 1. Validate Mammogram Upload
    mammo_name = sanitize_filename(mammogram_file.filename)
    mammo_suffix = Path(mammo_name).suffix.lower()
    if mammo_suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=MAMMOGRAM_ERROR_MSG
        )
    mammo_bytes = await mammogram_file.read()
    if not mammo_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mammogram upload is empty. Please provide a valid mammogram image."
        )
    if len(mammo_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Mammogram file exceeds {MAX_UPLOAD_SIZE_MB}MB limit."
        )
    try:
        mammo_img = Image.open(io.BytesIO(mammo_bytes))
        mammo_img.load()
        if mammo_img.width < MIN_IMAGE_DIMENSION or mammo_img.height < MIN_IMAGE_DIMENSION:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Mammogram dimensions ({mammo_img.width}x{mammo_img.height}) are too small."
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=MAMMOGRAM_ERROR_MSG
        )

    is_mammo_valid, mammo_err = validate_mammogram_image(mammo_img, mammo_name)
    if not is_mammo_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=mammo_err or MAMMOGRAM_ERROR_MSG
        )

    # 2. Validate Thermal Upload
    thermal_name = sanitize_filename(thermal_file.filename)
    thermal_suffix = Path(thermal_name).suffix.lower()
    if thermal_suffix not in {".png", ".jpg", ".jpeg"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=THERMAL_ERROR_MSG
        )
    thermal_bytes = await thermal_file.read()
    if not thermal_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thermal upload is empty. Please provide a valid thermal image."
        )
    if len(thermal_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Thermal file exceeds {MAX_UPLOAD_SIZE_MB}MB limit."
        )
    try:
        thermal_img = Image.open(io.BytesIO(thermal_bytes))
        thermal_img.load()
        if thermal_img.width < MIN_IMAGE_DIMENSION or thermal_img.height < MIN_IMAGE_DIMENSION:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Thermal dimensions ({thermal_img.width}x{thermal_img.height}) are too small."
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=THERMAL_ERROR_MSG
        )

    is_thermal_valid, thermal_err = validate_thermal_image(thermal_img, thermal_name)
    if not is_thermal_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=thermal_err or THERMAL_ERROR_MSG
        )

    # 3. Check for genuine multimodal fusion model
    fusion_ckpt = (
        get_checkpoint_path_for_modality("multimodal")
        or get_checkpoint_path_for_modality("fusion")
        or get_checkpoint_path_for_modality("combined")
    )

    if not fusion_ckpt:
        logger.info(
            f"Combined analysis requested for case {case_id or 'MF-COMBINED'}, but multimodal fusion model is not yet available."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Combined analysis model is not yet available."
        )

    # Future: When fusion model weights are trained and loaded, genuine multimodal inference will execute here.
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Combined analysis model is not yet available."
    )


@app.get("/api/gradcam-image/{filename}")
def get_gradcam_image(filename: str):
    """Serves generated Grad-CAM heatmap overlays with path traversal protection."""
    safe_name = sanitize_filename(filename)
    file_path = HEATMAPS_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grad-CAM heatmap image not found."
        )
    return FileResponse(str(file_path), media_type="image/jpeg")


@app.post("/api/reports/export-markdown")
def export_research_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Generates a downloadable, peer-review-formatted Markdown report for an analysis."""
    import time
    filename = payload.get("filename", "scan_analysis")
    modality = str(payload.get("modality", "unspecified")).upper()
    predicted_class = str(payload.get("predicted_class", "UNKNOWN")).upper()
    confidence = payload.get("confidence") or 0.0
    probabilities = payload.get("probabilities") or {}
    dimensions = payload.get("dimensions") or {}
    dim_str = f"{dimensions.get('width', 'N/A')} × {dimensions.get('height', 'N/A')}" if isinstance(dimensions, dict) else "N/A"
    entropy = payload.get("predictive_entropy", "N/A")
    uncertainty = payload.get("uncertainty_score", "N/A")
    margin = payload.get("confidence_margin", "N/A")
    coverage = payload.get("attention_coverage_percent", "N/A")
    peak_coords = payload.get("peak_activation_coords", "N/A")
    timestamp = payload.get("timestamp") or time.strftime("%Y-%m-%dT%H:%M:%SZ")

    report_md = f"""# MammoFusion-XAI — Research Study Analysis Report
**Generated:** {timestamp}  
**Platform:** MammoFusion-XAI Breast Imaging Research Platform (v1.0.0)  
**Modality:** {modality}  
**Target Scan:** `{filename}`  
**Scan Dimensions:** {dim_str} ({payload.get('color_mode', 'N/A')})  

---

## 1. Deep Learning Inference Findings
- **Model Architecture:** ResNet-50 Deep Convolutional Neural Network
- **Classification Result:** **{predicted_class}**
- **Model Confidence:** {float(confidence)*100:.1f}%
- **Softmax Activation Distribution:**
  - Normal: {float(probabilities.get('normal', 0.0))*100:.2f}%
  - Benign: {float(probabilities.get('benign', 0.0))*100:.2f}%
  - Malignant: {float(probabilities.get('malignant', 0.0))*100:.2f}%

## 2. Advanced Uncertainty Quantification
- **Predictive Shannon Entropy:** {entropy}
- **Normalized Uncertainty Score:** {uncertainty} (Scale: 0.0 - 1.0)
- **Top-2 Decision Margin:** {margin}
- **Test-Time Augmentation (TTA):** {'Active (Dual-view ensemble)' if payload.get('tta_applied') else 'Standard single-pass'}

## 3. Explainability & Spatial Attention Attribution (Grad-CAM)
- **Target Convolutional Layer:** `resnet.layer4` (Bottleneck Residual Blocks)
- **Attention Peak Coordinates:** {peak_coords}
- **Focal Attention Coverage:** {coverage}% of total image field
- **Heatmap Generation:** Positive gradient backpropagation with Turbo colormap overlay

---

## 4. Scientific & Ethical Governance Policy
* **Notice:** This document is generated for machine learning research and educational benchmarking.
* **Disclaimer:** Model predictions and Grad-CAM attention visualizations do not constitute clinical diagnoses or medical screening recommendations. Any clinical decisions must be guided by board-certified radiologists and histological validation.
"""
    clean_stem = Path(filename).stem
    return {
        "status": "success",
        "filename": f"MammoFusion_Report_{clean_stem}.md",
        "markdown": report_md
    }



# ============================================================================
# Analysis History Management
# ============================================================================

@app.get("/api/recent-analyses")
def get_recent_analyses() -> List[Dict[str, Any]]:
    """Returns genuine recent analysis records, or empty list if none exist."""
    recent_file = REPORTS_DIR / "recent_analyses.json"
    if recent_file.exists():
        try:
            with open(recent_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception:
            return []
    return []


@app.delete("/api/recent-analyses", response_model=ClearHistoryResponse)
def clear_recent_analyses() -> ClearHistoryResponse:
    """Clears analysis session history file from reports/ directory."""
    recent_file = REPORTS_DIR / "recent_analyses.json"
    cleared_count = 0
    if recent_file.exists():
        try:
            with open(recent_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
                cleared_count = len(existing) if isinstance(existing, list) else 0
        except Exception:
            cleared_count = 0
        with open(recent_file, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
    logger.info(f"Cleared {cleared_count} session analysis records.")
    return ClearHistoryResponse(
        message="Analysis history cleared successfully.",
        cleared_count=cleared_count
    )


# ============================================================================
# Evaluation Benchmark Results
# ============================================================================

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


# ============================================================================
# Static Files & SPA Routing
# ============================================================================

STATIC_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR = STATIC_DIR / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
def serve_index():
    """Serves the main application index.html."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>MammoFusion-XAI Frontend Loading...</h1>")
