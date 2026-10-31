import React from 'react';
import {
  Scan,
  BarChart3,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Calendar,
  Heart
} from 'lucide-react';
import { HealthResponse, ModelReadinessResponse } from '../../services/api';
import { PinkRibbon, RadiologyWorkstation, RibbonWithLeaves } from '../../components/Illustrations';

interface HomePageProps {
  health: HealthResponse | null;
  modelReadiness: ModelReadinessResponse | null;
  onNavigate: (view: string, modality?: 'mammogram' | 'thermal', sampleFilename?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ health, modelReadiness, onNavigate }) => {
  const isBackendHealthy = Boolean(health?.status === 'healthy');
  const mammoReady = Boolean(isBackendHealthy && modelReadiness?.mammogram?.ready);
  const thermalReady = Boolean(isBackendHealthy && modelReadiness?.thermal?.ready);
  const allModelsReady = Boolean(mammoReady && thermalReady);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1120px', margin: '0 auto', width: '100%' }}>
      {/* 1. Hero Banner */}
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
        {/* Left Side: Brand, Titles & Tagline */}
        <div style={{ flex: '1 1 540px', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px', marginBottom: '14px' }}>
            <PinkRibbon size={64} />
            <div>
              <h1 style={{
                fontSize: '35px',
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
                fontStyle: 'italic',
                color: '#8A1E52',
                marginTop: '4px',
                lineHeight: 1.4
              }}>
                Multimodal Explainable AI-Based<br />
                Breast Cancer Screening and Risk Prediction System
              </p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#9E3867',
            fontSize: '12.5px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            marginTop: '12px'
          }}>
            <span style={{ height: '1px', width: '42px', background: '#D998B4' }} />
            <span>Analyze • Understand • Care</span>
            <span style={{ height: '1px', width: '42px', background: '#D998B4' }} />
          </div>
        </div>

        {/* Right Side: Hospital Radiology & Mammogram Workstation */}
        <div style={{ flex: '0 0 350px', maxWidth: '370px', borderRadius: '16px', overflow: 'hidden' }}>
          <RadiologyWorkstation />
        </div>
      </div>

      {/* 2. Action Cards Row (3 Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {/* Card 1: New Examination */}
        <div
          onClick={() => onNavigate('examination')}
          style={{
            background: '#FFFFFF',
            border: '1px solid #F5D6DE',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(44, 24, 32, 0.03)',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#FFF0F5',
              border: '1px solid #FCD9E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D82873'
            }}>
              <Scan size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#2A061B' }}>New Examination</div>
              <div style={{ fontSize: '11.5px', color: '#826674', marginTop: '3px', maxWidth: '175px', lineHeight: 1.35 }}>
                Upload and analyze mammogram or thermal images
              </div>
            </div>
          </div>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873',
            flexShrink: 0
          }}>
            <ArrowRight size={14} />
          </div>
        </div>

        {/* Card 2: View Results */}
        <div
          onClick={() => onNavigate('results')}
          style={{
            background: '#FFFFFF',
            border: '1px solid #F5D6DE',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(44, 24, 32, 0.03)',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#FFF0F5',
              border: '1px solid #FCD9E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D82873'
            }}>
              <BarChart3 size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#2A061B' }}>View Results</div>
              <div style={{ fontSize: '11.5px', color: '#826674', marginTop: '3px', maxWidth: '175px', lineHeight: 1.35 }}>
                Check analysis results and insights
              </div>
            </div>
          </div>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873',
            flexShrink: 0
          }}>
            <ArrowRight size={14} />
          </div>
        </div>

        {/* Card 3: Patient History */}
        <div
          onClick={() => onNavigate('history')}
          style={{
            background: '#FFFFFF',
            border: '1px solid #F5D6DE',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(44, 24, 32, 0.03)',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#FFF0F5',
              border: '1px solid #FCD9E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D82873'
            }}>
              <Clock size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#2A061B' }}>Patient History</div>
              <div style={{ fontSize: '11.5px', color: '#826674', marginTop: '3px', maxWidth: '175px', lineHeight: 1.35 }}>
                Access previous examinations
              </div>
            </div>
          </div>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873',
            flexShrink: 0
          }}>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* 3. Middle Section (2 Equal Cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
        gap: '16px'
      }}>
        {/* Left Card: Project Overview */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F5D6DE',
          borderRadius: '16px',
          padding: '24px 26px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(44, 24, 32, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <div style={{ color: '#D82873' }}>
              <BarChart3 size={20} />
            </div>
            <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#2A061B' }}>
              Project Overview
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '20px', flexWrap: 'wrap' }}>
            {/* Donut Progress Ring */}
            <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="130" height="130" viewBox="0 0 130 130">
                {/* Background Ring */}
                <circle
                  cx="65"
                  cy="65"
                  r="52"
                  fill="none"
                  stroke="#FCE4EC"
                  strokeWidth="11"
                />
                {/* 95% Active Arc */}
                <circle
                  cx="65"
                  cy="65"
                  r="52"
                  fill="none"
                  stroke="#E62E78"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52 * 0.95} ${2 * Math.PI * 52 * 0.05}`}
                  transform="rotate(-90 65 65)"
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#2A061B', lineHeight: 1 }}>95%</div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#826674', marginTop: '4px' }}>Project Readiness</div>
              </div>
            </div>

            {/* Checklist items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#2A061B' }}>
                <CheckCircle2 size={16} color="#15803D" fill="#DCFCE7" />
                <span>Mammogram Model</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#2A061B' }}>
                <CheckCircle2 size={16} color="#15803D" fill="#DCFCE7" />
                <span>Thermal Model</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#2A061B' }}>
                <CheckCircle2 size={16} color="#15803D" fill="#DCFCE7" />
                <span>Grad-CAM Explanation</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#2A061B' }}>
                <CheckCircle2 size={16} color="#15803D" fill="#DCFCE7" />
                <span>Real-time Analysis</span>
              </div>
            </div>
          </div>

          {/* Decorative subtle pink wave in bottom right */}
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(254, 215, 226, 0.5) 0%, rgba(255, 255, 255, 0) 70%)',
            pointerEvents: 'none'
          }} />
        </div>

        {/* Right Card: Why It Matters? */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F5D6DE',
          borderRadius: '16px',
          padding: '24px 26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(44, 24, 32, 0.03)'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Heart size={18} color="#D82873" fill="#D82873" />
              <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#2A061B' }}>
                Why It Matters?
              </h3>
            </div>

            <p style={{
              fontSize: '12.5px',
              color: '#4A2A38',
              lineHeight: 1.55,
              marginBottom: '16px',
              maxWidth: '380px'
            }}>
              Breast cancer is one of the most common cancers worldwide. Our AI-powered system helps in early detection using both mammogram and thermal imaging, providing clear visual explanations for better understanding.
            </p>

            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('about')}
              style={{
                padding: '9px 18px',
                fontSize: '12.5px',
                borderRadius: '9999px',
                background: 'linear-gradient(90deg, #D82873, #B81D60)'
              }}
            >
              <span>Learn More</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Pink Ribbon & Leaves Illustration */}
          <div style={{ flexShrink: 0 }}>
            <RibbonWithLeaves size={115} />
          </div>
        </div>
      </div>

      {/* 4. Bottom Status Row (3 Equal Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Bottom Card 1: Last Analysis */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F5D6DE',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 1px 4px rgba(44, 24, 32, 0.02)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873'
          }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#2A061B' }}>Last Analysis</div>
            <div style={{ fontSize: '11px', color: '#826674', marginTop: '2px' }}>
              Oct 31, 2026 • 06:49 PM
            </div>
          </div>
        </div>

        {/* Bottom Card 2: System Status */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F5D6DE',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 1px 4px rgba(44, 24, 32, 0.02)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: isBackendHealthy ? '#F0FDF4' : '#FFFBEB',
            border: `1px solid ${isBackendHealthy ? '#BBF7D0' : '#FDE68A'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isBackendHealthy ? '#15803D' : '#B45309'
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#2A061B' }}>System Status</div>
            <div style={{
              fontSize: '11px',
              color: isBackendHealthy ? '#15803D' : '#B45309',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: 600
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isBackendHealthy ? '#15803D' : '#B45309',
                display: 'inline-block'
              }} />
              <span>{isBackendHealthy ? 'Backend Connected' : 'Connecting...'}</span>
            </div>
          </div>
        </div>

        {/* Bottom Card 3: Model Status */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F5D6DE',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 1px 4px rgba(44, 24, 32, 0.02)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873'
          }}>
            <Cpu size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#2A061B' }}>Model Status</div>
            <div style={{
              fontSize: '11px',
              color: allModelsReady ? '#15803D' : '#826674',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: 600
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: allModelsReady ? '#15803D' : '#826674',
                display: 'inline-block'
              }} />
              <span>{allModelsReady ? 'Models Ready' : 'Models Standby'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
