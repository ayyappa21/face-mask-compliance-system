import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Camera,
  Upload,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Users,
  Play,
  Square,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Activity,
  Zap,
  X,
  SwitchCamera,
  Server,
  CheckCircle2,
  Settings as SettingsIcon
} from 'lucide-react';
import { api, getApiBaseUrl, setCustomApiUrl, getCustomApiUrl, LIVE_TUNNEL_BACKEND } from '../services/api';
import { DetectionWebSocket } from '../services/websocket';

export function LiveMonitoringPage() {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('CAM-01');
  const [isStreaming, setIsStreaming] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Multi-camera & device selection
  const [facingMode, setFacingMode] = useState('user'); // 'user' or 'environment'
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // Dual-mode connection state: 'ws' (WebSocket), 'http' (HTTP frame polling fallback), 'offline'
  const [streamMode, setStreamMode] = useState('ws');
  const [backendStatus, setBackendStatus] = useState('checking'); // 'connected' | 'fallback_http' | 'offline' | 'checking'
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(() => getCustomApiUrl() || getApiBaseUrl());
  const [testResult, setTestResult] = useState(null);
  const [testingUrl, setTestingUrl] = useState(false);

  // Live detection telemetry
  const [liveMetrics, setLiveMetrics] = useState({
    total_faces: 0,
    mask_count: 0,
    no_mask_count: 0,
    incorrect_mask_count: 0,
    compliance_percentage: 100.0,
    detections: []
  });
  const [annotatedPreview, setAnnotatedPreview] = useState(null);
  const [fps, setFps] = useState(0);
  const [processing, setProcessing] = useState(false);

  const wsClientRef = useRef(null);
  const streamIntervalRef = useRef(null);
  const isProcessingRef = useRef(false);
  const serverDimsRef = useRef({ width: 480, height: 360 });
  const frameCounterRef = useRef({ count: 0, lastTime: performance.now() });
  const currentDetectionsRef = useRef([]);
  const activeStreamRef = useRef(null);
  const consecutiveErrorsRef = useRef(0);

  // Enumerate video devices on mount
  useEffect(() => {
    async function getDevices() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoDevs);
        if (videoDevs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevs[0].deviceId);
        }
      } catch (err) {
        console.warn('Could not enumerate video devices:', err);
      }
    }
    getDevices();
  }, [selectedDeviceId]);

  // Load cameras from backend
  useEffect(() => {
    async function loadCameras() {
      try {
        const camList = await api.getCameras();
        setCameras(camList);
        if (camList.length > 0) {
          setSelectedCamera(camList[0].id);
        }
        setBackendStatus('connected');
      } catch (err) {
        console.warn('Error fetching cameras from backend:', err);
        // Default camera if backend unreachable
        setCameras([
          { id: 'CAM-01', camera_name: 'Main Entrance - Terminal 1' },
          { id: 'CAM-02', camera_name: 'Lobby Corridor North' }
        ]);
        setBackendStatus('offline');
      }
    }
    loadCameras();
  }, []);

  // Check backend health periodically
  const checkBackendHealth = useCallback(async () => {
    try {
      await api.getHealth(10000);
      setBackendStatus((prev) => (prev === 'fallback_http' ? 'fallback_http' : 'connected'));
    } catch {
      setBackendStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  // Pixel-perfect bounding box rendering with letterbox/pillarbox offset compensation
  const drawBoundingBoxes = useCallback((detections, serverDims) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    if (!detections || detections.length === 0) return;

    const sWidth = serverDims?.width || 480;
    const sHeight = serverDims?.height || 360;

    // Calculate actual rendered video dimensions inside the container (object-contain)
    const vw = video.videoWidth || sWidth;
    const vh = video.videoHeight || sHeight;
    const videoAspect = vw / vh;
    const containerAspect = width / height;

    let renderW, renderH, offsetX, offsetY;
    if (containerAspect > videoAspect) {
      // Letterboxed on sides (pillarbox)
      renderH = height;
      renderW = height * videoAspect;
      offsetX = (width - renderW) / 2;
      offsetY = 0;
    } else {
      // Letterboxed on top/bottom
      renderW = width;
      renderH = width / videoAspect;
      offsetX = 0;
      offsetY = (height - renderH) / 2;
    }

    const scaleX = renderW / sWidth;
    const scaleY = renderH / sHeight;

    detections.forEach((det) => {
      const bx = offsetX + det.box.x * scaleX;
      const by = offsetY + det.box.y * scaleY;
      const bw = det.box.width * scaleX;
      const bh = det.box.height * scaleY;

      const color = det.color || (det.label === 'Mask' ? '#22C55E' : det.label === 'No Mask' ? '#EF4444' : '#F59E0B');

      // Glowing bounding box
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;

      // Rounded rectangle
      ctx.strokeRect(bx, by, bw, bh);

      // High-tech corner tick accents
      const corner = Math.min(bw * 0.22, bh * 0.22, 16);
      ctx.lineWidth = 3.5;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + corner);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + corner, by);
      ctx.stroke();
      // Top-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - corner, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + corner);
      ctx.stroke();
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - corner);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + corner, by + bh);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - corner, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - corner);
      ctx.stroke();

      ctx.restore();

      // Top classification & confidence badge
      const confPercent = Math.round(det.confidence * 100);
      const labelText = `${det.label} ${confPercent}%`;
      ctx.font = 'bold 11px "Inter", system-ui, -apple-system, sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      const badgeH = 20;
      const badgeW = textWidth + 14;
      const badgeY = Math.max(0, by - badgeH);

      // Translucent badge background
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, badgeY, badgeW, badgeH, [4, 4, 0, 0]);
      ctx.fill();

      // White text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, bx + 7, badgeY + 14);
    });
  }, []);

  // Update telemetry and frame rate statistics
  const updateTelemetry = useCallback((data) => {
    isProcessingRef.current = false;
    consecutiveErrorsRef.current = 0;

    const dets = data.detections || [];
    currentDetectionsRef.current = dets;

    if (data.frame_dims) {
      serverDimsRef.current = data.frame_dims;
    }

    setLiveMetrics({
      total_faces: data.total_faces || dets.length,
      mask_count: data.mask_count || 0,
      no_mask_count: data.no_mask_count || 0,
      incorrect_mask_count: data.incorrect_mask_count || 0,
      compliance_percentage: data.compliance_percentage !== undefined ? data.compliance_percentage : 100.0,
      detections: dets
    });

    drawBoundingBoxes(dets, serverDimsRef.current);

    frameCounterRef.current.count += 1;
    const now = performance.now();
    if (now - frameCounterRef.current.lastTime >= 1000) {
      setFps(Math.round((frameCounterRef.current.count * 1000) / (now - frameCounterRef.current.lastTime)));
      frameCounterRef.current.count = 0;
      frameCounterRef.current.lastTime = now;
    }
  }, [drawBoundingBoxes]);

  // Frame streaming dispatcher (WebSocket or HTTP Fallback)
  const sendFrameOverHttp = useCallback(async (base64Image, saveToDb = false) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const res = await api.detectFrameJson({
        image: base64Image,
        camera_id: selectedCamera,
        save_to_db: saveToDb,
        return_annotated: false
      });
      updateTelemetry(res);
      setBackendStatus('fallback_http');
    } catch (err) {
      isProcessingRef.current = false;
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= 4) {
        setBackendStatus('offline');
      }
    }
  }, [selectedCamera, updateTelemetry]);

  // Start continuous frame extraction loop
  const startFrameStreaming = useCallback((activeMode) => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);

    let frameIndex = 0;
    const targetW = 480;
    const targetH = 360;
    serverDimsRef.current = { width: targetW, height: targetH };

    // WebSocket runs at ~15-20 FPS (66ms); HTTP streaming runs at ~10-12 FPS (90ms)
    const intervalMs = activeMode === 'ws' ? 66 : 90;

    streamIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !captureCanvasRef.current) return;
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) return;

      if (isProcessingRef.current) return;

      const canvas = captureCanvasRef.current;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, targetW, targetH);

      const b64 = canvas.toDataURL('image/jpeg', 0.52);
      frameIndex++;
      const saveToDb = frameIndex % 15 === 0;

      if (activeMode === 'ws' && wsClientRef.current && wsClientRef.current.isConnected) {
        isProcessingRef.current = true;
        wsClientRef.current.sendFrame(b64, saveToDb, false);

        // Safety timeout to reset lock
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 300);
      } else {
        // HTTP Frame Streaming Fallback
        sendFrameOverHttp(b64, saveToDb);
      }
    }, intervalMs);
  }, [sendFrameOverHttp]);

  // WebSocket Connection Management with Auto-Fallback to HTTP
  useEffect(() => {
    if (!isStreaming) return;

    let wsConnected = false;
    const fallbackTimer = setTimeout(() => {
      if (!wsConnected && isStreaming) {
        console.log('[LiveMonitoring] WebSocket connection timeout; auto-switching to HTTP streaming fallback.');
        setStreamMode('http');
        setBackendStatus('fallback_http');
        startFrameStreaming('http');
      }
    }, 2200);

    const ws = new DetectionWebSocket(
      selectedCamera,
      (data) => {
        if (data.type === 'detection_result') {
          updateTelemetry(data);
        }
      },
      (err) => {
        console.warn('[LiveMonitoring] WebSocket error, switching to HTTP streaming fallback:', err);
        setStreamMode('http');
        setBackendStatus('fallback_http');
        startFrameStreaming('http');
      },
      () => {
        wsConnected = true;
        clearTimeout(fallbackTimer);
        setStreamMode('ws');
        setBackendStatus('connected');
        console.log('[LiveMonitoring] WebSocket stream established.');
        startFrameStreaming('ws');
      },
      () => {
        if (isStreaming && streamMode === 'ws') {
          console.log('[LiveMonitoring] WebSocket disconnected; initiating HTTP streaming fallback.');
          setStreamMode('http');
          startFrameStreaming('http');
        }
      }
    );

    ws.connect();
    wsClientRef.current = ws;

    return () => {
      clearTimeout(fallbackTimer);
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
    };
  }, [isStreaming, selectedCamera, startFrameStreaming, streamMode, updateTelemetry]);

  // Start webcam with robust error handling and multi-device support
  const startWebcam = async () => {
    setCameraError(null);
    setAnnotatedPreview(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Camera API is not supported in this browser environment. Ensure you are accessing over HTTPS or localhost.'
      );
      return;
    }

    try {
      // 1. Primary video constraints with selected device or facing mode
      const videoConstraints = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
        : { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
      } catch (constraintErr) {
        // Fallback to simple unconstrained video if specific constraints failed
        console.warn('Initial camera constraints failed, attempting basic video:', constraintErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      activeStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        videoRef.current.autoplay = true;

        await videoRef.current.play();
      }

      setWebcamActive(true);
      setIsStreaming(true);
      consecutiveErrorsRef.current = 0;
    } catch (err) {
      console.error('Webcam access error:', err);
      let errorMsg = 'Could not access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission denied. Please click the lock or camera icon in your browser address bar to grant access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera device found on this system. You can test detection by uploading a test photo below.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is in use by another tab or application. Please close other camera apps and retry.';
      } else {
        errorMsg = `Camera error: ${err.message || 'Unable to start camera feed'}`;
      }
      setCameraError(errorMsg);
      setWebcamActive(false);
      setIsStreaming(false);
    }
  };

  const stopMonitoring = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
    }
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    setWebcamActive(false);
    setIsStreaming(false);
    setFps(0);
    isProcessingRef.current = false;
  };

  // Flip facing mode (user / environment)
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isStreaming) {
      stopMonitoring();
      setTimeout(() => {
        startWebcam();
      }, 300);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setCameraError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('camera_id', selectedCamera);
      formData.append('save_to_db', 'true');

      const res = await api.detectFrame(formData);
      setLiveMetrics({
        total_faces: res.total_faces,
        mask_count: res.mask_count,
        no_mask_count: res.no_mask_count,
        incorrect_mask_count: res.incorrect_mask_count,
        compliance_percentage: res.compliance_percentage,
        detections: res.detections || []
      });

      if (res.annotated_image) {
        setAnnotatedPreview(res.annotated_image);
      }
    } catch (err) {
      setCameraError(err.message || 'Image detection failed. Verify backend connectivity in settings.');
    } finally {
      setProcessing(false);
    }
  };

  // Save custom backend API URL
  const handleSaveCustomUrl = async (overrideUrl) => {
    const targetUrl = typeof overrideUrl === 'string' ? overrideUrl : customUrlInput;
    setTestingUrl(true);
    setTestResult(null);
    try {
      setCustomApiUrl(targetUrl);
      const res = await api.getHealth(12000);
      setTestResult({
        ok: true,
        message: `Connected: ${res.project || res.app_name || 'FaceGuard AI'} (Model: ${res.model?.architecture || 'Loaded'})`
      });
      setBackendStatus('connected');
      setTimeout(() => {
        setShowConfigModal(false);
        setTestResult(null);
      }, 1200);
    } catch (err) {
      setTestResult({
        ok: false,
        message: `Connection failed: ${err.message}. Ensure backend is awake or select a preset below.`
      });
      setBackendStatus('offline');
    } finally {
      setTestingUrl(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Viewport Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Live Monitoring Viewport
            </h2>
            {isStreaming && (
              <span className="flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-[var(--success)] live-pulse"></span>
                <span>REAL-TIME • {fps} FPS</span>
              </span>
            )}
            {/* Backend Connection Pill */}
            <span
              onClick={() => setShowConfigModal(true)}
              className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer border transition-all ${
                backendStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                  : backendStatus === 'fallback_http'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20'
              }`}
              title="Click to configure backend API URL"
            >
              <Server className="w-3 h-3" />
              <span>
                {backendStatus === 'connected'
                  ? 'WS Connected'
                  : backendStatus === 'fallback_http'
                  ? 'HTTP Fallback'
                  : 'Backend Offline'}
              </span>
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Real-time multi-person CNN compliance detection with adaptive dual-channel inference.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Camera Selector Pill */}
          <div className="flex items-center space-x-2 glass-pill px-3 py-1.5 text-xs text-[var(--text-secondary)]">
            <Camera className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="bg-transparent text-[var(--text-primary)] font-semibold outline-none cursor-pointer text-xs"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id} className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
                  {c.id}: {c.camera_name}
                </option>
              ))}
            </select>
          </div>

          {/* Front / Rear Camera Toggle (for mobile and webcams) */}
          <button
            onClick={toggleFacingMode}
            className="p-2 rounded-xl glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-sm"
            title={`Switch to ${facingMode === 'user' ? 'Rear' : 'Front'} Camera`}
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {!isStreaming ? (
            <button
              onClick={startWebcam}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[var(--success)] hover:opacity-90 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Live Camera</span>
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-500/25 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Monitoring</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl glass-pill text-[var(--text-primary)] text-xs font-semibold hover:border-[var(--accent)]/40 transition-all shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>{processing ? 'Analyzing...' : 'Test Photo'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 rounded-xl glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-sm"
            title="Configure Backend API Server URL"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-sm"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Backend Offline Guidance Banner */}
      {backendStatus === 'offline' && (
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              Backend API server is not reachable from this domain. Configure your deployed backend URL (Render, Railway, or local tunnel) to enable neural inference.
            </span>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="font-bold underline ml-3 shrink-0 hover:text-amber-300"
          >
            Configure Backend URL
          </button>
        </div>
      )}

      {cameraError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{cameraError}</span>
          </div>
          <button onClick={() => setCameraError(null)} className="underline hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Viewport & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Large Video Monitoring Container */}
        <div
          ref={containerRef}
          className="lg:col-span-3 glass-panel p-4 rounded-3xl flex flex-col justify-between relative overflow-hidden bg-black/80 min-h-[480px] shadow-2xl"
        >
          {/* Top Video HUD status overlay */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 text-xs mb-3 z-20 text-white">
            <div className="flex items-center space-x-3">
              <span className="font-mono text-cyan-400 font-bold">{selectedCamera}</span>
              <span className="text-white/30">|</span>
              <span className="text-white/80 font-mono text-[11px]">Res: 640x480</span>
              <span className="text-white/30">|</span>
              <span className="text-white/80 text-[11px]">
                Mode: {streamMode === 'ws' ? 'WebSocket (Real-Time)' : 'HTTP Stream Fallback'}
              </span>
            </div>

            <div className="flex items-center space-x-2.5">
              <span className="text-white/60 text-[11px]">Compliance:</span>
              <span
                className={`font-black font-mono text-xs px-2.5 py-0.5 rounded-full ${
                  liveMetrics.compliance_percentage >= 85
                    ? 'bg-emerald-500/20 text-[#22C55E] border border-emerald-500/40'
                    : 'bg-amber-500/20 text-[#F59E0B] border border-amber-500/40'
                }`}
              >
                {liveMetrics.compliance_percentage}%
              </span>
            </div>
          </div>

          {/* Video Preview Surface */}
          <div className="relative flex-1 rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center border border-white/10 min-h-[380px]">
            {/* Native HTML5 Video Element - ALWAYS VISIBLE when webcam is active */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-contain ${annotatedPreview ? 'hidden' : 'block'}`}
            />

            {/* Hardware-Accelerated Bounding Box Canvas Overlay */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 pointer-events-none w-full h-full z-10 ${annotatedPreview ? 'hidden' : 'block'}`}
            />

            {/* Hidden capture canvas for low-overhead downscaled frame extraction */}
            <canvas ref={captureCanvasRef} className="hidden" />

            {/* Annotated Static Image Preview for Uploaded Test Photos */}
            {annotatedPreview ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={annotatedPreview}
                  alt="AI Annotated Preview"
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() => setAnnotatedPreview(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-all z-20"
                  title="Close Photo Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : !webcamActive ? (
              <div className="text-center p-8 text-slate-400 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto shadow-inner">
                  <VideoOff className="w-8 h-8 text-slate-400" />
                </div>
                <div className="text-sm font-bold text-white">Live Camera Offline</div>
                <p className="text-xs max-w-sm mx-auto text-slate-400 leading-relaxed">
                  Click <strong className="text-[var(--accent)]">"Start Live Camera"</strong> to activate browser webcam, or click <strong className="text-white">"Test Photo"</strong> to evaluate sample images.
                </p>
                <div className="pt-2">
                  <button
                    onClick={startWebcam}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-bold transition-all shadow-lg"
                  >
                    Activate Camera Feed
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Color Legend Footer */}
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-xs px-2 text-white">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]"></span>
                <span className="font-semibold text-white/90 text-[11px]">Mask (Safe)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
                <span className="font-semibold text-white/90 text-[11px]">No Mask (Violation)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                <span className="font-semibold text-white/90 text-[11px]">Incorrect Mask (Improper)</span>
              </div>
            </div>

            <div className="text-[11px] text-cyan-400 font-mono font-medium">
              Model: MobileNetV2 CNN • YuNet Multi-Face
            </div>
          </div>
        </div>

        {/* Compact Glass Statistic Panels Beside Video */}
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Live Frame Telemetry
            </span>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[var(--text-secondary)] text-xs">
                  <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span className="font-medium">Total People</span>
                </div>
                <span className="text-lg font-black font-mono text-[var(--text-primary)]">
                  {liveMetrics.total_faces}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-500 dark:text-emerald-400 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Compliant Mask</span>
                </div>
                <span className="text-base font-black font-mono text-[#22C55E]">
                  {liveMetrics.mask_count}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-rose-500 dark:text-rose-400 text-xs font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>No Mask</span>
                </div>
                <span className="text-base font-black font-mono text-[#EF4444]">
                  {liveMetrics.no_mask_count}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-500 dark:text-amber-400 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Incorrect Mask</span>
                </div>
                <span className="text-base font-black font-mono text-[#F59E0B]">
                  {liveMetrics.incorrect_mask_count}
                </span>
              </div>
            </div>
          </div>

          {/* Detected Subjects Card */}
          <div className="glass-card p-4 space-y-2.5">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Detected People ({liveMetrics.detections.length})
            </span>

            {liveMetrics.detections.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-3 text-center">
                No active subjects in current frame.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {liveMetrics.detections.map((det, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[var(--text-primary)] text-[11px]">Person #{idx + 1}</div>
                      <div className="text-[9px] text-[var(--text-muted)] font-mono">
                        [{det.box.x}, {det.box.y}, {det.box.width}x{det.box.height}]
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{
                          backgroundColor: `${det.color}20`,
                          color: det.color,
                          border: `1px solid ${det.color}40`
                        }}
                      >
                        {det.label}
                      </span>
                      <div className="text-[9px] text-[var(--text-muted)] mt-0.5 font-mono">
                        {Math.round(det.confidence * 100)}% Conf
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backend API Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl max-w-lg w-full space-y-4 border border-white/20 shadow-2xl bg-[var(--bg-primary)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[var(--text-primary)] font-bold text-sm">
                <Server className="w-4 h-4 text-[var(--accent)]" />
                <span>Backend API Connection Settings</span>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              When deployed on Vercel, the backend inference server can run on Render, Railway, or a Cloudflare tunnel. Enter the backend API URL below:
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
                Backend Server URL
              </label>
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://your-backend.onrender.com or http://localhost:8001"
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--glass-bg-subtle)] border border-[var(--glass-border-subtle)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[10px] text-[var(--text-muted)] block">
                Leave blank or set to http://localhost:8001 for local development.
              </span>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                  testResult.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-[var(--success)]'
                    : 'bg-rose-500/10 border-rose-500/30 text-[var(--danger)]'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--success)]" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-[var(--danger)]" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => {
                    setCustomUrlInput('https://faceguard-backend-22en.onrender.com');
                    handleSaveCustomUrl('https://faceguard-backend-22en.onrender.com');
                  }}
                  className="px-2.5 py-1 rounded-lg glass-pill text-[11px] text-[var(--accent)] font-semibold hover:bg-[var(--accent)]/10"
                >
                  Render Cloud
                </button>
                <button
                  onClick={() => {
                    setCustomUrlInput(LIVE_TUNNEL_BACKEND);
                    handleSaveCustomUrl(LIVE_TUNNEL_BACKEND);
                  }}
                  className="px-2.5 py-1 rounded-lg glass-pill text-[11px] text-cyan-400 font-semibold hover:bg-cyan-500/10"
                >
                  Active Tunnel
                </button>
                <button
                  onClick={() => {
                    setCustomUrlInput('http://localhost:8001');
                    handleSaveCustomUrl('http://localhost:8001');
                  }}
                  className="px-2.5 py-1 rounded-lg glass-pill text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Localhost
                </button>
              </div>

              <button
                onClick={() => handleSaveCustomUrl()}
                disabled={testingUrl}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:opacity-95 shadow-md shadow-[var(--accent)]/30"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingUrl ? 'animate-spin' : ''}`} />
                <span>{testingUrl ? 'Connecting...' : 'Test & Connect'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
