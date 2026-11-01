import React, { useState, useEffect } from 'react';
import {
  Scan,
  BarChart3,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Search,
  Eye,
  Flame,
  Layers,
  Calendar,
  Heart,
  Activity,
  FileText
} from 'lucide-react';
import {
  HealthResponse,
  ModelReadinessResponse,
  fetchRecentAnalyses
} from '../../services/api';
import { PinkRibbon, RadiologyWorkstation } from '../../components/Illustrations';

interface HomePageProps {
  health?: HealthResponse | null;
  modelReadiness?: ModelReadinessResponse | null;
  backendStatus?: 'checking' | 'online' | 'offline';
  onNavigate: (view: string, modality?: 'mammogram' | 'thermal' | 'combined', sampleFilename?: string) => void;
  onSelectResult?: (result: any) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onSelectResult
}) => {
  const [records, setRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'low'>('all');

  // Fetch real database records on mount
  useEffect(() => {
    let active = true;
    fetchRecentAnalyses()
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data)) {
          setRecords(data);
        } else {
          setRecords([]);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch recent analyses for dashboard:', err);
        if (active) setRecords([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Compute accurate doctor-friendly statistics from genuine records
  const totalExaminations = records.length;
  const highRiskCases = records.filter(
    (r) => (r.predicted_class || '').toLowerCase() === 'malignant'
  ).length;
  const lowRiskCases = totalExaminations - highRiskCases;

  const highRiskPct = totalExaminations > 0 ? Math.round((highRiskCases / totalExaminations) * 100) : 0;
  const lowRiskPct = totalExaminations > 0 ? 100 - highRiskPct : 0;

  const mammoCount = records.filter((r) => (r.modality || '').toLowerCase() === 'mammogram').length;
  const thermalCount = records.filter((r) => (r.modality || '').toLowerCase() === 'thermal').length;
  const combinedCount = records.filter((r) => (r.modality || '').toLowerCase() === 'combined').length;

  const lastRecord = records.length > 0 ? records[0] : null;

  // Filtered examinations for patient search
  const filteredRecords = records.filter((record) => {
    const isHigh = (record.predicted_class || '').toLowerCase() === 'malignant';
    if (riskFilter === 'high' && !isHigh) return false;
    if (riskFilter === 'low' && isHigh) return false;

    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    const caseId = (record.case_id || '').toLowerCase();
    const participantId = (record.participant_id || '').toLowerCase();
    const filename = (record.filename || '').toLowerCase();
    const modality = (record.modality || '').toLowerCase();
    const predClass = (record.predicted_class || '').toLowerCase();

    return (
      caseId.includes(query) ||
      participantId.includes(query) ||
      filename.includes(query) ||
      modality.includes(query) ||
      predClass.includes(query)
    );
  });

  const formatDate = (ts?: string) => {
    if (!ts) return 'Recent';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return ts;
    }
  };

  const formatCaseId = (record: any, idx: number) => {
    if (record.case_id) return record.case_id;
    if (record.participant_id) return `PT-${record.participant_id}`;
    return `EXAM-${String(idx + 1).padStart(3, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* 1. Hero Brand Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #FFF0F5 0%, #FEE8F0 45%, #FCE4EC 100%)',
        borderRadius: '20px',
        padding: '28px 36px',
        border: '1px solid #F7D2DD',
        boxShadow: '0 4px 20px rgba(216, 40, 115, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Left Side: Brand, Clinical Subtitle & Primary Actions */}
        <div style={{ flex: '1 1 540px', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '12px' }}>
            <PinkRibbon size={58} />
            <div>
              <h1 style={{
                fontSize: '32px',
                fontWeight: 800,
                color: '#2A061B',
                letterSpacing: '-0.025em',
                lineHeight: 1.15
              }}>
                MammoFusion-XAI
              </h1>
              <p style={{
                fontSize: '14.5px',
                fontWeight: 600,
                color: '#A02058',
                marginTop: '4px',
                letterSpacing: '-0.01em'
              }}>
                Clinical Breast Cancer Screening & Risk Prediction System
              </p>
            </div>
          </div>

          <p style={{
            fontSize: '13.5px',
            color: '#4A2A38',
            maxWidth: '560px',
            lineHeight: 1.5,
            marginTop: '8px'
          }}>
            Supportive diagnostic screening system for clinicians. Analyze mammograms, thermal scans, or paired multimodal examinations with explainable Grad-CAM heatmaps.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('screening')}
              style={{
                padding: '10px 22px',
                fontSize: '13.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(216, 40, 115, 0.3)'
              }}
            >
              <Scan size={16} />
              <span>Start Screening</span>
              <ArrowRight size={14} />
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onNavigate('history')}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px'
              }}
            >
              <Clock size={15} />
              <span>Patient History ({totalExaminations})</span>
            </button>
          </div>
        </div>

        {/* Right Side: Radiology Workstation Illustration */}
        <div style={{ flex: '0 0 340px', maxWidth: '360px', borderRadius: '16px', overflow: 'hidden' }}>
          <RadiologyWorkstation />
        </div>
      </div>

      {/* 2. Key Clinical Metrics (4 Doctor-Friendly Stat Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Card 1: Total Examinations */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873',
            flexShrink: 0
          }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: '#826674', letterSpacing: '0.04em' }}>
              Total Examinations
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#2A061B', marginTop: '2px', lineHeight: 1.1 }}>
              {historyLoading ? '--' : totalExaminations}
            </div>
            <div style={{ fontSize: '11px', color: '#826674', marginTop: '3px' }}>
              Stored clinical records
            </div>
          </div>
        </div>

        {/* Card 2: High-Risk Flagged Cases */}
        <div className="card" style={{
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: highRiskCases > 0 ? '#FFF5F7' : '#FFFFFF',
          borderColor: highRiskCases > 0 ? '#FCA5B8' : 'var(--border-light)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#FFE4E6',
            border: '1px solid #FDA4AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#E11D48',
            flexShrink: 0
          }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: '#BE123C', letterSpacing: '0.04em' }}>
              High-Risk Flagged
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#BE123C', marginTop: '2px', lineHeight: 1.1 }}>
              {historyLoading ? '--' : highRiskCases}
            </div>
            <div style={{ fontSize: '11px', color: '#BE123C', marginTop: '3px', fontWeight: 600 }}>
              {totalExaminations > 0 ? `${highRiskPct}% of cohort cases` : 'No cases flagged'}
            </div>
          </div>
        </div>

        {/* Card 3: Low-Risk Screening Cases */}
        <div className="card" style={{
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: '#F0FDF4',
          borderColor: '#BBF7D0'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#DCFCE7',
            border: '1px solid #86EFAC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#15803D',
            flexShrink: 0
          }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: '#166534', letterSpacing: '0.04em' }}>
              Low-Risk Cases
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#166534', marginTop: '2px', lineHeight: 1.1 }}>
              {historyLoading ? '--' : lowRiskCases}
            </div>
            <div style={{ fontSize: '11px', color: '#15803D', marginTop: '3px', fontWeight: 600 }}>
              {totalExaminations > 0 ? `${lowRiskPct}% normal / benign` : 'Awaiting scans'}
            </div>
          </div>
        </div>

        {/* Card 4: Most Recent Screening Result */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873',
            flexShrink: 0
          }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: '#826674', letterSpacing: '0.04em' }}>
              Latest Screening
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#2A061B', marginTop: '2px' }}>
              {lastRecord ? formatDate(lastRecord.timestamp) : 'No examinations'}
            </div>
            {lastRecord && (
              <span style={{
                display: 'inline-block',
                marginTop: '4px',
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                background: (lastRecord.predicted_class || '').toLowerCase() === 'malignant' ? '#FFE4E6' : '#ECFDF5',
                color: (lastRecord.predicted_class || '').toLowerCase() === 'malignant' ? '#BE123C' : '#047857',
                border: `1px solid ${(lastRecord.predicted_class || '').toLowerCase() === 'malignant' ? '#FDA4AF' : '#A7F3D0'}`
              }}>
                {(lastRecord.predicted_class || '').toLowerCase() === 'malignant' ? 'HIGH RISK' : 'LOW RISK'} • {lastRecord.modality}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Risk Distribution Chart & Modality Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '18px' }}>
        {/* Left Card: Screening Risk Distribution */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: '#D82873' }}>
                <BarChart3 size={20} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2A061B' }}>
                Screening Risk Distribution
              </h3>
            </div>
            <span style={{ fontSize: '11px', color: '#826674', fontWeight: 600 }}>
              Based on {totalExaminations} verified examinations
            </span>
          </div>

          {/* Visual Stacked Proportional Bar */}
          <div style={{ marginTop: '12px' }}>
            <div style={{
              display: 'flex',
              height: '18px',
              borderRadius: '9999px',
              overflow: 'hidden',
              background: '#F3E8EE'
            }}>
              {totalExaminations > 0 ? (
                <>
                  <div
                    style={{
                      width: `${highRiskPct}%`,
                      background: 'linear-gradient(90deg, #E11D48, #BE123C)',
                      transition: 'width 0.5s ease'
                    }}
                    title={`High Risk: ${highRiskCases} cases (${highRiskPct}%)`}
                  />
                  <div
                    style={{
                      width: `${lowRiskPct}%`,
                      background: 'linear-gradient(90deg, #10B981, #059669)',
                      transition: 'width 0.5s ease'
                    }}
                    title={`Low Risk: ${lowRiskCases} cases (${lowRiskPct}%)`}
                  />
                </>
              ) : (
                <div style={{ width: '100%', background: '#E5E7EB' }} />
              )}
            </div>

            {/* Legend & Exact Case Counts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#E11D48', display: 'inline-block' }} />
                <span style={{ fontSize: '12.5px', color: '#2A061B', fontWeight: 600 }}>
                  High Risk (Suspicious): <strong>{highRiskCases}</strong> ({highRiskPct}%)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#059669', display: 'inline-block' }} />
                <span style={{ fontSize: '12.5px', color: '#2A061B', fontWeight: 600 }}>
                  Low Risk (Normal/Benign): <strong>{lowRiskCases}</strong> ({lowRiskPct}%)
                </span>
              </div>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: '#FFF8FA',
              border: '1px solid #FCD9E2',
              fontSize: '12px',
              color: '#6A2A46',
              lineHeight: 1.45
            }}>
              <strong>Clinical Guidance:</strong> Risk classifications are generated by validated deep learning backbones based on radiologic microcalcifications, masses, and asymmetric thermographic vascular patterns.
            </div>
          </div>
        </div>

        {/* Right Card: Supported Examination Modes */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Activity size={20} color="#D82873" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2A061B' }}>
                Screening Modalities
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Primary Mammogram */}
              <div
                onClick={() => onNavigate('screening', 'mammogram')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: '#FFFFFF',
                  border: '1px solid #F5D6DE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFF0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D82873' }}>
                    <Eye size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#2A061B' }}>Primary Mammogram</div>
                    <div style={{ fontSize: '11px', color: '#826674' }}>Independent ResNet-50 radiograph screening ({mammoCount} conducted)</div>
                  </div>
                </div>
                <ArrowRight size={14} color="#D82873" />
              </div>

              {/* Thermal Infrared */}
              <div
                onClick={() => onNavigate('screening', 'thermal')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: '#FFFFFF',
                  border: '1px solid #F5D6DE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFF0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D82873' }}>
                    <Flame size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#2A061B' }}>Thermal Infrared Scan</div>
                    <div style={{ fontSize: '11px', color: '#826674' }}>Independent infrared thermography ({thermalCount} conducted)</div>
                  </div>
                </div>
                <ArrowRight size={14} color="#D82873" />
              </div>

              {/* Multimodal */}
              <div
                onClick={() => onNavigate('screening', 'combined')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: '#FFFFFF',
                  border: '1px solid #F5D6DE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFF0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D82873' }}>
                    <Layers size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#2A061B' }}>Multimodal Fusion</div>
                    <div style={{ fontSize: '11px', color: '#826674' }}>Dual-modality cross-attention screening ({combinedCount} conducted)</div>
                  </div>
                </div>
                <ArrowRight size={14} color="#D82873" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent Patient Examinations & Search Section */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#2A061B' }}>
              Recent Patient Examinations
            </h3>
            <p style={{ fontSize: '12.5px', color: '#826674', marginTop: '2px' }}>
              Review recent screening cases and access full model explainability findings.
            </p>
          </div>

          {/* Search Input & Risk Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#826674" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search case, patient ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '7px 12px 7px 32px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  fontSize: '12.5px',
                  width: '210px',
                  background: '#FFFFFF',
                  color: '#2A061B'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={`btn-secondary ${riskFilter === 'all' ? 'active' : ''}`}
                onClick={() => setRiskFilter('all')}
                style={{ fontSize: '11.5px', padding: '6px 10px' }}
              >
                All ({records.length})
              </button>
              <button
                type="button"
                className={`btn-secondary ${riskFilter === 'high' ? 'active' : ''}`}
                onClick={() => setRiskFilter('high')}
                style={{ fontSize: '11.5px', padding: '6px 10px', color: '#BE123C' }}
              >
                High Risk ({highRiskCases})
              </button>
              <button
                type="button"
                className={`btn-secondary ${riskFilter === 'low' ? 'active' : ''}`}
                onClick={() => setRiskFilter('low')}
                style={{ fontSize: '11.5px', padding: '6px 10px', color: '#15803D' }}
              >
                Low Risk ({lowRiskCases})
              </button>
            </div>
          </div>
        </div>

        {/* Table of Examinations */}
        {filteredRecords.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border-light)', textAlign: 'left', color: '#826674' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Case Reference</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Modality</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Screening Category</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Date & Time</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.slice(0, 8).map((record, idx) => {
                  const isHigh = (record.predicted_class || '').toLowerCase() === 'malignant';
                  const confPct = record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : '--';
                  return (
                    <tr
                      key={record.analysis_id || idx}
                      style={{
                        borderBottom: '1px solid #F7E5EC',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF9FB')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontWeight: 700, color: '#2A061B' }}>
                        {formatCaseId(record, idx)}
                      </td>
                      <td style={{ padding: '12px', textTransform: 'capitalize', color: '#4A2A38', fontWeight: 500 }}>
                        {record.modality === 'combined' ? 'Multimodal (Paired)' : record.modality}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 9px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: isHigh ? '#FFE4E6' : '#ECFDF5',
                          color: isHigh ? '#BE123C' : '#047857',
                          border: `1px solid ${isHigh ? '#FDA4AF' : '#A7F3D0'}`
                        }}>
                          {isHigh ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                          <span>{isHigh ? 'HIGH RISK' : 'LOW RISK'}</span>
                          <span style={{ opacity: 0.75, fontWeight: 500 }}>({confPct})</span>
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#826674' }}>
                        {formatDate(record.timestamp)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            if (onSelectResult) onSelectResult(record);
                            onNavigate('results');
                          }}
                          style={{ padding: '4px 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>View Findings</span>
                          <ArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#826674' }}>
            <Clock size={32} style={{ margin: '0 auto 8px', color: '#D998B4' }} />
            <div style={{ fontSize: '14px', fontWeight: 600 }}>No examinations matching your search</div>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              Run a scan under Screening to record clinical screening results.
            </div>
          </div>
        )}
      </div>

      {/* 5. Medical Disclaimer */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        background: '#FFF5F8',
        border: '1px solid #FCD9E2',
        fontSize: '12px',
        color: '#6A2A46',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <ShieldAlert size={20} color="#D82873" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: '#2A061B' }}>Clinical Advisory: </strong>
          MammoFusion-XAI is a clinical decision-support and screening platform designed for investigation and research. Risk stratifications (High Risk / Low Risk) flag suspicious radiologic or thermal features for follow-up and must not be used as a standalone or confirmed cancer diagnosis. All decisions require direct evaluation by a certified physician.
        </div>
      </div>
    </div>
  );
};
