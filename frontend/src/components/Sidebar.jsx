import React, { useState } from 'react';
import {
  LayoutDashboard,
  Video,
  BarChart3,
  AlertTriangle,
  Camera,
  Cpu,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Zap
} from 'lucide-react';

export function Sidebar({ currentTab, setCurrentTab }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'live', label: 'Live Monitoring', icon: Video, badge: 'Live' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'violations', label: 'Violation History', icon: AlertTriangle },
    { id: 'cameras', label: 'Camera Management', icon: Camera },
    { id: 'model', label: 'Model Performance', icon: Cpu },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <aside
      className={`glass-panel my-3 ml-4 mr-1 transition-all duration-300 ease-in-out shrink-0 flex flex-col justify-between select-none relative z-20 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      style={{ minHeight: 'calc(100vh - 5.5rem)' }}
    >
      <div className="p-3.5 space-y-2">
        {/* Collapse / Expand Toggle Button */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          {!isCollapsed && (
            <span className="text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
              Navigation
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all ml-auto"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Menu Items */}
        <div className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3.5 py-2.5'
                } rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25 border border-white/20'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)]'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
                  {!isCollapsed && <span className="font-semibold tracking-tight">{item.label}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating System Status Pill */}
      {!isCollapsed ? (
        <div className="p-3.5 m-3 rounded-2xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--success)] live-pulse"></span>
              <span>Vision Core</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--accent)] font-bold">MobileNetV2</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Real-time multi-person CNN compliance inference at ~9.4ms per face.
          </p>
        </div>
      ) : (
        <div className="p-3 flex justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--success)] live-pulse" title="System Active"></div>
        </div>
      )}
    </aside>
  );
}
