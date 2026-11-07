from fastapi import APIRouter
from .health import router as health_router
from .detection import router as detection_router
from .statistics import router as statistics_router
from .violations import router as violations_router
from .history import router as history_router
from .model_info import router as model_info_router
from .cameras import router as cameras_router
from .auth import router as auth_router
from .websocket_detection import router as websocket_router

api_router = APIRouter()

# Core REST APIs
api_router.include_router(detection_router)
api_router.include_router(statistics_router)
api_router.include_router(violations_router)
api_router.include_router(history_router)
api_router.include_router(model_info_router)
api_router.include_router(cameras_router)
api_router.include_router(auth_router)

__all__ = ["api_router", "health_router", "websocket_router"]
