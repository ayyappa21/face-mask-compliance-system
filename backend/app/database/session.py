import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

def _create_initial_engine():
    # First attempt: Target PostgreSQL database
    try:
        pg_engine = create_engine(
            settings.POSTGRES_URL,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 2}
        )
        with pg_engine.connect() as conn:
            pass
        logger.info("Successfully connected to PostgreSQL database.")
        return pg_engine
    except Exception as e:
        logger.warning(
            f"PostgreSQL connection to {settings.POSTGRES_URL} unavailable ({e}). "
            f"Falling back to local SQLite database at {settings.SQLITE_URL}."
        )
        return create_engine(
            settings.SQLITE_URL,
            connect_args={"check_same_thread": False}
        )

engine = _create_initial_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_engine():
    return engine

def get_session():
    return SessionLocal()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
