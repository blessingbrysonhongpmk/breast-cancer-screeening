import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight, Eye, Flame, RefreshCw, Trash2 } from 'lucide-react';
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
    loadHistory();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: '4px', color: 'var(--text-primary)' }}>
            Analysis History
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Recent scans processed during this session.
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
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
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
                  style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--status-malignant)' }}
                  title="Clear saved analysis records"
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
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <RefreshCw size={12} className={isLoading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* History List or Empty State */}
      {history.length > 0 ? (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-blush-subtle)', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
            Session Records ({history.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((record, idx) => {
              const modality = record.modality?.toLowerCase();
              const predictedClass = record.predicted_class?.toLowerCase();

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
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
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {record.filename}
                        </span>
                        <span className="badge badge-normal" style={{ fontSize: '10px' }}>
                          {record.modality?.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {record.dimensions?.width} × {record.dimensions?.height} • {record.format || 'Image'}
                        {record.timestamp ? ` • ${new Date(record.timestamp).toLocaleTimeString()}` : ''}
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
                        {predictedClass} ({record.confidence ? `${(record.confidence * 100).toFixed(0)}%` : 'Ready'})
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
                        style={{ fontSize: '11px', padding: '5px 10px' }}
                      >
                        <span>View</span>
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
            No Analysis Records in Session
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 18px' }}>
            Analyses performed during your active session will be logged here with prediction summaries and timestamps.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onNavigate('analyze')}
            style={{ fontSize: '13px', padding: '10px 18px' }}
          >
            <span>Run an Analysis</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
