import base64
import logging
from typing import List, Dict, Any, Tuple
import numpy as np

logger = logging.getLogger(__name__)

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("OpenCV not yet installed. Operating with image array stubs.")

from app.services.cnn_classifier import MaskClassifierService
from app.schemas.detection_schemas import BoundingBox, FaceDetectionResult, FrameDetectionResponse

class FaceDetectorService:
    _instance = None

    def __init__(self):
        self.face_cascade = None
        self.classifier = MaskClassifierService.get_instance()
        self.load_cascade()

    @classmethod
    def get_instance(cls) -> "FaceDetectorService":
        if cls._instance is None:
            cls._instance = FaceDetectorService()
        return cls._instance

    def load_cascade(self):
        if not CV2_AVAILABLE:
            return
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            if self.face_cascade.empty():
                logger.error("Failed to load OpenCV face cascade classifier.")
            else:
                logger.info("OpenCV face cascade detector initialized successfully.")
        except Exception as e:
            logger.error(f"Error loading OpenCV cascade: {e}")

    def detect_and_classify_frame(
        self, 
        frame_bgr: np.ndarray, 
        camera_id: str = "webcam",
        annotate: bool = True
    ) -> FrameDetectionResponse:
        """
        Detects all faces in frame, classifies mask compliance for each,
        and optionally draws bounding boxes and badges on the frame.
        """
        from datetime import datetime, timezone
        timestamp_str = datetime.now(timezone.utc).isoformat()

        if not CV2_AVAILABLE or frame_bgr is None:
            return FrameDetectionResponse(
                timestamp=timestamp_str,
                camera_id=camera_id,
                total_faces=0,
                mask_count=0,
                no_mask_count=0,
                incorrect_mask_count=0,
                compliance_percentage=100.0,
                detections=[]
            )

        h, w = frame_bgr.shape[:2]
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        
        # Detect multiple faces using cascade
        faces = []
        if self.face_cascade and not self.face_cascade.empty():
            detected = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=4,
                minSize=(35, 35)
            )
            faces = list(detected)

        # Fallback for cropped single face uploads: if no face was detected by cascade
        # but image itself has face-like aspect ratio and dimensions, evaluate whole image
        if len(faces) == 0 and 40 <= w <= 800 and 40 <= h <= 800 and 0.6 <= (w / h) <= 1.6:
            faces = [(int(0.05 * w), int(0.05 * h), int(0.9 * w), int(0.9 * h))]

        detections: List[FaceDetectionResult] = []
        mask_count = 0
        no_mask_count = 0
        incorrect_mask_count = 0

        annotated_bgr = frame_bgr.copy() if annotate else None

        for (x, y, fw, fh) in faces:
            # Crop face with slight padding
            pad_x = int(0.1 * fw)
            pad_y = int(0.1 * fh)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(w, x + fw + pad_x)
            y2 = min(h, y + fh + pad_y)

            face_crop = frame_bgr[y1:y2, x1:x2]
            label, confidence, color_hex = self.classifier.predict_face(face_crop)

            if label == "Mask":
                mask_count += 1
                bgr_color = (129, 185, 16)  # Green (#10B981 in BGR)
            elif label == "No Mask":
                no_mask_count += 1
                bgr_color = (68, 68, 239)   # Red (#EF4444 in BGR)
            else:  # Incorrect Mask
                incorrect_mask_count += 1
                bgr_color = (11, 158, 245)  # Orange (#F59E0B in BGR)

            det_result = FaceDetectionResult(
                box=BoundingBox(x=int(x), y=int(y), width=int(fw), height=int(fh)),
                label=label,
                confidence=round(confidence, 4),
                color=color_hex
            )
            detections.append(det_result)

            if annotate and annotated_bgr is not None:
                # 1. Draw rounded-style bounding box
                thickness = 2
                cv2.rectangle(annotated_bgr, (x, y), (x + fw, y + fh), bgr_color, thickness)

                # 2. Draw label banner
                label_text = f"{label} ({int(confidence * 100)}%)"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.55
                text_thickness = 1
                (tw, th), baseline = cv2.getTextSize(label_text, font, font_scale, text_thickness)

                label_y1 = max(0, y - th - 10)
                label_y2 = y
                label_x2 = min(w, x + tw + 12)

                # Filled banner
                cv2.rectangle(annotated_bgr, (x, label_y1), (label_x2, label_y2), bgr_color, cv2.FILLED)
                # White text
                cv2.putText(annotated_bgr, label_text, (x + 6, y - 5), font, font_scale, (255, 255, 255), text_thickness, cv2.LINE_AA)

        total_faces = len(detections)
        compliance_pct = (mask_count / total_faces * 100.0) if total_faces > 0 else 100.0

        # Draw HUD summary overlay bar on top of annotated frame
        if annotate and annotated_bgr is not None:
            self._draw_hud_overlay(annotated_bgr, total_faces, mask_count, no_mask_count, incorrect_mask_count, compliance_pct)

        annotated_b64 = None
        if annotate and annotated_bgr is not None:
            _, buffer = cv2.imencode(".jpg", annotated_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            annotated_b64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"

        return FrameDetectionResponse(
            timestamp=timestamp_str,
            camera_id=camera_id,
            total_faces=total_faces,
            mask_count=mask_count,
            no_mask_count=no_mask_count,
            incorrect_mask_count=incorrect_mask_count,
            compliance_percentage=round(compliance_pct, 2),
            detections=detections,
            annotated_image=annotated_b64
        )

    def _draw_hud_overlay(self, img: np.ndarray, total: int, mask: int, no_mask: int, incorrect: int, compliance: float):
        """
        Draws sleek monitoring overlay bar at the top of the video frame.
        """
        import cv2
        h, w = img.shape[:2]
        hud_h = 36
        # Dark translucent overlay header
        overlay = img.copy()
        cv2.rectangle(overlay, (0, 0), (w, hud_h), (20, 24, 33), -1)
        cv2.addWeighted(overlay, 0.75, img, 0.25, 0, img)

        hud_text = f"People: {total} | Mask: {mask} | No Mask: {no_mask} | Incorrect: {incorrect} | Compliance: {compliance:.1f}%"
        cv2.putText(img, hud_text, (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
