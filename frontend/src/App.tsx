import React, { useState, useEffect } from 'react';
import {
  Home,
  PlusCircle,
  FileCheck2,
  History,
  Info,
  RefreshCw,
  Menu,
  X
} from 'lucide-react';

import {
  HealthResponse,
  ModelReadinessResponse,
  SystemStatus,
  ModelStatus,
  AnalysisResponse,
  fetchHealthCheck,
  fetchModelReadiness,
  fetchSystemStatus,
  fetchModelStatus
} from './services/api';

import { HomePage } from './features/home/HomePage';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { ResultsPage } from './features/results/ResultsPage';
import { HistoryPage } from './features/history/HistoryPage';
import { AboutPage } from './features/about/AboutPage';

export function App() {
  const [activeModality, setActiveModality] = useState<'mammogram' | 'thermal'>('mammogram');

  const normalizeView = (hash: string): string => {
    const clean = hash.replace('#', '').trim().toLowerCase();
    if (['home', 'analyze', 'results', 'history', 'about'].includes(clean)) {
      return clean;
    }
    // Backward compatibility for existing links
    if (clean === 'overview') return 'home';
    if (clean === 'mammogram') {
      setActiveModality('mammogram');
      return 'analyze';
    }
    if (clean === 'thermal') {
      setActiveModality('thermal');
      return 'analyze';
    }
    if (clean === 'explainability') return 'results';
    if (['datasets', 'evaluation', 'settings'].includes(clean)) return 'about';
    return 'home';
  };

  const getInitialView = () => normalizeView(window.location.hash);

  const [currentView, setCurrentView] = useState<string>(getInitialView);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [modelReadiness, setModelReadiness] = useState<ModelReadinessResponse | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisResponse | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(normalizeView(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const syncBackendData = async () => {
    setIsSyncing(true);
    try {
      const [hlth, readi, sys, mdl] = await Promise.all([
        fetchHealthCheck().catch(() => null),
        fetchModelReadiness().catch(() => null),
        fetchSystemStatus().catch(() => null),
        fetchModelStatus().catch(() => null)
      ]);
      if (hlth) setHealth(hlth);
      if (readi) setModelReadiness(readi);
      if (sys) setStatus(sys);
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
    { id: 'home', label: 'Home', icon: Home },
    { id: 'analyze', label: 'New Analysis', icon: PlusCircle },
    { id: 'results', label: 'Results', icon: FileCheck2 },
    { id: 'history', label: 'Analysis History', icon: History },
    { id: 'about', label: 'About & Disclaimer', icon: Info }
  ];

  const handleNavigate = (view: string, modality?: 'mammogram' | 'thermal') => {
    if (modality) {
      setActiveModality(modality);
    }
    setCurrentView(view);
    window.location.hash = view;
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isBackendConnected = Boolean(health?.status === 'healthy' || status);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div
            onClick={() => handleNavigate('home')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--primary-rose), var(--dusty-rose))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '15px',
              boxShadow: '0 2px 6px rgba(178, 59, 85, 0.28)'
            }}>
              M
            </div>
            <div>
              <div style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.1
              }}>
                MammoFusion
              </div>
              <div style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                fontWeight: 600,
                marginTop: '2px'
              }}>
                Real-Time AI Platform
              </div>
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
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} color={isActive ? '#FFFFFF' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <div style={{
            padding: '14px',
            background: 'var(--bg-blush-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-rose)',
            fontSize: '11px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>System Status</span>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isBackendConnected ? 'var(--status-normal)' : 'var(--status-benign)',
                boxShadow: isBackendConnected ? '0 0 6px rgba(21, 128, 61, 0.4)' : 'none',
                display: 'inline-block'
              }} />
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {isBackendConnected ? 'Connected to AI Engine' : 'Reconnecting to Server...'}
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
              <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {navItems.find((n) => n.id === currentView)?.label}
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Connection Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: isBackendConnected ? 'var(--status-normal-bg)' : 'var(--status-benign-bg)',
              border: `1px solid ${isBackendConnected ? 'var(--status-normal-border)' : 'var(--status-benign-border)'}`,
              fontSize: '11px',
              color: isBackendConnected ? 'var(--status-normal)' : 'var(--status-benign)',
              fontWeight: 600
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isBackendConnected ? 'var(--status-normal)' : 'var(--status-benign)'
              }} />
              <span>{isBackendConnected ? 'Backend Connected' : 'Disconnected'}</span>
            </div>

            {/* Sync Button */}
            <button
              onClick={syncBackendData}
              disabled={isSyncing}
              className="btn-secondary"
              style={{ padding: '5px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Refresh connection status"
            >
              <RefreshCw size={12} className={isSyncing ? 'spinning' : ''} />
              <span>{isSyncing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="content-container">
          {currentView === 'home' && (
            <HomePage
              health={health}
              modelReadiness={modelReadiness}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'analyze' && (
            <AnalysisPage
              initialModality={activeModality}
              modelReadiness={modelReadiness}
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

          {currentView === 'history' && (
            <HistoryPage
              onNavigate={handleNavigate}
              onSelectResult={(res) => setLatestAnalysis(res)}
            />
          )}

          {currentView === 'about' && (
            <AboutPage />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
