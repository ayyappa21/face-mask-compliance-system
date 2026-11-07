import React, { useEffect, useState } from 'react';
import {
  Camera,
  Plus,
  Trash2,
  Power,
  RefreshCw,
  AlertCircle,
  X,
  MapPin,
  Radio
} from 'lucide-react';
import { api } from '../services/api';

export function CameraManagementPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCamera, setNewCamera] = useState({
    id: '',
    camera_name: '',
    camera_location: '',
    camera_status: 'online',
    camera_source: '0'
  });
  const [error, setError] = useState('');

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const list = await api.getCameras();
      setCameras(list);
    } catch (err) {
      console.error('Failed to load cameras', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createCamera(newCamera);
      setShowAddModal(false);
      setNewCamera({
        id: '',
        camera_name: '',
        camera_location: '',
        camera_status: 'online',
        camera_source: '0'
      });
      fetchCameras();
    } catch (err) {
      setError(err.message || 'Failed to create camera');
    }
  };

  const handleToggleStatus = async (cam) => {
    const nextStatus = cam.camera_status === 'online' ? 'disabled' : 'online';
    try {
      await api.updateCamera(cam.id, { camera_status: nextStatus });
      fetchCameras();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to remove feed ${id}?`)) return;
    try {
      await api.deleteCamera(id);
      fetchCameras();
    } catch (err) {
      console.error('Failed to delete camera', err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Camera Feed Management
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-glow)] border border-[var(--accent)]/30 text-[var(--accent)] text-[10px] font-mono font-semibold uppercase tracking-wider">
              Hardware Nodes
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Configure local webcams, network RTSP streams, and security surveillance points.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[var(--accent)] hover:opacity-95 text-white text-xs font-semibold shadow-lg shadow-[var(--accent)]/25 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Camera Feed</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted)] text-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[var(--accent)] mb-2" />
          <span>Loading cameras...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cameras.map((cam) => {
            const isOnline = cam.camera_status === 'online';
            return (
              <div
                key={cam.id}
                className="glass-card p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[11px] font-bold text-[var(--accent)] bg-[var(--accent-glow)] px-2.5 py-0.5 rounded-lg border border-[var(--accent)]/30">
                      {cam.id}
                    </span>

                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isOnline ? 'badge-safe' : 'badge-danger'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isOnline ? 'bg-[var(--success)] live-pulse' : 'bg-[var(--danger)]'
                        }`}
                      />
                      <span className="capitalize">{cam.camera_status}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {cam.camera_name}
                  </h3>

                  <div className="flex items-center space-x-1.5 text-xs text-[var(--text-secondary)] mt-1">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>{cam.camera_location}</span>
                  </div>

                  <div className="mt-3.5 p-2 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] truncate flex items-center space-x-2">
                    <Radio className="w-3 h-3 text-[var(--accent)] shrink-0" />
                    <span className="truncate">{cam.camera_source}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--glass-border-subtle)] flex items-center justify-between">
                  <button
                    onClick={() => handleToggleStatus(cam)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isOnline
                        ? 'glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        : 'bg-[var(--success)] text-white shadow-md shadow-[var(--success)]/20'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{isOnline ? 'Pause Stream' : 'Activate Stream'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(cam.id)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-rose-500/10 transition-colors"
                    title="Remove Camera"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Camera Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 max-w-sm w-full rounded-2xl shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--glass-border-subtle)]">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-sm font-bold text-[var(--text-primary)]">Add Camera Feed</span>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[var(--text-secondary)] font-medium mb-1">
                  Camera ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAM-04"
                  value={newCamera.id}
                  onChange={(e) => setNewCamera({ ...newCamera, id: e.target.value })}
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--text-secondary)] font-medium mb-1">
                  Camera Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. East Entrance"
                  value={newCamera.camera_name}
                  onChange={(e) => setNewCamera({ ...newCamera, camera_name: e.target.value })}
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--text-secondary)] font-medium mb-1">
                  Location
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor Gate 2"
                  value={newCamera.camera_location}
                  onChange={(e) => setNewCamera({ ...newCamera, camera_location: e.target.value })}
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--text-secondary)] font-medium mb-1">
                  Source (`0` for local webcam, or RTSP URI)
                </label>
                <input
                  type="text"
                  required
                  placeholder="0 or rtsp://192.168.1.100:554/live"
                  value={newCamera.camera_source}
                  onChange={(e) => setNewCamera({ ...newCamera, camera_source: e.target.value })}
                  className="w-full px-3 py-2 glass-input rounded-xl text-xs font-mono outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-xl glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[var(--accent)] hover:opacity-95 text-white font-semibold shadow-md shadow-[var(--accent)]/25"
                >
                  Save Feed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
