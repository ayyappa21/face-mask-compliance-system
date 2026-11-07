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
  }

  connect() {
    this.isManualClose = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173'
      ? `${window.location.hostname}:8001`
      : window.location.host;

    const wsUrl = `${protocol}//${host}/ws/detection?camera_id=${encodeURIComponent(this.cameraId)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`[WebSocket] Connected for camera ${this.cameraId}`);
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
        console.error('[WebSocket] Error', err);
        if (this.onError) this.onError(err);
      };

      this.ws.onclose = () => {
        console.log(`[WebSocket] Disconnected for camera ${this.cameraId}`);
        if (this.onClose) this.onClose();
        if (!this.isManualClose) {
          // Attempt reconnection after 3 seconds
          this.reconnectTimeout = setTimeout(() => {
            console.log('[WebSocket] Attempting auto-reconnection...');
            this.connect();
          }, 3000);
        }
      };
    } catch (e) {
      console.error('[WebSocket] Initialization error', e);
      if (this.onError) this.onError(e);
    }
  }

  sendFrame(base64Image, saveToDb = false) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'frame',
        image: base64Image,
        save: saveToDb,
        return_annotated: true
      }));
    }
  }

  disconnect() {
    this.isManualClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
