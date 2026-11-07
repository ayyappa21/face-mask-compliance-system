const API_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:8001`
  : '';

const API_BASE = `${API_HOST}/api`;

function getAuthHeaders() {
  const token = localStorage.getItem('fm_access_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Health
  async getHealth() {
    const res = await fetch(`${API_HOST}/health`);
    return res.json();
  },

  // Auth
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Authentication failed' }));
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  async getCurrentUser() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  // Statistics & Analytics
  async getStatistics() {
    const res = await fetch(`${API_BASE}/statistics`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch statistics');
    return res.json();
  },

  // Violations
  async getViolations(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/violations?${query}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch violations');
    return res.json();
  },

  // History
  async getHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/history?${query}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  // Model Info
  async getModelInfo() {
    const res = await fetch(`${API_BASE}/model-info`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch model info');
    return res.json();
  },

  // Cameras
  async getCameras() {
    const res = await fetch(`${API_BASE}/cameras`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch cameras');
    return res.json();
  },

  async createCamera(cameraData) {
    const res = await fetch(`${API_BASE}/cameras`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(cameraData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create camera' }));
      throw new Error(err.detail || 'Failed to create camera');
    }
    return res.json();
  },

  async updateCamera(id, updateData) {
    const res = await fetch(`${API_BASE}/cameras/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    if (!res.ok) throw new Error('Failed to update camera');
    return res.json();
  },

  async deleteCamera(id) {
    const res = await fetch(`${API_BASE}/cameras/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete camera');
    return res.json();
  },

  // Detection API
  async detectFrame(formData) {
    const res = await fetch(`${API_BASE}/detect`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Detection failed' }));
      throw new Error(err.detail || 'Detection failed');
    }
    return res.json();
  }
};
