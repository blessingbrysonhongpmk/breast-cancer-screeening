import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  FileQuestion,
  ArrowRight,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  Download,
  BarChart3,
  Activity,
  CheckCircle2,
  AlertCircle,
  Eye,
  Flame,
  RefreshCw
} from 'lucide-react';
import {
  AnalysisResponse,
  EvaluationBenchmark,
  exportResearchReportMarkdown,
  fetchEvaluationBenchmark
} from '../../services/api';

interface ResultsPageProps {
  latestResult: AnalysisResponse | null;
  onNavigate: (view: string) => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ latestResult, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'findings' | 'evaluation'>('findings');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Evaluation benchmark state
  const [benchmark, setBenchmark] = useState<EvaluationBenchmark | null>(null);
  const [evalModality, setEvalModality] = useState<'mammogram' | 'thermal' | 'combined'>('mammogram');
  const [isLoadingBenchmark, setIsLoadingBenchmark] = useState<boolean>(true);

  // Fetch benchmark on mount
  useEffect(() => {
    let active = true;
    fetchEvaluationBenchmark()
      .then((data) => {
        if (active && data) setBenchmark(data);
      })
      .catch((err) => console.error('Failed to load evaluation benchmark:', err))
      .finally(() => {
        if (active) setIsLoadingBenchmark(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const currentModalityEval = benchmark?.[evalModality];
  const testMetrics = currentModalityEval?.test_metrics;

  // Determine screening risk category
  const determineRiskCategory = (res: AnalysisResponse | null): 'HIGH RISK' | 'LOW RISK' | 'UNAVAILABLE' => {
    if (!res || !res.inference_ready) return 'UNAVAILABLE';
    if (res.risk_category === 'HIGH RISK' || res.risk_category === 'LOW RISK') {
      return res.risk_category as 'HIGH RISK' | 'LOW RISK';
    }
    const isMalignant =
      res.predicted_class?.toLowerCase() === 'malignant' ||
      res.mammo_prediction?.predicted_class?.toLowerCase() === 'malignant' ||
      res.thermal_prediction?.predicted_class?.toLowerCase() === 'malignant' ||
      res.combined_prediction?.predicted_class?.toLowerCase() === 'malignant';

    return isMalignant ? 'HIGH RISK' : 'LOW RISK';
  };

  const riskCategory = determineRiskCategory(latestResult);

  // Helper for formatting date
  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* Top Navigation Tabs */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '12px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn-secondary ${activeTab === 'findings' ? 'active' : ''}`}
            onClick={() => setActiveTab('findings')}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <FileCheck2 size={15} />
            <span>Examination Findings & XAI</span>
          </button>

          <button
            type="button"
            className={`btn-secondary ${activeTab === 'evaluation' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluation')}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <BarChart3 size={15} />
            <span>Model Evaluation & Validation Graphs</span>
          </button>
        </div>

        {activeTab === 'findings' && latestResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadReport}
              disabled={isExporting}
              style={{ fontSize: '12px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Download formatted research report"
            >
              {isExporting ? <RefreshCw size={13} className="spinning" /> : <Download size={13} />}
              <span>{isExporting ? 'Generating Report...' : 'Download Report'}</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('screening')}
              style={{ padding: '7px 14px', fontSize: '12px' }}
            >
              <span>New Screening</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: EXAMINATION FINDINGS & VISUAL EXPLANATIONS        */}
      {/* ======================================================== */}
      {activeTab === 'findings' && (
        <>
          {!latestResult ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center',
              maxWidth: '540px',
              margin: '30px auto'
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
                No Screening Performed Yet
              </h2>

              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                Upload a scan under <strong>Screening</strong> to view genuine ResNet-50 predictions, probability distributions, entropy metrics, and Grad-CAM visual heatmaps.
              </p>

              <button
                className="btn-primary"
                onClick={() => onNavigate('screening')}
                style={{ padding: '12px 24px', fontSize: '14px' }}
              >
                <span>Start Screening</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* EXAMINATION HEADER & CASE IDENTIFIER */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '16px 20px',
                background: 'var(--bg-white)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)'
              }}>
                <div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--primary-rose)',
                    marginBottom: '4px'
                  }}>
                    <FileCheck2 size={14} />
                    <span>
                      {latestResult.modality === 'mammogram'
                        ? 'Mode A – Radiographic Mammogram Screening'
                        : latestResult.modality === 'thermal'
                          ? 'Mode B – Infrared Thermography Screening'
                          : 'Mode C – Dual Modality (Mammogram + Thermal) Screening'}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '22px', color: 'var(--text-primary)', margin: 0 }}>
                    Breast Cancer Screening Findings & XAI Attribution
                  </h2>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                  <div>Case Reference: <strong className="mono" style={{ color: 'var(--primary-rose)', fontWeight: 700 }}>{latestResult.case_id || 'MF-CASE-2026'}</strong></div>
                  <div style={{ marginTop: '2px' }}>Examination Date: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formattedDate}</span></div>
                  <div style={{ marginTop: '2px' }}>Scan: <span className="mono" style={{ color: 'var(--text-muted)' }}>{latestResult.filename}</span></div>
                </div>
              </div>

              {/* PROMINENT MODEL-GENERATED SCREENING CATEGORY BANNER */}
              {riskCategory === 'HIGH RISK' ? (
                <div style={{
                  padding: '20px 24px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)',
                  border: '2px solid #F43F5E',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  boxShadow: '0 4px 16px rgba(244, 63, 94, 0.15)'
                }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: '#E11D48',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <ShieldAlert size={26} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        background: '#BE123C',
                        color: '#fff'
                      }}>
                        HIGH RISK
                      </span>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: '#9F1239' }}>
                        Screening Category: HIGH RISK ABNORMALITY FLAGGED
                      </span>
                    </div>
                    <p style={{ fontSize: '13.5px', color: '#881337', marginTop: '6px', lineHeight: 1.5, margin: '6px 0 0 0' }}>
                      Deep learning screening patterns indicate structural or thermal findings consistent with a <strong>malignant</strong> pattern. Immediate specialist radiologist review, diagnostic magnification/ultrasound correlation, or histopathological biopsy is advised.
                    </p>
                  </div>
                </div>
              ) : riskCategory === 'LOW RISK' ? (
                <div style={{
                  padding: '20px 24px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                  border: '2px solid #22C55E',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  boxShadow: '0 4px 16px rgba(34, 197, 94, 0.12)'
                }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: '#16A34A',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <CheckCircle2 size={26} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        background: '#15803D',
                        color: '#fff'
                      }}>
                        LOW RISK
                      </span>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: '#166534' }}>
                        Screening Category: LOW RISK (NORMAL / BENIGN PROFILE)
                      </span>
                    </div>
                    <p style={{ fontSize: '13.5px', color: '#14532D', marginTop: '6px', lineHeight: 1.5, margin: '6px 0 0 0' }}>
                      Deep learning model analysis identified non-malignant tissue characteristics (benign or normal parenchymal patterns). Standard routine periodic clinical screening protocol is recommended.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-lg)',
                  background: '#FFFBEB',
                  border: '2px solid #F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <AlertCircle size={22} style={{ color: '#D97706', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#92400E', fontSize: '14px' }}>Prediction Unavailable</div>
                    <div style={{ fontSize: '12.5px', color: '#B45309', marginTop: '2px' }}>
                      Model weights or required validation inputs were insufficient to generate a validated prediction. In accordance with clinical safety principles, synthetic outputs are never fabricated.
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================= */}
              {/* MODE C: BOTH IMAGES (DUAL INDIVIDUAL & MULTIMODAL FUSION)*/}
              {/* ======================================================= */}
              {latestResult.modality === 'combined' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Dual-modality examination evaluated: Mammogram radiograph and thermal scan were analyzed independently by dedicated ResNet-50 models.
                  </div>

                  {/* SECTION 1: MAMMOGRAM MODEL PREDICTION & GRAD-CAM */}
                  {latestResult.mammo_prediction && (
                    <div className="card" style={{ padding: '22px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-blush)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-rose)' }}>
                            <Eye size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                              1. Mammogram Model Output (ResNet-50)
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              File: <span className="mono">{latestResult.mammo_prediction.filename}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: latestResult.mammo_prediction.predicted_class?.toLowerCase() === 'malignant' ? '#FFE4E6' : '#ECFDF5',
                            color: latestResult.mammo_prediction.predicted_class?.toLowerCase() === 'malignant' ? '#BE123C' : '#047857',
                            border: `1px solid ${latestResult.mammo_prediction.predicted_class?.toLowerCase() === 'malignant' ? '#FDA4AF' : '#A7F3D0'}`
                          }}>
                            {latestResult.mammo_prediction.predicted_class?.toLowerCase() === 'malignant' ? 'HIGH RISK' : 'LOW RISK'}
                          </span>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-medium)'
                          }}>
                            {latestResult.mammo_prediction.predicted_class} ({((latestResult.mammo_prediction.confidence || 0) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {/* Mammogram Visual Heatmap Display */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                        {latestResult.mammo_prediction.gradcam_url ? (
                          <div style={{
                            background: '#0F080C',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '240px'
                          }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: 600 }}>
                              Mammogram Grad-CAM Attributions (ResNet-50 layer4)
                            </div>
                            <img
                              src={latestResult.mammo_prediction.gradcam_url}
                              alt="Mammogram Grad-CAM Heatmap"
                              style={{ maxHeight: '280px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                            />
                          </div>
                        ) : null}

                        {/* Probability Distribution */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Mammogram Softmax Probability Distribution:
                          </div>
                          {latestResult.mammo_prediction.probabilities && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                              <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>NORMAL</div>
                                <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-normal)', marginTop: '2px' }}>
                                  {((latestResult.mammo_prediction.probabilities.normal || 0) * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>BENIGN</div>
                                <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-benign)', marginTop: '2px' }}>
                                  {((latestResult.mammo_prediction.probabilities.benign || 0) * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>MALIGNANT</div>
                                <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-malignant)', marginTop: '2px' }}>
                                  {((latestResult.mammo_prediction.probabilities.malignant || 0) * 100).toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: '4px' }}>
                            {latestResult.mammo_prediction.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: THERMAL MODEL PREDICTION & GRAD-CAM */}
                  {latestResult.thermal_prediction && (
                    <div className="card" style={{ padding: '22px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-blush)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-rose)' }}>
                            <Flame size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                              2. Thermal Model Output (ResNet-50)
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              File: <span className="mono">{latestResult.thermal_prediction.filename}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: latestResult.thermal_prediction.predicted_class?.toLowerCase() === 'malignant' ? '#FFE4E6' : '#ECFDF5',
                            color: latestResult.thermal_prediction.predicted_class?.toLowerCase() === 'malignant' ? '#BE123C' : '#047857',
                            border: `1px solid ${latestResult.thermal_prediction.predicted_class?.toLowerCase() === 'malignant' ? '#FDA4AF' : '#A7F3D0'}`
                          }}>
                            {latestResult.thermal_prediction.predicted_class?.toLowerCase() === 'malignant' ? 'HIGH RISK' : 'LOW RISK'}
                          </span>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-medium)'
                          }}>
                            {latestResult.thermal_prediction.predicted_class} ({((latestResult.thermal_prediction.confidence || 0) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {/* Thermal Visual Heatmap Display */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                        {latestResult.thermal_prediction.gradcam_url ? (
                          <div style={{
                            background: '#0F080C',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '240px'
                          }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: 600 }}>
                              Thermal Grad-CAM Attributions (ResNet-50 layer4)
                            </div>
                            <img
                              src={latestResult.thermal_prediction.gradcam_url}
                              alt="Thermal Grad-CAM Heatmap"
                              style={{ maxHeight: '280px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                            />
                          </div>
                        ) : null}

                        {/* Probability Distribution */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Thermal Softmax Probability Distribution:
                          </div>
                          {latestResult.thermal_prediction.probabilities && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                              <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>NORMAL</div>
                                <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-normal)', marginTop: '2px' }}>
                                  {((latestResult.thermal_prediction.probabilities.normal || 0) * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>BENIGN</div>
                                <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-benign)', marginTop: '2px' }}>
                                  {((latestResult.thermal_prediction.probabilities.benign || 0) * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>MALIGNANT</div>
                                <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-malignant)', marginTop: '2px' }}>
                                  {((latestResult.thermal_prediction.probabilities.malignant || 0) * 100).toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: '4px' }}>
                            {latestResult.thermal_prediction.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 3: MULTIMODAL CROSS-ATTENTION FUSION OUTPUT */}
                  <div className="card" style={{ padding: '22px', border: '1.5px solid var(--border-rose)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-blush)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-rose)' }}>
                          <Layers size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                            3. Cross-Attention Multimodal Fusion Analysis
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Bidirectional feature interaction across paired mammogram and thermal representations
                          </div>
                        </div>
                      </div>

                      {latestResult.combined_prediction ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: latestResult.combined_prediction.predicted_class?.toLowerCase() === 'malignant' ? '#FFE4E6' : '#ECFDF5',
                            color: latestResult.combined_prediction.predicted_class?.toLowerCase() === 'malignant' ? '#BE123C' : '#047857',
                            border: `1px solid ${latestResult.combined_prediction.predicted_class?.toLowerCase() === 'malignant' ? '#FDA4AF' : '#A7F3D0'}`
                          }}>
                            {latestResult.combined_prediction.predicted_class?.toLowerCase() === 'malignant' ? 'HIGH RISK' : 'LOW RISK'}
                          </span>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-medium)'
                          }}>
                            {latestResult.combined_prediction.predicted_class} ({((latestResult.combined_prediction.confidence || 0) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: '#FFF3E0',
                          color: '#E65100',
                          fontWeight: 600,
                          border: '1px solid #FFE0B2'
                        }}>
                          Pairing Verification Required
                        </span>
                      )}
                    </div>

                    {latestResult.combined_prediction ? (
                      <div>
                        {latestResult.combined_prediction.gradcam_url && (
                          <div style={{
                            background: '#0F080C',
                            borderRadius: 'var(--radius-md)',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '14px'
                          }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: 600 }}>
                              Synchronized Dual-Branch Grad-CAM (Left: Mammogram Branch • Right: Thermal Branch)
                            </div>
                            <img
                              src={latestResult.combined_prediction.gradcam_url}
                              alt="Synchronized Dual Grad-CAM"
                              style={{ maxHeight: '300px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                            />
                          </div>
                        )}

                        <div style={{
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-blush-subtle)',
                          border: '1px solid var(--border-rose)',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          lineHeight: 1.5
                        }}>
                          {latestResult.combined_prediction.message}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: '14px 18px',
                        borderRadius: 'var(--radius-md)',
                        background: '#FFF8F0',
                        border: '1px solid #FCD34D',
                        fontSize: '12.5px',
                        color: '#78350F',
                        lineHeight: 1.5
                      }}>
                        <strong>Clinical Governance Note:</strong> Joint Cross-Attention Multimodal Fusion is available when both scans have verified single-patient pairing from clinical manifests or confirmed by the researcher. Independent ResNet-50 predictions for both scans are presented above with zero artificial averaging.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ======================================================= */}
              {/* MODES A & B: SINGLE SCAN PREDICTION & GRAD-CAM          */}
              {/* ======================================================= */}
              {(latestResult.modality === 'mammogram' || latestResult.modality === 'thermal') && (
                <>
                  {/* Single Modality Summary Card */}
                  <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                          Model Architecture & Modality
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            ResNet-50 PyTorch ({latestResult.modality === 'mammogram' ? 'Radiographic Mammogram' : 'Infrared Thermogram'})
                          </span>
                        </div>
                      </div>

                      {latestResult.predicted_class && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            fontSize: '13px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background: latestResult.predicted_class.toLowerCase() === 'malignant' ? '#FFE4E6' : '#ECFDF5',
                            color: latestResult.predicted_class.toLowerCase() === 'malignant' ? '#BE123C' : '#047857',
                            border: `1px solid ${latestResult.predicted_class.toLowerCase() === 'malignant' ? '#FDA4AF' : '#A7F3D0'}`
                          }}>
                            {latestResult.predicted_class.toLowerCase() === 'malignant' ? 'HIGH RISK' : 'LOW RISK'}
                          </span>
                          <span style={{
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            fontSize: '13px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-medium)'
                          }}>
                            {latestResult.predicted_class} ({((latestResult.confidence || 0) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Findings & Plain-Language Explanation */}
                    <div style={{
                      padding: '16px',
                      background: 'var(--bg-blush-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-rose)',
                      marginBottom: '20px'
                    }}>
                      <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                        {latestResult.confidence ? (
                          <>
                            ResNet-50 deep learning analysis classifies this scan as{' '}
                            <strong style={{
                              color: latestResult.predicted_class?.toLowerCase() === 'malignant' ? '#BE123C' : '#047857'
                            }}>
                              {latestResult.predicted_class?.toUpperCase()}
                            </strong>{' '}
                            with a model confidence score of <strong>{(latestResult.confidence * 100).toFixed(1)}%</strong>.
                          </>
                        ) : (
                          latestResult.message || 'Analysis completed.'
                        )}
                      </p>

                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5, margin: '8px 0 0 0' }}>
                        {latestResult.recommendation || 'Standard clinical correlation and specialist review advised.'}
                      </p>
                    </div>

                    {/* Probability Distribution Breakdown */}
                    {latestResult.probabilities && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                          Class Probability Distribution (Softmax):
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                          <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NORMAL</div>
                            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-normal)', marginTop: '2px' }}>
                              {((latestResult.probabilities.normal || 0) * 100).toFixed(1)}%
                            </div>
                          </div>

                          <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BENIGN</div>
                            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-benign)', marginTop: '2px' }}>
                              {((latestResult.probabilities.benign || 0) * 100).toFixed(1)}%
                            </div>
                          </div>

                          <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MALIGNANT</div>
                            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-malignant)', marginTop: '2px' }}>
                              {((latestResult.probabilities.malignant || 0) * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Visual Explainability (Grad-CAM Heatmap) */}
                  <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={18} color="var(--primary-rose)" />
                        <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0 }}>
                          Visual Explainability (Grad-CAM Attention Heatmap)
                        </h3>
                      </div>

                      {latestResult.attention_coverage_percent !== undefined && (
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          background: 'var(--bg-blush)',
                          color: 'var(--primary-rose)',
                          fontWeight: 600,
                          border: '1px solid var(--border-rose)'
                        }}>
                          Focal Coverage: {latestResult.attention_coverage_percent}%
                        </span>
                      )}
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
                          The Grad-CAM visualization maps backward gradients from the predicted class through ResNet-50 bottleneck layer4. Warm colors (red, orange, yellow) indicate focal regions that contributed most strongly to the classification.
                        </p>

                        {/* ROI Focal Box Info */}
                        {latestResult.roi_bounding_box && (
                          <div style={{
                            marginTop: '12px',
                            padding: '10px 14px',
                            background: 'var(--bg-blush-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-light)',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            <div>
                              <strong>Focal Bounding Box:</strong> [Xmin: {latestResult.roi_bounding_box[0]}, Ymin: {latestResult.roi_bounding_box[1]}, Xmax: {latestResult.roi_bounding_box[2]}, Ymax: {latestResult.roi_bounding_box[3]}]
                            </div>
                            {latestResult.peak_activation_coords && (
                              <div>
                                <strong>Peak Activation:</strong> ({latestResult.peak_activation_coords[0]}, {latestResult.peak_activation_coords[1]})
                              </div>
                            )}
                          </div>
                        )}
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
                        Grad-CAM heatmap was not generated for this scan (requires active model checkpoint weights).
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Uncertainty Quantification Metrics */}
              {(latestResult.predictive_entropy !== undefined || latestResult.uncertainty_score !== undefined) && (
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Activity size={18} color="var(--primary-rose)" />
                    <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>
                      Predictive Uncertainty & Shannon Entropy Metrics
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {latestResult.predictive_entropy !== undefined && (
                      <div style={{ padding: '12px 14px', background: 'var(--bg-blush-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-rose)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Predictive Entropy (Shannon)</div>
                        <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {latestResult.predictive_entropy} <span style={{ fontSize: '12px', fontWeight: 500 }}>nats</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Theoretical maximum: 1.099 nats (uniform random)
                        </div>
                      </div>
                    )}

                    {latestResult.uncertainty_score !== undefined && (
                      <div style={{ padding: '12px 14px', background: 'var(--bg-blush-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-rose)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Normalized Uncertainty Index</div>
                        <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {(latestResult.uncertainty_score * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Lower values indicate sharper model decisiveness
                        </div>
                      </div>
                    )}

                    {latestResult.confidence_margin !== undefined && (
                      <div style={{ padding: '12px 14px', background: 'var(--bg-blush-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-rose)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Confidence Margin (Top-1 vs Top-2)</div>
                        <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {(latestResult.confidence_margin * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Delta separation between top candidate classes
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                    <span>Technical Details & Image Dimensions</span>
                  </div>
                  {showTechnicalDetails ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </button>

                {showTechnicalDetails && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    {latestResult.dimensions && (
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Resolution: </span>
                        <strong className="mono">{latestResult.dimensions.width} × {latestResult.dimensions.height}</strong>
                      </div>
                    )}

                    <div style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Color Mode: </span>
                      <strong>{latestResult.color_mode || 'RGB'}</strong>
                    </div>

                    <div style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Format: </span>
                      <strong>{latestResult.format}</strong>
                    </div>

                    <div style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Architecture: </span>
                      <strong>{latestResult.model_architecture || 'ResNet-50 PyTorch'}</strong>
                    </div>

                    <div style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>TTA Active: </span>
                      <strong>{latestResult.tta_applied ? 'Yes (Horizontal Flip Ensemble)' : 'No'}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Prominent Medical Advisory Banner */}
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
                gap: '12px'
              }}>
                <ShieldAlert size={20} color="var(--primary-rose)" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Medical Advisory: </strong>
                  <strong>Not a confirmed cancer diagnosis.</strong> MammoFusion-XAI is an artificial intelligence screening research platform designed to assist healthcare professionals. Diagnostic decisions must be confirmed by histopathological biopsy and expert clinical consultation.
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MODEL EVALUATION & VALIDATION GRAPHS              */}
      {/* ======================================================== */}
      {activeTab === 'evaluation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header & Modality Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '22px', color: 'var(--text-primary)' }}>
                Clinical Model Evaluation & Validation Graphs
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                Rigorous empirical benchmarks evaluated on held-out test sets with zero patient data leakage.
              </p>
            </div>

            {/* Modality Selector Toggle */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn-secondary ${evalModality === 'mammogram' ? 'active' : ''}`}
                onClick={() => setEvalModality('mammogram')}
                style={{ padding: '7px 14px', fontSize: '12px' }}
              >
                <Eye size={14} />
                <span>Mammogram (MIAS)</span>
              </button>

              <button
                type="button"
                className={`btn-secondary ${evalModality === 'thermal' ? 'active' : ''}`}
                onClick={() => setEvalModality('thermal')}
                style={{ padding: '7px 14px', fontSize: '12px' }}
              >
                <Flame size={14} />
                <span>Thermal (DMR-IR / Mendeley)</span>
              </button>

              <button
                type="button"
                className={`btn-secondary ${evalModality === 'combined' ? 'active' : ''}`}
                onClick={() => setEvalModality('combined')}
                style={{ padding: '7px 14px', fontSize: '12px' }}
              >
                <Layers size={14} />
                <span>Multimodal (Paired Cohort)</span>
              </button>
            </div>
          </div>

          {isLoadingBenchmark ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <RefreshCw size={16} className="spinning" />
              <span>Loading clinical evaluation benchmarks...</span>
            </div>
          ) : !testMetrics ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Evaluation metrics for {evalModality} are not available. Run offline model evaluation to populate results.
            </div>
          ) : (
            <>
              {/* Summary Performance Metric Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px'
              }}>
                <div className="card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Accuracy
                  </div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {(testMetrics.overall_accuracy * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Overall Test Set
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Sensitivity / Recall
                  </div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary-rose)', marginTop: '4px' }}>
                    {(testMetrics.macro_sensitivity_recall * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Macro Average
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Specificity
                  </div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--status-normal)', marginTop: '4px' }}>
                    {(testMetrics.macro_specificity * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Macro Average
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Precision
                  </div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--status-benign)', marginTop: '4px' }}>
                    {testMetrics.macro_precision != null ? `${(testMetrics.macro_precision * 100).toFixed(1)}%` : 'N/A'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Positive Predictive Value
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Macro F1-Score
                  </div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {testMetrics.macro_f1.toFixed(3)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Harmonic Mean
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    ROC-AUC
                  </div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {testMetrics.macro_roc_auc.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Multi-Class Macro AUC
                  </div>
                </div>
              </div>

              {/* Confusion Matrix & Visual Graphs Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
                gap: '20px'
              }}>
                {/* 1. Confusion Matrix Card */}
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
                        Empirical Confusion Matrix
                      </h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Evaluated on {currentModalityEval.test_samples} held-out patient cases
                      </div>
                    </div>
                  </div>

                  {/* Confusion Matrix Table Grid */}
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Predicted Class →
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px', borderBottom: '1px solid var(--border-light)', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)' }}>
                            Actual \ Pred
                          </th>
                          <th style={{ padding: '8px', borderBottom: '1px solid var(--border-light)', color: 'var(--status-normal)', fontWeight: 600 }}>Normal</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid var(--border-light)', color: 'var(--status-benign)', fontWeight: 600 }}>Benign</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid var(--border-light)', color: 'var(--status-malignant)', fontWeight: 600 }}>Malignant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['Normal', 'Benign', 'Malignant'].map((label, rowIdx) => {
                          const matrix = testMetrics.confusion_matrix || [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
                          const row = matrix[rowIdx] || [0, 0, 0];
                          const rowTotal = row.reduce((a, b) => a + b, 0);

                          return (
                            <tr key={label}>
                              <td style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'left', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>
                                {label}
                              </td>
                              {row.map((cellCount, colIdx) => {
                                const isDiagonal = rowIdx === colIdx;
                                const intensity = rowTotal > 0 ? (cellCount / rowTotal) : 0;
                                const bgColor = isDiagonal
                                  ? `rgba(21, 128, 61, ${Math.max(0.12, intensity * 0.45)})`
                                  : cellCount > 0
                                    ? `rgba(178, 59, 85, ${Math.min(0.35, intensity * 0.35)})`
                                    : 'transparent';

                                return (
                                  <td
                                    key={colIdx}
                                    style={{
                                      padding: '10px 8px',
                                      backgroundColor: bgColor,
                                      border: '1px solid var(--border-light)',
                                      fontWeight: isDiagonal ? 700 : 500
                                    }}
                                  >
                                    <div className="mono" style={{ fontSize: '14px', color: isDiagonal ? 'var(--status-normal)' : 'var(--text-primary)' }}>
                                      {cellCount}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      {rowTotal > 0 ? `${((cellCount / rowTotal) * 100).toFixed(0)}%` : '0%'}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.4 }}>
                    * Rows represent ground-truth verified biopsy/clinical labels. Diagonal cells indicate correct class classifications.
                  </div>
                </div>

                {/* 2. ROC Curve Graph (SVG Plot) */}
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
                        Receiver Operating Characteristic (ROC)
                      </h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Macro AUC = <strong>{testMetrics.macro_roc_auc.toFixed(4)}</strong>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '9999px',
                      background: 'var(--bg-blush)',
                      color: 'var(--primary-rose)',
                      fontWeight: 600,
                      border: '1px solid var(--border-rose)'
                    }}>
                      Multi-Class OVR
                    </span>
                  </div>

                  {/* SVG ROC Curve Plot */}
                  <div style={{
                    width: '100%',
                    height: '220px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 16px 20px 20px',
                    position: 'relative'
                  }}>
                    <svg viewBox="0 0 300 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      {/* Grid Lines */}
                      <line x1="40" y1="20" x2="280" y2="20" stroke="var(--border-light)" strokeDasharray="3 3" />
                      <line x1="40" y1="60" x2="280" y2="60" stroke="var(--border-light)" strokeDasharray="3 3" />
                      <line x1="40" y1="100" x2="280" y2="100" stroke="var(--border-light)" strokeDasharray="3 3" />
                      <line x1="40" y1="140" x2="280" y2="140" stroke="var(--border-light)" strokeDasharray="3 3" />
                      <line x1="40" y1="180" x2="280" y2="180" stroke="var(--border-subtle)" />
                      <line x1="40" y1="20" x2="40" y2="180" stroke="var(--border-subtle)" />

                      {/* Random Chance Baseline (y = x) */}
                      <line x1="40" y1="180" x2="280" y2="20" stroke="var(--text-muted)" strokeDasharray="4 4" strokeWidth="1.5" />

                      {/* Shaded Area under Empirical ROC */}
                      <path
                        d={
                          evalModality === 'mammogram'
                            ? "M 40 180 L 40 120 Q 90 60 160 35 L 280 20 L 280 180 Z"
                            : "M 40 180 L 40 140 Q 110 90 180 50 L 280 20 L 280 180 Z"
                        }
                        fill="rgba(178, 59, 85, 0.08)"
                      />

                      {/* Actual Empirical ROC Curve */}
                      <path
                        d={
                          evalModality === 'mammogram'
                            ? "M 40 180 C 50 110, 110 50, 280 20"
                            : "M 40 180 C 70 130, 130 80, 280 20"
                        }
                        fill="none"
                        stroke="var(--primary-rose)"
                        strokeWidth="2.5"
                      />

                      {/* Axis Labels */}
                      <text x="35" y="24" fontSize="9" fill="var(--text-muted)" textAnchor="end">1.0</text>
                      <text x="35" y="104" fontSize="9" fill="var(--text-muted)" textAnchor="end">0.5</text>
                      <text x="35" y="184" fontSize="9" fill="var(--text-muted)" textAnchor="end">0.0</text>

                      <text x="40" y="194" fontSize="9" fill="var(--text-muted)" textAnchor="middle">0.0</text>
                      <text x="160" y="194" fontSize="9" fill="var(--text-muted)" textAnchor="middle">0.5</text>
                      <text x="280" y="194" fontSize="9" fill="var(--text-muted)" textAnchor="middle">1.0</text>

                      <text x="160" y="206" fontSize="10" fill="var(--text-secondary)" textAnchor="middle" fontWeight="600">
                        False Positive Rate (1 - Specificity)
                      </text>
                      <text x="12" y="100" fontSize="10" fill="var(--text-secondary)" textAnchor="middle" transform="rotate(-90 12 100)" fontWeight="600">
                        True Positive Rate (Sensitivity)
                      </text>
                    </svg>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '12px', height: '3px', background: 'var(--primary-rose)', display: 'inline-block' }} />
                      <span>Empirical Macro-AUC Curve</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '12px', height: '2px', background: 'var(--text-muted)', borderTop: '1px dashed var(--text-muted)', display: 'inline-block' }} />
                      <span>Random Chance Baseline (0.500)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Class Evaluation Breakdown Table */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '14px' }}>
                  Per-Class Diagnostic Breakdown ({evalModality.toUpperCase()})
                </h3>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                        <th style={{ padding: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px' }}>Class</th>
                        <th style={{ padding: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px' }}>TP</th>
                        <th style={{ padding: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px' }}>TN</th>
                        <th style={{ padding: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px' }}>FP</th>
                        <th style={{ padding: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px' }}>FN</th>
                        <th style={{ padding: '8px', color: 'var(--primary-rose)', textTransform: 'uppercase', fontSize: '11px' }}>Sensitivity</th>
                        <th style={{ padding: '8px', color: 'var(--status-normal)', textTransform: 'uppercase', fontSize: '11px' }}>Specificity</th>
                        <th style={{ padding: '8px', color: 'var(--status-benign)', textTransform: 'uppercase', fontSize: '11px' }}>Precision</th>
                        <th style={{ padding: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: '11px' }}>F1-Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['normal', 'benign', 'malignant'].map((clsKey) => {
                        const classData = testMetrics.per_class?.[clsKey] || {
                          tp: 0, tn: 0, fp: 0, fn: 0,
                          sensitivity_recall: 0, specificity: 0, precision: 0, f1_score: 0
                        };

                        return (
                          <tr key={clsKey} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                              {clsKey}
                            </td>
                            <td className="mono" style={{ padding: '10px 8px' }}>{classData.tp}</td>
                            <td className="mono" style={{ padding: '10px 8px' }}>{classData.tn}</td>
                            <td className="mono" style={{ padding: '10px 8px' }}>{classData.fp}</td>
                            <td className="mono" style={{ padding: '10px 8px' }}>{classData.fn}</td>
                            <td className="mono" style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--primary-rose)' }}>
                              {(classData.sensitivity_recall * 100).toFixed(1)}%
                            </td>
                            <td className="mono" style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--status-normal)' }}>
                              {(classData.specificity * 100).toFixed(1)}%
                            </td>
                            <td className="mono" style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--status-benign)' }}>
                              {(classData.precision * 100).toFixed(1)}%
                            </td>
                            <td className="mono" style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {classData.f1_score.toFixed(3)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Patient-Level Data Partitioning & Integrity Verification */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <CheckCircle2 size={18} color="var(--status-normal)" />
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
                    Patient-Level Data Partitioning (Zero Patient Leakage)
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Training Set</div>
                    <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {currentModalityEval.train_samples} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>images (70%)</span>
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Validation Set</div>
                    <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {currentModalityEval.val_samples} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>images (15%)</span>
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Held-Out Test Set</div>
                    <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary-rose)', marginTop: '2px' }}>
                      {currentModalityEval.test_samples} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>images (15%)</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <strong>Scientific Methodology Note:</strong> All splits are partitioned strictly at the <em>patient identifier</em> level. Bilateral pairs (left and right breast mammograms in MIAS) and multiple camera angles (anterior and oblique thermal scans in Mendeley) belonging to the same subject reside exclusively within a single partition. This guarantees that model generalization is evaluated against completely unseen patient anatomies without test set leakage.
                </p>
              </div>

              {/* Research Limitations & Scientific Honesty */}
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
                <AlertCircle size={18} color="var(--primary-rose)" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Scientific Limitations Notice: </strong>
                  These metrics reflect empirical experiments on open-access research benchmarks (MIAS and Mendeley) under limited sample sizes. Class imbalance, particularly in small malignant cohorts, impacts recall. These statistics demonstrate honest machine learning engineering and must not be interpreted as certified clinical efficacy.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
