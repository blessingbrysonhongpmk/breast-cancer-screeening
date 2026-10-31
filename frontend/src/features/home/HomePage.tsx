import React from 'react';
import {
  Eye,
  Flame,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { HealthResponse, ModelReadinessResponse } from '../../services/api';

interface HomePageProps {
  health: HealthResponse | null;
  modelReadiness: ModelReadinessResponse | null;
  onNavigate: (view: string, modality?: 'mammogram' | 'thermal') => void;
}

export const HomePage: React.FC<HomePageProps> = ({ health, modelReadiness, onNavigate }) => {
  const isBackendHealthy = Boolean(health?.status === 'healthy');
  const mammoReady = Boolean(isBackendHealthy && modelReadiness?.mammogram?.ready);
  const thermalReady = Boolean(isBackendHealthy && modelReadiness?.thermal?.ready);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      {/* Platform Header & Telemetry */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px 28px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '9999px',
            background: 'var(--bg-blush)',
            border: '1px solid var(--border-rose)',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--primary-rose)'
          }}>
            <Activity size={12} />
            Research Platform
          </span>

          <span style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontWeight: 500
          }}>
            Release 1.0 • PyTorch ResNet-50
          </span>
        </div>

        <h1 style={{
          fontSize: '30px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.025em',
          lineHeight: 1.2,
          marginBottom: '10px'
        }}>
          Multimodal Breast Oncology Imaging & Explainability
        </h1>

        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '740px',
          marginBottom: '20px'
        }}>
          MammoFusion-XAI provides rigorous deep learning evaluation on full-field mammography (MIAS cohort)
          and infrared surface thermography (Mendeley cohort). Run genuine ResNet-50 inference, quantify predictive
          entropy, and inspect layer4 Grad-CAM focal visual attributions.
        </p>

        {/* Live System Telemetry Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-light)'
        }}>
          {/* Backend Status */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: isBackendHealthy ? 'var(--status-normal-bg)' : 'var(--status-benign-bg)',
            border: `1px solid ${isBackendHealthy ? 'var(--status-normal-border)' : 'var(--status-benign-border)'}`,
            fontSize: '11px',
            color: isBackendHealthy ? 'var(--status-normal)' : 'var(--status-benign)',
            fontWeight: 600
          }}>
            {isBackendHealthy ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            <span>Backend: {isBackendHealthy ? 'Service Active (FastAPI :8000)' : 'Connecting...'}</span>
          </div>

          {/* Mammogram Model */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: mammoReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
            border: `1px solid ${mammoReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`,
            fontSize: '11px',
            color: mammoReady ? 'var(--status-normal)' : 'var(--text-muted)',
            fontWeight: 600
          }}>
            {mammoReady ? <ShieldCheck size={13} /> : <AlertCircle size={13} />}
            <span>Mammogram ResNet-50: {mammoReady ? 'Model Ready (Grad-CAM active)' : 'Not Available'}</span>
          </div>

          {/* Thermal Model */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: thermalReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
            border: `1px solid ${thermalReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`,
            fontSize: '11px',
            color: thermalReady ? 'var(--status-normal)' : 'var(--text-muted)',
            fontWeight: 600
          }}>
            {thermalReady ? <ShieldCheck size={13} /> : <AlertCircle size={13} />}
            <span>Thermal ResNet-50: {thermalReady ? 'Model Ready (Grad-CAM active)' : 'Not Available'}</span>
          </div>
        </div>
      </div>

      {/* Primary Modality Workstations */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
        gap: '20px'
      }}>
        {/* Modality 1: Mammogram */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={() => onNavigate('analyze', 'mammogram')}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'var(--bg-blush)',
                border: '1px solid var(--border-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-rose)'
              }}>
                <Eye size={22} />
              </div>

              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '9999px',
                fontWeight: 600,
                background: mammoReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
                color: mammoReady ? 'var(--status-normal)' : 'var(--text-muted)',
                border: `1px solid ${mammoReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`
              }}>
                {mammoReady ? 'Verified Ready' : 'Model not available'}
              </span>
            </div>

            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Radiographic Morphology
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0 8px', color: 'var(--text-primary)' }}>
              Full-Field X-Ray Mammography
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              Inspect tissue density patterns, circumscribed masses, and architectural distortions using 224×224 normalized grayscale scans.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginBottom: '20px',
              padding: '10px 12px',
              background: 'var(--bg-blush-subtle)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)'
            }}>
              <div>• <strong>Architecture:</strong> ResNet-50 (layer4 bottleneck)</div>
              <div>• <strong>Categories:</strong> Normal, Benign, Malignant</div>
              <div>• <strong>Explainability:</strong> Dual-view Grad-CAM heatmap</div>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: '11px 16px', fontSize: '13px' }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('analyze', 'mammogram');
            }}
          >
            <span>Launch Mammography Analysis</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Modality 2: Thermal Image */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={() => onNavigate('analyze', 'thermal')}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'var(--bg-blush)',
                border: '1px solid var(--border-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-rose)'
              }}>
                <Flame size={22} />
              </div>

              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '9999px',
                fontWeight: 600,
                background: thermalReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
                color: thermalReady ? 'var(--status-normal)' : 'var(--text-muted)',
                border: `1px solid ${thermalReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`
              }}>
                {thermalReady ? 'Verified Ready' : 'Model not available'}
              </span>
            </div>

            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Physiological Thermography
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0 8px', color: 'var(--text-primary)' }}>
              Infrared Breast Thermography
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              Analyze metabolic heat distribution, vascular hyperthermia gradients, and temperature asymmetry across breast quadrants.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginBottom: '20px',
              padding: '10px 12px',
              background: 'var(--bg-blush-subtle)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)'
            }}>
              <div>• <strong>Architecture:</strong> ResNet-50 3-Channel RGB</div>
              <div>• <strong>Categories:</strong> Normal, Benign, Malignant</div>
              <div>• <strong>Explainability:</strong> Focal hyperthermic localization</div>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: '11px 16px', fontSize: '13px' }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('analyze', 'thermal');
            }}
          >
            <span>Launch Thermography Analysis</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Quick-Access Research Benchmark Suite */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Quick-Start Benchmarks
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Test genuine pre-evaluated scans from the peer-reviewed research cohorts:
            </div>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('analyze')}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <span>Open Analysis Workspace</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('analyze', 'mammogram')}
            style={{
              padding: '10px 14px',
              justifyContent: 'space-between',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>MIAS Case P001</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mammogram • Benign Circumscribed Mass</div>
            </div>
            <ArrowRight size={14} color="var(--primary-rose)" />
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('analyze', 'mammogram')}
            style={{
              padding: '10px 14px',
              justifyContent: 'space-between',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>MIAS Case P002</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mammogram • Normal Glandular Tissue</div>
            </div>
            <ArrowRight size={14} color="var(--primary-rose)" />
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('analyze', 'thermal')}
            style={{
              padding: '10px 14px',
              justifyContent: 'space-between',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>Mendeley IIR0110</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Thermal • Frontal Anterior View</div>
            </div>
            <ArrowRight size={14} color="var(--primary-rose)" />
          </button>
        </div>
      </div>

      {/* Mandatory Medical Disclaimer Banner */}
      <div style={{
        padding: '14px 18px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        fontSize: '12px',
        color: 'var(--text-muted)',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <AlertCircle size={16} color="var(--primary-rose)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Scientific Research Notice:</strong> MammoFusion-XAI is an academic research platform for evaluating explainable computer vision in oncology imaging. Model outputs and Grad-CAM heatmaps do not provide medical screening or diagnosis.
        </span>
      </div>
    </div>
  );
};
