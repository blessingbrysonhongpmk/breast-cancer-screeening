import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  BookOpen,
  Award,
  ChevronDown,
  ChevronUp,
  ShieldAlert
} from 'lucide-react';
import { EvaluationBenchmark, fetchEvaluationBenchmark } from '../../services/api';

export const AboutPage: React.FC = () => {
  const [benchmark, setBenchmark] = useState<EvaluationBenchmark | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  useEffect(() => {
    fetchEvaluationBenchmark()
      .then((data) => {
        if (data && (data.mammogram || data.thermal)) {
          setBenchmark(data);
        }
      })
      .catch((err) => console.error('Failed to load benchmark:', err));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '6px', color: 'var(--text-primary)' }}>
          About MammoFusion-XAI
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
          A real-time explainable deep learning platform for multimodal breast cancer screening and clinical risk inspection.
        </p>
      </div>

      {/* Purpose & Research Scope */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <BookOpen size={18} color="var(--primary-rose)" />
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Project Purpose & Scope</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          MammoFusion-XAI investigates how deep neural networks process two complementary screening modalities:
          full-field digital mammography (structural X-ray) and infrared thermography (surface thermal asymmetry).
          A core research focus is <strong>visual explainability</strong> through Gradient-weighted Class Activation
          Mapping (Grad-CAM), which highlights anatomical regions that drive the model's classifications.
        </p>
      </div>

      {/* Scientific Integrity: Separate Patient Populations */}
      <div className="card-elevated" style={{ borderLeft: '4px solid var(--primary-rose)', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <ShieldCheck size={18} color="var(--primary-rose)" />
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Scientific Integrity & Cohort Boundaries</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          The mammography collection (MIAS, UK) and thermography collection (Mendeley, Mexico) originate from
          independent patient cohorts with distinct imaging protocols and ethical consents.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '8px' }}>
          In accordance with scientific machine learning standards, <strong>unpaired synthetic multimodal fusion is prohibited</strong>.
          We evaluate unimodal baseline networks independently to prevent fabricated correlations across unrelated patients.
        </p>
      </div>

      {/* Dataset Sources */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '14px' }}>
          Verified Dataset Sources
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-blush-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-rose)' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              MIAS Mammography Database
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Mammographic Image Analysis Society (Cambridge, UK). 322 digitized 8-bit PGM raster mammograms from 161 patient bilateral pairs with Wolfe tissue density classification.
            </p>
          </div>

          <div style={{ padding: '16px', background: 'var(--bg-blush-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-rose)' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Mendeley Breast Thermography
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Infrared thermal camera series (CC BY-NC 3.0, Mexico). 357 thermal scans across three clinical projections (Anterior, Left Oblique, Right Oblique) from 119 diagnosed participants.
            </p>
          </div>
        </div>
      </div>

      {/* Mandatory Medical Disclaimer */}
      <div style={{
        padding: '18px 22px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <ShieldAlert size={22} color="var(--primary-rose)" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Important Medical Disclaimer: </strong>
          This real-time AI screening platform is an assistive diagnostic support system and does not replace evaluation by a licensed healthcare professional. Always consult a qualified medical professional for health decisions.
        </div>
      </div>

      {/* Optional Collapsible Technical Details (for researchers) */}
      <div className="card" style={{ padding: '18px 24px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <Award size={18} color="var(--primary-rose)" />
            <span>Technical Validation & Benchmark Metrics (Optional)</span>
          </div>
          {showTechnicalDetails ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
        </button>

        {showTechnicalDetails && (
          <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Below are the verified test set metrics on held-out patient cases evaluated using strict 70/15/15 patient-isolated splits:
            </p>

            {benchmark?.mammogram && (
              <div style={{ padding: '14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  ResNet-50 Mammography (Held-out Test Set)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Accuracy</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700 }}>
                      {(benchmark.mammogram.test_metrics.overall_accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sensitivity</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-rose)' }}>
                      {(benchmark.mammogram.test_metrics.macro_sensitivity_recall * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Specificity</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-normal)' }}>
                      {(benchmark.mammogram.test_metrics.macro_specificity * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Macro-F1</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700 }}>
                      {benchmark.mammogram.test_metrics.macro_f1.toFixed(3)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {benchmark?.thermal && (
              <div style={{ padding: '14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  ResNet-50 Thermography (Held-out Test Set)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Accuracy</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700 }}>
                      {(benchmark.thermal.test_metrics.overall_accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sensitivity</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-rose)' }}>
                      {(benchmark.thermal.test_metrics.macro_sensitivity_recall * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Specificity</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-normal)' }}>
                      {(benchmark.thermal.test_metrics.macro_specificity * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Macro-F1</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700 }}>
                      {benchmark.thermal.test_metrics.macro_f1.toFixed(3)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
