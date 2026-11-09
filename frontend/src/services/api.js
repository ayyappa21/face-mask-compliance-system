/**
 * FaceGuard AI - Central API Client Service
 * Dynamically resolves production Render backend, custom tunnel, and local backend URLs.
 */

const DEFAULT_PRODUCTION_BACKEND = 'https://faceguard-backend-22en.onrender.com';

export function getCustomApiUrl() {
  return localStorage.getItem('faceguard_custom_api_url') || '';
}

export function setCustomApiUrl(url) {
  if (url && url.trim()) {
    localStorage.setItem('faceguard_custom_api_url', url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem('faceguard_custom_api_url');
  }
  window.dispatchEvent(new Event('faceguard-config-changed'));
}

export function getApiBaseUrl() {
  // 1. User-configured custom backend URL (saved in browser localStorage)
  const custom = getCustomApiUrl();
  if (custom) {
    return custom;
  }

  // 2. Build-time Vite environment variable (e.g. VITE_API_URL on Vercel)
  const viteApiUrl = import.meta.env.VITE_API_URL;
  if (viteApiUrl && viteApiUrl.trim()) {
    return viteApiUrl.trim().replace(/\/+$/, '');
  }

  // 3. Localhost development environment
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return `http://${hostname}:8001`;
  }

  // 4. Default production live backend on Render
  return DEFAULT_PRODUCTION_BACKEND;
}

export function getApiEndpoint(path) {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

function getAuthHeaders() {
  const token = localStorage.getItem('fm_access_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  getApiBaseUrl,
  setCustomApiUrl,
  getCustomApiUrl,

  // Health
  async getHealth(timeoutMs = 6000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = getApiEndpoint('/health');
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Health check failed (${res.status})`);
      return res.json();
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  },

  // Auth
  async login(username, password) {
    const res = await fetch(getApiEndpoint('/api/auth/login'), {
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
    const res = await fetch(getApiEndpoint('/api/auth/me'), {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  // Statistics & Analytics
  async getStatistics() {
    const res = await fetch(getApiEndpoint('/api/statistics'), {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch statistics');
    return res.json();
  },

  // Violations
  async getViolations(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(getApiEndpoint(`/api/violations?${query}`), {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch violations');
    return res.json();
  },

  // History
  async getHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(getApiEndpoint(`/api/history?${query}`), {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  // Model Info
  async getModelInfo() {
    const res = await fetch(getApiEndpoint('/api/model-info'), {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch model info');
    return res.json();
  },

  // Cameras
  async getCameras() {
    const res = await fetch(getApiEndpoint('/api/cameras'), {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch cameras');
    return res.json();
  },

  async createCamera(cameraData) {
    const res = await fetch(getApiEndpoint('/api/cameras'), {
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
    const res = await fetch(getApiEndpoint(`/api/cameras/${id}`), {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    if (!res.ok) throw new Error('Failed to update camera');
    return res.json();
  },

  async deleteCamera(id) {
    const res = await fetch(getApiEndpoint(`/api/cameras/${id}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete camera');
    return res.json();
  },

  // High-Performance Real-Time Frame Streaming Detection (JSON)
  async detectFrameJson(payload) {
    const res = await fetch(getApiEndpoint('/api/detect/frame'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Frame detection failed' }));
      throw new Error(err.detail || `Frame detection failed with status ${res.status}`);
    }
    return res.json();
  },

  // Multipart Detection API (Test Photos / Form Uploads)
  async detectFrame(formData) {
    const res = await fetch(getApiEndpoint('/api/detect'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Detection failed' }));
      throw new Error(err.detail || 'Detection failed');
    }
    return res.json();
  }
};
