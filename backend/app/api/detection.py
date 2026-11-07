import base64
import cv2
import numpy as np
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional

from app.database.session import get_db
from app.models.database_models import DetectionRecord, ViolationRecord
from app.services.face_detector import FaceDetectorService
from app.schemas.detection_schemas import FrameDetectionResponse

router = APIRouter(prefix="/detect", tags=["Detection"])

@router.post("", response_model=FrameDetectionResponse)
async def detect_frame(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    camera_id: str = Form("CAM-01"),
    save_to_db: bool = Form(True),
    db: Session = Depends(get_db)
):
    """
    Accepts an image via multipart upload or base64 string, runs CNN face-mask detection,
    persists compliance metrics and violations into PostgreSQL/SQLite, and returns annotated results.
    """
    img_bgr = None

    if file is not None:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    elif image_base64:
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]
        try:
            raw_bytes = base64.b64decode(image_base64)
            nparr = np.frombuffer(raw_bytes, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {str(e)}")

    if img_bgr is None:
        raise HTTPException(status_code=400, detail="No valid image provided. Supply a file or image_base64 parameter.")

    detector = FaceDetectorService.get_instance()
    result = detector.detect_and_classify_frame(
        frame_bgr=img_bgr,
        camera_id=camera_id,
        annotate=True
    )

    if save_to_db:
        try:
            # 1. Save DetectionRecord
            det_record = DetectionRecord(
                camera_id=camera_id,
                total_faces=result.total_faces,
                mask_count=result.mask_count,
                no_mask_count=result.no_mask_count,
                incorrect_mask_count=result.incorrect_mask_count,
                compliance_percentage=result.compliance_percentage
            )
            db.add(det_record)

            # 2. Save individual ViolationRecords for non-compliant faces
            for det in result.detections:
                if det.label in ["No Mask", "Incorrect Mask"]:
                    v_record = ViolationRecord(
                        camera_id=camera_id,
                        detection_category=det.label,
                        confidence_score=det.confidence
                    )
                    db.add(v_record)

            db.commit()
        except Exception as e:
            db.rollback()
            # Do not fail detection request if DB write glitches
            pass

    return result
