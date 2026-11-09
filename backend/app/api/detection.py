import asyncio
import base64
import logging
import cv2
import numpy as np
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database.session import get_db
from app.models.database_models import DetectionRecord, ViolationRecord
from app.services.face_detector import FaceDetectorService
from app.schemas.detection_schemas import FrameDetectionResponse, StreamFrameRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/detect", tags=["Detection"])

@router.post("", response_model=FrameDetectionResponse)
async def detect_frame(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    camera_id: str = Form("CAM-01"),
    save_to_db: bool = Form(True),
    is_single_face_upload: bool = Form(False),
    db: Session = Depends(get_db)
):
    """
    Accepts an image via multipart upload or base64 string, runs CNN face-mask detection,
    persists compliance metrics and violations into PostgreSQL/SQLite, and returns annotated results.
    Supports detecting ALL visible people in the frame simultaneously.
    """
    img_bgr = None

    if file is not None:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        # If user uploaded a photo directly, allow single-face fallback if no face detected
        is_single_face_upload = True
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
    result = await asyncio.to_thread(
        detector.detect_and_classify_frame,
        frame_bgr=img_bgr,
        camera_id=camera_id,
        annotate=True,
        is_single_face_upload=is_single_face_upload
    )

    if save_to_db and result.total_faces > 0:
        try:
            det_record = DetectionRecord(
                camera_id=camera_id,
                total_faces=result.total_faces,
                mask_count=result.mask_count,
                no_mask_count=result.no_mask_count,
                incorrect_mask_count=result.incorrect_mask_count,
                compliance_percentage=result.compliance_percentage
            )
            db.add(det_record)

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
            logger.warning(f"DB write warning: {e}")

    return result


@router.post("/frame", response_model=FrameDetectionResponse)
async def detect_frame_json(
    payload: StreamFrameRequest,
    db: Session = Depends(get_db)
):
    """
    High-performance real-time frame streaming endpoint (HTTP fallback for WebSockets).
    Processes compressed base64 frames asynchronously without blocking the event loop.
    Detects ALL visible people in a single frame.
    """
    b64_img = payload.image or payload.frame
    if not b64_img:
        raise HTTPException(status_code=400, detail="Image data is required in 'image' or 'frame' field.")

    if "," in b64_img:
        b64_img = b64_img.split(",")[1]

    try:
        raw_bytes = base64.b64decode(b64_img)
        nparr = np.frombuffer(raw_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode base64 frame: {str(e)}")

    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Decoded image is empty.")

    detector = FaceDetectorService.get_instance()
    result = await asyncio.to_thread(
        detector.detect_and_classify_frame,
        frame_bgr=img_bgr,
        camera_id=payload.camera_id or "webcam",
        annotate=payload.return_annotated or False,
        is_single_face_upload=False
    )

    if payload.save_to_db and result.total_faces > 0:
        try:
            det_record = DetectionRecord(
                camera_id=payload.camera_id or "webcam",
                total_faces=result.total_faces,
                mask_count=result.mask_count,
                no_mask_count=result.no_mask_count,
                incorrect_mask_count=result.incorrect_mask_count,
                compliance_percentage=result.compliance_percentage
            )
            db.add(det_record)

            for det in result.detections:
                if det.label in ["No Mask", "Incorrect Mask"]:
                    v_record = ViolationRecord(
                        camera_id=payload.camera_id or "webcam",
                        detection_category=det.label,
                        confidence_score=det.confidence
                    )
                    db.add(v_record)

            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Live frame DB write warning: {e}")

    return result
