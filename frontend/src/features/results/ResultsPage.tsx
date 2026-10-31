import React, { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { AnalysisResponse, fetchRecentAnalyses } from '../../services/api';

interface ResultsPageProps {
  latestResult: AnalysisResponse | null;
  onNavigate: (view: string) => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ latestResult, onNavigate }) => {
  const [recentAnalyses, setRecentAnalyses] = useState<any[]>([]);

  useEffect(() => {
    fetchRecentAnalyses()
      .then((data) => setRecentAnalyses(data))
      .catch((err) => console.error('Failed to load recent analyses:', err));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>Analysis Records & Pipeline Ledger</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Audited logs of image inputs processed by the FastAPI backend runtime. Displays verified contract payloads.
        </p>
      </div>

      {/* Latest Analysis Inspection Card */}
      {latestResult ? (
        <div className="card-elevated" style={{ borderLeft: '4px solid var(--primary-rose)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="var(--primary-rose)" />
              <h3 style={{ fontSize: '18px' }}>Latest Pipeline Execution</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge badge-normal">Status: {latestResult.status}</span>
              <span className="badge badge-rosegold">Modality: {latestResult.modality.toUpperCase()}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Filename</div>
              <div className="mono" style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px', wordBreak: 'break-all' }}>
                {latestResult.filename}
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verified Dimensions</div>
              <div className="mono" style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>
                {latestResult.dimensions.width} × {latestResult.dimensions.height} px
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Color Mode & Format</div>
              <div className="mono" style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>
                {latestResult.color_mode} • {latestResult.format}
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Inference Readiness</div>
              <div className="mono" style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px', color: 'var(--status-benign)' }}>
                {latestResult.inference_ready ? 'Available' : 'Awaiting Weights'}
              </div>
            </div>
          </div>

          {/* Genuine Deep Learning Prediction Box */}
          {latestResult.inference_ready && latestResult.predicted_class && (
            <div style={{ padding: '16px', background: 'var(--bg-blush)', border: '1px solid var(--border-rose)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ResNet-50 Predicted Diagnosis
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '14px',
                      fontWeight: 700,
                      background: latestResult.predicted_class === 'malignant' ? 'var(--status-malignant-bg)' : latestResult.predicted_class === 'benign' ? 'var(--status-benign-bg)' : 'var(--status-normal-bg)',
                      color: latestResult.predicted_class === 'malignant' ? 'var(--status-malignant)' : latestResult.predicted_class === 'benign' ? 'var(--status-benign)' : 'var(--status-normal)',
                      border: `1px solid ${latestResult.predicted_class === 'malignant' ? 'var(--status-malignant-border)' : latestResult.predicted_class === 'benign' ? 'var(--status-benign-border)' : 'var(--status-normal-border)'}`
                    }}>
                      {latestResult.predicted_class.toUpperCase()}
                    </span>
                    <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {(Number(latestResult.confidence || 0) * 100).toFixed(1)}% Confidence
                    </span>
                  </div>
                </div>
                <span className="badge badge-rosegold">Backbone: ResNet-50</span>
              </div>

              {/* Class Probability Distribution */}
              {latestResult.probabilities && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginTop: '12px' }}>
                  <div style={{ padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NORMAL</div>
                    <div className="mono" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--status-normal)' }}>
                      {((latestResult.probabilities.normal || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BENIGN</div>
                    <div className="mono" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--status-benign)' }}>
                      {((latestResult.probabilities.benign || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>MALIGNANT</div>
                    <div className="mono" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--status-malignant)' }}>
                      {((latestResult.probabilities.malignant || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Grad-CAM Thumbnail if present */}
              {latestResult.gradcam_url && (
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <img
                    src={latestResult.gradcam_url}
                    alt="Grad-CAM Activation Map"
                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-rose)' }}
                  />
                  <div>
                    <strong style={{ fontSize: '12px', color: 'var(--primary-rose)' }}>Grad-CAM Attribution Generated</strong>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Gradient backpropagation from layer4 mapped to spatial coordinates.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ padding: '14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Engine Diagnostics
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {latestResult.message}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              <strong>Recommended Action:</strong> {latestResult.recommendation}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn-secondary" onClick={() => onNavigate('explainability')}>
              Inspect Explainability Criteria <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <ClipboardList size={36} color="var(--dusty-rose)" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ fontSize: '16px', marginBottom: '6px' }}>No Active Analysis Record in Memory</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 20px' }}>
            Submit an image from the Mammography or Thermal workspace to trigger verified server-side ingestion and logging.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="btn-primary" onClick={() => onNavigate('mammogram')}>
              Run Mammogram Inspection
            </button>
            <button className="btn-secondary" onClick={() => onNavigate('thermal')}>
              Run Thermal Inspection
            </button>
          </div>
        </div>
      )}

      {/* Recent Analysis Ledger from API */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--primary-rose)" />
            <h3 style={{ fontSize: '16px' }}>Runtime Session History</h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {recentAnalyses.length} events logged
          </span>
        </div>

        {recentAnalyses.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            Session ledger is empty. Submitting images in either modality workspace records an entry here.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Modality</th>
                  <th>Filename</th>
                  <th>Dimensions</th>
                  <th>Inference State</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentAnalyses.map((rec, idx) => (
                  <tr key={idx}>
                    <td className="mono" style={{ fontSize: '11px' }}>{rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString() : 'Recent'}</td>
                    <td><span className="badge badge-normal">{rec.modality}</span></td>
                    <td className="mono" style={{ fontWeight: 500 }}>{rec.filename}</td>
                    <td className="mono">{rec.dimensions ? `${rec.dimensions.width}×${rec.dimensions.height}` : '—'}</td>
                    <td>
                      <span className="badge badge-rosegold">
                        {rec.inference_ready ? 'Model Inferenced' : 'Milestone 2 Ingestion'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--status-normal)', fontWeight: 600, fontSize: '11px' }}>
                        ✓ {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mandatory Clinical Research Disclaimer */}
      <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <AlertTriangle size={20} color="var(--status-benign)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Investigational Research Disclaimer:</strong>
          <br />
          MammoFusion-XAI Risk is an academic exploratory decision-support system. It is not an FDA-cleared, CE-marked, or MHRA-approved medical device. It cannot be used for direct clinical diagnosis, triage, or definitive patient management. All imaging decisions require evaluation by a board-certified radiologist.
        </div>
      </div>
    </div>
  );
};
