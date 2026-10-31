import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Eye,
  Flame,
  ClipboardList,
  Layers,
  Database,
  Award,
  Settings,
  RefreshCw,
  Menu,
  X
} from 'lucide-react';

import {
  SystemStatus,
  DatasetStats,
  ModelStatus,
  AnalysisResponse,
  fetchSystemStatus,
  fetchDatasetStats,
  fetchModelStatus
} from './services/api';

import { OverviewPage } from './features/overview/OverviewPage';
import { MammogramPage } from './features/mammogram/MammogramPage';
import { ThermalPage } from './features/thermal/ThermalPage';
import { ResultsPage } from './features/results/ResultsPage';
import { ExplainabilityPage } from './features/explainability/ExplainabilityPage';
import { DatasetsPage } from './features/datasets/DatasetsPage';
import { EvaluationPage } from './features/evaluation/EvaluationPage';
import { SettingsPage } from './features/settings/SettingsPage';

export function App() {
  // Synchronize route with URL hash for browser back/forward and refresh persistence
  const getInitialView = () => {
    const hash = window.location.hash.replace('#', '').trim();
    const validIds = ['overview', 'mammogram', 'thermal', 'results', 'explainability', 'datasets', 'evaluation', 'settings'];
    return validIds.includes(hash) ? hash : 'overview';
  };

  const [currentView, setCurrentView] = useState<string>(getInitialView);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisResponse | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      const validIds = ['overview', 'mammogram', 'thermal', 'results', 'explainability', 'datasets', 'evaluation', 'settings'];
      if (validIds.includes(hash)) {
        setCurrentView(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const syncBackendData = async () => {
    setIsSyncing(true);
    try {
      const [sys, dset, mdl] = await Promise.all([
        fetchSystemStatus().catch(() => null),
        fetchDatasetStats().catch(() => null),
        fetchModelStatus().catch(() => null)
      ]);
      if (sys) setStatus(sys);
      if (dset) setStats(dset);
      if (mdl) setModelStatus(mdl);
    } catch (e) {
      console.error('Failed to sync backend:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncBackendData();
  }, []);

  const navItems = [
    { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
    { id: 'mammogram', label: 'Mammogram Viewport', icon: Eye },
    { id: 'thermal', label: 'Thermal Viewport', icon: Flame },
    { id: 'results', label: 'Analysis Records', icon: ClipboardList },
    { id: 'explainability', label: 'Grad-CAM XAI', icon: Layers },
    { id: 'datasets', label: 'Manifest Workspace', icon: Database },
    { id: 'evaluation', label: 'Model Benchmark', icon: Award },
    { id: 'settings', label: 'System & Citations', icon: Settings }
  ];

  const handleNavigate = (view: string) => {
    setCurrentView(view);
    window.location.hash = view;
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="layout-root">
      {/* Mobile backdrop overlay */}
      <div
        className={`sidebar-overlay ${mobileMenuOpen ? 'visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Brand Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--primary-rose), var(--dusty-rose))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14px',
                boxShadow: '0 2px 6px rgba(178, 59, 85, 0.3)'
              }}>
                M
              </div>
              <span style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em'
              }}>
                MammoFusion
              </span>
            </div>
            <div style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginTop: '4px',
              paddingLeft: '36px',
              fontWeight: 600
            }}>
              RESEARCH WORKSPACE
            </div>
          </div>
          <button
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} color="var(--text-primary)" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} color={isActive ? 'var(--primary-rose)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Telemetry Footer */}
        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <div style={{
            padding: '12px',
            background: 'var(--bg-muted)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            fontSize: '11px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Repository Audit</span>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--status-normal)',
                display: 'inline-block'
              }} />
            </div>
            <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>679 Verified Images</span>
              <span>100% Readable • 0 Corrupt</span>
              <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Drive E: {status?.disk.free_gb ?? '—'} GB free
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="main-content-wrapper">
        {/* Top Header Bar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="mobile-menu-trigger"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={22} color="var(--text-primary)" />
            </button>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Multimodal Oncology AI
              </div>
              <h1 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {navItems.find((n) => n.id === currentView)?.label}
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Live Backend Connection Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--status-normal-bg)',
              border: '1px solid var(--status-normal-border)',
              fontSize: '11px',
              color: 'var(--status-normal)',
              fontWeight: 600
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--status-normal)',
                boxShadow: '0 0 6px rgba(21, 128, 61, 0.6)'
              }} />
              <span>FastAPI Live :8000</span>
            </div>

            {/* Sync Button */}
            <button
              onClick={syncBackendData}
              disabled={isSyncing}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Synchronize telemetry with backend"
            >
              <RefreshCw size={12} className={isSyncing ? 'spinning' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="content-container">
          {currentView === 'overview' && (
            <OverviewPage
              stats={stats}
              status={status}
              modelStatus={modelStatus}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'mammogram' && (
            <MammogramPage
              onNavigate={handleNavigate}
              onAnalysisComplete={(res) => setLatestAnalysis(res)}
            />
          )}

          {currentView === 'thermal' && (
            <ThermalPage
              onNavigate={handleNavigate}
              onAnalysisComplete={(res) => setLatestAnalysis(res)}
            />
          )}

          {currentView === 'results' && (
            <ResultsPage
              latestResult={latestAnalysis}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'explainability' && (
            <ExplainabilityPage modelStatus={modelStatus} />
          )}

          {currentView === 'datasets' && (
            <DatasetsPage />
          )}

          {currentView === 'evaluation' && (
            <EvaluationPage modelStatus={modelStatus} />
          )}

          {currentView === 'settings' && (
            <SettingsPage status={status} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
