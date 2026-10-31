import React from 'react';
import { HardDrive, BookOpen, Scale, CheckCircle2 } from 'lucide-react';
import { SystemStatus } from '../../services/api';

interface SettingsPageProps {
  status: SystemStatus | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ status }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>System Architecture & Provenance</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Runtime infrastructure parameters, dataset licensing provenance, and clinical ethics enforcement rules.
        </p>
      </div>

      {/* Storage and Runtime Telemetry */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={18} color="var(--primary-rose)" />
            <h3 style={{ fontSize: '16px' }}>Host Storage Telemetry</h3>
          </div>
          <span className="badge badge-normal">Drive {status?.disk.drive || 'E:'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Free Disk Space</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {status?.disk.free_gb ?? '—'} GB
            </div>
            <div style={{ fontSize: '10px', color: 'var(--status-normal)', marginTop: '4px' }}>
              Ample storage for PyTorch checkpoints
            </div>
          </div>
          <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Volume Capacity</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {status?.disk.total_gb ?? '—'} GB
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Dedicated screening workspace
            </div>
          </div>
          <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Backend Daemon</div>
            <div className="mono" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
              FastAPI / Uvicorn
            </div>
            <div style={{ fontSize: '10px', color: 'var(--status-normal)', marginTop: '4px' }}>
              Listening on http://127.0.0.1:8000
            </div>
          </div>
        </div>
      </div>

      {/* Dataset Citations & Formal Provenance */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <BookOpen size={18} color="var(--primary-rose)" />
          <h3 style={{ fontSize: '16px' }}>Scientific Citations & Archival Provenance</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '14px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '13px' }}>1. Mammographic Image Analysis Society (MIAS) Mini-Database</strong>
              <span className="badge badge-normal">UK Open Data</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Suckling, J., Parker, J., Dance, D.R., Astley, S., Hutt, I., Boggis, C.R.M., Ricketts, I., Stamatakis, E., Cerneaz, N., Kok, S.L., Taylor, P., Betal, D., & Savage, J. (1994). <em>The Mammographic Image Analysis Society Digital Mammogram Database</em>. Exerpta Medica International Congress Series 1069, pp. 375–386.
            </p>
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              License: Research & Academic Non-Commercial Use. Cambridge, UK.
            </div>
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '13px' }}>2. Mendeley Breast Thermography Research Archive</strong>
              <span className="badge badge-rosegold">CC BY-NC 3.0</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Silva, L.F., Saade, D.C., Seixas, F.L., Silva, A.C., Paiva, A.C., Bravo, R.S., & Schwartzkopf, V. (2014). <em>A new database for evaluating breast thermal imaging: Acquisition protocol and validation</em>. Mendeley Data, V1.
            </p>
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              License: Creative Commons Attribution-NonCommercial 3.0 Unported.
            </div>
          </div>
        </div>
      </div>

      {/* Research Ethics & Clinical Machine Learning Protocols */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Scale size={18} color="var(--primary-rose)" />
          <h3 style={{ fontSize: '16px' }}>Research Ethics & Policy Enforcement</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <CheckCircle2 size={16} color="var(--status-normal)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Cohort Boundary Enforcement:</strong> MIAS and Mendeley datasets contain separate subject populations. Unpaired synthetic multimodal fusion is scientifically invalid and is blocked at the pipeline level.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <CheckCircle2 size={16} color="var(--status-normal)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Patient-Level Isolation:</strong> Data splitting prevents image-level leakage across bilateral mammograms or multi-angle thermal projections. All views of an individual are constrained to a single partition.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <CheckCircle2 size={16} color="var(--status-normal)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Zero-Fabrication Guarantee:</strong> When weights do not exist, the interface displays an honest standby state rather than fabricated inferences or decorative heatmaps.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
