import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Heart,
  Eye,
  Flame,
  Layers,
  Sparkles,
  Lock,
  FileText,
  CheckCircle2,
  HelpCircle,
  Activity,
  ArrowRight
} from 'lucide-react';
import { PinkRibbon } from '../../components/Illustrations';

export const AboutPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* 1. Header & Brand Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #FFF0F5 0%, #FEE8F0 50%, #FCE4EC 100%)',
        borderRadius: '20px',
        padding: '30px 36px',
        border: '1px solid #F7D2DD',
        boxShadow: '0 4px 18px rgba(216, 40, 115, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ flex: 1, zIndex: 2 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '9999px',
            background: '#FFFFFF',
            border: '1px solid #F5CCD7',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#D82873',
            marginBottom: '10px'
          }}>
            <Heart size={13} fill="#D82873" color="#D82873" />
            <span>Doctor & User Knowledge Guide</span>
          </div>

          <h1 style={{
            fontSize: '30px',
            fontWeight: 800,
            color: '#2A061B',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}>
            About MammoFusion-XAI
          </h1>

          <p style={{
            fontSize: '14.5px',
            fontWeight: 600,
            color: '#8A1E52',
            marginTop: '6px',
            lineHeight: 1.45
          }}>
            Explainable AI-Powered Breast Cancer Screening & Risk Prediction System
          </p>

          <p style={{
            fontSize: '13.5px',
            color: '#4A2A38',
            marginTop: '8px',
            lineHeight: 1.55,
            maxWidth: '680px'
          }}>
            A physician-friendly clinical screening aid designed to assist healthcare professionals in evaluating mammograms and thermal scans with transparent visual evidence.
          </p>
        </div>

        <div style={{ flexShrink: 0, zIndex: 2 }}>
          <PinkRibbon size={72} />
        </div>
      </div>

      {/* 2. Application Purpose */}
      <div className="card" style={{ padding: '26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873'
          }}>
            <Activity size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2A061B' }}>
              Application Purpose
            </h3>
            <div style={{ fontSize: '12px', color: '#826674' }}>
              Why MammoFusion-XAI was created
            </div>
          </div>
        </div>

        <p style={{ fontSize: '13.5px', color: '#3A1E2B', lineHeight: 1.65, marginBottom: '14px' }}>
          Breast cancer remains one of the most frequently diagnosed cancers among women worldwide. Early detection is the single most critical factor in improving treatment outcomes and patient survival rates.
        </p>

        <p style={{ fontSize: '13.5px', color: '#3A1E2B', lineHeight: 1.65 }}>
          Traditional mammography identifies dense structural anomalies and microcalcifications, while infrared thermography detects physiological metabolic heat and asymmetric vascular activity. <strong>MammoFusion-XAI</strong> provides an intelligent, supportive second-reader platform that assists doctors in evaluating both modalities independently or in combination, accompanied by intuitive visual explanations.
        </p>
      </div>

      {/* 3. Main Features */}
      <div className="card" style={{ padding: '26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2A061B' }}>
              Main Features
            </h3>
            <div style={{ fontSize: '12px', color: '#826674' }}>
              Core capabilities built for healthcare workflows
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Feature 1 */}
          <div style={{
            padding: '18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFF9FB',
            border: '1px solid #F8D6E1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Eye size={18} color="#D82873" />
              <strong style={{ fontSize: '14px', color: '#2A061B' }}>Mode A: Mammogram Screening</strong>
            </div>
            <p style={{ fontSize: '12.5px', color: '#5A3A48', lineHeight: 1.5 }}>
              Analyze mammogram X-ray radiographs independently through a dedicated ResNet-50 network trained to detect structural tissue densities, architectural distortions, and microcalcifications.
            </p>
          </div>

          {/* Feature 2 */}
          <div style={{
            padding: '18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFF9FB',
            border: '1px solid #F8D6E1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Flame size={18} color="#D82873" />
              <strong style={{ fontSize: '14px', color: '#2A061B' }}>Mode B: Thermal Screening</strong>
            </div>
            <p style={{ fontSize: '12.5px', color: '#5A3A48', lineHeight: 1.5 }}>
              Analyze infrared thermal scans independently to detect metabolic hyperthermia, hot spots, and abnormal heat distribution without exposure to ionizing radiation.
            </p>
          </div>

          {/* Feature 3 */}
          <div style={{
            padding: '18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFF9FB',
            border: '1px solid #F8D6E1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Layers size={18} color="#D82873" />
              <strong style={{ fontSize: '14px', color: '#2A061B' }}>Mode C: Both Images (Dual & Multimodal)</strong>
            </div>
            <p style={{ fontSize: '12.5px', color: '#5A3A48', lineHeight: 1.5 }}>
              Review both individual modality predictions side by side. When same-patient pairing is verified, Cross-Attention feature fusion computes joint attention maps.
            </p>
          </div>

          {/* Feature 4 */}
          <div style={{
            padding: '18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFF9FB',
            border: '1px solid #F8D6E1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Sparkles size={18} color="#D82873" />
              <strong style={{ fontSize: '14px', color: '#2A061B' }}>Explainable AI (Grad-CAM)</strong>
            </div>
            <p style={{ fontSize: '12.5px', color: '#5A3A48', lineHeight: 1.5 }}>
              Visual heatmap overlays display the exact spatial regions and feature patterns that influenced the AI model's assessment, ensuring transparency and trust.
            </p>
          </div>

          {/* Feature 5 */}
          <div style={{
            padding: '18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFF9FB',
            border: '1px solid #F8D6E1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={18} color="#D82873" />
              <strong style={{ fontSize: '14px', color: '#2A061B' }}>Clear Risk Stratification</strong>
            </div>
            <p style={{ fontSize: '12.5px', color: '#5A3A48', lineHeight: 1.5 }}>
              Outputs a clear, validated <strong>HIGH RISK</strong> or <strong>LOW RISK</strong> screening category with calibrated confidence scores and predictive uncertainty metrics.
            </p>
          </div>

          {/* Feature 6 */}
          <div style={{
            padding: '18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFF9FB',
            border: '1px solid #F8D6E1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <FileText size={18} color="#D82873" />
              <strong style={{ fontSize: '14px', color: '#2A061B' }}>Clinical Research Reporting</strong>
            </div>
            <p style={{ fontSize: '12.5px', color: '#5A3A48', lineHeight: 1.5 }}>
              One-click download of clinical examination reports complete with case reference ID, date, modality details, risk assessment, and clinical recommendations.
            </p>
          </div>
        </div>
      </div>

      {/* 4. How to Use the Application */}
      <div className="card" style={{ padding: '26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: '#FFF0F5',
            border: '1px solid #FCD9E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D82873'
          }}>
            <HelpCircle size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2A061B' }}>
              How to Use the Application
            </h3>
            <div style={{ fontSize: '12px', color: '#826674' }}>
              Simple 4-step workflow for clinicians
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* Step 1 */}
          <div style={{
            padding: '16px 18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFFFFF',
            border: '1.5px solid #F5D6DE'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#D82873',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px'
            }}>
              1
            </div>
            <strong style={{ fontSize: '14px', color: '#2A061B', display: 'block', marginBottom: '4px' }}>
              Select Modality Mode
            </strong>
            <p style={{ fontSize: '12px', color: '#6A4A58', lineHeight: 1.5 }}>
              Navigate to <strong>New Examination</strong> and choose your screening workflow: <em>Mode A (Mammogram only)</em>, <em>Mode B (Thermal only)</em>, or <em>Mode C (Both Scans)</em>.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{
            padding: '16px 18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFFFFF',
            border: '1.5px solid #F5D6DE'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#D82873',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px'
            }}>
              2
            </div>
            <strong style={{ fontSize: '14px', color: '#2A061B', display: 'block', marginBottom: '4px' }}>
              Upload Patient Scans
            </strong>
            <p style={{ fontSize: '12px', color: '#6A4A58', lineHeight: 1.5 }}>
              Drag and drop local scan files or select reference test scans. The system automatically inspects file format integrity and verifies modality properties.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{
            padding: '16px 18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFFFFF',
            border: '1.5px solid #F5D6DE'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#D82873',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px'
            }}>
              3
            </div>
            <strong style={{ fontSize: '14px', color: '#2A061B', display: 'block', marginBottom: '4px' }}>
              Execute Analysis
            </strong>
            <p style={{ fontSize: '12px', color: '#6A4A58', lineHeight: 1.5 }}>
              Click the analysis button to run the trained PyTorch neural network. The model evaluates features in real-time and computes Grad-CAM activations.
            </p>
          </div>

          {/* Step 4 */}
          <div style={{
            padding: '16px 18px',
            borderRadius: 'var(--radius-md)',
            background: '#FFFFFF',
            border: '1.5px solid #F5D6DE'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#D82873',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px'
            }}>
              4
            </div>
            <strong style={{ fontSize: '14px', color: '#2A061B', display: 'block', marginBottom: '4px' }}>
              Review Findings & Report
            </strong>
            <p style={{ fontSize: '12px', color: '#6A4A58', lineHeight: 1.5 }}>
              Inspect the <em>HIGH RISK</em> or <em>LOW RISK</em> category, examine the Grad-CAM focal heatmap, and click <em>Download Report</em> for clinical documentation.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Patient Privacy Information */}
      <div className="card" style={{ padding: '26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#15803D'
          }}>
            <Lock size={19} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2A061B' }}>
              Patient Privacy & Data Protection
            </h3>
            <div style={{ fontSize: '12px', color: '#826674' }}>
              Privacy-conscious design principles
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: '#3A1E2B', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <CheckCircle2 size={16} color="#15803D" style={{ flexShrink: 0, marginTop: '3px' }} />
            <span><strong>Local Processing:</strong> All deep learning inference, image decoding, and Grad-CAM generation run locally on your secured server environment.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <CheckCircle2 size={16} color="#15803D" style={{ flexShrink: 0, marginTop: '3px' }} />
            <span><strong>No Third-Party Transmission:</strong> Patient medical images are never uploaded to commercial public cloud services or external advertising networks.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <CheckCircle2 size={16} color="#15803D" style={{ flexShrink: 0, marginTop: '3px' }} />
            <span><strong>Pseudonymized References:</strong> Examination archives are indexed by private case reference tokens rather than patient personal identifiers.</span>
          </div>
        </div>
      </div>

      {/* 6. Medical Disclaimer */}
      <div style={{
        padding: '22px 24px',
        borderRadius: 'var(--radius-lg)',
        background: '#FFF5F8',
        border: '1.5px solid #FCD9E2',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px'
      }}>
        <ShieldAlert size={24} color="#D82873" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#BE123C', marginBottom: '6px' }}>
            Official Medical & Clinical Advisory
          </h4>
          <p style={{ fontSize: '13px', color: '#4A2A38', lineHeight: 1.6 }}>
            MammoFusion-XAI is an investigational decision-support aid designed for educational and clinical research purposes. Model predictions, confidence scores, and screening risk categories (High Risk / Low Risk) represent algorithmic feature assessments and must <strong>never</strong> be interpreted as a confirmed diagnosis of breast cancer or an absolute guarantee of benignity.
          </p>
          <p style={{ fontSize: '12.5px', color: '#6A3A4A', marginTop: '6px', lineHeight: 1.55 }}>
            All medical decisions, follow-up recommendations, diagnostic ultrasound examinations, and biopsy procedures must be determined directly by a licensed medical practitioner, radiologist, or oncologist in accordance with clinical standards.
          </p>
        </div>
      </div>
    </div>
  );
};
