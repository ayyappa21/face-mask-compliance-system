import base64
import json
import logging
import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.face_detector import FaceDetectorService
from app.database.session import SessionLocal
from app.models.database_models import DetectionRecord, ViolationRecord

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/detection")
async def websocket_detection_endpoint(websocket: WebSocket, camera_id: str = "webcam"):
    """
    Bi-directional low-latency WebSocket endpoint for real-time video frame inference.
    Clients transmit compressed JPEG base64 frames; server returns detection coordinates,
    labels, confidence levels, compliance metrics, and optional annotated previews.
    """
    await websocket.accept()
    detector = FaceDetectorService.get_instance()
    logger.info(f"WebSocket client connected for camera: {camera_id}")

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except Exception:
                continue

            msg_type = data.get("type", "frame")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": str(data.get("timestamp"))})
                continue

            elif msg_type == "frame":
                b64_img = data.get("image", "")
                save_to_db = data.get("save", False)
                return_annotated = data.get("return_annotated", True)

                if not b64_img:
                    continue

                if "," in b64_img:
                    b64_img = b64_img.split(",")[1]

                try:
                    img_bytes = base64.b64decode(b64_img)
                    nparr = np.frombuffer(img_bytes, np.uint8)
                    frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": f"Frame decode failed: {str(e)}"})
                    continue

                if frame_bgr is None:
                    continue

                # Run inference
                result = detector.detect_and_classify_frame(
                    frame_bgr=frame_bgr,
                    camera_id=camera_id,
                    annotate=return_annotated
                )

                # Optional DB persistence (throttled by client save flag)
                if save_to_db and result.total_faces > 0:
                    try:
                        db = SessionLocal()
                        det_record = DetectionRecord(
                            camera_id=camera_id,
                            total_faces=result.total_faces,
                            mask_count=result.mask_count,
                            no_mask_count=result.no_mask_count,
                            incorrect_mask_count=result.incorrect_mask_count,
                            compliance_percentage=result.compliance_percentage
                        )
                        db.add(det_record)
                        for d in result.detections:
                            if d.label in ["No Mask", "Incorrect Mask"]:
                                v_rec = ViolationRecord(
                                    camera_id=camera_id,
                                    detection_category=d.label,
                                    confidence_score=d.confidence
                                )
                                db.add(v_rec)
                        db.commit()
                        db.close()
                    except Exception as db_err:
                        logger.warning(f"WebSocket DB write error: {db_err}")

                resp_payload = {
                    "type": "detection_result",
                    "timestamp": result.timestamp,
                    "camera_id": camera_id,
                    "total_faces": result.total_faces,
                    "mask_count": result.mask_count,
                    "no_mask_count": result.no_mask_count,
                    "incorrect_mask_count": result.incorrect_mask_count,
                    "compliance_percentage": result.compliance_percentage,
                    "detections": [d.model_dump() for d in result.detections],
                    "annotated_image": result.annotated_image if return_annotated else None
                }
                await websocket.send_json(resp_payload)

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for camera: {camera_id}")
    except Exception as e:
        logger.error(f"WebSocket exception: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
