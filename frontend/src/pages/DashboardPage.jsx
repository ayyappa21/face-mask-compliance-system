import React, { useEffect, useState } from 'react';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Camera,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertOctagon,
  ArrowUpRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { api } from '../services/api';
import { StatCard } from '../components/StatCard';

export function DashboardPage({ onNavigateToLive }) {
  const [data, setData] = useState(null);
  const [violations, setViolations] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const [statsRes, vioRes, camRes] = await Promise.all([
        api.getStatistics(),
        api.getViolations({ limit: 5 }),
        api.getCameras()
      ]);
      setData(statsRes);
      setViolations(vioRes.items || []);
      setCameras(camRes || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-[var(--text-secondary)] space-x-2.5 text-xs font-medium">
        <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent)]" />
        <span>Syncing Real-Time Intelligence Dashboard...</span>
      </div>
    );
  }

  const { summary, trends, category_distribution } = data;
  const pieColors = ['#22C55E', '#EF4444', '#F59E0B'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Compliance Overview
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-glow)] text-[var(--accent)] text-[10px] font-mono font-bold tracking-wider border border-[var(--accent)]/30">
              LIVE
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Real-time aggregate compliance metrics, temporal analytics, and camera safety telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[var(--accent)]' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={onNavigateToLive}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-bold shadow-lg shadow-[var(--accent)]/30 transition-all"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Launch Live Viewport</span>
          </button>
        </div>
      </div>

      {/* 1. Four Primary Glass Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total People Detected"
          value={summary.total_people_detected.toLocaleString()}
          subtext="Cumulative facial scans"
          icon={Users}
          color="accent"
          trend="Active"
        />

        <StatCard
          title="Wearing Masks"
          value={summary.mask_compliant_count.toLocaleString()}
          subtext="Properly covered nose & mouth"
          icon={ShieldCheck}
          color="success"
          trend="Compliant"
        />

        <StatCard
          title="No Mask"
          value={summary.no_mask_count.toLocaleString()}
          subtext="Uncovered facial violations"
          icon={ShieldAlert}
          color="danger"
          trend="Critical"
        />

        <StatCard
          title="Incorrect Mask"
          value={summary.incorrect_mask_count.toLocaleString()}
          subtext="Worn below nose or chin"
          icon={AlertTriangle}
          color="warning"
          trend="Improper"
        />
      </div>

      {/* 2. Compliance Visualization & Detection Activity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Detection Activity Chart */}
        <div className="lg:col-span-2 glass-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Detection Activity Timeline</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">Chronological classification rates across active feeds</p>
            </div>
            <span className="text-[10px] font-mono text-[var(--accent)] bg-[var(--accent-glow)] px-2.5 py-0.5 rounded-full border border-[var(--accent)]/30 font-semibold">
              Live Feed Synced
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientMask" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradientNoMask" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradientIncorrect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="time_label" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--chart-tooltip-bg)',
                    backdropFilter: 'blur(16px)',
                    borderColor: 'var(--chart-tooltip-border)',
                    color: 'var(--chart-tooltip-text)',
                    borderRadius: '14px',
                    fontSize: '11px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
                  }}
                />
                <Area type="monotone" dataKey="mask" name="Mask (Compliant)" stroke="#22C55E" strokeWidth={2.5} fillOpacity={1} fill="url(#gradientMask)" />
                <Area type="monotone" dataKey="no_mask" name="No Mask" stroke="#EF4444" strokeWidth={2.5} fillOpacity={1} fill="url(#gradientNoMask)" />
                <Area type="monotone" dataKey="incorrect" name="Incorrect Mask" stroke="#F59E0B" strokeWidth={2.5} fillOpacity={1} fill="url(#gradientIncorrect)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Compliance Percentage Visualization (Ring & Metrics) */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Compliance Ratio</h3>
              <Activity className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Aggregate mask compliance score</p>
          </div>

          {/* Central Donut Visualization */}
          <div className="h-48 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={category_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={72}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {category_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--chart-tooltip-bg)',
                    backdropFilter: 'blur(16px)',
                    borderColor: 'var(--chart-tooltip-border)',
                    color: 'var(--chart-tooltip-text)',
                    borderRadius: '12px',
                    fontSize: '11px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Inner Percentage Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                {summary.overall_compliance_percentage}%
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--text-muted)]">
                Compliance
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--glass-border-subtle)] flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Target Standard:</span>
            <span className="font-bold text-emerald-500 font-mono">≥ 85.0% Required</span>
          </div>
        </div>
      </div>

      {/* 3. Recent Violations Feed & Camera Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Violations Mini Feed */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Non-Compliance Events</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">Latest safety incidents flagged by vision detectors</p>
            </div>
            <span className="text-xs font-bold text-rose-500 font-mono">
              {summary.total_violations_recorded.toLocaleString()} Total Logged
            </span>
          </div>

          <div className="space-y-2">
            {violations.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-6 text-center">No recent violations logged.</p>
            ) : (
              violations.map((v) => {
                const isNoMask = v.detection_category === 'No Mask';
                return (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-xl ${isNoMask ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'}`}>
                        {isNoMask ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">{v.detection_category}</div>
                        <div className="text-[10px] text-[var(--text-muted)] flex items-center space-x-1.5 mt-0.5">
                          <Camera className="w-3 h-3" />
                          <span>{v.camera_id || 'webcam'}</span>
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          <span>{v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isNoMask ? 'badge-danger' : 'badge-warning'}`}>
                        {Math.round(v.confidence_score * 100)}% Conf
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Camera Status Grid */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Camera Feed Nodes</h3>
              <span className="text-xs font-bold text-[var(--success)] font-mono">
                {cameras.filter((c) => c.camera_status === 'online').length} / {cameras.length} Online
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mb-4">Real-time status of security endpoints</p>

            <div className="space-y-2">
              {cameras.map((c) => {
                const isOnline = c.camera_status === 'online';
                return (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[var(--success)] live-pulse' : 'bg-slate-400'}`}></span>
                      <div>
                        <div className="font-bold text-[var(--text-primary)] text-[11px]">{c.camera_name}</div>
                        <div className="text-[9px] text-[var(--text-muted)] font-mono">{c.id} • {c.camera_location}</div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${isOnline ? 'badge-safe' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                      {c.camera_status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={onNavigateToLive}
            className="w-full mt-4 py-2 rounded-xl glass-pill text-xs font-bold text-[var(--accent)] hover:border-[var(--accent)]/50 transition-colors flex items-center justify-center space-x-1"
          >
            <span>Configure Cameras</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
