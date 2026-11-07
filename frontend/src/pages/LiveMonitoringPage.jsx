import React, { useRef, useState, useEffect } from 'react';
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
  Zap
} from 'lucide-react';
import { api } from '../services/api';
import { DetectionWebSocket } from '../services/websocket';

export function LiveMonitoringPage() {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('CAM-01');
  const [isStreaming, setIsStreaming] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
  const frameCounterRef = useRef({ count: 0, lastTime: performance.now() });

  useEffect(() => {
    async function loadCameras() {
      try {
        const camList = await api.getCameras();
        setCameras(camList);
        if (camList.length > 0) {
          setSelectedCamera(camList[0].id);
        }
      } catch (err) {
        console.error('Error fetching cameras', err);
      }
    }
    loadCameras();
  }, []);

  useEffect(() => {
    if (!isStreaming) return;

    const ws = new DetectionWebSocket(
      selectedCamera,
      (data) => {
        if (data.type === 'detection_result') {
          setLiveMetrics({
            total_faces: data.total_faces,
            mask_count: data.mask_count,
            no_mask_count: data.no_mask_count,
            incorrect_mask_count: data.incorrect_mask_count,
            compliance_percentage: data.compliance_percentage,
            detections: data.detections || []
          });

          if (data.annotated_image) {
            setAnnotatedPreview(data.annotated_image);
          }

          frameCounterRef.current.count += 1;
          const now = performance.now();
          if (now - frameCounterRef.current.lastTime >= 1000) {
            setFps(Math.round((frameCounterRef.current.count * 1000) / (now - frameCounterRef.current.lastTime)));
            frameCounterRef.current.count = 0;
            frameCounterRef.current.lastTime = now;
          }
        }
      },
      (err) => console.error('WS Error:', err),
      () => console.log('WebSocket stream active'),
      () => console.log('WebSocket stream closed')
    );

    ws.connect();
    wsClientRef.current = ws;

    return () => {
      ws.disconnect();
      wsClientRef.current = null;
    };
  }, [isStreaming, selectedCamera]);

  const startWebcam = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setWebcamActive(true);
      setIsStreaming(true);
      startFrameStreaming();
    } catch (err) {
      console.error('Webcam access error', err);
      setCameraError('Unable to access video device. Please verify camera permissions or upload an image file.');
      setWebcamActive(false);
      setIsStreaming(false);
    }
  };

  const stopMonitoring = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
    }
    setWebcamActive(false);
    setIsStreaming(false);
    setFps(0);
  };

  const startFrameStreaming = () => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);

    let frameCount = 0;
    streamIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || !wsClientRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 640, 480);

      const b64 = canvas.toDataURL('image/jpeg', 0.65);
      frameCount++;
      const saveToDb = frameCount % 10 === 0;
      wsClientRef.current.sendFrame(b64, saveToDb);
    }, 140);
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
      setCameraError(err.message || 'Image detection failed.');
    } finally {
      setProcessing(false);
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
                <span>STREAMING • {fps} FPS</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Real-time multi-person CNN compliance inference, spatial bounding boxes, and compliance HUD.
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

          {!isStreaming ? (
            <button
              onClick={startWebcam}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[var(--success)] hover:opacity-90 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Webcam Feed</span>
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
            onClick={toggleFullscreen}
            className="p-2 rounded-xl glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-sm"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

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
          <div className="flex items-center justify-between px-3.5 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 text-xs mb-3 z-10 text-white">
            <div className="flex items-center space-x-3">
              <span className="font-mono text-cyan-400 font-bold">{selectedCamera}</span>
              <span className="text-white/30">|</span>
              <span className="text-white/80 font-mono text-[11px]">Res: 640x480</span>
              <span className="text-white/30">|</span>
              <span className="text-white/80 text-[11px]">CNN: MobileNetV2</span>
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
          <div className="relative flex-1 rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center border border-white/10">
            <video
              ref={videoRef}
              playsInline
              muted
              className={annotatedPreview ? 'hidden' : 'w-full h-full object-contain'}
            />
            <canvas ref={canvasRef} className="hidden" />

            {annotatedPreview ? (
              <img
                src={annotatedPreview}
                alt="Live AI Annotated Stream"
                className="w-full h-full object-contain"
              />
            ) : !webcamActive ? (
              <div className="text-center p-8 text-slate-400 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto shadow-inner">
                  <VideoOff className="w-8 h-8 text-slate-400" />
                </div>
                <div className="text-sm font-bold text-white">No Active Camera Feed</div>
                <p className="text-xs max-w-sm mx-auto text-slate-400 leading-relaxed">
                  Click <strong className="text-[var(--accent)]">"Start Webcam Feed"</strong> to stream live camera frames, or click <strong className="text-white">"Test Photo"</strong> to evaluate sample images.
                </p>
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
              Forward Pass: ~9.4ms / face
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
                  <span className="font-medium">Total Faces</span>
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
              Detected Subjects ({liveMetrics.detections.length})
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
                      <div className="font-bold text-[var(--text-primary)] text-[11px]">Subject #{idx + 1}</div>
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
    </div>
  );
}
