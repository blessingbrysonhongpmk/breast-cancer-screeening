import React, { useState } from 'react';
import {
  FileCheck2,
  FileQuestion,
  ArrowRight,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  Download
} from 'lucide-react';
import { AnalysisResponse, exportResearchReportMarkdown } from '../../services/api';

interface ResultsPageProps {
  latestResult: AnalysisResponse | null;
  onNavigate: (view: string) => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ latestResult, onNavigate }) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleDownloadReport = async () => {
    if (!latestResult) return;
    setIsExporting(true);
    try {
      const data = await exportResearchReportMarkdown(latestResult);
      const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!latestResult) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
        maxWidth: '540px',
        margin: '40px auto 0'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--bg-blush)',
          border: '1px solid var(--border-rose)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary-rose)',
          marginBottom: '20px'
        }}>
          <FileQuestion size={32} />
        </div>

        <h2 style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--text-primary)' }}>
          No Analysis Performed Yet
        </h2>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
          Upload a breast mammogram or thermal scan to inspect findings, classification probabilities, and Grad-CAM visual explainability maps.
        </p>

        <button
          className="btn-primary"
          onClick={() => onNavigate('analyze')}
          style={{ padding: '12px 24px', fontSize: '14px' }}
        >
          <span>Start New Analysis</span>
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  const predictedClass = latestResult.predicted_class?.toLowerCase();
  const confidencePercent = latestResult.confidence ? (latestResult.confidence * 100).toFixed(1) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--primary-rose)',
            marginBottom: '4px'
          }}>
            <FileCheck2 size={14} />
            <span>Analysis Result • {latestResult.modality.toUpperCase()}</span>
          </div>
          <h2 style={{ fontSize: '24px', color: 'var(--text-primary)' }}>
            Scan Findings & Explainability
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownloadReport}
            disabled={isExporting}
            style={{ fontSize: '13px', padding: '9px 16px' }}
            title="Download formatted research report"
          >
            <Download size={14} />
            <span>{isExporting ? 'Generating...' : 'Download Report'}</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => onNavigate('analyze')}
            style={{ padding: '9px 16px', fontSize: '13px' }}
          >
            <span>Start Another Analysis</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Model Output Summary Card */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Model Prediction (Research Output — Not a Clinical Diagnosis)
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Target: <span className="mono" style={{ fontWeight: 600 }}>{latestResult.filename}</span>
            </div>
          </div>

          {predictedClass && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '14px',
              fontWeight: 700,
              textTransform: 'uppercase',
              background: predictedClass === 'malignant'
                ? 'var(--status-malignant-bg)'
                : predictedClass === 'benign'
                ? 'var(--status-benign-bg)'
                : 'var(--status-normal-bg)',
              color: predictedClass === 'malignant'
                ? 'var(--status-malignant)'
                : predictedClass === 'benign'
                ? 'var(--status-benign)'
                : 'var(--status-normal)',
              border: `1px solid ${
                predictedClass === 'malignant'
                  ? 'var(--status-malignant-border)'
                  : predictedClass === 'benign'
                  ? 'var(--status-benign-border)'
                  : 'var(--status-normal-border)'
              }`
            }}>
              {predictedClass}
            </span>
          )}
        </div>

        {/* Detailed Findings Text */}
        <div style={{
          padding: '16px',
          background: 'var(--bg-blush-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-rose)',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            {confidencePercent ? (
              <>
                The neural network model classified this scan as{' '}
                <strong style={{
                  color: predictedClass === 'malignant'
                    ? 'var(--status-malignant)'
                    : predictedClass === 'benign'
                    ? 'var(--status-benign)'
                    : 'var(--status-normal)'
                }}>
                  {predictedClass?.toUpperCase()}
                </strong>{' '}
                with <strong>{confidencePercent}%</strong> confidence.
              </>
            ) : (
              latestResult.message || 'Analysis completed.'
            )}
          </p>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {latestResult.recommendation || 'Standard clinical correlation and specialist review advised.'}
          </p>
        </div>

        {/* Probability Distribution Breakdown */}
        {latestResult.probabilities && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
              Class Probability Distribution:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NORMAL</div>
                <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-normal)', marginTop: '2px' }}>
                  {((latestResult.probabilities.normal || 0) * 100).toFixed(1)}%
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BENIGN</div>
                <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-benign)', marginTop: '2px' }}>
                  {((latestResult.probabilities.benign || 0) * 100).toFixed(1)}%
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MALIGNANT</div>
                <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-malignant)', marginTop: '2px' }}>
                  {((latestResult.probabilities.malignant || 0) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
              * Softmax activation scores represent model output distributions across research training categories and are not clinical probabilities.
            </div>
          </div>
        )}
      </div>

      {/* Visual Explainability (Grad-CAM Saliency) */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Layers size={18} color="var(--primary-rose)" />
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>
            Visual Explainability (Grad-CAM)
          </h3>
        </div>

        {latestResult.gradcam_url ? (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#0F080C',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              minHeight: '280px',
              maxHeight: '440px',
              overflow: 'hidden'
            }}>
              <img
                src={latestResult.gradcam_url}
                alt="Grad-CAM saliency map"
                style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '14px', lineHeight: 1.5 }}>
              The Grad-CAM heatmap overlays the input scan with gradient saliency. Warm colors (red, orange, yellow) indicate anatomical regions that contributed most strongly to the model’s prediction.
            </p>
          </div>
        ) : (
          <div style={{
            padding: '24px',
            background: 'var(--bg-muted)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--text-muted)'
          }}>
            Grad-CAM heatmap was not generated for this scan (requires loaded neural network weights).
          </div>
        )}
      </div>

      {/* Collapsible Technical Details */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <Info size={16} />
            <span>Technical Details & Metadata</span>
          </div>
          {showTechnicalDetails ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </button>

        {showTechnicalDetails && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Resolution: </span>
              <strong className="mono">{latestResult.dimensions.width} × {latestResult.dimensions.height}</strong>
            </div>

            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Color Mode: </span>
              <strong>{latestResult.color_mode}</strong>
            </div>

            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Format: </span>
              <strong>{latestResult.format}</strong>
            </div>

            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Architecture: </span>
              <strong>ResNet-50 Unimodal</strong>
            </div>

            {latestResult.predictive_entropy !== undefined && (
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Predictive Entropy: </span>
                <strong className="mono">{latestResult.predictive_entropy} nats</strong>
              </div>
            )}

            {latestResult.uncertainty_score !== undefined && (
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Uncertainty Index: </span>
                <strong className="mono">{(latestResult.uncertainty_score * 100).toFixed(1)}%</strong>
              </div>
            )}

            {latestResult.attention_coverage_percent !== undefined && (
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Focal Coverage: </span>
                <strong className="mono">{latestResult.attention_coverage_percent}%</strong>
              </div>
            )}

            {latestResult.peak_activation_coords && (
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Focal Peak (X, Y): </span>
                <strong className="mono">({latestResult.peak_activation_coords[0]}, {latestResult.peak_activation_coords[1]})</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Medical Disclaimer Banner */}
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
