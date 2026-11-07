import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Camera,
  Lock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';

export function ViolationHistoryPage() {
  const [violations, setViolations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchCamera, setSearchCamera] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const params = { limit, offset: page * limit };
      if (filterCategory) params.category = filterCategory;
      if (searchCamera) params.camera_id = searchCamera;

      const res = await api.getViolations(params);
      setViolations(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load violations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, [filterCategory, searchCamera, page]);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Violation Incident History
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 text-rose-500 text-[10px] font-mono font-semibold uppercase tracking-wider">
              Audit Trail
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Sealed audit logs of non-compliant face events captured across registered surveillance checkpoints.
          </p>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl glass-pill text-xs text-[var(--text-secondary)]">
          <Lock className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Privacy Protected: Raw face photos omitted</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Camera ID..."
              value={searchCamera}
              onChange={(e) => {
                setSearchCamera(e.target.value);
                setPage(0);
              }}
              className="pl-8 pr-3 py-1.5 glass-input rounded-xl text-xs placeholder-[var(--text-muted)] w-56 transition-all"
            />
          </div>

          <div className="flex items-center space-x-2 glass-pill px-3 py-1.5 text-xs text-[var(--text-secondary)]">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(0);
              }}
              className="bg-transparent text-[var(--text-primary)] outline-none cursor-pointer text-xs"
            >
              <option value="" className="bg-[var(--bg-primary)]">All Categories</option>
              <option value="No Mask" className="bg-[var(--bg-primary)]">No Mask</option>
              <option value="Incorrect Mask" className="bg-[var(--bg-primary)]">Incorrect Mask</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchViolations}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl glass-pill hover:bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Violations Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--glass-bg-subtle)] border-b border-[var(--glass-border-subtle)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Event Ref</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Camera Feed</th>
                <th className="py-3 px-4">Violation Type</th>
                <th className="py-3 px-4">Neural Confidence</th>
                <th className="py-3 px-4">Risk Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border-subtle)] text-[var(--text-secondary)]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-[var(--text-muted)]">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[var(--accent)] mb-2" />
                    <span>Loading violation records...</span>
                  </td>
                </tr>
              ) : violations.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-[var(--text-muted)]">
                    No violation events registered matching current criteria.
                  </td>
                </tr>
              ) : (
                violations.map((v) => {
                  const isNoMask = v.detection_category === 'No Mask';
                  const dateStr = v.timestamp ? new Date(v.timestamp).toLocaleString() : 'N/A';
                  return (
                    <tr key={v.id} className="hover:bg-[var(--glass-bg-subtle)] transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-[var(--text-muted)] text-[11px]">
                        #EVT-{v.id.toString().padStart(5, '0')}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-primary)] text-[11px]">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 font-mono text-[var(--accent)] text-[11px]">
                          <Camera className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <span>{v.camera_id || 'webcam'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isNoMask ? 'badge-danger' : 'badge-warning'
                          }`}
                        >
                          {isNoMask ? (
                            <ShieldAlert className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          <span>{v.detection_category}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-primary)] text-[11px] font-semibold">
                        {Math.round(v.confidence_score * 100)}%
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            isNoMask
                              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                          }`}
                        >
                          {isNoMask ? 'High Alert' : 'Moderate'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-[var(--glass-border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span className="text-[11px]">
            Showing {violations.length} of {total} recorded incidents
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 rounded-lg glass-pill hover:bg-[var(--glass-bg)] disabled:opacity-40 disabled:cursor-not-allowed text-[11px] flex items-center space-x-1"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Previous</span>
            </button>
            <span className="font-mono text-[var(--text-primary)] text-[11px] px-1">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-2.5 py-1 rounded-lg glass-pill hover:bg-[var(--glass-bg)] disabled:opacity-40 disabled:cursor-not-allowed text-[11px] flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
