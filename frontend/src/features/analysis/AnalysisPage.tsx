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
  ShieldAlert
} from 'lucide-react';
import {
  AnalysisResponse,
  ModelStatus,
  SampleItem,
  fetchSamples,
  getSampleImageUrl,
  submitImageAnalysis
} from '../../services/api';

interface AnalysisPageProps {
  initialModality?: 'mammogram' | 'thermal';
  modelStatus: ModelStatus | null;
  onNavigate: (view: string) => void;
  onAnalysisComplete: (result: AnalysisResponse) => void;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  initialModality = 'mammogram',
  modelStatus,
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

  // Samples for one-click testing
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);
  const [showSamplesDrawer, setShowSamplesDrawer] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if model weights are loaded
  const isModelReady = Boolean(
    modelStatus?.is_ready_for_inference &&
    (modelStatus?.models_available?.length ?? 0) > 0
  );

  // Load samples
  useEffect(() => {
    fetchSamples()
      .then((data) => setSamples(data))
      .catch((err) => console.error('Failed to load samples:', err));
  }, []);

  // Update modality when initialModality changes
  useEffect(() => {
    if (initialModality) {
      setModality(initialModality);
    }
  }, [initialModality]);

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
      setErrorMsg('Invalid file format. Please upload a .png, .jpg, .jpeg, or .pgm image.');
      return;
    }

    // Validate size (25 MB max)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 25 MB limit.`);
      return;
    }

    // Revoke old URL
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setUploadedFile(file);
    setSelectedSample(null);
    setErrorMsg(null);

    if (lowerName.endsWith('.pgm')) {
      // PGM cannot be displayed natively as an <img> source in browsers
      setPreviewUrl(null);
    } else {
      setPreviewUrl(URL.createObjectURL(file));
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
        // Fetch sample image as blob to submit to backend
        const sampleUrl = getSampleImageUrl(selectedSample.modality, selectedSample.filename);
        const res = await fetch(sampleUrl);
        if (!res.ok) throw new Error('Could not retrieve sample image from server.');
        const blob = await res.blob();
        fileToUpload = new File([blob], selectedSample.filename, { type: blob.type || 'image/png' });
      } else {
        throw new Error('No image loaded.');
      }

      const result = await submitImageAnalysis(fileToUpload, modality);
      onAnalysisComplete(result);
      // Seamlessly navigate to the Results view
      onNavigate('results');
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMsg(err.message || 'Analysis failed. Please check your connection to the server.');
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
          Select an imaging modality, upload a breast scan, and run the neural network inspection.
        </p>
      </div>

      {/* Step 1: Modality Selection Toggle */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Step 1: Choose Modality
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
            Step 2: Upload or Select Scan
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

            <div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Drag and drop your scan here, or <span style={{ color: 'var(--primary-rose)', textDecoration: 'underline' }}>Browse files</span>
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Supports PNG, JPG, JPEG, or PGM (up to 25 MB)
              </p>
            </div>
          </div>
        )}

        {/* Image Preview & Management (shown when image is selected) */}
        {hasImage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              background: '#0F080C',
              borderRadius: 'var(--radius-md)',
              minHeight: '320px',
              maxHeight: '440px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Scan preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '420px',
                    objectFit: 'contain',
                    ...previewFilterStyle
                  }}
                />
              ) : (
                <div style={{ color: '#FAF7F2', textAlign: 'center', padding: '24px' }}>
                  <FileImage size={42} color="var(--dusty-rose)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 600 }}>Uncompressed PGM Format Detected</p>
                  <p style={{ fontSize: '12px', color: '#A68D9A', maxWidth: '320px', marginTop: '4px' }}>
                    {activeFilename} will be decoded directly on the server during analysis.
                  </p>
                </div>
              )}

              {/* Viewport Badge */}
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(20, 8, 14, 0.75)',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#FAF7F2',
                fontFamily: 'monospace'
              }}>
                {modality.toUpperCase()}
              </div>
            </div>

            {/* Image Details & View Controls Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              background: 'var(--bg-muted)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activeFilename}
                </span>
                {uploadedFile && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    ({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                )}
                {selectedSample && (
                  <span style={{ fontSize: '11px', color: 'var(--primary-rose)', marginLeft: '8px', fontWeight: 600 }}>
                    [Reference Sample]
                  </span>
                )}
              </div>

              {/* Action Buttons: Replace / Remove / Viewing Tools */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsInverted(!isInverted)}
                  style={{
                    fontSize: '11px',
                    padding: '5px 10px',
                    backgroundColor: isInverted ? 'var(--bg-blush)' : 'var(--bg-surface)'
                  }}
                  title="Invert color polarity"
                >
                  <Sliders size={12} />
                  <span>Invert</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setContrastBoost(!contrastBoost)}
                  style={{
                    fontSize: '11px',
                    padding: '5px 10px',
                    backgroundColor: contrastBoost ? 'var(--bg-blush)' : 'var(--bg-surface)'
                  }}
                  title="Enhance tissue contrast"
                >
                  <Sliders size={12} />
                  <span>Contrast</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: '11px', padding: '5px 10px' }}
                >
                  <RefreshCw size={12} />
                  <span>Replace</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRemoveImage}
                  style={{ fontSize: '11px', padding: '5px 10px', color: 'var(--status-malignant)' }}
                >
                  <Trash2 size={12} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message Alert */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--status-malignant-bg)',
          border: '1px solid var(--status-malignant-border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          fontSize: '13px',
          color: 'var(--status-malignant)'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{errorMsg}</div>
        </div>
      )}

      {/* Primary Action Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleRunAnalysis}
          disabled={!hasImage || isSubmitting || !isModelReady}
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '14px 24px',
            fontSize: '15px'
          }}
        >
          {isSubmitting ? (
            <>
              <RefreshCw size={18} className="spinning" />
              <span>Running Neural Network Inspection...</span>
            </>
          ) : (
            <>
              <span>Run Analysis</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {!isModelReady && (
          <div style={{
            fontSize: '12px',
            color: 'var(--status-benign)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <ShieldAlert size={14} />
            <span>Analysis is not available yet because a trained model has not been connected.</span>
          </div>
        )}
      </div>
    </div>
  );
};
