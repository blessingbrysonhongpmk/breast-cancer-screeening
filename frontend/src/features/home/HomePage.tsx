import React from 'react';
import {
  Eye,
  Flame,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Activity,
  CheckCircle2,
  Cpu,
  Layers,
  Database
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
            Final Year Engineering Project • ResNet-50 PyTorch
          </span>
        </div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.025em',
          lineHeight: 1.25,
          marginBottom: '10px'
        }}>
          Multimodal Explainable AI-Based Breast Cancer Screening and Risk Prediction System
        </h1>

        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '760px',
          marginBottom: '20px'
        }}>
          A clinical research platform integrating full-field digital mammography (MIAS cohort) and infrared surface thermography (Mendeley cohort). Features real ResNet-50 inference, predictive Shannon entropy quantification, layer4 Grad-CAM focal visual attributions, and patient-isolated validation.
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
            <span>Backend: {isBackendHealthy ? 'FastAPI Service Connected' : 'Connecting to Server...'}</span>
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
            <span>Mammogram ResNet-50: {mammoReady ? 'Ready (Grad-CAM active)' : 'Not Available'}</span>
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
            <span>Thermal ResNet-50: {thermalReady ? 'Ready (Grad-CAM active)' : 'Not Available'}</span>
          </div>
        </div>
      </div>

      {/* Primary Modality Examination Cards */}
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
          onClick={() => onNavigate('examination', 'mammogram')}
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
                {mammoReady ? 'Model Ready' : 'Model Not Available'}
              </span>
            </div>

            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Structural Radiography
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0 8px', color: 'var(--text-primary)' }}>
              Full-Field Digital Mammography
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              Examine tissue density, circumscribed masses, and microcalcifications using 224×224 normalized grayscale scans from the verified MIAS cohort.
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
              <div>• <strong>Network:</strong> ResNet-50 (layer4 feature maps)</div>
              <div>• <strong>Outputs:</strong> Normal, Benign, Malignant</div>
              <div>• <strong>XAI:</strong> Gradient-weighted Class Activation Mapping</div>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: '11px 16px', fontSize: '13px' }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('examination', 'mammogram');
            }}
          >
            <span>Launch Mammogram Examination</span>
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
          onClick={() => onNavigate('examination', 'thermal')}
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
                {thermalReady ? 'Model Ready' : 'Model Not Available'}
              </span>
            </div>

            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Physiological Thermography
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0 8px', color: 'var(--text-primary)' }}>
              Infrared Breast Thermography
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              Analyze metabolic thermal patterns, vascular asymmetry, and localized hyperthermia across frontal and oblique projections (Mendeley cohort).
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
              <div>• <strong>Network:</strong> ResNet-50 3-Channel RGB</div>
              <div>• <strong>Outputs:</strong> Normal, Benign, Malignant</div>
              <div>• <strong>XAI:</strong> Hyperthermic gradient localization</div>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: '11px 16px', fontSize: '13px' }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('examination', 'thermal');
            }}
          >
            <span>Launch Thermography Examination</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Quick-Access Reference Case Suite */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Reference Case Benchmarks
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Test pre-evaluated scans from the peer-reviewed research cohorts:
            </div>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('examination')}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <span>Open Examination Workspace</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('examination', 'mammogram')}
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
            onClick={() => onNavigate('examination', 'mammogram')}
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
            onClick={() => onNavigate('examination', 'thermal')}
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

      {/* Core Engineering Methodology Highlights */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px'
      }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Layers size={16} color="var(--primary-rose)" />
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Explainable AI</h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Grad-CAM visual attributions calculate exact target gradients through ResNet-50 layer4 to map high-salience tumor and vascular regions.
          </p>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Cpu size={16} color="var(--primary-rose)" />
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Uncertainty & TTA</h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Shannon entropy metrics and bilateral test-time augmentation (TTA) measure predictive stability and confidence intervals.
          </p>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Database size={16} color="var(--primary-rose)" />
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Zero Leakage</h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Strict patient-level data partitioning prevents data leakage between training, validation, and held-out test evaluation benchmarks.
          </p>
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
