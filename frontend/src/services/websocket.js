import { getApiBaseUrl } from './api';

export function getWsBaseUrl() {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    if (apiBase.startsWith('https://')) {
      return apiBase.replace('https://', 'wss://');
    }
    if (apiBase.startsWith('http://')) {
      return apiBase.replace('http://', 'ws://');
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.port === '5173'
    ? `${window.location.hostname}:8001`
    : window.location.host;
  return `${protocol}//${host}`;
}

export class DetectionWebSocket {
  constructor(cameraId = 'webcam', onMessage, onError, onOpen, onClose) {
    this.cameraId = cameraId;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.ws = null;
    this.reconnectTimeout = null;
    this.isManualClose = false;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 2; // Don't infinite-loop if hosting platform doesn't support WS
  }

  connect() {
    this.isManualClose = false;
    const wsBase = getWsBaseUrl();
    const wsUrl = `${wsBase}/ws/detection?camera_id=${encodeURIComponent(this.cameraId)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(`[WebSocket] Connected successfully to ${wsUrl}`);
        if (this.onOpen) this.onOpen();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) this.onMessage(data);
        } catch (err) {
          console.error('[WebSocket] Failed to parse message', err);
        }
      };

      this.ws.onerror = (err) => {
        this.isConnected = false;
        console.warn(`[WebSocket] Connection error at ${wsUrl}:`, err);
        if (this.onError) this.onError(err);
      };

      this.ws.onclose = (event) => {
        const wasOpen = this.isConnected;
        this.isConnected = false;
        console.log(`[WebSocket] Disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);
        if (this.onClose) this.onClose(event);

        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.reconnectTimeout = setTimeout(() => {
            console.log(`[WebSocket] Auto-reconnecting attempt ${this.reconnectAttempts}...`);
            this.connect();
          }, 2500);
        }
      };
    } catch (e) {
      console.warn('[WebSocket] Initialization error:', e);
      this.isConnected = false;
      if (this.onError) this.onError(e);
    }
  }

  sendFrame(base64Image, saveToDb = false, returnAnnotated = false) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'frame',
        image: base64Image,
        save: saveToDb,
        return_annotated: returnAnnotated
      }));
      return true;
    }
    return false;
  }

  disconnect() {
    this.isManualClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // Ignore close errors
      }
      this.ws = null;
    }
    this.isConnected = false;
  }
}
