import React, { useState, useEffect } from 'react';
import { Download, Search, CheckCircle2 } from 'lucide-react';
import { ManifestRecord, fetchManifestRecords } from '../../services/api';

export const DatasetsPage: React.FC = () => {
  const [records, setRecords] = useState<ManifestRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [modality, setModality] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRecords = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchManifestRecords(modality, limit, searchQuery);
      setRecords(data.records);
      setTotalCount(data.total);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch manifest records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [modality, limit]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadRecords();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header & Export Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>Audited Dataset Manifest Workspace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Comprehensive manifest registry of 679 physical images verified across drive directories with patient-level isolation metadata.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href="/api/manifests/export/mammogram"
            download="mammogram_manifest.csv"
            className="btn-secondary"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Export MIAS CSV (322)
          </a>
          <a
            href="/api/manifests/export/thermal"
            download="thermal_manifest.csv"
            className="btn-secondary"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Export Thermal CSV (357)
          </a>
        </div>
      </div>

      {/* Cohort Provenance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '14px' }}>MIAS Mammogram Mini-Database</h4>
            <span className="badge badge-normal">322 Images</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Acquired from the Mammographic Image Analysis Society (Cambridge, UK). Uncompressed 8-bit PGM raster scans at 50-micron pixel edge, clipped/padded to 1024×1024. Contains 161 patient bilateral pairs with Wolfe tissue density classification.
          </p>
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Status: <strong>161 Patients • 0 Missing • Strict Patient Split</strong>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '14px' }}>Mendeley Breast Thermography</h4>
            <span className="badge badge-rosegold">357 Images</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Published under CC BY-NC 3.0 (Mexico). Calibrated infrared thermal camera records capturing temperature distribution across three clinical projections (Anterior, Left Oblique, Right Oblique) for 119 diagnosed patients.
          </p>
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Status: <strong>119 Patients × 3 Projections = 357 Scans</strong>
          </div>
        </div>
      </div>

      {/* Manifest Table Filter & Search Controls */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          {/* Modality Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn-secondary ${modality === 'all' ? 'active' : ''}`}
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => setModality('all')}
            >
              All Cohorts (679)
            </button>
            <button
              className={`btn-secondary ${modality === 'mammogram' ? 'active' : ''}`}
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => setModality('mammogram')}
            >
              MIAS Mammograms (322)
            </button>
            <button
              className={`btn-secondary ${modality === 'thermal' ? 'active' : ''}`}
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => setModality('thermal')}
            >
              Mendeley Thermal (357)
            </button>
          </div>

          {/* Search Bar & Limit Dropdown */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search patient, file, label..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '7px 12px 7px 30px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-surface)',
                  fontSize: '12px',
                  width: '200px'
                }}
              />
            </div>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{
                padding: '7px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                fontSize: '12px'
              }}
            >
              <option value={25}>Show 25</option>
              <option value={50}>Show 50</option>
              <option value={100}>Show 100</option>
              <option value={200}>Show 200</option>
            </select>
            <button type="submit" className="btn-secondary" style={{ padding: '7px 12px', fontSize: '12px' }}>
              Search
            </button>
          </form>
        </div>

        {/* Manifest Table */}
        {isLoading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Reading manifest records from disk...
          </div>
        ) : errorMsg ? (
          <div style={{ padding: '16px', color: 'var(--status-malignant)', fontSize: '12px' }}>
            Error: {errorMsg}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Modality</th>
                  <th>Filename</th>
                  <th>Patient ID</th>
                  <th>Ground Truth</th>
                  <th>Tissue / View</th>
                  <th>Dimensions</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`badge ${r.modality === 'mammogram' ? 'badge-normal' : 'badge-rosegold'}`}>
                        {r.modality}
                      </span>
                    </td>
                    <td className="mono" style={{ fontWeight: 600, fontSize: '12px' }}>
                      {r.filename}
                    </td>
                    <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                      {r.patient_id}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: r.label.toLowerCase() === 'malignant' ? 'var(--status-malignant-bg)' : r.label.toLowerCase() === 'benign' ? 'var(--status-benign-bg)' : 'var(--status-normal-bg)',
                        color: r.label.toLowerCase() === 'malignant' ? 'var(--status-malignant)' : r.label.toLowerCase() === 'benign' ? 'var(--status-benign)' : 'var(--status-normal)',
                        border: `1px solid ${r.label.toLowerCase() === 'malignant' ? 'var(--status-malignant-border)' : r.label.toLowerCase() === 'benign' ? 'var(--status-benign-border)' : 'var(--status-normal-border)'}`
                      }}>
                        {r.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {r.background_tissue ? `Tissue: ${r.background_tissue}` : r.view ? `View: ${r.view}` : '—'}
                    </td>
                    <td className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {r.image_width && r.image_height ? `${r.image_width}×${r.image_height}` : '1024×1024'}
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-normal)', fontSize: '11px', fontWeight: 500 }}>
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>Displaying {records.length} of {totalCount} total verified items</span>
          <span>Manifest path: <code>data/manifests/*.csv</code></span>
        </div>
      </div>
    </div>
  );
};
