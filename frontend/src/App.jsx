import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ViolationHistoryPage } from './pages/ViolationHistoryPage';
import { CameraManagementPage } from './pages/CameraManagementPage';
import { ModelInfoPage } from './pages/ModelInfoPage';
import { SettingsPage } from './pages/SettingsPage';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-secondary)] font-mono text-xs">
        Initializing Surveillance Platform...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col relative overflow-x-hidden transition-colors duration-300">
      {/* Ambient background glow orbs */}
      <div className="ambient-orb orb-accent" />
      <div className="ambient-orb orb-secondary" />

      {/* Top Glass Navbar */}
      <Navbar activePage={currentTab} />

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Floating Glass Sidebar */}
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto pb-16 px-2 sm:px-4">
          {currentTab === 'dashboard' && (
            <DashboardPage onNavigateToLive={() => setCurrentTab('live')} />
          )}
          {currentTab === 'live' && <LiveMonitoringPage />}
          {currentTab === 'analytics' && <AnalyticsPage />}
          {currentTab === 'violations' && <ViolationHistoryPage />}
          {currentTab === 'cameras' && <CameraManagementPage />}
          {currentTab === 'model' && <ModelInfoPage />}
          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
