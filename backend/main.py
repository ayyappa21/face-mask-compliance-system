import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import os

from app.core.config import settings
from app.database.init_db import init_database
from app.services.cnn_classifier import MaskClassifierService
from app.services.face_detector import FaceDetectorService
from app.api import api_router, health_router, websocket_router

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("face_mask_compliance")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database and Model
    logger.info("Starting Face Mask Compliance Monitoring Backend...")
    try:
        init_database()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    # Preload Deep Learning Models once into memory
    try:
        logger.info("Pre-loading CNN classifier and face detector...")
        MaskClassifierService.get_instance()
        FaceDetectorService.get_instance()
        logger.info("Computer Vision models warmed up successfully.")
    except Exception as e:
        logger.error(f"Error warming up models: {e}")

    yield

    # Shutdown
    logger.info("Face Mask Compliance Backend shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Real-Time Face Mask Compliance Detection System using Deep Learning CNN (MobileNetV2), OpenCV, FastAPI, and PostgreSQL.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for React Frontend (Vite / Dev / Production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception at {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "error": str(exc)}
    )

# Register Routers
app.include_router(health_router)          # GET /health
app.include_router(api_router, prefix="/api")  # /api/detect, /api/statistics, /api/violations, etc.
app.include_router(websocket_router)       # /ws/detection

@app.get("/download/face_mask_compliance_system.zip", tags=["Export"])
async def download_project_zip():
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "face_mask_compliance_system.zip")),
        "/Users/potnuruayyappa/.gemini/antigravity/scratch/face_mask_compliance_system.zip",
        "/Users/potnuruayyappa/Downloads/face_mask_compliance_system.zip"
    ]
    for path in candidates:
        if os.path.exists(path):
            return FileResponse(
                path=path,
                media_type="application/zip",
                filename="face_mask_compliance_system.zip"
            )
    return JSONResponse(status_code=404, content={"detail": "ZIP archive not found"})


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )
