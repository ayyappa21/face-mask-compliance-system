import time
from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.session import get_db
from app.services.cnn_classifier import MaskClassifierService
from app.services.face_detector import FaceDetectorService
from app.core.config import settings

router = APIRouter(tags=["Health"])

START_TIME = time.time()

@router.get("/", summary="Root Backend Status Endpoint")
def root_status():
    """
    Returns 200 OK with general backend status, version, and available service routes.
    Prevents 404 on root path inspection.
    """
    uptime_seconds = int(time.time() - START_TIME)
    return {
        "status": "online",
        "app_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "uptime_seconds": uptime_seconds,
        "environment": "production",
        "endpoints": {
            "root": "/",
            "health": "/health",
            "ready": "/health/ready",
            "docs": "/docs",
            "detect_frame": "/api/detect/frame",
            "detect_multipart": "/api/detect",
            "statistics": "/api/statistics",
            "violations": "/api/violations",
            "history": "/api/history",
            "cameras": "/api/cameras",
            "model_info": "/api/model-info",
            "websocket": "/ws/detection"
        }
    }


@router.get("/health", summary="Liveness Probe")
def health_check(db: Session = Depends(get_db)):
    """
    Returns HTTP 200 OK with runtime diagnostics, database status, and model states.
    Configured for cloud container health checks.
    """
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    classifier = MaskClassifierService.get_instance()
    detector = FaceDetectorService.get_instance()
    uptime_seconds = int(time.time() - START_TIME)

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "version": settings.VERSION,
        "project": settings.PROJECT_NAME,
        "uptime_seconds": uptime_seconds,
        "database": db_status,
        "model": {
            "loaded": classifier.is_loaded,
            "device": classifier.device,
            "classes": classifier.classes,
            "architecture": "MobileNetV2 Transfer Learning"
        },
        "detector": detector.status_info
    }


@router.get("/health/ready", summary="Readiness Probe")
def readiness_check(response: Response, db: Session = Depends(get_db)):
    """
    Verifies that the database and all neural vision models are initialized and ready to serve inference.
    Returns HTTP 200 if ready, or HTTP 503 if models/database are uninitialized.
    """
    db_connected = False
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False

    classifier = MaskClassifierService.get_instance()
    detector = FaceDetectorService.get_instance()

    is_ready = db_connected and classifier.is_loaded and detector.is_ready

    payload = {
        "ready": is_ready,
        "status": "ready" if is_ready else "not_ready",
        "database": "connected" if db_connected else "disconnected",
        "classifier": {
            "loaded": classifier.is_loaded,
            "device": classifier.device,
            "classes": classifier.classes
        },
        "detector": detector.status_info
    }

    if not is_ready:
        return JSONResponse(status_code=503, content=payload)

    return payload
