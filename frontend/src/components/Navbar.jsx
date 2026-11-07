import React from 'react';
import { ShieldCheck, LogOut, Sun, Moon, Radio, Activity, Download } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 glass-panel border-b border-[var(--glass-border)] px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-2xl mx-4 mt-3 rounded-2xl shadow-sm">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/20">
          <div className="w-full h-full bg-[var(--bg-primary)] rounded-[10px] flex items-center justify-center transition-colors">
            <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-extrabold text-[var(--text-primary)] tracking-tight">
              FaceGuard <span className="text-[var(--accent)]">AI</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-[var(--accent-glow)] text-[var(--accent)] text-[10px] font-mono font-bold tracking-wider border border-[var(--accent)]/30">
              PRO
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] font-medium">
            Intelligent Face Mask Compliance Monitoring
          </p>
        </div>
      </div>

      {/* Center: Live Status Telemetry Pill */}
      <div className="hidden md:flex items-center space-x-2.5 px-4 py-1.5 glass-pill text-xs">
        <span className="w-2 h-2 rounded-full bg-[var(--success)] live-pulse"></span>
        <span className="text-[var(--text-secondary)] text-[11px] font-medium">
          Neural Inference Engine: <span className="text-[var(--success)] font-semibold font-mono">30 FPS Active</span>
        </span>
      </div>

      {/* Right Controls: Theme Toggle & User Profile */}
      <div className="flex items-center space-x-3">
        {/* Light / Dark Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl glass-pill text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all shadow-sm"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500" />
          )}
        </button>

        {/* Direct Project ZIP Download Button */}
        <a
          href="/face_mask_compliance_system.zip"
          download="face_mask_compliance_system.zip"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl glass-pill bg-[var(--accent-glow)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white border border-[var(--accent)]/30 text-xs font-semibold transition-all shadow-sm"
          title="Download Complete Project ZIP Archive"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download ZIP</span>
        </a>

        {user && (
          <div className="flex items-center space-x-3 pl-3 border-l border-[var(--glass-border-subtle)]">
            <div className="flex items-center space-x-2.5 px-3 py-1 rounded-full glass-pill">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-[var(--text-primary)] capitalize">
                {user.username}
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-[var(--accent-glow)] text-[var(--accent)] font-bold">
                {user.role}
              </span>
            </div>

            <button
              onClick={logout}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
