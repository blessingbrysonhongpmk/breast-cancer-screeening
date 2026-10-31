import React, { useState } from 'react';
import {
  ShieldCheck,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Cpu,
  Layers,
  Database,
  Code
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const [showTechnicalSpecs, setShowTechnicalSpecs] = useState<boolean>(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '880px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 10px',
          borderRadius: '9999px',
          background: 'var(--bg-blush)',
          border: '1px solid var(--border-rose)',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--primary-rose)',
          marginBottom: '8px'
        }}>
          Final Year Engineering Research Project
        </div>
        <h2 style={{ fontSize: '26px', color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: '6px' }}>
          Multimodal Explainable AI-Based Breast Cancer Screening and Risk Prediction System
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
          An oncology research platform investigating deep learning computer vision, uncertainty quantification, and visual explainability across digital mammography and infrared thermography.
        </p>
      </div>

      {/* Purpose & Research Scope */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <BookOpen size={18} color="var(--primary-rose)" />
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Project Purpose & Methodology</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Early detection of breast neoplasms relies heavily on radiographic screening (full-field digital mammography), which captures structural microcalcifications and tissue density anomalies. Complementary physiological imaging (infrared breast thermography) captures abnormal metabolic hyperthermia and angiogenesis-driven temperature asymmetries.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '10px' }}>
          This system implements <strong>PyTorch ResNet-50</strong> unimodal deep convolutional neural networks tailored to each imaging modality, evaluates predictive uncertainty via <strong>Shannon entropy</strong> and <strong>Test-Time Augmentation (TTA)</strong>, and generates transparent visual explanations using <strong>Gradient-weighted Class Activation Mapping (Grad-CAM)</strong>.
        </p>
      </div>

      {/* Scientific Integrity: Separate Patient Populations */}
      <div className="card-elevated" style={{ borderLeft: '4px solid var(--primary-rose)', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <ShieldCheck size={18} color="var(--primary-rose)" />
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Scientific Integrity & Cohort Boundary Policy</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          The mammography collection (MIAS, UK) and thermography collection (Mendeley, Mexico) originate from completely independent patient populations with distinct protocols, hardware, and ethical consents.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '8px' }}>
          In strict compliance with clinical machine learning standards, <strong>unpaired synthetic multimodal fusion is prohibited</strong>. We evaluate unimodal baseline networks independently to prevent fabricating spurious correlations across unrelated subjects.
        </p>
      </div>

      {/* Dataset Sources */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Database size={18} color="var(--primary-rose)" />
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>
            Verified Dataset Collections
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-blush-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-rose)' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              MIAS Mammography Database
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
              Mammographic Image Analysis Society (Cambridge, UK). 322 digitized 8-bit PGM raster mammograms from 161 patient bilateral pairs with Wolfe tissue density classification.
            </p>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              • Partitioning: 221 Train / 48 Val / 48 Test (Patient-Isolated)<br />
              • Classes: Normal, Benign, Malignant
            </div>
          </div>

          <div style={{ padding: '16px', background: 'var(--bg-blush-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-rose)' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Mendeley Breast Thermography
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
              Infrared thermal camera series (CC BY-NC 3.0, Mexico). 357 thermal scans across three clinical projections (Anterior, Left Oblique, Right Oblique) from 119 diagnosed participants.
            </p>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              • Partitioning: 237 Train / 51 Val / 48 Test (Patient-Isolated)<br />
              • Classes: Normal, Benign, Malignant
            </div>
          </div>
        </div>
      </div>

      {/* Explainable AI & Uncertainty Engineering */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
        gap: '16px'
      }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Layers size={18} color="var(--primary-rose)" />
            <h4 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Explainable AI (Grad-CAM)</h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Calculates the backward gradient of the predicted class score with respect to feature maps in ResNet-50 <code>layer4</code>. Saliency maps are rectified (ReLU) and rendered with the Turbo colormap overlay, localizing focal anatomical anomalies.
          </p>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Cpu size={18} color="var(--primary-rose)" />
            <h4 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Uncertainty & CPU Optimization</h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Shannon entropy metrics ($H(y)$) quantify model decisiveness. Test-time augmentation (TTA) averages predictions across bilateral horizontal reflections. Lightweight memory management ensures smooth execution on standard 8 GB CPU hardware.
          </p>
        </div>
      </div>

      {/* Collapsible Engineering Technical Specifications */}
      <div className="card" style={{ padding: '18px 24px' }}>
        <button
          type="button"
          onClick={() => setShowTechnicalSpecs(!showTechnicalSpecs)}
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
            <Code size={18} color="var(--primary-rose)" />
            <span>Technical Architecture & Software Stack</span>
          </div>
          {showTechnicalSpecs ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
        </button>

        {showTechnicalSpecs && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '12px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Backend Framework:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>FastAPI 0.115+ (ASGI / Uvicorn)</div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>Machine Learning:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>PyTorch 2.2+ & Torchvision ResNet-50</div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>Frontend Framework:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>React 18, TypeScript, Vite 5</div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>Visual System:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Hospital Ivory / Rose Palette (Plus Jakarta Sans)</div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>Explainability Engine:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Grad-CAM (OpenCV / Matplotlib Turbo)</div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)' }}>Verification Suite:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Pytest (48 verified unit/endpoint tests)</div>
            </div>
          </div>
        )}
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
          This research platform is an educational tool developed for academic research in biomedical computer vision. Model outputs, confidence metrics, and Grad-CAM saliency heatmaps do not provide clinical screening or diagnosis and must never replace certified radiological review.
        </div>
      </div>
    </div>
  );
};
