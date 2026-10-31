import React, { useState, useEffect } from 'react';
import {
  Home,
  Scan,
  BarChart3,
  Clock,
  Info,
  RefreshCw,
  Menu,
  X,
  Bell,
  ChevronDown,
  Heart
} from 'lucide-react';

import {
  HealthResponse,
  ModelReadinessResponse,
  AnalysisResponse,
  fetchHealthCheck,
  fetchModelReadiness
} from './services/api';

import { HomePage } from './features/home/HomePage';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { ResultsPage } from './features/results/ResultsPage';
import { HistoryPage } from './features/history/HistoryPage';
import { AboutPage } from './features/about/AboutPage';
import { PinkRibbon, WomanSilhouette } from './components/Illustrations';

export function App() {
  const [activeModality, setActiveModality] = useState<'mammogram' | 'thermal'>('mammogram');

  const normalizeView = (hash: string): string => {
    const clean = hash.replace('#', '').trim().toLowerCase();
    if (['dashboard', 'examination', 'results', 'history', 'about'].includes(clean)) {
      return clean;
    }
    // Backward compatibility for existing links and hashes
    if (clean === 'home' || clean === 'overview') return 'dashboard';
    if (clean === 'analyze') return 'examination';
    if (clean === 'mammogram') {
      setActiveModality('mammogram');
      return 'examination';
    }
    if (clean === 'thermal') {
      setActiveModality('thermal');
      return 'examination';
    }
    if (clean === 'explainability' || clean === 'evaluation') return 'results';
    if (['datasets', 'settings'].includes(clean)) return 'about';
    return 'dashboard';
  };

  const getInitialView = () => normalizeView(window.location.hash);

  const [currentView, setCurrentView] = useState<string>(getInitialView);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [modelReadiness, setModelReadiness] = useState<ModelReadinessResponse | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisResponse | null>(null);
  const [targetSample, setTargetSample] = useState<string | null>(null);

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
      const [hlth, readi] = await Promise.all([
        fetchHealthCheck().catch(() => null),
        fetchModelReadiness().catch(() => null)
      ]);
      if (hlth) setHealth(hlth);
      if (readi) setModelReadiness(readi);
    } catch (e) {
      console.error('Failed to sync backend:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchHealthCheck().catch(() => null),
      fetchModelReadiness().catch(() => null)
    ])
      .then(([hlth, readi]) => {
        if (!active) return;
        if (hlth) setHealth(hlth);
        if (readi) setModelReadiness(readi);
      })
      .catch((e) => {
        console.error('Failed to sync backend:', e);
      });
    return () => {
      active = false;
    };
  }, []);

  // Exactly the 5 items matching user design
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'examination', label: 'New Examination', icon: Scan },
    { id: 'results', label: 'Results', icon: BarChart3 },
    { id: 'history', label: 'Patient History', icon: Clock },
    { id: 'about', label: 'About', icon: Info }
  ];

  const handleNavigate = (view: string, modality?: 'mammogram' | 'thermal', sampleFilename?: string) => {
    const normalized = normalizeView(view);
    if (modality) {
      setActiveModality(modality);
    }
    if (sampleFilename !== undefined) {
      setTargetSample(sampleFilename);
    }
    setCurrentView(normalized);
    window.location.hash = normalized;
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

      {/* Deep Plum Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Brand Wordmark with Pink Ribbon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '28px', position: 'relative' }}>
          <button
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
            style={{ position: 'absolute', right: '-4px', top: '0' }}
          >
            <X size={20} color="#FFFFFF" />
          </button>

          <div
            onClick={() => handleNavigate('dashboard')}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
          >
            <PinkRibbon size={34} />
            <div>
              <div style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                lineHeight: 1.15
              }}>
                MammoFusion-XAI
              </div>
              <div style={{
                fontSize: '10px',
                color: '#E0B8CB',
                fontWeight: 500,
                marginTop: '4px',
                letterSpacing: '0.02em'
              }}>
                Breast Imaging Research Platform
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Menu (5 exact items) */}
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
                <Icon size={19} color={isActive ? '#FFFFFF' : '#E2CAD7'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Woman Silhouette & "Early Detection Saves Lives" */}
        <div style={{ marginTop: 'auto', paddingTop: '16px', textAlign: 'center' }}>
          <WomanSilhouette width={140} height={120} />
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '12px', fontStyle: 'italic', fontWeight: 600, color: '#FFD4E5', letterSpacing: '0.02em' }}>
              Early Detection
            </div>
            <div style={{ fontSize: '12px', fontStyle: 'italic', fontWeight: 600, color: '#FFD4E5', letterSpacing: '0.02em' }}>
              Saves Lives
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <Heart size={14} color="#FF70A6" fill="#FF70A6" opacity={0.8} />
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
          </div>

          {/* User Profile & Notifications */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Sync Refresh Button */}
            <button
              type="button"
              onClick={syncBackendData}
              disabled={isSyncing}
              className="btn-secondary"
              style={{ padding: '5px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '9999px' }}
              title="Refresh connection status"
            >
              <RefreshCw size={11} className={isSyncing ? 'spinning' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Notification Bell with Badge */}
            <div style={{ position: 'relative', cursor: 'pointer', padding: '4px' }}>
              <Bell size={18} color="#4A0E2E" />
              <span style={{
                position: 'absolute',
                top: '0',
                right: '0',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#D82873',
                color: '#FFFFFF',
                fontSize: '9px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                1
              </span>
            </div>

            {/* User Avatar Capsule */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px 4px 6px',
              borderRadius: '9999px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #F2CCD7',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(44, 24, 32, 0.04)'
            }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: '#3D0B24',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                B
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#2A061B' }}>Blessing</span>
              <ChevronDown size={14} color="#826674" />
            </div>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="content-container">
          {currentView === 'dashboard' && (
            <HomePage
              health={health}
              modelReadiness={modelReadiness}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'examination' && (
            <AnalysisPage
              initialModality={activeModality}
              initialSampleFilename={targetSample}
              onClearTargetSample={() => setTargetSample(null)}
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
