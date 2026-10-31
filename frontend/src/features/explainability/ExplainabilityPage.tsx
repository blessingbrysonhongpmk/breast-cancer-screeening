import React, { useState } from 'react';
import { Layers, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import { SampleItem, fetchSamples, getSampleImageUrl, ModelStatus } from '../../services/api';

interface ExplainabilityPageProps {
  modelStatus?: ModelStatus | null;
}

export const ExplainabilityPage: React.FC<ExplainabilityPageProps> = ({ modelStatus }) => {
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);

  const isTrained = Boolean(
    modelStatus?.is_ready_for_inference &&
    (modelStatus?.models_available?.length ?? 0) > 0
  );

  React.useEffect(() => {
    fetchSamples()
      .then((data) => {
        setSamples(data);
        if (data.length > 0) setSelectedSample(data[0]);
      })
      .catch((err) => console.error('Failed to load samples for XAI:', err));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0, width: '100%' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>Explainable AI (Grad-CAM) Framework</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Gradient-weighted Class Activation Mapping architecture for spatial saliency and localization validation.
        </p>
      </div>

      {/* Scientific Integrity Banner */}
      <div className="card-elevated" style={{ borderLeft: '4px solid var(--primary-rose)' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <ShieldAlert size={22} color="var(--primary-rose)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Strict Zero-Fabrication Scientific Guarantee</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              In clinical AI evaluation, rendering simulated Gaussian blurs or decorative heatmaps without a genuine backpropagated PyTorch computational graph constitutes scientific fraud. MammoFusion-XAI will <strong>only render heatmaps computed directly from trained CNN gradients</strong> once compatible weights are verified in memory. Below is the verified runtime inspection harness.
            </p>
          </div>
        </div>
      </div>

      {/* Dual Canvas: Original vs Grad-CAM Attribution */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--primary-rose)" />
            <h3 style={{ fontSize: '16px' }}>Dual-Canvas Attribution Viewport</h3>
          </div>
          {/* Sample quick switcher */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Reference:</span>
            <select
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}
              value={selectedSample?.id || ''}
              onChange={(e) => {
                const found = samples.find((s) => s.id === e.target.value);
                if (found) setSelectedSample(found);
              }}
            >
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.modality.toUpperCase()}] {s.filename} ({s.label})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
          {/* Left Canvas: Radiographic Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Input Radiograph (Original 1024×1024)
              </span>
              <span className="badge badge-normal">{selectedSample?.modality.toUpperCase()}</span>
            </div>
            <div style={{
              background: '#0F080C',
              borderRadius: 'var(--radius-md)',
              minHeight: '340px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {selectedSample ? (
                <img
                  src={getSampleImageUrl(selectedSample.modality, selectedSample.filename)}
                  alt="Original input"
                  style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ color: '#826674', fontSize: '12px' }}>Loading reference...</span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Case: <strong className="mono">{selectedSample?.filename}</strong></span>
              <span>Truth: <strong style={{ color: 'var(--primary-rose)' }}>{selectedSample?.label.toUpperCase()}</strong></span>
            </div>
          </div>

          {/* Right Canvas: Grad-CAM Attribution Overlay */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Grad-CAM Activation Map (Target Layer: ResNet-50 layer4)
              </span>
              <span className={isTrained ? 'badge badge-normal' : 'badge badge-standby'}>
                {isTrained ? 'PyTorch Hooks Ready' : 'Training Pending'}
              </span>
            </div>
            <div style={{
              background: '#1A0E15',
              borderRadius: 'var(--radius-md)',
              minHeight: '340px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              border: isTrained ? '1px solid var(--border-rose)' : '1px dashed var(--border-dashed)',
              position: 'relative'
            }}>
              {isTrained ? (
                <>
                  <CheckCircle2 size={36} color="var(--status-normal)" style={{ marginBottom: '12px' }} />
                  <h4 style={{ fontSize: '15px', color: '#FDFBF9', marginBottom: '6px' }}>
                    Grad-CAM Hooks Active in Memory
                  </h4>
                  <p style={{ fontSize: '12px', color: '#E8DCDA', maxWidth: '340px', lineHeight: 1.5 }}>
                    Real gradient backpropagation hooks are registered on the ResNet-50 bottleneck block (<code className="mono">layer4.2.conv3</code>).
                  </p>
                  <div className="mono" style={{
                    background: 'rgba(0,0,0,0.5)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    color: '#FAF7F2',
                    fontSize: '11px',
                    marginTop: '10px',
                    marginBottom: '10px'
                  }}>
                    {"α_k^c = (1/Z) Σ_i Σ_j (∂y^c / ∂A_{i,j}^k)"}
                  </div>
                  <p style={{ fontSize: '11px', color: '#C86D80', maxWidth: '320px' }}>
                    Upload or test an image in the Mammogram or Thermal viewport to generate live Grad-CAM heatmaps.
                  </p>
                </>
              ) : (
                <>
                  <Clock size={32} color="var(--dusty-rose)" style={{ marginBottom: '12px' }} />
                  <h4 style={{ fontSize: '14px', color: '#FDFBF9', marginBottom: '6px' }}>
                    Grad-CAM Unavailable: Training Pending
                  </h4>
                  <p style={{ fontSize: '12px', color: '#C86D80', maxWidth: '300px', lineHeight: 1.5 }}>
                    Grad-CAM requires calculating partial derivatives on trained weights:
                  </p>
                  <div className="mono" style={{
                    background: 'rgba(0,0,0,0.5)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    color: '#FAF7F2',
                    fontSize: '11px',
                    marginTop: '8px',
                    marginBottom: '10px'
                  }}>
                    {"α_k^c = (1/Z) Σ_i Σ_j (∂y^c / ∂A_{i,j}^k)"}
                  </div>
                  <p style={{ fontSize: '11px', color: '#A68D9A', maxWidth: '320px' }}>
                    Trained weights are required before gradient maps can be rendered. Synthetic heatmaps are disabled.
                  </p>
                </>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Colormap: <strong>Turbo (Zero baseline)</strong></span>
              <span>Backbone: <strong>ResNet-50 (Unimodal)</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Grad-CAM Mathematical & Implementation Pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px', minWidth: 0 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle2 size={16} color="var(--status-normal)" />
            <h4 style={{ fontSize: '13px' }}>1. Forward Activation Hook</h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {"Extracts feature activations A^k from the final bottleneck convolutional block where spatial coordinates correlate to anatomical lesion sites."}
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle2 size={16} color="var(--status-normal)" />
            <h4 style={{ fontSize: '13px' }}>2. Backward Gradient Hook</h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {"Computes gradients of score y^c with respect to feature maps, global-average-pooled to determine importance weights α_k^c."}
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle2 size={16} color="var(--status-normal)" />
            <h4 style={{ fontSize: '13px' }}>3. Positive Rectification (ReLU)</h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {"Applies ReLU to isolate features that have a positive influence on the target class (benign vs malignant), eliminating non-informative suppressions."}
          </p>
        </div>
      </div>
    </div>
  );
};
