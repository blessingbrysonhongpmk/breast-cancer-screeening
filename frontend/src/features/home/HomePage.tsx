import React from 'react';
import { Eye, Flame, ArrowRight, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { ModelStatus } from '../../services/api';

interface HomePageProps {
  modelStatus: ModelStatus | null;
  onNavigate: (view: string, modality?: 'mammogram' | 'thermal') => void;
}

export const HomePage: React.FC<HomePageProps> = ({ modelStatus, onNavigate }) => {
  const isModelReady = Boolean(
    modelStatus?.is_ready_for_inference &&
    (modelStatus?.models_available?.length ?? 0) > 0
  );

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
          <span>Research Prototype</span>
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
          AI-Assisted Breast Cancer Screening
        </h1>

        <p style={{
          fontSize: '15px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '680px',
          margin: '0 auto'
        }}>
          MammoFusion-XAI investigates explainable deep learning for breast oncology imaging.
          Upload a digital mammogram or thermal scan to inspect tissue patterns and view visual explainability maps.
        </p>

        {/* System Model Status Note */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
          {isModelReady ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--status-normal-bg)',
              border: '1px solid var(--status-normal-border)',
              fontSize: '12px',
              color: 'var(--status-normal)',
              fontWeight: 500
            }}>
              <ShieldCheck size={15} />
              <span>AI models connected and ready for analysis</span>
            </div>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--status-benign-bg)',
              border: '1px solid var(--status-benign-border)',
              fontSize: '12px',
              color: 'var(--status-benign)',
              fontWeight: 500
            }}>
              <AlertCircle size={15} />
              <span>Model weights pending connection (analysis standby)</span>
            </div>
          )}
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
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--bg-blush)',
              border: '1px solid var(--border-rose)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-rose)',
              marginBottom: '20px'
            }}>
              <Eye size={24} />
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
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--bg-blush)',
              border: '1px solid var(--border-rose)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-rose)',
              marginBottom: '20px'
            }}>
              <Flame size={24} />
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
        This research prototype is not a medical diagnosis. It must not be used to make healthcare decisions. Please consult a qualified healthcare professional.
      </div>
    </div>
  );
};
