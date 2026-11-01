import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight, Eye, Flame, RefreshCw, Trash2, ShieldCheck } from 'lucide-react';
import { fetchRecentAnalyses, clearRecentAnalyses, AnalysisResponse } from '../../services/api';

interface HistoryPageProps {
  onNavigate: (view: string) => void;
  onSelectResult?: (result: AnalysisResponse) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onNavigate, onSelectResult }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await fetchRecentAnalyses();
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load recent analyses:', e);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await clearRecentAnalyses();
      setHistory([]);
      setShowClearConfirm(false);
    } catch (e) {
      console.error('Failed to clear history:', e);
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchRecentAnalyses()
      .then((data) => {
        if (active) {
          setHistory(Array.isArray(data) ? data : []);
          setIsLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          console.error('Failed to load recent analyses:', e);
          setHistory([]);
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const formatCaseReference = (filename: string, index: number): string => {
    const clean = (filename || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const prefix = clean.length >= 4 ? clean.slice(0, 8) : `CASE-${String(index + 1).padStart(3, '0')}`;
    return `REF-${prefix}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: '4px', color: 'var(--text-primary)' }}>
            Patient Examination History
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Previously saved examination records from genuine backend deep learning inferences.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {history.length > 0 && (
            <>
              {showClearConfirm ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleClearHistory}
                    disabled={isClearing}
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isClearing && <RefreshCw size={12} className="spinning" />}
                    <span>{isClearing ? 'Clearing...' : 'Confirm Clear'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowClearConfirm(true)}
                  style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--status-malignant)', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Clear saved examination records"
                >
                  <Trash2 size={13} />
                  <span>Clear History</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={loadHistory}
            disabled={isLoading}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={12} className={isLoading ? 'spinning' : ''} />
            <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* History List or Honest Empty State */}
      {history.length > 0 ? (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-light)',
            background: 'var(--bg-blush-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
              Examination Records ({history.length})
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Stored locally during session
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((record, idx) => {
              const modality = record.modality?.toLowerCase();
              const predictedClass = record.predicted_class?.toLowerCase();
              const caseRef = formatCaseReference(record.filename, idx);

              return (
                <div
                  key={idx}
                  style={{
                    padding: '16px 20px',
                    borderBottom: idx < history.length - 1 ? '1px solid var(--border-light)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: 'var(--bg-blush)',
                      border: '1px solid var(--border-rose)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary-rose)'
                    }}>
                      {modality === 'thermal' ? <Flame size={18} /> : <Eye size={18} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="mono" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--primary-rose)' }}>
                          {caseRef}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>•</span>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {record.filename}
                        </span>
                        <span className="badge badge-normal" style={{ fontSize: '10px' }}>
                          {record.modality === 'thermal' ? 'THERMAL' : 'MAMMOGRAM'}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {record.dimensions?.width} × {record.dimensions?.height} px • {record.format || 'Image'}
                        {record.timestamp ? ` • ${new Date(record.timestamp).toLocaleString()}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {predictedClass && (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '11px',
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
                        border: `1px solid ${predictedClass === 'malignant'
                          ? 'var(--status-malignant-border)'
                          : predictedClass === 'benign'
                            ? 'var(--status-benign-border)'
                            : 'var(--status-normal-border)'
                          }`
                      }}>
                        {predictedClass} ({record.confidence ? `${(record.confidence * 100).toFixed(0)}%` : 'Evaluated'})
                      </span>
                    )}

                    {onSelectResult && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          onSelectResult(record);
                          onNavigate('results');
                        }}
                        style={{ fontSize: '11px', padding: '6px 12px' }}
                      >
                        <span>View Results</span>
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Clock size={36} color="var(--dusty-rose)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', marginBottom: '6px', color: 'var(--text-primary)' }}>
            No Examination Records Found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 18px', lineHeight: 1.5 }}>
            Analyses conducted through New Examination are automatically archived here with privacy-conscious reference IDs, timestamps, and model predictions.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onNavigate('screening')}
            style={{ fontSize: '13px', padding: '10px 18px' }}
          >
            <span>Start Screening</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Privacy Notice */}
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
        <ShieldCheck size={16} color="var(--primary-rose)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Patient Privacy Notice:</strong> Examination history uses de-identified reference tokens. Scan bytes and temporary saliency overlays are managed securely in local cache.
        </span>
      </div>
    </div>
  );
};
