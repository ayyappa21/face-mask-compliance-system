import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.session import get_db
from app.services.cnn_classifier import MaskClassifierService
from app.core.config import settings

router = APIRouter(tags=["Health"])

START_TIME = time.time()

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    # Test DB status
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    classifier = MaskClassifierService.get_instance()
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
        }
    }
