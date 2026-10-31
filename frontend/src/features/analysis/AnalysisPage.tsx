import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileImage,
  RefreshCw,
  Trash2,
  Sliders,
  AlertCircle,
  Eye,
  Flame,
  ArrowRight,
  Layers,
  Sparkles,
  CheckCircle2,
  Info
} from 'lucide-react';
import {
  AnalysisResponse,
  ModelReadinessResponse,
  SampleItem,
  fetchSamples,
  getSampleImageUrl,
  submitMammogramAnalysis,
  submitThermalAnalysis,
  submitCombinedAnalysis
} from '../../services/api';

type ExaminationMode = 'mammogram' | 'thermal' | 'combined';

interface AnalysisPageProps {
  initialModality?: 'mammogram' | 'thermal' | 'combined';
  initialSampleFilename?: string | null;
  onClearTargetSample?: () => void;
  modelReadiness: ModelReadinessResponse | null;
  onNavigate: (view: string) => void;
  onAnalysisComplete: (result: AnalysisResponse) => void;
}

// Client-side image validation helper
function validateImageClientSide(
  file: File,
  expectedModality: 'mammogram' | 'thermal'
): Promise<{ valid: boolean; error: string | null; width: number; height: number }> {
  return new Promise((resolve) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const nameLower = file.name.toLowerCase();

    // 1. Extension checks
    if (expectedModality === 'mammogram') {
      if (!['.png', '.jpg', '.jpeg', '.pgm'].includes(ext)) {
        return resolve({
          valid: false,
          error: 'Invalid image. Please upload a mammogram image.',
          width: 0,
          height: 0
        });
      }
      if (['iir', 'anterior', 'oblder', 'oblizq', 'therm'].some((k) => nameLower.includes(k))) {
        return resolve({
          valid: false,
          error: 'Invalid image. Please upload a mammogram image.',
          width: 0,
          height: 0
        });
      }
    } else {
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
        return resolve({
          valid: false,
          error: 'Invalid image. Please upload a thermal image.',
          width: 0,
          height: 0
        });
      }
      if (['mdb', 'mammo', 'mias'].some((k) => nameLower.includes(k))) {
        return resolve({
          valid: false,
          error: 'Invalid image. Please upload a thermal image.',
          width: 0,
          height: 0
        });
      }
    }

    if (ext === '.pgm') {
      return resolve({ valid: true, error: null, width: 0, height: 0 });
    }

    // 2. Canvas analysis for browser-renderable formats
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w < 32 || h < 32) {
        URL.revokeObjectURL(url);
        return resolve({
          valid: false,
          error: `Image dimensions (${w}×${h}) are too small. Minimum required is 32×32 pixels.`,
          width: w,
          height: h
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return resolve({ valid: true, error: null, width: w, height: h });
      }

      ctx.drawImage(img, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      let totalDiff = 0;
      let darkCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalDiff += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        if (gray < 20) darkCount++;
      }
      const avgDiff = totalDiff / ((data.length / 4) * 3);
      const darkRatio = darkCount / (data.length / 4);
      URL.revokeObjectURL(url);

      if (expectedModality === 'mammogram') {
        if (avgDiff >= 8.0) {
          return resolve({
            valid: false,
            error: 'Invalid image. Please upload a mammogram image.',
            width: w,
            height: h
          });
        }
        return resolve({ valid: true, error: null, width: w, height: h });
      } else {
        if (avgDiff < 8.0 && darkRatio > 0.18) {
          return resolve({
            valid: false,
            error: 'Invalid image. Please upload a thermal image.',
            width: w,
            height: h
          });
        }
        return resolve({ valid: true, error: null, width: w, height: h });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const errMsg =
        expectedModality === 'mammogram'
          ? 'Invalid image. Please upload a mammogram image.'
          : 'Invalid image. Please upload a thermal image.';
      resolve({ valid: false, error: errMsg, width: 0, height: 0 });
    };
    img.src = url;
  });
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
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleDimensions, setSingleDimensions] = useState<{ width: number; height: number } | null>(null);

  // Combined-scan state (Mode 3)
  const [combinedMammoFile, setCombinedMammoFile] = useState<File | null>(null);
  const [combinedMammoPreview, setCombinedMammoPreview] = useState<string | null>(null);
  const [combinedMammoError, setCombinedMammoError] = useState<string | null>(null);
  const [combinedMammoDims, setCombinedMammoDims] = useState<{ width: number; height: number } | null>(null);

  const [combinedThermalFile, setCombinedThermalFile] = useState<File | null>(null);
  const [combinedThermalPreview, setCombinedThermalPreview] = useState<string | null>(null);
  const [combinedThermalError, setCombinedThermalError] = useState<string | null>(null);
  const [combinedThermalDims, setCombinedThermalDims] = useState<{ width: number; height: number } | null>(null);

  const [caseId, setCaseId] = useState<string>(() => `MF-CASE-2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);

  // General controls & states
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [contrastBoost, setContrastBoost] = useState<boolean>(false);
  const [useTta, setUseTta] = useState<boolean>(false);

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
      setSingleError(null);
      setPreviewUrl(getSampleImageUrl(match.modality, match.filename));
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
    setSingleError(null);
    setShowSamplesDrawer(false);
  };

  // Process single upload (Modes 1 & 2)
  const handleSingleFileProcess = async (file: File) => {
    if (mode === 'combined') return;
    const targetModality = mode as 'mammogram' | 'thermal';
    const validation = await validateImageClientSide(file, targetModality);

    if (!validation.valid) {
      setSingleError(validation.error);
      setUploadedFile(null);
      setPreviewUrl(null);
      setSingleDimensions(null);
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSingleError(null);
    setUploadedFile(file);
    setSelectedSample(null);
    setSingleDimensions(validation.width > 0 ? { width: validation.width, height: validation.height } : null);

    if (!file.name.toLowerCase().endsWith('.pgm')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  // Process Mode 3 Mammogram upload
  const handleCombinedMammoProcess = async (file: File) => {
    const validation = await validateImageClientSide(file, 'mammogram');
    if (!validation.valid) {
      setCombinedMammoError(validation.error);
      setCombinedMammoFile(null);
      setCombinedMammoPreview(null);
      setCombinedMammoDims(null);
      return;
    }

    if (combinedMammoPreview && combinedMammoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(combinedMammoPreview);
    }

    setCombinedMammoError(null);
    setCombinedMammoFile(file);
    setCombinedMammoDims(validation.width > 0 ? { width: validation.width, height: validation.height } : null);

    if (!file.name.toLowerCase().endsWith('.pgm')) {
      setCombinedMammoPreview(URL.createObjectURL(file));
    } else {
      setCombinedMammoPreview(null);
    }
  };

  // Process Mode 3 Thermal upload
  const handleCombinedThermalProcess = async (file: File) => {
    const validation = await validateImageClientSide(file, 'thermal');
    if (!validation.valid) {
      setCombinedThermalError(validation.error);
      setCombinedThermalFile(null);
      setCombinedThermalPreview(null);
      setCombinedThermalDims(null);
      return;
    }

    if (combinedThermalPreview && combinedThermalPreview.startsWith('blob:')) {
      URL.revokeObjectURL(combinedThermalPreview);
    }

    setCombinedThermalError(null);
    setCombinedThermalFile(file);
    setCombinedThermalDims(validation.width > 0 ? { width: validation.width, height: validation.height } : null);
    setCombinedThermalPreview(URL.createObjectURL(file));
  };

  // Reference sample selection for single modes
  const handleSelectSample = (sample: SampleItem) => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setSelectedSample(sample);
    setSingleError(null);
    setPreviewUrl(getSampleImageUrl(sample.modality, sample.filename));
    setShowSamplesDrawer(false);
  };

  const handleClearSingleImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setUploadedFile(null);
    setSelectedSample(null);
    setPreviewUrl(null);
    setSingleError(null);
    setSingleDimensions(null);
    if (singleFileInputRef.current) singleFileInputRef.current.value = '';
  };

  const handleClearCombinedMammo = () => {
    if (combinedMammoPreview && combinedMammoPreview.startsWith('blob:')) URL.revokeObjectURL(combinedMammoPreview);
    setCombinedMammoFile(null);
    setCombinedMammoPreview(null);
    setCombinedMammoError(null);
    setCombinedMammoDims(null);
    if (mammoFileInputRef.current) mammoFileInputRef.current.value = '';
  };

  const handleClearCombinedThermal = () => {
    if (combinedThermalPreview && combinedThermalPreview.startsWith('blob:')) URL.revokeObjectURL(combinedThermalPreview);
    setCombinedThermalFile(null);
    setCombinedThermalPreview(null);
    setCombinedThermalError(null);
    setCombinedThermalDims(null);
    if (thermalFileInputRef.current) thermalFileInputRef.current.value = '';
  };

  // Load a reference test pair into Mode 3 for verification
  const handleLoadSamplePair = async () => {
    const mammoSample = samples.find((s) => s.modality === 'mammogram');
    const thermalSample = samples.find((s) => s.modality === 'thermal');
    if (!mammoSample || !thermalSample) return;

    try {
      // Fetch mammogram sample
      const resM = await fetch(getSampleImageUrl(mammoSample.modality, mammoSample.filename));
      const blobM = await resM.blob();
      const fileM = new File([blobM], mammoSample.filename, { type: blobM.type || 'image/jpeg' });
      await handleCombinedMammoProcess(fileM);

      // Fetch thermal sample
      const resT = await fetch(getSampleImageUrl(thermalSample.modality, thermalSample.filename));
      const blobT = await resT.blob();
      const fileT = new File([blobT], thermalSample.filename, { type: blobT.type || 'image/jpeg' });
      await handleCombinedThermalProcess(fileT);
    } catch (e) {
      console.error('Failed to load sample pair:', e);
    }
  };

  // Single analysis run (Modes 1 & 2)
  const handleRunSingleAnalysis = async () => {
    if (!uploadedFile && !selectedSample) {
      const errMsg =
        mode === 'mammogram'
          ? 'Invalid image. Please upload a mammogram image.'
          : 'Invalid image. Please upload a thermal image.';
      setSingleError(errMsg);
      return;
    }

    setIsSubmitting(true);
    setSingleError(null);

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
      setSingleError(err.message || 'The analysis service encountered an error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combined analysis run (Mode 3)
  const handleRunCombinedAnalysis = async () => {
    if (!combinedMammoFile || !combinedThermalFile) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitCombinedAnalysis(combinedMammoFile, combinedThermalFile, caseId);
      onAnalysisComplete(res);
      onNavigate('results');
    } catch (err: any) {
      // Expected to report "Combined analysis model is not yet available."
      alert(err.message || 'Combined analysis model is not yet available.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modality readiness flags
  const mammoReady = Boolean(modelReadiness?.mammogram?.ready);
  const thermalReady = Boolean(modelReadiness?.thermal?.ready);
  const combinedReady = Boolean(modelReadiness?.combined?.ready);

  const previewFilterStyle = {
    filter: `${isInverted ? 'invert(100%)' : ''} ${contrastBoost ? 'contrast(150%) brightness(105%)' : ''}`.trim() || 'none'
  };

  const filteredSamples = samples.filter((s) => s.modality === mode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '920px', margin: '0 auto', width: '100%' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
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
                {mammoReady ? '● Ready' : '○ Standby'}
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
              Formats: <strong>PNG, JPG, PGM</strong>
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
                {thermalReady ? '● Ready' : '○ Standby'}
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                2. Thermal Screening
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                Infrared physiological thermography using verified PyTorch ResNet-50.
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid var(--border-light)' }}>
              Formats: <strong>PNG, JPG, JPEG</strong>
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
                  ? 'Accepts mammogram radiographs only. Thermal and non-radiographic scans will be rejected.'
                  : 'Accepts infrared thermograms only. Mammograms and non-thermal scans will be rejected.'}
              </div>
            </div>

            {/* Reference Sample Selector Button */}
            {filteredSamples.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSamplesDrawer(!showSamplesDrawer)}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                <span>{showSamplesDrawer ? 'Hide Reference Samples' : 'Select Reference Sample'}</span>
              </button>
            )}
          </div>

          {/* Reference Samples Drawer */}
          {showSamplesDrawer && (
            <div style={{
              padding: '14px',
              background: 'var(--bg-blush-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-rose)',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Select a verified reference scan from the {mode === 'mammogram' ? 'MIAS' : 'Mendeley'} research repository:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
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
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Dropzone or Image Preview */}
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
                padding: '42px 24px',
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
                Supported: <strong>{mode === 'mammogram' ? 'PNG, JPG, JPEG, PGM' : 'PNG, JPG, JPEG'}</strong> • Maximum file size: <strong>25 MB</strong>
              </div>
            </div>
          ) : (
            <div>
              {/* Image Preview & Controls */}
              <div style={{
                background: '#12020A',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '340px',
                position: 'relative'
              }}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Scan Preview"
                    style={{
                      maxHeight: '360px',
                      maxWidth: '100%',
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'contain',
                      ...previewFilterStyle
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#fff', padding: '40px 20px' }}>
                    <FileImage size={48} style={{ color: 'var(--accent-rose)', marginBottom: '12px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>PGM Radiograph Loaded</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                      Raw 16-bit PGM radiograph loaded directly for backend ResNet-50 pipeline.
                    </div>
                  </div>
                )}
              </div>

              {/* Inspection Controls & File Info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '14px',
                padding: '10px 14px',
                background: 'var(--bg-light)',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  File: <strong style={{ color: 'var(--text-primary)' }}>{uploadedFile?.name || selectedSample?.filename}</strong>
                  {singleDimensions && ` (${singleDimensions.width}×${singleDimensions.height} px)`}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {previewUrl && (
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
          {singleError && (
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
              <span>{singleError}</span>
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
              disabled={isSubmitting || (!uploadedFile && !selectedSample) || Boolean(singleError)}
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
                <strong>Combined analysis model is not yet available.</strong> Single-modality models for Mammogram and Thermal screening are loaded and verified. However, genuine multimodal late-fusion screening strictly requires a trained fusion model with paired-provenance cohort data. Per project scientific policy, fabricated predictions and manual score combinations are prohibited.
              </div>
            </div>
          </div>

          {/* Case Reference & Quick Pair Loader */}
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
                  width: '220px'
                }}
              />
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleLoadSamplePair}
              style={{ fontSize: '12px', padding: '8px 14px' }}
            >
              <Sparkles size={14} />
              <span>Load Verified Reference Pair (Testing)</span>
            </button>
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
                    Accepts PNG, JPG, JPEG, PGM
                  </div>
                </div>
              ) : (
                <div style={{
                  background: '#12020A',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  {combinedMammoPreview ? (
                    <img
                      src={combinedMammoPreview}
                      alt="Mammogram"
                      style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ color: '#fff', padding: '24px 0', textAlign: 'center' }}>
                      <FileImage size={32} style={{ color: 'var(--accent-rose)' }} />
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>PGM Radiograph Loaded</div>
                    </div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
                    {combinedMammoFile.name} {combinedMammoDims && `(${combinedMammoDims.width}×${combinedMammoDims.height})`}
                  </div>
                </div>
              )}

              {/* Mammogram Field Error */}
              {combinedMammoError && (
                <div style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  background: 'var(--status-malignant-bg)',
                  border: '1px solid var(--status-malignant-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--status-malignant)',
                  fontSize: '12px'
                }}>
                  <AlertCircle size={14} />
                  <span>{combinedMammoError}</span>
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
                <div style={{
                  background: '#12020A',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  {combinedThermalPreview && (
                    <img
                      src={combinedThermalPreview}
                      alt="Thermal Scan"
                      style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  )}
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
                    {combinedThermalFile.name} {combinedThermalDims && `(${combinedThermalDims.width}×${combinedThermalDims.height})`}
                  </div>
                </div>
              )}

              {/* Thermal Field Error */}
              {combinedThermalError && (
                <div style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  background: 'var(--status-malignant-bg)',
                  border: '1px solid var(--status-malignant-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--status-malignant)',
                  fontSize: '12px'
                }}>
                  <AlertCircle size={14} />
                  <span>{combinedThermalError}</span>
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
                  Pair Status: {combinedMammoFile && combinedThermalFile ? 'Both Scans Validated' : 'Awaiting Both Scans'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Mammogram: {combinedMammoFile ? '✓ Ready' : '○ Pending'} • Thermal: {combinedThermalFile ? '✓ Ready' : '○ Pending'}
                </div>
              </div>
            </div>

            {/* Analyze Combined Images Button (Disabled as per requirement) */}
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
    </div>
  );
};
