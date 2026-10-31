import React, { useState, useEffect } from 'react';
import { Flame, Eye, X, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { SampleItem, AnalysisResponse, fetchSamples, submitImageAnalysis, getSampleImageUrl } from '../../services/api';

interface ThermalPageProps {
  onNavigate: (view: string) => void;
  onAnalysisComplete?: (res: AnalysisResponse) => void;
}

export const ThermalPage: React.FC<ThermalPageProps> = ({ onNavigate, onAnalysisComplete }) => {
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Projection filter (Anterior, Left Oblique, Right Oblique)
  const [viewFilter, setViewFilter] = useState<'all' | 'anterior' | 'oblique_r' | 'oblique_l'>('all');

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSamples()
      .then((data) => {
        const thermal = data.filter((s) => s.modality === 'thermal');
        setSamples(thermal);
        if (thermal.length > 0) {
          handleSelectSample(thermal[0]);
        }
      })
      .catch((err) => console.error('Failed to fetch thermal samples:', err));
  }, []);

  const handleSelectSample = (sample: SampleItem) => {
    setSelectedSample(sample);
    setUploadedFile(null);
    setPreviewUrl(getSampleImageUrl('thermal', sample.filename));
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
    const validExts = ['.jpg', '.jpeg', '.png'];
    if (!validExts.includes(ext)) {
      setErrorMsg(`Invalid file format "${ext}". Supported thermal formats are: .jpg, .jpeg, .png`);
      return;
    }

    // Validate file size (max 25 MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed 25 MB limit.`);
      return;
    }

    // Clean up previous blob URL
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setUploadedFile(file);
    setSelectedSample(null);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysisResult(null);
    setErrorMsg(null);
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
        const blobRes = await fetch(getSampleImageUrl('thermal', selectedSample.filename));
        const blob = await blobRes.blob();
        fileToUpload = new File([blob], selectedSample.filename, { type: blob.type });
      } else {
        throw new Error('Please select a sample or upload a file first.');
      }

      const res = await submitImageAnalysis(fileToUpload, 'thermal');
      setAnalysisResult(res);
      if (onAnalysisComplete) onAnalysisComplete(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Thermal analysis submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSamples = samples.filter((s) => {
    if (viewFilter === 'all') return true;
    if (viewFilter === 'anterior') return s.view.toLowerCase().includes('anterior');
    if (viewFilter === 'oblique_r') return s.view.toLowerCase().includes('right') || s.filename.includes('der');
    if (viewFilter === 'oblique_l') return s.view.toLowerCase().includes('left') || s.filename.includes('izq');
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>Thermal Imaging Workspace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Infrared thermographic surface temperature evaluation from the Mendeley Breast Thermography research archive (Mexico).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-normal">Mendeley Cohort</span>
          <span className="badge badge-rosegold">FLIR Pseudocolor / RGB</span>
        </div>
      </div>

      {/* Main Grid: Upload/Selector & Image Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
        {/* Left Column: Projection Filter & Samples */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Projection Filter Tabs */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '13px' }}>Standard Clinical Projections</h4>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>3 Views / Subject</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <button
                className={`btn-secondary ${viewFilter === 'all' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '6px 10px' }}
                onClick={() => setViewFilter('all')}
              >
                All Views ({samples.length})
              </button>
              <button
                className={`btn-secondary ${viewFilter === 'anterior' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '6px 10px' }}
                onClick={() => setViewFilter('anterior')}
              >
                Anterior Frontal
              </button>
              <button
                className={`btn-secondary ${viewFilter === 'oblique_r' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '6px 10px' }}
                onClick={() => setViewFilter('oblique_r')}
              >
                Right Oblique
              </button>
              <button
                className={`btn-secondary ${viewFilter === 'oblique_l' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '6px 10px' }}
                onClick={() => setViewFilter('oblique_l')}
              >
                Left Oblique
              </button>
            </div>

            {/* Filtered Sample Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
              {filteredSamples.map((s) => (
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
                    {s.filename.replace('Breast Thermography_', '')}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {s.label.toUpperCase()} • {s.view}
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
            onClick={() => document.getElementById('thermal-file-input')?.click()}
          >
            <input
              id="thermal-file-input"
              type="file"
              accept=".jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-blush)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={24} color="var(--primary-rose)" />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Drag and drop thermogram, or <span style={{ color: 'var(--primary-rose)', textDecoration: 'underline' }}>browse</span>
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supported formats: JPEG, PNG • Multi-view clinical protocol
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
                  Cohort: {uploadedFile ? 'User Upload' : 'Mendeley Archive'}
                </span>
                {selectedSample && (
                  <span className="badge badge-rosegold">
                    Subject ID: {selectedSample.patient_id}
                  </span>
                )}
                {selectedSample && (
                  <span className="badge badge-normal">
                    Class: {selectedSample.label.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Thermal Viewport */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '440px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={16} color="var(--primary-rose)" />
              <h4 style={{ fontSize: '13px' }}>Thermographic Sensor Viewport</h4>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Projection: <strong>{selectedSample?.view || 'Custom Upload'}</strong>
            </div>
          </div>

          {/* Viewport Display */}
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
                alt="Thermography scan viewport"
                style={{
                  maxWidth: '100%',
                  maxHeight: '380px',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#826674' }}>
                <p style={{ fontSize: '13px' }}>No thermogram loaded</p>
                <p style={{ fontSize: '11px', marginTop: '4px' }}>Select an anterior or oblique projection from the list</p>
              </div>
            )}

            {/* Thermal Colormap Bar */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '12px',
              background: 'rgba(20, 8, 14, 0.8)',
              padding: '6px 10px',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '9px',
              color: '#FDFBF9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cold</span>
                <span>Hyperthermic</span>
              </div>
              <div style={{
                width: '120px',
                height: '8px',
                borderRadius: '2px',
                background: 'linear-gradient(to right, #0000FF, #00FFFF, #00FF00, #FFFF00, #FF0000, #FFFFFF)'
              }} />
            </div>

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
              MODALITY: INFRARED THERMAL • SENSOR: FLIR MATRIX
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
                {isSubmitting ? 'Submitting to Backend Pipeline...' : 'Run Thermal Pipeline Inspection'}
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
                  <p><strong>Image Dimensions:</strong> {analysisResult.dimensions.width} × {analysisResult.dimensions.height} ({analysisResult.format}, {analysisResult.color_mode})</p>
                  <p style={{ marginTop: '4px' }}><strong>Backend Message:</strong> {analysisResult.message}</p>
                </div>

                {/* Genuine Prediction or Honest Standby Alert */}
                {analysisResult.inference_ready && analysisResult.predicted_class ? (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-rose)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                        ResNet-50 Thermal Classification
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
                          <strong style={{ color: 'var(--primary-rose)' }}>Thermal Grad-CAM Generated</strong>
                          <p>Backpropagated gradient saliency on thermal feature maps.</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: '10px', padding: '10px', background: 'var(--status-benign-bg)', border: '1px solid var(--status-benign-border)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <ShieldAlert size={16} color="var(--status-benign)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '11px', color: 'var(--status-benign)' }}>
                      <strong>Research Integrity Notice:</strong> Thermography CNN checkpoints are scheduled for Milestone 3 training. In keeping with zero-fabrication research standards, predicted thermal classes and heatmaps remain in standby until weights are generated.
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
