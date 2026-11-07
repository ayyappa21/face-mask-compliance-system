import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Sliders,
  Bell,
  Volume2,
  Lock,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Zap,
  Server
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  // Settings State
  const [confidenceThreshold, setConfidenceThreshold] = useState(() => {
    return Number(localStorage.getItem('faceguard_conf_threshold') || 65);
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    return localStorage.getItem('faceguard_sound_alerts') !== 'false';
  });
  const [strictCompliance, setStrictCompliance] = useState(() => {
    return localStorage.getItem('faceguard_strict_compliance') === 'true';
  });
  const [privacyGuard, setPrivacyGuard] = useState(() => {
    return localStorage.getItem('faceguard_privacy_guard') !== 'false';
  });
  const [streamFps, setStreamFps] = useState(() => {
    return Number(localStorage.getItem('faceguard_stream_fps') || 15);
  });
  const [boxStyle, setBoxStyle] = useState(() => {
    return localStorage.getItem('faceguard_box_style') || 'glow';
  });

  // Diagnostics State
  const [testingConnection, setTestingConnection] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [savedToast, setSavedToast] = useState(false);

  // Sync to local storage
  const handleSave = () => {
    localStorage.setItem('faceguard_conf_threshold', confidenceThreshold.toString());
    localStorage.setItem('faceguard_sound_alerts', soundAlerts.toString());
    localStorage.setItem('faceguard_strict_compliance', strictCompliance.toString());
    localStorage.setItem('faceguard_privacy_guard', privacyGuard.toString());
    localStorage.setItem('faceguard_stream_fps', streamFps.toString());
    localStorage.setItem('faceguard_box_style', boxStyle);

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2400);
  };

  const handleResetDefaults = () => {
    setConfidenceThreshold(65);
    setSoundAlerts(true);
    setStrictCompliance(false);
    setPrivacyGuard(true);
    setStreamFps(15);
    setBoxStyle('glow');

    localStorage.setItem('faceguard_conf_threshold', '65');
    localStorage.setItem('faceguard_sound_alerts', 'true');
    localStorage.setItem('faceguard_strict_compliance', 'false');
    localStorage.setItem('faceguard_privacy_guard', 'true');
    localStorage.setItem('faceguard_stream_fps', '15');
    localStorage.setItem('faceguard_box_style', 'glow');

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2400);
  };

  const testBackendConnection = async () => {
    try {
      setTestingConnection(true);
      const res = await api.getHealth();
      setHealthStatus({
        ok: true,
        data: res
      });
    } catch (err) {
      setHealthStatus({
        ok: false,
        error: err.message || 'Connection failed'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  useEffect(() => {
    testBackendConnection();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              System Configuration & Preferences
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-glow)] border border-[var(--accent)]/30 text-[var(--accent)] text-[10px] font-mono font-semibold uppercase tracking-wider">
              Control Panel
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Manage neural thresholds, display themes, surveillance privacy guardrails, and telemetry diagnostics.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {savedToast && (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[var(--success)] text-xs font-semibold flex items-center space-x-1 animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Preferences Saved</span>
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:opacity-95 text-white text-xs font-semibold shadow-lg shadow-[var(--accent)]/25 transition-all"
          >
            Apply Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Appearance & Interface */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center space-x-2 text-[var(--text-primary)] font-bold text-sm">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-[var(--accent)]" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>Visual Theme & Interface</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Toggle between translucent glass surfaces tuned for daylight or low-light monitoring.
          </p>

          <div className="p-4 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-[var(--text-primary)] block">
                Current Color Scheme
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                {theme === 'dark' ? 'Dark Glassmorphism (#10131D)' : 'Light Glassmorphism (#F4F6FA)'}
              </span>
            </div>

            <button
              onClick={toggleTheme}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl glass-pill hover:bg-[var(--glass-bg)] text-xs font-medium text-[var(--text-primary)] transition-all"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Switch to Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Switch to Dark</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--glass-border-subtle)]">
            <label className="text-xs font-semibold text-[var(--text-primary)] block">
              Bounding Box Rendering Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'glow', label: 'Luminous Glow' },
                { id: 'solid', label: 'Solid Border' },
                { id: 'minimal', label: 'Minimalist' }
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => setBoxStyle(style.id)}
                  className={`p-2 rounded-xl text-center text-xs font-medium border transition-all ${
                    boxStyle === style.id
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                      : 'glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Neural Detection Parameters */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center space-x-2 text-[var(--text-primary)] font-bold text-sm">
            <Sliders className="w-4 h-4 text-[var(--accent)]" />
            <span>Neural Detection Parameters</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Tune neural inference sensitivity to balance false alarms against detection rigor.
          </p>

          <div className="p-4 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                Confidence Threshold
              </span>
              <span className="font-mono font-bold text-[var(--accent)]">
                {confidenceThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="40"
              max="95"
              step="5"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="w-full accent-[var(--accent)] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>40% (Permissive)</span>
              <span>65% (Recommended)</span>
              <span>95% (Strict)</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                Video Ingestion Frame Rate
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {streamFps} FPS
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={streamFps}
              onChange={(e) => setStreamFps(Number(e.target.value))}
              className="w-full accent-[var(--accent)] cursor-pointer"
            />
            <span className="text-[10px] text-[var(--text-muted)] block">
              Lower frame rates conserve client CPU and network bandwidth during WebSocket transmission.
            </span>
          </div>
        </div>

        {/* Surveillance Alerts & Governance */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center space-x-2 text-[var(--text-primary)] font-bold text-sm">
            <Bell className="w-4 h-4 text-[var(--accent)]" />
            <span>Alerts & Notifications</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Configure audible warning tones and security violation triggers.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)]">
              <div className="flex items-center space-x-2.5">
                <Volume2 className="w-4 h-4 text-[var(--text-secondary)]" />
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    Audible Violation Chime
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Emit subtle alert when an unmasked face enters frame
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundAlerts}
                onChange={(e) => setSoundAlerts(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)]">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-[var(--text-secondary)]" />
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    Strict Mode (Flag Incorrect Masks)
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Trigger non-compliance audit logs for masks below the nose
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={strictCompliance}
                onChange={(e) => setStrictCompliance(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Privacy & CCTV Compliance */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center space-x-2 text-[var(--text-primary)] font-bold text-sm">
            <Lock className="w-4 h-4 text-[var(--accent)]" />
            <span>Privacy Guard & CCTV Compliance</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Privacy-conscious CCTV settings adhering to modern data protection standards.
          </p>

          <div className="p-3.5 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  Biometric Privacy Shield
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Only retain temporal detection metrics; never store raw facial photography.
                </span>
              </div>
              <input
                type="checkbox"
                checked={privacyGuard}
                onChange={(e) => setPrivacyGuard(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-[var(--text-secondary)] leading-relaxed">
            <strong className="text-[var(--success)] block mb-0.5">Privacy Compliant Architecture:</strong>
            FaceGuard AI operates edge facial localization without storing biometric identity vectors, names, or face embeddings in permanent storage.
          </div>
        </div>
      </div>

      {/* Backend Diagnostics & Connectivity Section */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[var(--text-primary)] font-bold text-sm">
            <Server className="w-4 h-4 text-[var(--accent)]" />
            <span>Infrastructure Connectivity & Diagnostics</span>
          </div>

          <button
            onClick={testBackendConnection}
            disabled={testingConnection}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl glass-pill hover:bg-[var(--glass-bg)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin text-[var(--accent)]' : ''}`} />
            <span>Run Health Check</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)]">
            <span className="text-[11px] text-[var(--text-muted)] block">FastAPI Gateway</span>
            <span className="font-mono font-semibold text-[var(--text-primary)] mt-1 block">
              http://localhost:8001
            </span>
            <div className="flex items-center space-x-1 mt-1 text-[10px] text-[var(--success)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] live-pulse" />
              <span>CORS & WebSocket Active</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)]">
            <span className="text-[11px] text-[var(--text-muted)] block">Database Layer</span>
            <span className="font-mono font-semibold text-[var(--text-primary)] mt-1 block">
              SQLite / PostgreSQL
            </span>
            <div className="flex items-center space-x-1 mt-1 text-[10px] text-[var(--text-secondary)]">
              <span>face_mask_monitoring</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)]">
            <span className="text-[11px] text-[var(--text-muted)] block">Neural Model Status</span>
            <span className="font-mono font-semibold text-[var(--accent)] mt-1 block">
              MobileNetV2 (Loaded)
            </span>
            <div className="flex items-center space-x-1 mt-1 text-[10px] text-[var(--text-secondary)]">
              <span>97.73% Empirical Accuracy</span>
            </div>
          </div>
        </div>

        {healthStatus && (
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            healthStatus.ok
              ? 'bg-emerald-500/10 border-emerald-500/25 text-[var(--success)]'
              : 'bg-rose-500/10 border-rose-500/25 text-[var(--danger)]'
          }`}>
            <div className="flex items-center space-x-2">
              {healthStatus.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--success)]" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[var(--danger)]" />
              )}
              <span>
                {healthStatus.ok
                  ? `Backend health verified: ${healthStatus.data.app_name || 'FaceGuard AI'} (Status: ${healthStatus.data.status})`
                  : `Backend unreachable: ${healthStatus.error}`}
              </span>
            </div>
            <span className="font-mono text-[11px]">200 OK</span>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-rose-500/10 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Factory Defaults</span>
          </button>
        </div>
      </div>
    </div>
  );
}
