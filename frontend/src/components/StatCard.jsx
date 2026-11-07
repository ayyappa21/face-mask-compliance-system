import React from 'react';

export function StatCard({ title, value, subtext, icon: Icon, color = 'accent', trend }) {
  const schemeMap = {
    accent: {
      accentBorder: 'hover:border-[var(--accent)]/50',
      badge: 'bg-[var(--accent-glow)] text-[var(--accent)] border-[var(--accent)]/30',
      iconBg: 'bg-[var(--accent-glow)] text-[var(--accent)]'
    },
    success: {
      accentBorder: 'hover:border-emerald-500/50',
      badge: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30',
      iconBg: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400'
    },
    danger: {
      accentBorder: 'hover:border-rose-500/50',
      badge: 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/30',
      iconBg: 'bg-rose-500/15 text-rose-500 dark:text-rose-400'
    },
    warning: {
      accentBorder: 'hover:border-amber-500/50',
      badge: 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30',
      iconBg: 'bg-amber-500/15 text-amber-500 dark:text-amber-400'
    }
  };

  const scheme = schemeMap[color] || schemeMap.accent;

  return (
    <div className={`p-5 glass-card ${scheme.accentBorder} relative overflow-hidden group`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            {title}
          </span>
          <div className="mt-2.5 flex items-baseline space-x-2.5">
            <span className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {value}
            </span>
            {trend && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scheme.badge}`}>
                {trend}
              </span>
            )}
          </div>
          {subtext && (
            <p className="mt-1 text-[11px] text-[var(--text-secondary)] font-normal">
              {subtext}
            </p>
          )}
        </div>

        {Icon && (
          <div className={`p-3 rounded-2xl ${scheme.iconBg} shadow-sm transition-transform duration-300 group-hover:scale-105`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
