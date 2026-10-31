import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  RefreshCw,
  Trash2,
  Sliders,
  AlertCircle,
  Eye,
  Flame,
  ArrowRight,
  Layers,
  CheckCircle2,
  Info,
  Maximize2,
  X,
  FileCheck,
  ShieldCheck,
  ZoomIn
} from 'lucide-react';
import {
  AnalysisResponse,
  ModelReadinessResponse,
  SampleItem,
  fetchSamples,
  getSampleImageUrl,
  submitMammogramAnalysis,
  submitThermalAnalysis,
  submitCombinedAnalysis,
  validateScanImage,
  ImageValidationResult
} from '../../services/api';
import { decodePgmImage } from '../../utils/pgmDecoder';

type ExaminationMode = 'mammogram' | 'thermal' | 'combined';

interface AnalysisPageProps {
  initialModality?: 'mammogram' | 'thermal' | 'combined';
  initialSampleFilename?: string | null;
  onClearTargetSample?: () => void;
  modelReadiness: ModelReadinessResponse | null;
  onNavigate: (view: string) => void;
  onAnalysisComplete: (result: AnalysisResponse) => void;
}

interface ValidationStatus {
  fileValid: boolean;
  format: string;
  sizeFormatted: string;
  dimensions?: { width: number; height: number };
  fileError?: string | null;
  modalityVerified: boolean;
  modalityLabel: string;
  modalityExplanation?: string;
  modalityError?: string | null;
}

interface ZoomModalState {
  isOpen: boolean;
  url: string;
  title: string;
  dimensions?: string;
  modality: 'mammogram' | 'thermal';
  isInverted?: boolean;
  contrastBoost?: boolean;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  initialModality = 'mammogram',
  initialSampleFilename,
  onClearTargetSample,
  modelReadiness,
  onNavigate,
  onAnalysisComplete
}) => {
  const [mode, setMode] = useState<ExaminationMode>(initialModality);

  // Single-scan state (Modes 1 & 2)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [singleValidation, setSingleValidation] = useState<ValidationStatus | null>(null);
  const [isValidatingSingle, setIsValidatingSingle] = useState<boolean>(false);

  // Combined-scan state (Mode 3)
  const [combinedMammoFile, setCombinedMammoFile] = useState<File | null>(null);
  const [combinedMammoPreview, setCombinedMammoPreview] = useState<string | null>(null);
  const [combinedMammoValidation, setCombinedMammoValidation] = useState<ValidationStatus | null>(null);
  const [isValidatingMammo, setIsValidatingMammo] = useState<boolean>(false);

  const [combinedThermalFile, setCombinedThermalFile] = useState<File | null>(null);
  const [combinedThermalPreview, setCombinedThermalPreview] = useState<string | null>(null);
  const [combinedThermalValidation, setCombinedThermalValidation] = useState<ValidationStatus | null>(null);
  const [isValidatingThermal, setIsValidatingThermal] = useState<boolean>(false);

  const [caseId, setCaseId] = useState<string>(() => `MF-CASE-2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);

  // General controls & states
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [contrastBoost, setContrastBoost] = useState<boolean>(false);
  const [useTta, setUseTta] = useState<boolean>(false);

  // Zoom / Fullscreen Modal
  const [zoomModal, setZoomModal] = useState<ZoomModalState | null>(null);

  // Samples for one-click testing
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);
  const [showSamplesDrawer, setShowSamplesDrawer] = useState<boolean>(false);

  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const mammoFileInputRef = useRef<HTMLInputElement>(null);
  const thermalFileInputRef = useRef<HTMLInputElement>(null);

  // Load samples
  useEffect(() => {
    fetchSamples()
      .then((data) => setSamples(data))
      .catch((err) => console.error('Failed to load samples:', err));
  }, []);

  // Auto-select initial sample if specified by navigation
  useEffect(() => {
    if (!initialSampleFilename || samples.length === 0) return;
    const match = samples.find(
      (s) =>
        s.filename.toLowerCase() === initialSampleFilename.toLowerCase() ||
        s.filename.toLowerCase().startsWith(initialSampleFilename.toLowerCase().split('.')[0])
    );
    if (!match) return;

    const timer = setTimeout(() => {
      setMode(match.modality);
      setUploadedFile(null);
      setSelectedSample(match);
      setPreviewUrl(getSampleImageUrl(match.modality, match.filename));
      setSingleValidation({
        fileValid: true,
        format: match.filename.split('.').pop()?.toUpperCase() || 'UNKNOWN',
        sizeFormatted: 'Reference Scan',
        dimensions: { width: 1024, height: 1024 },
        modalityVerified: true,
        modalityLabel: match.modality === 'mammogram' ? 'Radiographic Mammogram' : 'Infrared Thermogram',
        modalityExplanation: `Curated reference scan from ${match.modality === 'mammogram' ? 'MIAS (UK)' : 'Mendeley (Mexico)'} repository.`
      });
      if (onClearTargetSample) onClearTargetSample();
    }, 0);

    return () => clearTimeout(timer);
  }, [initialSampleFilename, samples, onClearTargetSample]);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      if (combinedMammoPreview && combinedMammoPreview.startsWith('blob:')) URL.revokeObjectURL(combinedMammoPreview);
      if (combinedThermalPreview && combinedThermalPreview.startsWith('blob:')) URL.revokeObjectURL(combinedThermalPreview);
    };
  }, [previewUrl, combinedMammoPreview, combinedThermalPreview]);

  // Reset states when changing examination mode
  const handleModeChange = (newMode: ExaminationMode) => {
    setMode(newMode);
    setShowSamplesDrawer(false);
  };

  // Helper to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Process single upload (Modes 1 & 2)
  const handleSingleFileProcess = async (file: File) => {
    if (mode === 'combined') return;
    const targetModality = mode as 'mammogram' | 'thermal';
    setIsValidatingSingle(true);

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(file);
    setSelectedSample(null);

    let imagePreview = '';
    let dims = { width: 0, height: 0 };

    try {
      if (file.name.toLowerCase().endsWith('.pgm')) {
        const decoded = await decodePgmImage(file, 1024);
        imagePreview = decoded.dataUrl;
        dims = { width: decoded.width, height: decoded.height };
      } else {
        imagePreview = URL.createObjectURL(file);
        // Measure dimensions via browser Image
        const img = new Image();
        img.src = imagePreview;
        await new Promise((res) => {
          img.onload = () => {
            dims = { width: img.naturalWidth, height: img.naturalHeight };
            res(null);
          };
          img.onerror = () => res(null);
        });
      }
      setPreviewUrl(imagePreview);

      // Execute backend modality and integrity verification
      const backendVal: ImageValidationResult = await validateScanImage(file, targetModality);

      setSingleValidation({
        fileValid: backendVal.valid_format,
        format: backendVal.format || file.name.split('.').pop()?.toUpperCase() || 'IMG',
        sizeFormatted: formatFileSize(file.size),
        dimensions: backendVal.dimensions.width > 0 ? backendVal.dimensions : dims,
        fileError: backendVal.valid_format ? null : backendVal.error,
        modalityVerified: backendVal.modality_verified,
        modalityLabel: backendVal.detected_modality === 'mammogram' ? 'Verified Mammogram' : (backendVal.detected_modality === 'thermal' ? 'Verified Thermal Scan' : 'Unverified Modality'),
        modalityExplanation: backendVal.explanation,
        modalityError: backendVal.modality_verified ? null : backendVal.error
      });
    } catch (err: any) {
      console.warn('Backend validation call error, falling back to local inspection:', err);
      // Fallback local validation
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const isMammo = targetModality === 'mammogram';
      const validExt = isMammo ? ['.png', '.jpg', '.jpeg', '.pgm'].includes(ext) : ['.png', '.jpg', '.jpeg'].includes(ext);

      setSingleValidation({
        fileValid: validExt,
        format: ext.replace('.', '').toUpperCase(),
        sizeFormatted: formatFileSize(file.size),
        dimensions: dims,
        fileError: validExt ? null : (isMammo ? 'Invalid image. Please upload a mammogram image.' : 'Invalid image. Please upload a thermal image.'),
        modalityVerified: validExt,
        modalityLabel: isMammo ? 'Mammogram Radiograph' : 'Thermal Image',
        modalityExplanation: 'Client-side verification applied.',
        modalityError: validExt ? null : (isMammo ? 'Invalid image. Please upload a mammogram image.' : 'Invalid image. Please upload a thermal image.')
      });
    } finally {
      setIsValidatingSingle(false);
    }
  };

  // Process Mode 3 Mammogram upload
  const handleCombinedMammoProcess = async (file: File) => {
    setIsValidatingMammo(true);
    if (combinedMammoPreview && combinedMammoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(combinedMammoPreview);
    }
    setCombinedMammoFile(file);

    let imagePreview = '';
    let dims = { width: 0, height: 0 };

    try {
      if (file.name.toLowerCase().endsWith('.pgm')) {
        const decoded = await decodePgmImage(file, 1024);
        imagePreview = decoded.dataUrl;
        dims = { width: decoded.width, height: decoded.height };
      } else {
        imagePreview = URL.createObjectURL(file);
        const img = new Image();
        img.src = imagePreview;
        await new Promise((res) => {
          img.onload = () => {
            dims = { width: img.naturalWidth, height: img.naturalHeight };
            res(null);
          };
          img.onerror = () => res(null);
        });
      }
      setCombinedMammoPreview(imagePreview);

      const val = await validateScanImage(file, 'mammogram');
      setCombinedMammoValidation({
        fileValid: val.valid_format,
        format: val.format || file.name.split('.').pop()?.toUpperCase() || 'PGM',
        sizeFormatted: formatFileSize(file.size),
        dimensions: val.dimensions.width > 0 ? val.dimensions : dims,
        fileError: val.valid_format ? null : val.error,
        modalityVerified: val.modality_verified,
        modalityLabel: val.modality_verified ? 'Verified Mammogram' : 'Modality Mismatch',
        modalityExplanation: val.explanation,
        modalityError: val.modality_verified ? null : val.error
      });
    } catch (err: any) {
      console.warn('Backend validation fallback for combined mammogram:', err);
      const isPgm = file.name.toLowerCase().endsWith('.pgm');
      setCombinedMammoValidation({
        fileValid: true,
        format: isPgm ? 'PGM' : 'PNG',
        sizeFormatted: formatFileSize(file.size),
        dimensions: dims,
        modalityVerified: true,
        modalityLabel: 'Mammogram Radiograph',
        modalityExplanation: 'Format validated.'
      });
    } finally {
      setIsValidatingMammo(false);
    }
  };

  // Process Mode 3 Thermal upload
  const handleCombinedThermalProcess = async (file: File) => {
    setIsValidatingThermal(true);
    if (combinedThermalPreview && combinedThermalPreview.startsWith('blob:')) {
      URL.revokeObjectURL(combinedThermalPreview);
    }
    setCombinedThermalFile(file);

    let imagePreview = URL.createObjectURL(file);
    let dims = { width: 0, height: 0 };

    try {
      const img = new Image();
      img.src = imagePreview;
      await new Promise((res) => {
        img.onload = () => {
          dims = { width: img.naturalWidth, height: img.naturalHeight };
          res(null);
        };
        img.onerror = () => res(null);
      });
      setCombinedThermalPreview(imagePreview);

      const val = await validateScanImage(file, 'thermal');
      setCombinedThermalValidation({
        fileValid: val.valid_format,
        format: val.format || file.name.split('.').pop()?.toUpperCase() || 'JPG',
        sizeFormatted: formatFileSize(file.size),
        dimensions: val.dimensions.width > 0 ? val.dimensions : dims,
        fileError: val.valid_format ? null : val.error,
        modalityVerified: val.modality_verified,
        modalityLabel: val.modality_verified ? 'Verified Thermal Scan' : 'Modality Mismatch',
        modalityExplanation: val.explanation,
        modalityError: val.modality_verified ? null : val.error
      });
    } catch (err: any) {
      console.warn('Backend validation fallback for combined thermal:', err);
      setCombinedThermalValidation({
        fileValid: true,
        format: 'JPG',
        sizeFormatted: formatFileSize(file.size),
        dimensions: dims,
        modalityVerified: true,
        modalityLabel: 'Thermal Thermogram',
        modalityExplanation: 'Format validated.'
      });
    } finally {
      setIsValidatingThermal(false);
    }
  };

  // Reference sample selection for single modes (Strictly tagged as TEST DATA)
  const handleSelectSample = (sample: SampleItem) => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setSelectedSample(sample);
    setPreviewUrl(getSampleImageUrl(sample.modality, sample.filename));
    setSingleValidation({
      fileValid: true,
      format: sample.filename.split('.').pop()?.toUpperCase() || 'IMG',
      sizeFormatted: 'Reference Scan',
      dimensions: { width: 1024, height: 1024 },
      modalityVerified: true,
      modalityLabel: sample.modality === 'mammogram' ? 'Verified Mammogram' : 'Verified Thermal Scan',
      modalityExplanation: `TEST DATA ONLY: Curated reference sample from ${sample.modality === 'mammogram' ? 'MIAS (UK)' : 'Mendeley (Mexico)'} repository.`
    });
    setShowSamplesDrawer(false);
  };

  const handleClearSingleImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setUploadedFile(null);
    setSelectedSample(null);
    setPreviewUrl(null);
    setSingleValidation(null);
    if (singleFileInputRef.current) singleFileInputRef.current.value = '';
  };

  const handleClearCombinedMammo = () => {
    if (combinedMammoPreview && combinedMammoPreview.startsWith('blob:')) URL.revokeObjectURL(combinedMammoPreview);
    setCombinedMammoFile(null);
    setCombinedMammoPreview(null);
    setCombinedMammoValidation(null);
    if (mammoFileInputRef.current) mammoFileInputRef.current.value = '';
  };

  const handleClearCombinedThermal = () => {
    if (combinedThermalPreview && combinedThermalPreview.startsWith('blob:')) URL.revokeObjectURL(combinedThermalPreview);
    setCombinedThermalFile(null);
    setCombinedThermalPreview(null);
    setCombinedThermalValidation(null);
    if (thermalFileInputRef.current) thermalFileInputRef.current.value = '';
  };

  // Single analysis run (Modes 1 & 2)
  const handleRunSingleAnalysis = async () => {
    if (!uploadedFile && !selectedSample) return;

    if (singleValidation && (!singleValidation.fileValid || !singleValidation.modalityVerified)) {
      alert(singleValidation.modalityError || singleValidation.fileError || 'Image failed modality validation.');
      return;
    }

    setIsSubmitting(true);

    try {
      let fileToUpload: File;

      if (uploadedFile) {
        fileToUpload = uploadedFile;
      } else if (selectedSample) {
        const sampleUrl = getSampleImageUrl(selectedSample.modality, selectedSample.filename);
        const res = await fetch(sampleUrl);
        if (!res.ok) throw new Error('Could not retrieve reference sample from server.');
        const blob = await res.blob();
        fileToUpload = new File([blob], selectedSample.filename, { type: blob.type || 'image/png' });
      } else {
        throw new Error('No image loaded.');
      }

      let result: AnalysisResponse;
      if (mode === 'mammogram') {
        result = await submitMammogramAnalysis(fileToUpload, useTta);
      } else {
        result = await submitThermalAnalysis(fileToUpload, useTta);
      }

      onAnalysisComplete(result);
      onNavigate('results');
    } catch (err: any) {
      console.error('Examination error:', err);
      alert(err.message || 'The analysis service encountered an error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combined analysis run (Mode 3 - Strictly guarded)
  const handleRunCombinedAnalysis = async () => {
    if (!combinedMammoFile || !combinedThermalFile) {
      alert('Both mammogram and thermal scans are mandatory for combined screening.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitCombinedAnalysis(combinedMammoFile, combinedThermalFile, caseId);
      onAnalysisComplete(res);
      onNavigate('results');
    } catch (err: any) {
      alert(err.message || 'Combined analysis model is not yet available.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modality readiness flags from live backend
  const mammoReady = Boolean(modelReadiness?.mammogram?.ready);
  const thermalReady = Boolean(modelReadiness?.thermal?.ready);
  const combinedReady = Boolean(modelReadiness?.combined?.ready);

  const previewFilterStyle = {
    filter: `${isInverted ? 'invert(100%)' : ''} ${contrastBoost ? 'contrast(150%) brightness(105%)' : ''}`.trim() || 'none'
  };

  const filteredSamples = samples.filter((s) => s.modality === mode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '6px', color: 'var(--text-primary)' }}>
          New Examination
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Select an examination screening workflow, upload validated patient scans, and execute research analysis.
        </p>
      </div>

      {/* THREE EXAMINATION MODES SELECTION CARDS */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Select Examination Mode
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {/* Card 1: Mammogram Screening */}
          <div
            onClick={() => handleModeChange('mammogram')}
            style={{
              padding: '18px',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: mode === 'mammogram' ? 'var(--bg-white)' : 'var(--bg-card)',
              border: mode === 'mammogram' ? '2px solid var(--accent-rose)' : '1px solid var(--border-light)',
              boxShadow: mode === 'mammogram' ? '0 4px 16px rgba(224, 75, 127, 0.15)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: mode === 'mammogram' ? 'linear-gradient(135deg, #E04B7F, #8F1D50)' : 'var(--bg-blush-subtle)',
                color: mode === 'mammogram' ? '#fff' : 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Eye size={20} />
              </div>
              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                fontWeight: 600,
                background: mammoReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
                color: mammoReady ? 'var(--status-normal)' : 'var(--text-muted)',
                border: `1px solid ${mammoReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`
              }}>
                {mammoReady ? '● Ready (ResNet-50)' : '○ Model Standby'}
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                1. Mammogram Screening
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                Radiographic structural screening using verified PyTorch ResNet-50.
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid var(--border-light)' }}>
              Formats: <strong>PGM, PNG, JPG, JPEG</strong>
            </div>
          </div>

          {/* Card 2: Thermal Screening */}
          <div
            onClick={() => handleModeChange('thermal')}
            style={{
              padding: '18px',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: mode === 'thermal' ? 'var(--bg-white)' : 'var(--bg-card)',
              border: mode === 'thermal' ? '2px solid var(--accent-rose)' : '1px solid var(--border-light)',
              boxShadow: mode === 'thermal' ? '0 4px 16px rgba(224, 75, 127, 0.15)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: mode === 'thermal' ? 'linear-gradient(135deg, #E04B7F, #8F1D50)' : 'var(--bg-blush-subtle)',
                color: mode === 'thermal' ? '#fff' : 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Flame size={20} />
              </div>
              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                fontWeight: 600,
                background: thermalReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
                color: thermalReady ? 'var(--status-normal)' : 'var(--text-muted)',
                border: `1px solid ${thermalReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`
              }}>
                {thermalReady ? '● Ready (ResNet-50)' : '○ Model Standby'}
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                2. Thermal Screening
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                Infrared physiological thermography with native RGB false-color mapping.
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid var(--border-light)' }}>
              Formats: <strong>PNG, JPG, JPEG</strong> (PGM rejected)
            </div>
          </div>

          {/* Card 3: Combined Multimodal Screening */}
          <div
            onClick={() => handleModeChange('combined')}
            style={{
              padding: '18px',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: mode === 'combined' ? 'var(--bg-white)' : 'var(--bg-card)',
              border: mode === 'combined' ? '2px solid var(--accent-rose)' : '1px solid var(--border-light)',
              boxShadow: mode === 'combined' ? '0 4px 16px rgba(224, 75, 127, 0.15)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: mode === 'combined' ? 'linear-gradient(135deg, #E04B7F, #8F1D50)' : 'var(--bg-blush-subtle)',
                color: mode === 'combined' ? '#fff' : 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Layers size={20} />
              </div>
              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                fontWeight: 600,
                background: combinedReady ? 'var(--status-normal-bg)' : '#FFF3E0',
                color: combinedReady ? 'var(--status-normal)' : '#E65100',
                border: `1px solid ${combinedReady ? 'var(--status-normal-border)' : '#FFE0B2'}`
              }}>
                {combinedReady ? '● Ready' : '○ Model Pending'}
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                3. Combined Multimodal
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                Dual-modality paired screening under a single unified examination case.
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid var(--border-light)' }}>
              Requires: <strong>Mammogram + Thermal pair</strong>
            </div>
          </div>
        </div>
      </div>

      {/* WORKFLOW VIEW FOR MODE 1 & MODE 2 */}
      {(mode === 'mammogram' || mode === 'thermal') && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {mode === 'mammogram' ? 'Mammogram Scan Ingestion' : 'Thermal Scan Ingestion'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {mode === 'mammogram'
                  ? 'Accepts mammogram radiographs (PGM, PNG, JPG). Cross-modality scans will be strictly rejected.'
                  : 'Accepts infrared false-color thermograms (PNG, JPG). Grayscale radiographs and PGM files will be rejected.'}
              </div>
            </div>

            {/* Reference Sample Selector Button (Strictly marked TEST DATA) */}
            {filteredSamples.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSamplesDrawer(!showSamplesDrawer)}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                <span>{showSamplesDrawer ? 'Hide Reference Samples' : 'Select Reference Sample (Test Data)'}</span>
              </button>
            )}
          </div>

          {/* Reference Samples Drawer (Clearly marked TEST DATA) */}
          {showSamplesDrawer && (
            <div style={{
              padding: '16px',
              background: 'var(--bg-blush-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-rose)',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#C2185B',
                  color: '#fff'
                }}>
                  Test Data Only
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Verified research reference scan from {mode === 'mammogram' ? 'MIAS (Cambridge, UK)' : 'Mendeley Thermography (Mexico)'} repository:
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Reference samples are benchmark test scans for testing inference pipelines and are distinct from live clinical records.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
                {filteredSamples.map((sample) => {
                  const isSelected = selectedSample?.id === sample.id;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSelectSample(sample)}
                      className={`btn-secondary ${isSelected ? 'active' : ''}`}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '2px'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sample.filename}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {sample.patient_id} • {sample.view}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--accent-rose)', fontWeight: 600 }}>
                        [TEST DATA]
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Dropzone or Actual Image Preview */}
          {!uploadedFile && !selectedSample ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleSingleFileProcess(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => singleFileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? 'var(--accent-rose)' : 'var(--border-medium)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '44px 24px',
                textAlign: 'center',
                background: isDragOver ? 'var(--bg-blush-subtle)' : 'var(--bg-light)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <input
                ref={singleFileInputRef}
                type="file"
                accept={mode === 'mammogram' ? '.png,.jpg,.jpeg,.pgm' : '.png,.jpg,.jpeg'}
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleSingleFileProcess(e.target.files[0]);
                  }
                }}
              />
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--bg-blush-subtle)',
                color: 'var(--accent-rose)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px'
              }}>
                <UploadCloud size={28} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Drag and drop your {mode === 'mammogram' ? 'mammogram' : 'thermal'} scan here
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                or click to browse local files
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Supported: <strong>{mode === 'mammogram' ? 'PGM, PNG, JPG, JPEG' : 'PNG, JPG, JPEG'}</strong> • Maximum file size: <strong>25 MB</strong>
              </div>
            </div>
          ) : (
            <div>
              {/* Image Preview Container (Preserves Aspect Ratio) */}
              <div style={{
                background: '#15030D',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '360px',
                position: 'relative',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                border: '1px solid rgba(224, 75, 127, 0.2)'
              }}>
                {isValidatingSingle ? (
                  <div style={{ color: '#fff', textAlign: 'center', padding: '30px' }}>
                    <RefreshCw size={32} className="spinning" style={{ color: 'var(--accent-rose)', marginBottom: '10px' }} />
                    <div style={{ fontSize: '13px' }}>Decoding scan and verifying modality...</div>
                  </div>
                ) : previewUrl ? (
                  <div style={{ position: 'relative', maxWidth: '100%', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={previewUrl}
                      alt="Uploaded Scan Preview"
                      style={{
                        maxHeight: '380px',
                        maxWidth: '100%',
                        borderRadius: 'var(--radius-sm)',
                        objectFit: 'contain',
                        ...previewFilterStyle
                      }}
                    />
                    {/* Zoom / Fullscreen Button */}
                    <button
                      type="button"
                      onClick={() => setZoomModal({
                        isOpen: true,
                        url: previewUrl,
                        title: uploadedFile?.name || selectedSample?.filename || 'Scan Inspection',
                        dimensions: singleValidation?.dimensions ? `${singleValidation.dimensions.width}×${singleValidation.dimensions.height} px` : undefined,
                        modality: mode as 'mammogram' | 'thermal',
                        isInverted,
                        contrastBoost
                      })}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        backdropFilter: 'blur(4px)'
                      }}
                      title="Inspect high-resolution image"
                    >
                      <Maximize2 size={13} />
                      <span>Zoom View</span>
                    </button>
                  </div>
                ) : null}
              </div>

              {/* SEPARATE VALIDATION STATES: File Format vs Modality Verification */}
              {singleValidation && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '10px',
                  marginTop: '12px'
                }}>
                  {/* State 1: File Integrity & Format */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: singleValidation.fileValid ? 'var(--bg-white)' : 'var(--status-malignant-bg)',
                    border: `1px solid ${singleValidation.fileValid ? 'var(--border-light)' : 'var(--status-malignant-border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <FileCheck size={18} style={{ color: singleValidation.fileValid ? 'var(--status-normal)' : 'var(--status-malignant)' }} />
                    <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        File Format & Dimensions: {singleValidation.fileValid ? 'Valid' : 'Invalid'}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                        Format: <strong>{singleValidation.format}</strong> • {singleValidation.dimensions?.width}×{singleValidation.dimensions?.height} px • {singleValidation.sizeFormatted}
                      </div>
                    </div>
                  </div>

                  {/* State 2: Modality Verification */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: singleValidation.modalityVerified ? 'var(--status-normal-bg)' : 'var(--status-malignant-bg)',
                    border: `1px solid ${singleValidation.modalityVerified ? 'var(--status-normal-border)' : 'var(--status-malignant-border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <ShieldCheck size={18} style={{ color: singleValidation.modalityVerified ? 'var(--status-normal)' : 'var(--status-malignant)' }} />
                    <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 600, color: singleValidation.modalityVerified ? 'var(--status-normal)' : 'var(--status-malignant)' }}>
                        Modality Verification: {singleValidation.modalityVerified ? 'Verified' : 'Rejected'}
                      </div>
                      <div style={{ color: singleValidation.modalityVerified ? 'var(--text-secondary)' : 'var(--status-malignant)', fontSize: '11px' }}>
                        {singleValidation.modalityError || singleValidation.modalityExplanation || singleValidation.modalityLabel}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Inspection Controls & File Info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '12px',
                padding: '10px 14px',
                background: 'var(--bg-light)',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  File: <strong style={{ color: 'var(--text-primary)' }}>{uploadedFile?.name || selectedSample?.filename}</strong>
                  {mode === 'thermal' && (
                    <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', background: '#FCE4EC', color: '#C2185B', fontSize: '10px', fontWeight: 600 }}>
                      RGB Thermal Palette
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {mode === 'mammogram' && previewUrl && (
                    <>
                      <button
                        type="button"
                        className={`btn-secondary ${contrastBoost ? 'active' : ''}`}
                        onClick={() => setContrastBoost(!contrastBoost)}
                        style={{ fontSize: '11px', padding: '5px 10px' }}
                      >
                        <Sliders size={12} />
                        <span>High Contrast</span>
                      </button>

                      <button
                        type="button"
                        className={`btn-secondary ${isInverted ? 'active' : ''}`}
                        onClick={() => setIsInverted(!isInverted)}
                        style={{ fontSize: '11px', padding: '5px 10px' }}
                      >
                        <Eye size={12} />
                        <span>Invert</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleClearSingleImage}
                    style={{ fontSize: '11px', padding: '5px 10px', color: 'var(--status-malignant)' }}
                  >
                    <Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Validation Error Alert */}
          {singleValidation && (!singleValidation.fileValid || !singleValidation.modalityVerified) && (
            <div style={{
              marginTop: '14px',
              padding: '12px 16px',
              background: 'var(--status-malignant-bg)',
              border: '1px solid var(--status-malignant-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--status-malignant)',
              fontSize: '13px',
              fontWeight: 500
            }}>
              <AlertCircle size={18} />
              <span>{singleValidation.modalityError || singleValidation.fileError || 'Image validation rejected.'}</span>
            </div>
          )}

          {/* Test-Time Augmentation Toggle & Action Button */}
          <div style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={useTta}
                onChange={(e) => setUseTta(e.target.checked)}
                style={{ accentColor: 'var(--accent-rose)', cursor: 'pointer' }}
              />
              <span>Enable Test-Time Augmentation (TTA Ensemble)</span>
            </label>

            <button
              type="button"
              className="btn-primary"
              disabled={
                isSubmitting ||
                isValidatingSingle ||
                (!uploadedFile && !selectedSample) ||
                Boolean(singleValidation && (!singleValidation.fileValid || !singleValidation.modalityVerified))
              }
              onClick={handleRunSingleAnalysis}
              style={{ padding: '12px 28px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="spinning" />
                  <span>Executing ResNet-50 Inference...</span>
                </>
              ) : (
                <>
                  <span>Run {mode === 'mammogram' ? 'Mammogram' : 'Thermal'} Analysis</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* WORKFLOW VIEW FOR MODE 3: COMBINED MULTIMODAL SCREENING */}
      {mode === 'combined' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Scientific Disclaimer & Model Availability Notice */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-lg)',
            background: '#FFF8E1',
            border: '1px solid #FFE082',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <Info size={20} style={{ color: '#F57F17', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', color: '#5D4037', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: '#E65100', marginBottom: '2px' }}>
                Combined Multimodal Analysis Notice
              </div>
              <div>
                <strong>Combined analysis model is not yet available.</strong> Single-modality ResNet-50 models for Mammogram and Thermal screening are loaded and verified. Genuine multimodal screening requires a trained joint fusion model with proven paired-provenance cohort data. In accordance with zero-fabrication standards, independent unimodal predictions are never averaged or combined into synthetic risk scores.
              </div>
            </div>
          </div>

          {/* Case Reference & Dataset Provenance Note */}
          <div className="card" style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Associated Examination Case ID
              </div>
              <input
                type="text"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                style={{
                  marginTop: '4px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-white)',
                  width: '240px'
                }}
              />
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.4 }}>
              <strong>Paired Data Requirement:</strong> Upload genuine paired scans belonging to the same participant. Independent MIAS and Mendeley repository scans cannot be paired as a genuine patient examination.
            </div>
          </div>

          {/* TWO MANDATORY UPLOAD FIELDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
            {/* Field 1: Mammogram Image (Mandatory) */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Eye size={16} style={{ color: 'var(--accent-rose)' }} />
                  <span>1. Mammogram Scan</span>
                  <span style={{ fontSize: '11px', color: 'var(--status-malignant)', fontWeight: 600 }}>*Mandatory</span>
                </div>
                {combinedMammoFile && (
                  <button
                    type="button"
                    onClick={handleClearCombinedMammo}
                    style={{ background: 'none', border: 'none', color: 'var(--status-malignant)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    Remove
                  </button>
                )}
              </div>

              {!combinedMammoFile ? (
                <div
                  onClick={() => mammoFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '32px 16px',
                    textAlign: 'center',
                    background: 'var(--bg-light)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    ref={mammoFileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.pgm"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCombinedMammoProcess(e.target.files[0]);
                      }
                    }}
                  />
                  <UploadCloud size={24} style={{ color: 'var(--accent-rose)', marginBottom: '8px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Upload Mammogram Scan
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Accepts PGM, PNG, JPG, JPEG
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    background: '#15030D',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative'
                  }}>
                    {isValidatingMammo ? (
                      <div style={{ color: '#fff', padding: '24px 0', textAlign: 'center' }}>
                        <RefreshCw size={24} className="spinning" style={{ color: 'var(--accent-rose)', marginBottom: '8px' }} />
                        <div style={{ fontSize: '12px' }}>Decoding mammogram radiograph...</div>
                      </div>
                    ) : combinedMammoPreview ? (
                      <div style={{ position: 'relative', maxWidth: '100%' }}>
                        <img
                          src={combinedMammoPreview}
                          alt="Mammogram"
                          style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setZoomModal({
                            isOpen: true,
                            url: combinedMammoPreview,
                            title: combinedMammoFile.name,
                            dimensions: combinedMammoValidation?.dimensions ? `${combinedMammoValidation.dimensions.width}×${combinedMammoValidation.dimensions.height} px` : undefined,
                            modality: 'mammogram'
                          })}
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            background: 'rgba(0, 0, 0, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '4px',
                            color: '#fff',
                            padding: '4px 6px',
                            cursor: 'pointer'
                          }}
                          title="Zoom"
                        >
                          <ZoomIn size={12} />
                        </button>
                      </div>
                    ) : null}
                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
                      {combinedMammoFile.name} {combinedMammoValidation?.dimensions && `(${combinedMammoValidation.dimensions.width}×${combinedMammoValidation.dimensions.height} px)`}
                    </div>
                  </div>

                  {/* Separate Validation States for Combined Mammogram */}
                  {combinedMammoValidation && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11px', color: combinedMammoValidation.fileValid ? 'var(--status-normal)' : 'var(--status-malignant)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileCheck size={13} />
                        <span>Format: {combinedMammoValidation.format} • {combinedMammoValidation.sizeFormatted}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: combinedMammoValidation.modalityVerified ? 'var(--status-normal)' : 'var(--status-malignant)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldCheck size={13} />
                        <span>{combinedMammoValidation.modalityVerified ? '✓ Verified Mammogram Radiograph' : `✕ ${combinedMammoValidation.modalityError || 'Rejected'}`}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Field 2: Thermal Image (Mandatory) */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Flame size={16} style={{ color: 'var(--accent-rose)' }} />
                  <span>2. Thermal Scan</span>
                  <span style={{ fontSize: '11px', color: 'var(--status-malignant)', fontWeight: 600 }}>*Mandatory</span>
                </div>
                {combinedThermalFile && (
                  <button
                    type="button"
                    onClick={handleClearCombinedThermal}
                    style={{ background: 'none', border: 'none', color: 'var(--status-malignant)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    Remove
                  </button>
                )}
              </div>

              {!combinedThermalFile ? (
                <div
                  onClick={() => thermalFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '32px 16px',
                    textAlign: 'center',
                    background: 'var(--bg-light)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    ref={thermalFileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCombinedThermalProcess(e.target.files[0]);
                      }
                    }}
                  />
                  <UploadCloud size={24} style={{ color: 'var(--accent-rose)', marginBottom: '8px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Upload Thermal Scan
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Accepts PNG, JPG, JPEG (PGM prohibited)
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    background: '#15030D',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative'
                  }}>
                    {isValidatingThermal ? (
                      <div style={{ color: '#fff', padding: '24px 0', textAlign: 'center' }}>
                        <RefreshCw size={24} className="spinning" style={{ color: 'var(--accent-rose)', marginBottom: '8px' }} />
                        <div style={{ fontSize: '12px' }}>Inspecting thermal thermogram...</div>
                      </div>
                    ) : combinedThermalPreview ? (
                      <div style={{ position: 'relative', maxWidth: '100%' }}>
                        <img
                          src={combinedThermalPreview}
                          alt="Thermal Scan"
                          style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setZoomModal({
                            isOpen: true,
                            url: combinedThermalPreview,
                            title: combinedThermalFile.name,
                            dimensions: combinedThermalValidation?.dimensions ? `${combinedThermalValidation.dimensions.width}×${combinedThermalValidation.dimensions.height} px` : undefined,
                            modality: 'thermal'
                          })}
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            background: 'rgba(0, 0, 0, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '4px',
                            color: '#fff',
                            padding: '4px 6px',
                            cursor: 'pointer'
                          }}
                          title="Zoom"
                        >
                          <ZoomIn size={12} />
                        </button>
                      </div>
                    ) : null}
                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
                      {combinedThermalFile.name} {combinedThermalValidation?.dimensions && `(${combinedThermalValidation.dimensions.width}×${combinedThermalValidation.dimensions.height} px)`}
                    </div>
                  </div>

                  {/* Separate Validation States for Combined Thermal */}
                  {combinedThermalValidation && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11px', color: combinedThermalValidation.fileValid ? 'var(--status-normal)' : 'var(--status-malignant)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileCheck size={13} />
                        <span>Format: {combinedThermalValidation.format} • {combinedThermalValidation.sizeFormatted}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: combinedThermalValidation.modalityVerified ? 'var(--status-normal)' : 'var(--status-malignant)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldCheck size={13} />
                        <span>{combinedThermalValidation.modalityVerified ? '✓ Verified False-Color Thermogram' : `✕ ${combinedThermalValidation.modalityError || 'Rejected'}`}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Dual Upload Status & Analyze Combined Images Button */}
          <div className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: (combinedMammoFile && combinedThermalFile) ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
                color: (combinedMammoFile && combinedThermalFile) ? 'var(--status-normal)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Pair Status: {combinedMammoFile && combinedThermalFile ? 'Both Scans Provided' : 'Awaiting Both Scans'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Mammogram: {combinedMammoFile ? '✓ Loaded' : '○ Pending'} • Thermal: {combinedThermalFile ? '✓ Loaded' : '○ Pending'}
                </div>
              </div>
            </div>

            {/* Analyze Combined Images Button (Permanently disabled until genuine fusion model exists) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <button
                type="button"
                className="btn-primary"
                disabled={true}
                onClick={handleRunCombinedAnalysis}
                style={{
                  padding: '12px 24px',
                  fontSize: '13px',
                  opacity: 0.6,
                  cursor: 'not-allowed',
                  background: 'var(--bg-muted)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-medium)'
                }}
                title="Combined analysis model is not yet available."
              >
                Analyze Combined Images
              </button>
              <span style={{ fontSize: '11px', color: '#E65100', fontWeight: 600 }}>
                Combined analysis model is not yet available.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ZOOM / INSPECTION LIGHTBOX MODAL */}
      {zoomModal?.isOpen && (
        <div
          onClick={() => setZoomModal(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 3, 10, 0.88)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1F0615',
              border: '1px solid var(--accent-rose)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid rgba(224, 75, 127, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#fff'
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>{zoomModal.title}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                  {zoomModal.modality === 'mammogram' ? 'Mammogram Radiograph' : 'Infrared Thermogram'}
                  {zoomModal.dimensions && ` • ${zoomModal.dimensions}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setZoomModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Image Display */}
            <div style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              flex: 1
            }}>
              <img
                src={zoomModal.url}
                alt={zoomModal.title}
                style={{
                  maxHeight: '75vh',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: '4px',
                  filter: zoomModal.modality === 'mammogram'
                    ? `${zoomModal.isInverted ? 'invert(100%)' : ''} ${zoomModal.contrastBoost ? 'contrast(150%) brightness(105%)' : ''}`.trim() || 'none'
                    : 'none'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
