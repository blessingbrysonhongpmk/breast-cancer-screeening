import React from 'react';
import { Eye, Flame, ArrowRight, ShieldCheck, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      {/* Hero Introduction */}
      <div style={{ textAlign: 'center', paddingTop: '16px', paddingBottom: '8px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '9999px',
          background: 'var(--bg-blush)',
          border: '1px solid var(--border-rose)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--primary-rose)',
          marginBottom: '16px'
        }}>
          <Sparkles size={14} />
          <span>Breast Imaging Research Platform</span>
        </div>

        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '36px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.25,
          marginBottom: '14px'
        }}>
          Explainable AI for Breast Imaging Research
        </h1>

        <p style={{
          fontSize: '15px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '680px',
          margin: '0 auto'
        }}>
          MammoFusion-XAI evaluates explainable deep learning methods on breast mammography and infrared thermography research datasets.
          Upload an image to inspect tissue features and generate Grad-CAM visual attribution maps.
        </p>

        {/* Separated Backend Health & Per-Modality Model Readiness Bar */}
        <div style={{
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {/* Backend Status */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            background: isBackendHealthy ? 'var(--status-normal-bg)' : 'var(--status-benign-bg)',
            border: `1px solid ${isBackendHealthy ? 'var(--status-normal-border)' : 'var(--status-benign-border)'}`,
            fontSize: '12px',
            color: isBackendHealthy ? 'var(--status-normal)' : 'var(--status-benign)',
            fontWeight: 500
          }}>
            {isBackendHealthy ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>Backend: {isBackendHealthy ? 'Connected & Verified' : 'Connecting...'}</span>
          </div>

          {/* Mammogram Model Readiness */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            background: mammoReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
            border: `1px solid ${mammoReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`,
            fontSize: '12px',
            color: mammoReady ? 'var(--status-normal)' : 'var(--text-muted)',
            fontWeight: 500
          }}>
            {mammoReady ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
            <span>Mammogram ResNet-50: {mammoReady ? 'Model Ready' : 'Model not available'}</span>
          </div>

          {/* Thermal Model Readiness */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            background: thermalReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
            border: `1px solid ${thermalReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`,
            fontSize: '12px',
            color: thermalReady ? 'var(--status-normal)' : 'var(--text-muted)',
            fontWeight: 500
          }}>
            {thermalReady ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
            <span>Thermal ResNet-50: {thermalReady ? 'Model Ready' : 'Model not available'}</span>
          </div>
        </div>
      </div>

      {/* Primary Workflow Actions (Two Large Obvious Choices) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
        gap: '24px'
      }}>
        {/* Option 1: Mammogram */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '28px',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease'
          }}
          onClick={() => onNavigate('analyze', 'mammogram')}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'var(--bg-blush)',
                border: '1px solid var(--border-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-rose)'
              }}>
                <Eye size={24} />
              </div>

              <span style={{
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '9999px',
                fontWeight: 600,
                background: mammoReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
                color: mammoReady ? 'var(--status-normal)' : 'var(--text-muted)',
                border: `1px solid ${mammoReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`
              }}>
                {mammoReady ? 'Model Ready' : 'Model not available'}
              </span>
            </div>

            <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Analyze a Mammogram
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
              Inspect full-field X-ray mammography for structural tissue density, microcalcifications, and architectural masses.
            </p>
          </div>

          <button
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: '14px' }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('analyze', 'mammogram');
            }}
          >
            <span>Start Mammogram Analysis</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Option 2: Thermal Image */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '28px',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease'
          }}
          onClick={() => onNavigate('analyze', 'thermal')}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'var(--bg-blush)',
                border: '1px solid var(--border-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-rose)'
              }}>
                <Flame size={24} />
              </div>

              <span style={{
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '9999px',
                fontWeight: 600,
                background: thermalReady ? 'var(--status-normal-bg)' : 'var(--bg-muted)',
                color: thermalReady ? 'var(--status-normal)' : 'var(--text-muted)',
                border: `1px solid ${thermalReady ? 'var(--status-normal-border)' : 'var(--border-light)'}`
              }}>
                {thermalReady ? 'Model Ready' : 'Model not available'}
              </span>
            </div>

            <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Analyze a Thermal Image
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
              Inspect infrared surface thermography to detect physiological temperature gradients and vascular asymmetries.
            </p>
          </div>

          <button
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: '14px' }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('analyze', 'thermal');
            }}
          >
            <span>Start Thermal Analysis</span>
            <ArrowRight size={16} />
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
        textAlign: 'center'
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Medical Disclaimer: </strong>
        This research platform is an educational tool for medical imaging research and must not be used for clinical diagnosis or healthcare decisions. Always consult a qualified medical professional.
      </div>
    </div>
  );
};
