from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def get_utc_now():
    return datetime.now(timezone.utc)

class DetectionRecord(Base):
    """
    Stores aggregate detection events processed from video streams or uploaded images.
    """
    __tablename__ = "detection_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=get_utc_now, index=True, nullable=False)
    camera_id = Column(String(50), index=True, nullable=True)
    total_faces = Column(Integer, default=0, nullable=False)
    mask_count = Column(Integer, default=0, nullable=False)
    no_mask_count = Column(Integer, default=0, nullable=False)
    incorrect_mask_count = Column(Integer, default=0, nullable=False)
    compliance_percentage = Column(Float, default=0.0, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "camera_id": self.camera_id,
            "total_faces": self.total_faces,
            "mask_count": self.mask_count,
            "no_mask_count": self.no_mask_count,
            "incorrect_mask_count": self.incorrect_mask_count,
            "compliance_percentage": round(self.compliance_percentage, 2)
        }


class ViolationRecord(Base):
    """
    Stores non-compliance incidents (No Mask or Incorrect Mask) with privacy-first metadata.
    Does not store identifiable face photos by default.
    """
    __tablename__ = "violation_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=get_utc_now, index=True, nullable=False)
    camera_id = Column(String(50), index=True, nullable=True)
    detection_category = Column(String(50), nullable=False)  # 'No Mask' or 'Incorrect Mask'
    confidence_score = Column(Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "camera_id": self.camera_id,
            "detection_category": self.detection_category,
            "confidence_score": round(self.confidence_score, 4)
        }


class CameraRecord(Base):
    """
    Stores CCTV and webcam monitoring feeds.
    """
    __tablename__ = "camera_records"

    id = Column(String(50), primary_key=True, index=True)
    camera_name = Column(String(100), nullable=False)
    camera_location = Column(String(100), nullable=False)
    camera_status = Column(String(20), default="online", nullable=False)  # online, offline, disabled
    camera_source = Column(String(255), default="0", nullable=False)  # 0 (webcam), RTSP URL, video path
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "camera_name": self.camera_name,
            "camera_location": self.camera_location,
            "camera_status": self.camera_status,
            "camera_source": self.camera_source,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class User(Base):
    """
    Stores administrative credentials for dashboard access.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="admin", nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
