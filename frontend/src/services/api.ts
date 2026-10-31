/**
 * Typed API Service for MammoFusion-XAI Risk
 * Connects exclusively to real FastAPI backend endpoints.
 */

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
}

export interface ModalityReadinessDetail {
  ready: boolean;
  model_architecture: string;
  checkpoint: string | null;
  target_layer: string | null;
  num_classes: number;
  classes: string[];
  device: string;
}

export interface ModelReadinessResponse {
  mammogram: ModalityReadinessDetail;
  thermal: ModalityReadinessDetail;
  all_ready: boolean;
}

export interface SystemStatus {
  project: string;
  milestones: {
    milestone_1_ingestion: string;
    milestone_2_preprocessing: string;
    milestone_3_modeling: string;
  };
  disk: {
    free_gb: number;
    total_gb: number;
    drive: string;
  };
  scientific_policy: string;
}

export interface DatasetStats {
  project?: string;
  milestone?: string;
  total_images_across_modalities: number;
  total_storage_used_bytes?: number;
  total_storage_used_mb?: number;
  total_storage_used_gb?: number;
  mammogram: {
    modality: string;
    total_images: number;
    readable_images: number;
    corrupt_images?: number;
    unique_patients_identified: number;
    label_distribution?: Record<string, number>;
    resolution_distribution?: Record<string, number>;
  };
  thermal: {
    modality: string;
    total_images: number;
    readable_images: number;
    corrupt_images?: number;
    unique_patients_identified: number;
    label_distribution?: Record<string, number>;
    resolution_distribution?: Record<string, number>;
  };
}

export interface ModelStatus {
  models_available: string[];
  models_loaded?: string[];
  is_ready_for_inference: boolean;
  status_message: string;
  milestone_stage: string;
}

export interface SampleItem {
  id: string;
  modality: 'mammogram' | 'thermal';
  filename: string;
  label: string;
  patient_id: string;
  view: string;
  tissue?: string;
  description: string;
}

export interface ManifestRecord {
  relative_path: string;
  modality: string;
  dataset: string;
  filename: string;
  patient_id: string;
  label: string;
  image_width?: string;
  image_height?: string;
  file_type?: string;
  background_tissue?: string;
  view?: string;
  validation_status?: string;
  severity?: string;
}

export interface ManifestResponse {
  total: number;
  returned: number;
  records: ManifestRecord[];
}

export interface AnalysisResponse {
  status: string;
  modality: string;
  filename: string;
  dimensions: { width: number; height: number };
  color_mode: string;
  format: string;
  inference_ready: boolean;
  predicted_class?: 'normal' | 'benign' | 'malignant' | string;
  confidence?: number;
  probabilities?: {
    normal?: number;
    benign?: number;
    malignant?: number;
    [key: string]: number | undefined;
  };
  gradcam_url?: string;
  model_architecture?: string;
  message: string;
  recommendation: string;
}

export interface ClearHistoryResponse {
  message: string;
  cleared_count: number;
}

export interface EvaluationBenchmark {
  status?: string;
  mammogram?: {
    test_metrics: {
      overall_accuracy: number;
      macro_f1: number;
      macro_sensitivity_recall: number;
      macro_specificity: number;
      macro_roc_auc: number;
      per_class: Record<string, any>;
      confusion_matrix: number[][];
    };
    test_samples: number;
    train_samples: number;
    val_samples: number;
  };
  thermal?: {
    test_metrics: {
      overall_accuracy: number;
      macro_f1: number;
      macro_sensitivity_recall: number;
      macro_specificity: number;
      macro_roc_auc: number;
      per_class: Record<string, any>;
      confusion_matrix: number[][];
    };
    test_samples: number;
    train_samples: number;
    val_samples: number;
  };
}

const API_BASE = '';

export async function fetchHealthCheck(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health HTTP error: ${res.status}`);
  return res.json();
}

export async function fetchModelReadiness(): Promise<ModelReadinessResponse> {
  const res = await fetch(`${API_BASE}/api/models/readiness`);
  if (!res.ok) throw new Error(`Model readiness HTTP error: ${res.status}`);
  return res.json();
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/api/status`);
  if (!res.ok) throw new Error(`Status HTTP error: ${res.status}`);
  return res.json();
}

export async function fetchDatasetStats(): Promise<DatasetStats> {
  const res = await fetch(`${API_BASE}/api/datasets`);
  if (!res.ok) throw new Error(`Dataset HTTP error: ${res.status}`);
  return res.json();
}

export async function fetchModelStatus(): Promise<ModelStatus> {
  const res = await fetch(`${API_BASE}/api/models`);
  if (!res.ok) throw new Error(`Model HTTP error: ${res.status}`);
  return res.json();
}

export async function fetchSamples(): Promise<SampleItem[]> {
  const res = await fetch(`${API_BASE}/api/samples`);
  if (!res.ok) throw new Error(`Samples HTTP error: ${res.status}`);
  return res.json();
}

export async function fetchManifestRecords(
  modality: string = 'all',
  limit: number = 100,
  search: string = ''
): Promise<ManifestResponse> {
  const params = new URLSearchParams({
    modality,
    limit: limit.toString(),
    search
  });
  const res = await fetch(`${API_BASE}/api/manifests/records?${params.toString()}`);
  if (!res.ok) throw new Error(`Manifest records HTTP error: ${res.status}`);
  return res.json();
}

export async function submitImageAnalysis(
  file: File,
  modality: 'mammogram' | 'thermal'
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('modality', modality);

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    let errorDetail = `Analysis submission failed: ${res.status}`;
    try {
      const errorJson = await res.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch (_) {
      // Use fallback
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export async function fetchRecentAnalyses(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/recent-analyses`);
  if (!res.ok) return [];
  return res.json();
}

export async function clearRecentAnalyses(): Promise<ClearHistoryResponse> {
  const res = await fetch(`${API_BASE}/api/recent-analyses`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Failed to clear analyses: ${res.status}`);
  return res.json();
}

export function getSampleImageUrl(modality: string, filename: string): string {
  return `${API_BASE}/api/sample-image/${modality}/${filename}`;
}

export async function fetchEvaluationBenchmark(): Promise<EvaluationBenchmark | null> {
  const res = await fetch(`${API_BASE}/api/evaluation`);
  if (!res.ok) return null;
  return res.json();
}
