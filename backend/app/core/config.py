import os
from pathlib import Path
from typing import List

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
TRAINED_MODELS_DIR = BASE_DIR / "trained_models"
DATASET_DIR = BASE_DIR / "dataset"

class Settings:
    PROJECT_NAME: str = "Real-Time Face Mask Compliance Detection System"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-for-face-mask-compliance-monitoring-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")

    # Database
    # Default to PostgreSQL, with graceful SQLite fallback for quick local testing if Postgres server is unavailable
    POSTGRES_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg://postgres:postgres@localhost:5432/face_mask_monitoring"
    )
    SQLITE_URL: str = f"sqlite:///{BASE_DIR}/face_mask_monitoring.db"
    
    # Model
    MODEL_PATH: str = os.getenv(
        "MODEL_PATH", 
        str(TRAINED_MODELS_DIR / "best_mask_detector.pt")
    )
    METRICS_PATH: str = str(TRAINED_MODELS_DIR / "evaluation_metrics.json")
    INPUT_SIZE: int = 224
    CONFIDENCE_THRESHOLD: float = 0.50

    # Compliance Categories matching trained PyTorch model class_to_idx mapping
    CLASSES: List[str] = ["Incorrect Mask", "Mask", "No Mask"]
    CLASS_COLORS: dict = {
        "Mask": "#10B981",          # Green
        "No Mask": "#EF4444",       # Red
        "Incorrect Mask": "#F59E0B" # Orange / Amber
    }

    # CORS
    CORS_ORIGINS: List[str] = [
        "https://face-mask-compliance-system.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ]

settings = Settings()
