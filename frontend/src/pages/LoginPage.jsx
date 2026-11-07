import React, { useState } from 'react';
import { ShieldCheck, Lock, User, ArrowRight, AlertCircle, Sparkles, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

export function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFill = () => {
    setUsername('admin');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col justify-center items-center px-4 relative overflow-hidden select-none transition-colors duration-300">
      {/* Ambient Orbs */}
      <div className="ambient-orb orb-accent"></div>
      <div className="ambient-orb orb-secondary"></div>

      {/* Top Floating Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl glass-card text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shadow-sm"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>
      </div>

      {/* Main Glass Portal Card */}
      <div className="w-full max-w-sm glass-panel p-8 shadow-2xl relative z-10 border border-[var(--glass-border)] rounded-3xl">
        {/* Brand Icon & Heading */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1.5px] shadow-xl shadow-indigo-500/20 mx-auto mb-3.5">
            <div className="w-full h-full bg-[var(--bg-primary)] rounded-[14px] flex items-center justify-center transition-colors">
              <ShieldCheck className="w-8 h-8 text-[var(--accent)]" />
            </div>
          </div>

          <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
            FaceGuard <span className="text-[var(--accent)]">AI</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
            Intelligent Face Mask Compliance Monitoring
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Administrator Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 glass-input rounded-xl text-xs placeholder-[var(--text-muted)] focus:outline-none"
                placeholder="admin"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Security Key / Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 glass-input rounded-xl text-xs placeholder-[var(--text-muted)] focus:outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 px-4 bg-[var(--accent)] hover:opacity-90 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-[var(--accent)]/30 transition-all disabled:opacity-50"
          >
            <span>{submitting ? 'Verifying Credentials...' : 'Sign In to Portal'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[var(--glass-border-subtle)] flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">Demo Mode:</span>
          <button
            type="button"
            onClick={handleQuickFill}
            className="text-[var(--accent)] hover:underline font-semibold flex items-center space-x-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fill Credentials</span>
          </button>
        </div>
      </div>
    </div>
  );
}
