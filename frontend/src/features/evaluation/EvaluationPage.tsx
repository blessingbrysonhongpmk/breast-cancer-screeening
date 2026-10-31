import React, { useState, useEffect } from 'react';
import { Award, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ModelStatus, EvaluationBenchmark, fetchEvaluationBenchmark } from '../../services/api';

interface EvaluationPageProps {
  modelStatus?: ModelStatus | null;
}

export const EvaluationPage: React.FC<EvaluationPageProps> = () => {
  const [benchmark, setBenchmark] = useState<EvaluationBenchmark | null>(null);

  useEffect(() => {
    fetchEvaluationBenchmark()
      .then((data) => {
        if (data && (data.mammogram || data.thermal)) {
          setBenchmark(data);
        }
      })
      .catch((err) => console.error('Failed to fetch benchmark:', err));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>Model Evaluation & Validation Benchmark</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Standardized clinical metrics protocol and patient-isolated validation criteria for unimodal and multimodal architectures.
        </p>
      </div>

      {/* Verified Benchmark Ledger if available */}
      {benchmark ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {benchmark.mammogram && (
            <div className="card-elevated" style={{ borderLeft: '4px solid var(--primary-rose)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} color="var(--primary-rose)" />
                  <h3 style={{ fontSize: '16px' }}>ResNet-50 Mammography Test Benchmark</h3>
                </div>
                <span className="badge badge-normal">Held-out: {benchmark.mammogram.test_samples} Images</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Accuracy</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {(benchmark.mammogram.test_metrics.overall_accuracy * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sensitivity (Recall)</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary-rose)', marginTop: '2px' }}>
                    {(benchmark.mammogram.test_metrics.macro_sensitivity_recall * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Specificity</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--status-normal)', marginTop: '2px' }}>
                    {(benchmark.mammogram.test_metrics.macro_specificity * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Macro-F1</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {benchmark.mammogram.test_metrics.macro_f1.toFixed(3)}
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ROC-AUC</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--status-benign)', marginTop: '2px' }}>
                    {benchmark.mammogram.test_metrics.macro_roc_auc.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {benchmark.thermal && (
            <div className="card-elevated" style={{ borderLeft: '4px solid var(--dusty-rose)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} color="var(--primary-rose)" />
                  <h3 style={{ fontSize: '16px' }}>ResNet-50 Thermography Test Benchmark</h3>
                </div>
                <span className="badge badge-rosegold">Held-out: {benchmark.thermal.test_samples} Images</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Accuracy</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {(benchmark.thermal.test_metrics.overall_accuracy * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sensitivity (Recall)</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary-rose)', marginTop: '2px' }}>
                    {(benchmark.thermal.test_metrics.macro_sensitivity_recall * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Specificity</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--status-normal)', marginTop: '2px' }}>
                    {(benchmark.thermal.test_metrics.macro_specificity * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Macro-F1</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {benchmark.thermal.test_metrics.macro_f1.toFixed(3)}
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ROC-AUC</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--status-benign)', marginTop: '2px' }}>
                    {benchmark.thermal.test_metrics.macro_roc_auc.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card-elevated" style={{ borderLeft: '4px solid var(--status-benign)' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <AlertTriangle size={22} color="var(--status-benign)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>
                Milestone 3 Deep Learning Model Standby
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Under our strict zero-fabrication research policy, <strong>no placeholder ROC curves, synthetic confusion matrices, or simulated accuracy metrics are presented</strong>. Verified test metrics appear once training completes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Core Clinical Metric Definitions */}
      <div className="card">
        <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>Clinical Performance Metrics & Mathematical Definitions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '14px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Sensitivity (Recall)</span>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--primary-rose)' }}>TP / (TP + FN)</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Proportion of true malignant cases correctly flagged. Crucial in breast screening to minimize false negatives (missed cancers).
            </p>
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Specificity</span>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--primary-rose)' }}>TN / (TN + FP)</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Proportion of non-malignant cases accurately identified as benign or normal. High specificity prevents unnecessary follow-up biopsies.
            </p>
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Precision (PPV)</span>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--primary-rose)' }}>TP / (TP + FP)</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Positive Predictive Value: probability that a case classified as malignant is genuinely confirmed by ground truth biopsy.
            </p>
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>F1-Score</span>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--primary-rose)' }}>2·(P·R)/(P+R)</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Harmonic mean of precision and recall. Accounts for class imbalance across normal (205), benign (61), and malignant (51) samples.
            </p>
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>ROC-AUC</span>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--primary-rose)' }}>∫ TPR d(FPR)</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Area under the Receiver Operating Characteristic curve. Measures discriminator capability across continuous decision thresholds.
            </p>
          </div>
        </div>
      </div>

      {/* Patient-Isolated Splitting Protocol */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="var(--primary-rose)" />
            <h3 style={{ fontSize: '16px' }}>Cross-Validation & Splitting Architecture</h3>
          </div>
          <span className="badge badge-normal">Leakage-Proof Stratification</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
          In medical imaging, multiple views of the same subject (e.g. left and right breast in MIAS, or 3 thermal projections in Mendeley) share underlying morphological and thermal profiles. Random image-level splitting introduces optimistic leakage.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>70% Training Partition</div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Used exclusively for backpropagation and parameter weight optimization.
            </p>
          </div>
          <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>15% Validation Partition</div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Used for early stopping, learning rate decay scheduling, and hyperparameter tuning.
            </p>
          </div>
          <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>15% Test Partition (Held-Out)</div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Unseen patients reserved strictly for final benchmark reporting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};