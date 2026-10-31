import React, { useState, useEffect } from 'react';
import { UploadCloud, Eye, RefreshCw, X, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { SampleItem, AnalysisResponse, fetchSamples, submitImageAnalysis, getSampleImageUrl } from '../../services/api';

interface MammogramPageProps {
  onNavigate: (view: string) => void;
  onAnalysisComplete?: (res: AnalysisResponse) => void;
}

export const MammogramPage: React.FC<MammogramPageProps> = ({ onNavigate, onAnalysisComplete }) => {
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // DICOM Viewer visual controls (CSS filter based simulation for research inspection)
  const [isInverted, setIsInverted] = useState(false);
  const [contrastBoost, setContrastBoost] = useState(false);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSamples()
      .then((data) => {
        const mammo = data.filter((s) => s.modality === 'mammogram');
        setSamples(mammo);
        if (mammo.length > 0) {
          handleSelectSample(mammo[0]);
        }
      })
      .catch((err) => console.error('Failed to fetch samples:', err));
  }, []);

  const handleSelectSample = (sample: SampleItem) => {
    setSelectedSample(sample);
    setUploadedFile(null);
    setPreviewUrl(getSampleImageUrl('mammogram', sample.filename));
    setAnalysisResult(null);
    setErrorMsg(null);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    // Validate file extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const validExts = ['.pgm', '.png', '.jpg', '.jpeg'];
    if (!validExts.includes(ext)) {
      setErrorMsg(`Invalid file format "${ext}". Supported formats are: .pgm, .png, .jpg, .jpeg`);
      return;
    }

    // Validate file size (max 25 MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed 25 MB limit.`);
      return;
    }

    // Clean up previous blob URL to prevent memory leaks
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setUploadedFile(file);
    setSelectedSample(null);
    setAnalysisResult(null);
    setErrorMsg(null);

    // If PGM, browser cannot render directly via URL.createObjectURL without canvas conversion.
    if (file.name.toLowerCase().endsWith('.pgm')) {
      setPreviewUrl(null); // Show friendly PGM notification banner
    } else {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleClear = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setSelectedSample(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setErrorMsg(null);
  };

  const handleAnalyze = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      let fileToUpload: File;
      if (uploadedFile) {
        fileToUpload = uploadedFile;
      } else if (selectedSample) {
        // Fetch sample file blob to submit to real endpoint
        const blobRes = await fetch(getSampleImageUrl('mammogram', selectedSample.filename));
        const blob = await blobRes.blob();
        fileToUpload = new File([blob], selectedSample.filename, { type: blob.type });
      } else {
        throw new Error('Please select a sample or upload a file first.');
      }

      const res = await submitImageAnalysis(fileToUpload, 'mammogram');
      setAnalysisResult(res);
      if (onAnalysisComplete) onAnalysisComplete(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Image analysis request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const imageFilterStyle = {
    filter: `${isInverted ? 'invert(100%)' : ''} ${contrastBoost ? 'contrast(160%) brightness(110%)' : ''}`.trim() || 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>Mammography Workspace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Full-field digital mammogram inspection with uncompressed 8-bit PGM support from the Cambridge MIAS database.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-normal">MIAS (UK) Cohort</span>
          <span className="badge badge-rosegold">1024×1024 Grayscale</span>
        </div>
      </div>

      {/* Main Grid: Upload/Selector & Image Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
        {/* Left Column: Sample Browser & Upload Target */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Real Dataset Sample Quick-Loader */}
          <div className="card">
            <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Verified Repository Samples</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
              {samples.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSample(s)}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    borderRadius: 'var(--radius-sm)',
                    border: selectedSample?.id === s.id ? '2px solid var(--primary-rose)' : '1px solid var(--border-light)',
                    background: selectedSample?.id === s.id ? 'var(--bg-blush)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div className="mono" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {s.filename}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {s.label.toUpperCase()} • {s.tissue}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => document.getElementById('mammo-file-input')?.click()}
          >
            <input
              id="mammo-file-input"
              type="file"
              accept=".pgm,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-blush)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UploadCloud size={24} color="var(--primary-rose)" />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Drag and drop mammogram image, or <span style={{ color: 'var(--primary-rose)', textDecoration: 'underline' }}>browse</span>
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supported formats: <strong>.pgm</strong> (MIAS standard), .png, .jpg • Up to 20 MB
                </p>
              </div>
            </div>
          </div>

          {/* Active Target Metadata */}
          {(selectedSample || uploadedFile) && (
            <div className="card" style={{ padding: '16px', background: 'var(--bg-surface-elevated)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Input</div>
                  <div className="mono" style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>
                    {uploadedFile ? uploadedFile.name : selectedSample?.filename}
                  </div>
                </div>
                <button
                  onClick={handleClear}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  title="Clear selection"
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                <span className="badge badge-normal">
                  Source: {uploadedFile ? 'User File Upload' : 'MIAS Repository'}
                </span>
                {selectedSample && (
                  <span className="badge badge-rosegold">
                    Ground Truth: {selectedSample.label.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Image Canvas & DICOM Inspection Controls */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '440px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={16} color="var(--primary-rose)" />
              <h4 style={{ fontSize: '13px' }}>Radiographic Viewport</h4>
            </div>
            {/* DICOM viewer tools */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn-secondary ${isInverted ? 'active' : ''}`}
                style={{ padding: '5px 9px', fontSize: '11px' }}
                onClick={() => setIsInverted(!isInverted)}
                title="Invert grayscale polarity"
              >
                Invert Polarity
              </button>
              <button
                className={`btn-secondary ${contrastBoost ? 'active' : ''}`}
                style={{ padding: '5px 9px', fontSize: '11px' }}
                onClick={() => setContrastBoost(!contrastBoost)}
                title="Enhance local tissue contrast"
              >
                Contrast CLAHE
              </button>
              <button
                className="btn-secondary"
                style={{ padding: '5px 9px', fontSize: '11px' }}
                onClick={() => { setIsInverted(false); setContrastBoost(false); }}
                title="Reset viewer adjustments"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          {/* Visual Display Port */}
          <div style={{
            flex: 1,
            background: '#120A0E',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '340px'
          }}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Mammogram scan viewport"
                style={{
                  maxWidth: '100%',
                  maxHeight: '380px',
                  objectFit: 'contain',
                  transition: 'filter 0.2s ease',
                  ...imageFilterStyle
                }}
              />
            ) : uploadedFile?.name.toLowerCase().endsWith('.pgm') ? (
              <div style={{ textAlign: 'center', color: '#E8DCDA', padding: '24px' }}>
                <p style={{ fontWeight: 600, fontSize: '14px' }}>Raw 8-bit PGM Binary Detected</p>
                <p style={{ fontSize: '12px', color: '#A68D9A', marginTop: '6px', maxWidth: '320px' }}>
                  Native browsers cannot decode portable graymaps directly without server-side transcoding. Submit below to analyze via the FastAPI engine.
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#826674' }}>
                <p style={{ fontSize: '13px' }}>No image loaded into viewport</p>
                <p style={{ fontSize: '11px', marginTop: '4px' }}>Select a repository sample or upload an image file</p>
              </div>
            )}

            {/* Viewport Overlay Info */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '12px',
              background: 'rgba(20, 8, 14, 0.75)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#FDFBF9',
              fontFamily: 'monospace'
            }}>
              MODALITY: X-RAY MAMMO • CLAHE: {contrastBoost ? 'ON' : 'OFF'} • POLARITY: {isInverted ? 'INVERTED' : 'STANDARD'}
            </div>
          </div>

          {/* Submission and Real Response Box */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                className="btn-primary"
                onClick={handleAnalyze}
                disabled={(!selectedSample && !uploadedFile) || isSubmitting}
                style={{ flex: 1 }}
              >
                {isSubmitting ? 'Transmitting to Pipeline...' : 'Run Pipeline Inspection'}
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', background: 'var(--status-malignant-bg)', border: '1px solid var(--status-malignant-border)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--status-malignant)' }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {analysisResult && (
              <div style={{ padding: '14px', background: 'var(--bg-blush)', border: '1px solid var(--border-rose)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--primary-rose)' }}>
                    <CheckCircle2 size={16} /> Server Ingestion Acknowledged
                  </div>
                  <span className="badge badge-normal">Status: {analysisResult.status}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <p><strong>Decoded Resolution:</strong> {analysisResult.dimensions.width} × {analysisResult.dimensions.height} ({analysisResult.format}, {analysisResult.color_mode})</p>
                  <p style={{ marginTop: '4px' }}><strong>Backend Message:</strong> {analysisResult.message}</p>
                </div>

                {/* Genuine Prediction or Honest Standby Alert */}
                {analysisResult.inference_ready && analysisResult.predicted_class ? (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-rose)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                        ResNet-50 Classification
                      </span>
                      <span className="badge badge-rosegold">PyTorch Inference</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: analysisResult.predicted_class === 'malignant' ? 'var(--status-malignant-bg)' : analysisResult.predicted_class === 'benign' ? 'var(--status-benign-bg)' : 'var(--status-normal-bg)',
                        color: analysisResult.predicted_class === 'malignant' ? 'var(--status-malignant)' : analysisResult.predicted_class === 'benign' ? 'var(--status-benign)' : 'var(--status-normal)',
                        border: `1px solid ${analysisResult.predicted_class === 'malignant' ? 'var(--status-malignant-border)' : analysisResult.predicted_class === 'benign' ? 'var(--status-benign-border)' : 'var(--status-normal-border)'}`
                      }}>
                        {analysisResult.predicted_class.toUpperCase()}
                      </span>
                      <span className="mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                        {((analysisResult.confidence ?? 0) * 100).toFixed(1)}% Confidence
                      </span>
                    </div>
                    {analysisResult.gradcam_url && (
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={analysisResult.gradcam_url}
                          alt="Grad-CAM activation thumbnail"
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-rose)' }}
                        />
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--primary-rose)' }}>Grad-CAM Attribution Generated</strong>
                          <p>Backpropagated spatial activation from ResNet-50 layer4.</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: '10px', padding: '10px', background: 'var(--status-benign-bg)', border: '1px solid var(--status-benign-border)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <ShieldAlert size={16} color="var(--status-benign)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '11px', color: 'var(--status-benign)' }}>
                      <strong>Research Integrity Notice:</strong> Deep learning model checkpoints are pending Milestone 3 training. No synthetic classification or fabricated Grad-CAM heatmaps are displayed in compliance with research ethics.
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" style={{ fontSize: '11px', padding: '6px 12px' }} onClick={() => onNavigate('results')}>
                    View Full Analysis Record →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
