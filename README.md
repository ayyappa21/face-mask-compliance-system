# Real-Time Face Mask Compliance Detection & Monitoring System

A production-grade, end-to-end computer vision and deep learning monitoring system that detects and classifies face mask compliance in real time from live webcam feeds, CCTV RTSP streams, and uploaded images.

Built with **PyTorch**, **MobileNetV2 Transfer Learning**, **OpenCV**, **FastAPI**, **PostgreSQL**, and **React (Vite + Tailwind CSS + Recharts)**.

---

## 1. System Overview & Key Capabilities

- **3-Class Real-Time Compliance Classification**:
  - 🟢 **Mask**: Person wearing a face mask correctly over nose and mouth.
  - 🔴 **No Mask**: Person not wearing a face mask (critical violation).
  - 🟠 **Incorrect Mask**: Mask worn below the nose, under the chin, or dangling (improper placement).
- **Computer Vision Pipeline**:
  - High-speed face localization via OpenCV cascade / bounding-box processing.
  - Sub-10ms CNN forward pass inference with **MobileNetV2**.
  - Dynamic HUD overlay rendering real-time bounding boxes, confidence badges, and compliance percentages.
- **Full-Stack Enterprise Architecture**:
  - **FastAPI Backend**: Async REST APIs and bi-directional WebSockets (`/ws/detection`) for low-latency streaming.
  - **PostgreSQL / SQLAlchemy**: Secure persistence for aggregate detection metrics, non-compliance incidents, and camera configurations. Graceful SQLite fallback for local zero-config runs.
  - **React Admin Dashboard**: Live monitoring viewport, telemetry HUD, temporal trend graphs (Recharts), violation audit logs, and camera feed management.
- **Privacy-Conscious Design**:
  - Compliant with privacy standards: raw face photographs are never saved to database disks by default; only compliance statistics, timestamps, confidence scores, and camera IDs are recorded.

---

## 2. Deep Learning Model & Evaluation Metrics

### Model Architecture Selection
- **Architecture**: **MobileNetV2** with custom dense classification head:
  `InvertedResidual Backbone` ➔ `Dropout(0.3)` ➔ `Linear(1280, 128)` ➔ `ReLU` ➔ `Dropout(0.2)` ➔ `Linear(128, 3)` ➔ `Softmax`
- **Why MobileNetV2?**: Employs **depthwise separable convolutions** and linear bottlenecks, reducing parameter size to **~2.39M parameters** and computational complexity to **~300M FLOPs** (compared to ResNet50's 25M params and 4B FLOPs). This guarantees smooth **30+ FPS** real-time multi-person inference on standard CPUs and Apple Silicon Metal (MPS).

### Genuine Evaluation Performance on Unseen Test Split (176 images)
- **Overall Test Accuracy**: **97.73%**
- **Weighted Precision**: **97.73%**
- **Weighted Recall**: **97.73%**
- **Weighted F1-Score**: **97.72%**
- **Average Inference Latency**: **~9.4 ms per face**

#### Detailed Classification Report:
| Class | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: |
| **Incorrect Mask** | 0.9836 | 1.0000 | 0.9917 | 60 |
| **Mask** | 0.9643 | 0.9643 | 0.9643 | 56 |
| **No Mask** | 0.9831 | 0.9667 | 0.9748 | 60 |
| **Weighted Average** | **0.9773** | **0.9773** | **0.9772** | **176** |

#### Test Set Confusion Matrix:
```
Actual \ Predicted     Incorrect Mask      Mask      No Mask
Incorrect Mask               60              0          0
Mask                          1             54          1
No Mask                       0              2         58
```

Evaluation graphs are stored in `backend/trained_models/`:
- `class_distribution.png`: Dataset breakdown across Train (1,500), Validation (180), and Test (176) splits.
- `training_history.png`: Loss and Accuracy curves across training epochs.
- `confusion_matrix.png`: Heatmap on unseen test data.
- `evaluation_metrics.json`: Exported numerical verification scores.

---

## 3. Project Directory Structure

```
face_mask_compliance_system/
├── backend/
│   ├── app/
│   │   ├── api/                  # REST & WebSocket route handlers
│   │   │   ├── auth.py           # Admin JWT authentication
│   │   │   ├── cameras.py        # Camera feed CRUD management
│   │   │   ├── detection.py      # Image detection endpoint
│   │   │   ├── health.py         # System healthcheck
│   │   │   ├── history.py        # Historical detection queries
│   │   │   ├── model_info.py     # Architecture & evaluation info
│   │   │   ├── statistics.py     # Aggregated compliance telemetry
│   │   │   └── websocket_detection.py # Low-latency real-time video stream
│   │   ├── core/                 # Config & security settings
│   │   ├── database/             # SQLAlchemy engine & DB initializers
│   │   ├── models/               # DB ORM schemas (DetectionRecord, ViolationRecord, etc.)
│   │   ├── schemas/              # Pydantic v2 validation models
│   │   └── services/             # Computer vision & PyTorch services
│   │       ├── cnn_classifier.py # MobileNetV2 inference engine
│   │       └── face_detector.py  # OpenCV face localization & HUD renderer
│   ├── dataset/                  # Dataset archives & processed splits
│   ├── tests/                    # Automated pytest suite (18 test cases)
│   ├── trained_models/           # Saved PyTorch checkpoint & metric charts
│   ├── training/                 # Data prep, class balancing & training scripts
│   ├── cctv_camera_streamer.py   # Standalone OpenCV desktop/CCTV camera agent
│   ├── Dockerfile
│   ├── main.py                   # FastAPI server entrypoint
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/           # Navbar, Sidebar, StatCard
│   │   ├── hooks/                # useAuth context provider
│   │   ├── pages/                # Login, Dashboard, LiveMonitoring, Analytics, Violations, Cameras, ModelInfo
│   │   ├── services/             # Fetch REST API & WebSocket client
│   │   ├── App.jsx
│   │   ├── index.css             # Glassmorphism & custom utility styling
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf                # Nginx production reverse proxy
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 4. Quickstart Guide (Local Development)

### Prerequisites
- Python 3.10+ (Tested on Python 3.11, 3.12, 3.13)
- Node.js 18+ and npm

### 1. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server (Runs on http://localhost:8000)
python3 main.py
```
> Interactive Swagger API Documentation is available at **http://localhost:8000/docs**.

### 2. Frontend Setup
```bash
cd frontend

# Install npm packages
npm install

# Start Vite dev server (Runs on http://localhost:5173)
npm run dev
```

### 3. Log in to Dashboard
- Open **http://localhost:5173**
- Default Admin Credentials:
  - **Username**: `admin`
  - **Password**: `admin123`
  - *(Or click "Fill Demo Credentials" on the login screen)*

---

## 5. Live Monitoring Modes

### Mode A: Browser Webcam (Zero Installation)
1. Open the **Live Monitoring** page in the dashboard.
2. Click **"Start Live Webcam"**.
3. Allow browser camera permissions. The frontend streams downscaled frames to the backend WebSocket at 7 FPS, receiving real-time bounding boxes and compliance overlays.

### Mode B: Standalone Desktop / CCTV Streamer (`cctv_camera_streamer.py`)
Run the native OpenCV monitoring agent directly from your terminal:
```bash
cd backend

# Stream local webcam (camera index 0)
python3 cctv_camera_streamer.py --source 0 --camera-id CAM-01

# Stream IP / CCTV camera RTSP feed and sync incidents to backend API:
python3 cctv_camera_streamer.py --source rtsp://192.168.1.100:554/live --camera-id CAM-03 --sync-api
```
Press `q` inside the video display window to exit.

---

## 6. Running Automated Tests

The project includes unit and integration tests covering CNN inference, color classification, angle rotations, low-light robustness, multi-face frames, REST APIs, camera CRUD, and WebSocket streaming:

```bash
cd backend
python3 -m pytest tests/ -v
```
All **18 automated test cases** execute and pass in under 2 seconds.

---

## 7. Docker Deployment

Launch the entire stack (PostgreSQL 16, FastAPI Backend, and Nginx React Frontend) with one command:

```bash
docker-compose up --build
```
- Frontend Dashboard: **http://localhost:3000**
- Backend API & Swagger: **http://localhost:8000/docs**
- PostgreSQL: **localhost:5432**

---

## 8. Cloud Deployment Guide (Render + Vercel)

### Crucial Architectural Consideration: Laptop Webcam vs Cloud Backend
> ⚠️ **Important Cloud Limitation**: A cloud server (such as Render, AWS, or GCP) runs in a remote container and **cannot physically access your local laptop's webcam hardware** (like `/dev/video0`).
>
> **How this architecture solves it**:
> 1. **Browser Client Mode**: The React frontend running in the user's browser accesses the laptop webcam via HTML5 `navigator.mediaDevices.getUserMedia()`, captures frames on a hidden HTML5 canvas, and transmits them over WebSockets or HTTP POST to the cloud backend.
> 2. **Edge CCTV Agent Mode**: For fixed CCTV installations, run `cctv_camera_streamer.py` on an on-premise device (e.g., Raspberry Pi, mini PC, or local server) with `--sync-api --api-url https://your-backend.onrender.com/api/detect`.

### A. Deploy Backend on Render
1. Connect your GitHub repository to [Render](https://render.com).
2. Create a **PostgreSQL Database** on Render:
   - Name: `face_mask_monitoring`
   - Copy the **Internal Database URL**.
3. Create a **Web Service** on Render:
   - Root Directory: `backend`
   - Environment: `Python`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Set Environment Variables in Render:
   - `DATABASE_URL`: Your Render PostgreSQL connection string
   - `SECRET_KEY`: A secure random 64-character secret
   - `ADMIN_USERNAME`: `admin`
   - `ADMIN_PASSWORD`: Your chosen admin password
   - `CORS_ORIGINS`: `["https://your-frontend.vercel.app"]`

### B. Deploy Frontend on Vercel
1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Set Root Directory to `frontend`.
3. Set Framework Preset to `Vite`.
4. Add Environment Variables:
   - `VITE_API_URL`: `https://your-backend.onrender.com`
5. Click **Deploy**.

---

## 9. API Reference

### Health & Information
- `GET /health`: Backend uptime, database status, and model warmup check.
- `GET /api/model-info`: Architecture details, class mappings, parameter counts, and test evaluation metrics.

### Detection
- `POST /api/detect`: Multipart image or base64 frame upload. Returns bounding boxes, labels (`Mask`, `No Mask`, `Incorrect Mask`), confidence scores, and compliance percentages. Automatically records non-compliance violations to database.
- `WebSocket /ws/detection?camera_id=CAM-01`: Bi-directional stream for continuous real-time video frames.

### Analytics & Auditing
- `GET /api/statistics`: Aggregate compliance counts, rates, category breakdown, and chronological trends.
- `GET /api/violations`: Filtered and paginated non-compliance violation incidents.
- `GET /api/history`: Chronological batch detection records.

### Cameras & Authentication
- `GET /api/cameras`: List all configured camera nodes.
- `POST /api/cameras`: Register a new camera or RTSP stream.
- `PUT /api/cameras/{id}`: Update camera status (online/disabled/offline).
- `DELETE /api/cameras/{id}`: Remove camera node.
- `POST /api/auth/login`: Admin credentials authentication, returns JWT bearer token.
