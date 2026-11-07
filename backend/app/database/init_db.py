import datetime
import random
from sqlalchemy.orm import Session
from app.models.database_models import Base, User, CameraRecord, DetectionRecord, ViolationRecord
from app.database.session import get_engine, SessionLocal
from app.core.security import hash_password
from app.core.config import settings

def init_database():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        # 1. Seed Admin User
        admin = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
        if not admin:
            admin = User(
                username=settings.ADMIN_USERNAME,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role="admin"
            )
            db.add(admin)
            db.commit()

        # 2. Seed Default Cameras
        default_cameras = [
            CameraRecord(
                id="CAM-01",
                camera_name="Main Gate - Entrance A",
                camera_location="Ground Floor Gate 1",
                camera_status="online",
                camera_source="0"  # Laptop webcam or default device
            ),
            CameraRecord(
                id="CAM-02",
                camera_name="Academic Block - Hallway",
                camera_location="1st Floor Corridor",
                camera_status="online",
                camera_source="test_feed"
            ),
            CameraRecord(
                id="CAM-03",
                camera_name="Auditorium - Foyer",
                camera_location="Auditorium Entrance",
                camera_status="offline",
                camera_source="rtsp://192.168.1.100:554/stream"
            )
        ]
        for cam in default_cameras:
            existing = db.query(CameraRecord).filter(CameraRecord.id == cam.id).first()
            if not existing:
                db.add(cam)
        db.commit()

        # 3. Seed Realistic Historical Baseline Records if empty
        record_count = db.query(DetectionRecord).count()
        if record_count == 0:
            now = datetime.datetime.utcnow()
            for i in range(24, 0, -1):
                rec_time = now - datetime.timedelta(hours=i)
                faces = random.randint(12, 35)
                # realistic 80-92% compliance
                mask = int(faces * random.uniform(0.75, 0.90))
                incorrect = random.randint(0, min(3, faces - mask))
                no_mask = faces - mask - incorrect
                compliance = (mask / faces) * 100.0 if faces > 0 else 100.0

                det = DetectionRecord(
                    timestamp=rec_time,
                    camera_id=random.choice(["CAM-01", "CAM-02"]),
                    total_faces=faces,
                    mask_count=mask,
                    no_mask_count=no_mask,
                    incorrect_mask_count=incorrect,
                    compliance_percentage=compliance
                )
                db.add(det)

                # Add violation records for no_mask or incorrect_mask
                for _ in range(no_mask):
                    v = ViolationRecord(
                        timestamp=rec_time + datetime.timedelta(minutes=random.randint(1, 55)),
                        camera_id=random.choice(["CAM-01", "CAM-02"]),
                        detection_category="No Mask",
                        confidence_score=round(random.uniform(0.85, 0.98), 4)
                    )
                    db.add(v)
                for _ in range(incorrect):
                    v = ViolationRecord(
                        timestamp=rec_time + datetime.timedelta(minutes=random.randint(1, 55)),
                        camera_id=random.choice(["CAM-01", "CAM-02"]),
                        detection_category="Incorrect Mask",
                        confidence_score=round(random.uniform(0.75, 0.94), 4)
                    )
                    db.add(v)

            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
    print("Database initialized successfully.")
