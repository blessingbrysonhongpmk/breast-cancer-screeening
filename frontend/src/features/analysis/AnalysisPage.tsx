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
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import {
  AnalysisResponse,
  ModelReadinessResponse,
  SampleItem,
  fetchSamples,
  getSampleImageUrl,
  submitImageAnalysis
} from '../../services/api';

interface AnalysisPageProps {
  initialModality?: 'mammogram' | 'thermal';
  modelReadiness: ModelReadinessResponse | null;
  onNavigate: (view: string) => void;
  onAnalysisComplete: (result: AnalysisResponse) => void;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  initialModality = 'mammogram',
  modelReadiness,
  onNavigate,
  onAnalysisComplete
}) => {
  const [modality, setModality] = useState<'mammogram' | 'thermal'>(initialModality);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [contrastBoost, setContrastBoost] = useState<boolean>(false);
  const [useTta, setUseTta] = useState<boolean>(false);

  // Samples for one-click testing
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);
  const [showSamplesDrawer, setShowSamplesDrawer] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if model weights for currently selected modality are loaded
  const isCurrentModalityReady = Boolean(modelReadiness?.[modality]?.ready);

  // Load samples
  useEffect(() => {
    fetchSamples()
      .then((data) => setSamples(data))
      .catch((err) => console.error('Failed to load samples:', err));
  }, []);

  // Adjust modality when initialModality prop changes
  const [prevInitialModality, setPrevInitialModality] = useState(initialModality);
  if (initialModality && initialModality !== prevInitialModality) {
    setPrevInitialModality(initialModality);
    setModality(initialModality);
  }

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileProcess = (file: File) => {
    // Validate extension
    const allowed = ['.png', '.jpg', '.jpeg', '.pgm'];
    const lowerName = file.name.toLowerCase();
    const isAllowed = allowed.some((ext) => lowerName.endsWith(ext));

    if (!isAllowed) {
      setErrorMsg('This file type is not supported. Please upload a .png, .jpg, .jpeg, or .pgm image.');
      return;
    }

    // Validate size (25 MB max)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(`The file exceeds the 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    // Revoke old URL
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setErrorMsg(null);

    // Dimension check for standard browser images
    if (!lowerName.endsWith('.pgm')) {
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth < 32 || img.naturalHeight < 32) {
          setErrorMsg(`Image dimensions (${img.naturalWidth}×${img.naturalHeight}) are too small. Minimum required dimension is 32×32 pixels.`);
          URL.revokeObjectURL(objUrl);
          setUploadedFile(null);
          setPreviewUrl(null);
          return;
        }
        setUploadedFile(file);
        setSelectedSample(null);
        setPreviewUrl(objUrl);
      };
      img.onerror = () => {
        setErrorMsg('The image could not be opened. Try another file.');
        URL.revokeObjectURL(objUrl);
        setUploadedFile(null);
        setPreviewUrl(null);
      };
      img.src = objUrl;
    } else {
      // PGM cannot be natively rendered by browser <img> tag
      setUploadedFile(file);
      setSelectedSample(null);
      setPreviewUrl(null);
    }
  };

  const handleSelectSample = (sample: SampleItem) => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setSelectedSample(sample);
    setErrorMsg(null);
    setPreviewUrl(getSampleImageUrl(sample.modality, sample.filename));
    setShowSamplesDrawer(false);
  };

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setSelectedSample(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRunAnalysis = async () => {
    if (!uploadedFile && !selectedSample) {
      setErrorMsg('Please select or upload an image before running analysis.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let fileToUpload: File;

      if (uploadedFile) {
        fileToUpload = uploadedFile;
      } else if (selectedSample) {
        const sampleUrl = getSampleImageUrl(selectedSample.modality, selectedSample.filename);
        const res = await fetch(sampleUrl);
        if (!res.ok) throw new Error('Could not retrieve sample image from server.');
        const blob = await res.blob();
        fileToUpload = new File([blob], selectedSample.filename, { type: blob.type || 'image/png' });
      } else {
        throw new Error('No image loaded.');
      }

      const result = await submitImageAnalysis(fileToUpload, modality, useTta);
      onAnalysisComplete(result);
      onNavigate('results');
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMsg(err.message || 'The analysis service is unavailable. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasImage = Boolean(uploadedFile || selectedSample);
  const activeFilename = uploadedFile?.name || selectedSample?.filename || '';
  const filteredSamples = samples.filter((s) => s.modality === modality);

  const previewFilterStyle = {
    filter: `${isInverted ? 'invert(100%)' : ''} ${contrastBoost ? 'contrast(150%) brightness(105%)' : ''}`.trim() || 'none'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '6px', color: 'var(--text-primary)' }}>
          New Image Analysis
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Select an imaging modality, upload a breast scan, and run deep learning research inspection.
        </p>
      </div>

      {/* Step 1: Modality Selection Toggle */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Imaging Modality Selection
          </div>

          {/* Modality Model Readiness Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: isCurrentModalityReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
            border: `1px solid ${isCurrentModalityReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`,
            fontSize: '11px',
            color: isCurrentModalityReady ? 'var(--status-normal)' : 'var(--text-muted)',
            fontWeight: 600
          }}>
            {isCurrentModalityReady ? <ShieldCheck size={13} /> : <AlertCircle size={13} />}
            <span>
              {isCurrentModalityReady
                ? `${modality.toUpperCase()} Model: ResNet-50 Ready (Grad-CAM active)`
                : `${modality.toUpperCase()} Model: Model not available`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn-secondary ${modality === 'mammogram' ? 'active' : ''}`}
            onClick={() => {
              if (modality !== 'mammogram') {
                setModality('mammogram');
                handleRemoveImage();
              }
            }}
            style={{
              flex: '1 1 200px',
              padding: '12px 16px',
              justifyContent: 'center',
              backgroundColor: modality === 'mammogram' ? 'var(--primary-rose)' : 'var(--bg-surface)',
              color: modality === 'mammogram' ? '#FFFFFF' : 'var(--text-primary)',
              borderColor: modality === 'mammogram' ? 'var(--primary-rose)' : 'var(--border-subtle)',
              boxShadow: modality === 'mammogram' ? '0 2px 8px rgba(178, 59, 85, 0.25)' : 'none'
            }}
          >
            <Eye size={18} />
            <span style={{ fontWeight: 600 }}>Mammogram (X-ray)</span>
          </button>

          <button
            type="button"
            className={`btn-secondary ${modality === 'thermal' ? 'active' : ''}`}
            onClick={() => {
              if (modality !== 'thermal') {
                setModality('thermal');
                handleRemoveImage();
              }
            }}
            style={{
              flex: '1 1 200px',
              padding: '12px 16px',
              justifyContent: 'center',
              backgroundColor: modality === 'thermal' ? 'var(--primary-rose)' : 'var(--bg-surface)',
              color: modality === 'thermal' ? '#FFFFFF' : 'var(--text-primary)',
              borderColor: modality === 'thermal' ? 'var(--primary-rose)' : 'var(--border-subtle)',
              boxShadow: modality === 'thermal' ? '0 2px 8px rgba(178, 59, 85, 0.25)' : 'none'
            }}
          >
            <Flame size={18} />
            <span style={{ fontWeight: 600 }}>Thermal Image (Infrared)</span>
          </button>
        </div>
      </div>

      {/* Step 2: Upload or Choose Image */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Scan Ingestion & Inspection
          </div>

          {/* Quick Sample Selector Trigger */}
          {filteredSamples.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowSamplesDrawer(!showSamplesDrawer)}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <span>{showSamplesDrawer ? 'Hide Samples' : 'Try a Verified Sample'}</span>
            </button>
          )}
        </div>

        {/* Optional Verified Samples Drawer */}
        {showSamplesDrawer && (
          <div style={{
            padding: '14px',
            background: 'var(--bg-blush-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-rose)',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Select a reference scan from the verified {modality === 'mammogram' ? 'MIAS' : 'Mendeley'} dataset:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              {filteredSamples.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    background: selectedSample?.id === sample.id ? 'var(--bg-blush)' : 'var(--bg-surface)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {sample.filename}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Truth: <strong>{sample.label.toUpperCase()}</strong> • {sample.view}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pgm"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileProcess(e.target.files[0]);
            }
          }}
        />

        {/* Upload Dropzone (shown when no image selected) */}
        {!hasImage && (
          <div
            className={`dropzone ${isDragOver ? 'dragover' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileProcess(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-rose)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-rose)'
            }}>
              <UploadCloud size={28} />
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Drag and drop your scan here, or click to browse
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Supports standard PNG, JPEG, and MIAS PGM images (up to 25 MB)
              </div>
            </div>
          </div>
        )}

        {/* Image Preview & Controls (shown when image is selected) */}
        {hasImage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'var(--bg-blush-subtle)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-rose)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileImage size={18} color="var(--primary-rose)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activeFilename}
                </span>
                {uploadedFile && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ({(uploadedFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                >
                  <RefreshCw size={12} />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRemoveImage}
                  style={{ fontSize: '12px', padding: '5px 10px', color: 'var(--status-malignant)' }}
                >
                  <Trash2 size={12} />
                  <span>Remove</span>
                </button>
              </div>
            </div>

            {/* Visual Canvas Display */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#0F080C',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              minHeight: '260px',
              maxHeight: '420px',
              overflow: 'hidden'
            }}>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Scan preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '380px',
                    objectFit: 'contain',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'filter 0.2s ease',
                    ...previewFilterStyle
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#E2D9DC', padding: '20px' }}>
                  <FileImage size={36} style={{ margin: '0 auto 8px', opacity: 0.7 }} />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>MIAS PGM Raw Grayscale Image</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>
                    Standard browser canvas cannot render 8-bit PGM directly. Image will be converted safely by the neural network on upload.
                  </div>
                </div>
              )}
            </div>

            {/* Quick Diagnostic Toggles */}
            {previewUrl && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Viewer Filter:
                </span>
                <button
                  type="button"
                  className={`btn-secondary ${isInverted ? 'active' : ''}`}
                  onClick={() => setIsInverted(!isInverted)}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  <Sliders size={12} />
                  <span>Invert Grayscale</span>
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${contrastBoost ? 'active' : ''}`}
                  onClick={() => setContrastBoost(!contrastBoost)}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  <Sliders size={12} />
                  <span>High Contrast</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inline Error Banner */}
        {errorMsg && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--status-malignant-bg)',
            border: '1px solid var(--status-malignant-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--status-malignant)'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Analysis Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '16px 20px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)'
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={useTta}
            onChange={(e) => setUseTta(e.target.checked)}
            style={{ accentColor: 'var(--primary-rose)', width: '15px', height: '15px', cursor: 'pointer' }}
          />
          <span>Test-Time Augmentation (Dual-view ensemble)</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRemoveImage}
            disabled={!hasImage || isSubmitting}
            style={{ padding: '10px 18px', fontSize: '13px' }}
          >
            Reset
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={handleRunAnalysis}
            disabled={!hasImage || isSubmitting}
            style={{ padding: '10px 22px', fontSize: '13px', minWidth: '180px', justifyContent: 'center' }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={15} className="spinning" />
                <span>Processing Model...</span>
              </>
            ) : (
              <>
                <span>Run Deep Learning Analysis</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mandatory Medical Disclaimer */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        fontSize: '12px',
        color: 'var(--text-muted)',
        lineHeight: 1.6,
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <ShieldAlert size={18} color="var(--primary-rose)" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--text-secondary)' }}>Medical Disclaimer: </strong>
          This research platform is an educational tool for medical imaging research and must not be used for clinical diagnosis or healthcare decisions. Always consult a qualified medical professional.
        </div>
      </div>
    </div>
  );
};
