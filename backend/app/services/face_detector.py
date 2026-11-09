import os
import base64
import logging
from pathlib import Path
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
from app.schemas.detection_schemas import BoundingBox, FaceDetectionResult, FrameDetectionResponse, FrameDimensions

class FaceDetectorService:
    _instance = None

    def __init__(self):
        self.yunet_detector = None
        self.face_cascade = None
        self.classifier = MaskClassifierService.get_instance()
        self.init_detectors()

    @classmethod
    def get_instance(cls) -> "FaceDetectorService":
        if cls._instance is None:
            cls._instance = FaceDetectorService()
        return cls._instance

    def init_detectors(self):
        if not CV2_AVAILABLE:
            return

        # 1. Initialize High-Performance Deep Learning Face Detector (YuNet ONNX)
        yunet_path = Path(__file__).resolve().parent.parent.parent / "trained_models" / "face_detection_yunet.onnx"
        if not yunet_path.exists():
            yunet_path = Path("/tmp/face_detection_yunet.onnx")

        if yunet_path.exists() and hasattr(cv2, "FaceDetectorYN"):
            try:
                # YuNet supports detecting multiple people simultaneously with no artificial cap (top_k=100)
                self.yunet_detector = cv2.FaceDetectorYN.create(
                    str(yunet_path),
                    "",
                    (320, 240),
                    score_threshold=0.38,
                    nms_threshold=0.32,
                    top_k=100
                )
                logger.info("OpenCV YuNet Deep Learning multi-face detector initialized successfully (top_k=100).")
            except Exception as e:
                logger.warning(f"Could not load YuNet face detector: {e}. Falling back to Haar cascades.")
                self.yunet_detector = None

        # 2. Initialize Haar Cascade as reliable fallback
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            if not self.face_cascade.empty():
                logger.info("OpenCV Haar Cascade fallback detector initialized.")
        except Exception as e:
            logger.error(f"Error loading Haar cascade: {e}")

    def detect_and_classify_frame(
        self,
        frame_bgr: np.ndarray,
        camera_id: str = "webcam",
        annotate: bool = True,
        is_single_face_upload: bool = False
    ) -> FrameDetectionResponse:
        """
        Detects ALL visible people in the frame in real time using GPU/CPU-accelerated CNN inference,
        batches all detected face crops into a single PyTorch forward pass,
        and returns coordinates, classifications, confidence scores, and optional HUD previews.
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

        orig_h, orig_w = frame_bgr.shape[:2]

        # Resolution optimization: downscale for ultra-fast multi-person detection if frame is large
        max_det_dim = 640
        if orig_w > max_det_dim or orig_h > max_det_dim:
            scale = max_det_dim / float(max(orig_w, orig_h))
            det_w = int(orig_w * scale)
            det_h = int(orig_h * scale)
            det_frame = cv2.resize(frame_bgr, (det_w, det_h), interpolation=cv2.INTER_LINEAR)
            scale_x = orig_w / float(det_w)
            scale_y = orig_h / float(det_h)
        else:
            det_frame = frame_bgr
            det_w, det_h = orig_w, orig_h
            scale_x, scale_y = 1.0, 1.0

        raw_faces: List[Tuple[int, int, int, int, float]] = []

        # Step 1: Detect all faces using YuNet Deep Learning Detector
        if self.yunet_detector is not None:
            try:
                self.yunet_detector.setInputSize((det_w, det_h))
                _, detected_faces = self.yunet_detector.detect(det_frame)
                if detected_faces is not None and len(detected_faces) > 0:
                    for f in detected_faces:
                        fx = max(0, int(f[0] * scale_x))
                        fy = max(0, int(f[1] * scale_y))
                        fw = min(orig_w - fx, int(f[2] * scale_x))
                        fh = min(orig_h - fy, int(f[3] * scale_y))
                        conf = float(f[14]) if len(f) > 14 else 0.85
                        if fw >= 16 and fh >= 16:
                            raw_faces.append((fx, fy, fw, fh, conf))
            except Exception as e:
                logger.warning(f"YuNet inference exception: {e}")

        # Step 2: Fallback to multi-scale Haar Cascade if YuNet returned zero faces
        if len(raw_faces) == 0 and self.face_cascade and not self.face_cascade.empty():
            gray = cv2.cvtColor(det_frame, cv2.COLOR_BGR2GRAY)
            detected = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.10,
                minNeighbors=3,
                minSize=(24, 24)
            )
            for (cx, cy, cw, ch) in detected:
                fx = max(0, int(cx * scale_x))
                fy = max(0, int(cy * scale_y))
                fw = min(orig_w - fx, int(cw * scale_x))
                fh = min(orig_h - fy, int(ch * scale_y))
                raw_faces.append((fx, fy, fw, fh, 0.75))

        # Step 3: Only for cropped single face upload fallback (NEVER for multi-person video streaming)
        if len(raw_faces) == 0 and is_single_face_upload:
            if 40 <= orig_w <= 800 and 40 <= orig_h <= 800 and 0.6 <= (orig_w / orig_h) <= 1.6:
                raw_faces.append((int(0.05 * orig_w), int(0.05 * orig_h), int(0.9 * orig_w), int(0.9 * orig_h), 0.70))

        # Step 4: Non-Maximum Suppression (NMS) to eliminate duplicate overlapping boxes
        final_boxes: List[Tuple[int, int, int, int, float]] = []
        if len(raw_faces) > 0:
            boxes = [[f[0], f[1], f[2], f[3]] for f in raw_faces]
            scores = [f[4] for f in raw_faces]
            indices = cv2.dnn.NMSBoxes(boxes, scores, score_threshold=0.35, nms_threshold=0.35)
            if len(indices) > 0:
                for idx in indices.flatten():
                    final_boxes.append(raw_faces[idx])
            else:
                final_boxes = raw_faces

        # Step 5: Batch classification of all detected faces
        face_crops: List[np.ndarray] = []
        valid_boxes: List[Tuple[int, int, int, int, float]] = []

        for (x, y, fw, fh, det_conf) in final_boxes:
            pad_x = int(0.12 * fw)
            pad_y = int(0.12 * fh)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(orig_w, x + fw + pad_x)
            y2 = min(orig_h, y + fh + pad_y)

            crop = frame_bgr[y1:y2, x1:x2]
            if crop.size > 0 and crop.shape[0] >= 8 and crop.shape[1] >= 8:
                face_crops.append(crop)
                valid_boxes.append((x, y, fw, fh, det_conf))

        # Batch forward pass on Apple Silicon MPS / CUDA / CPU
        classifications = self.classifier.predict_faces_batch(face_crops)

        detections: List[FaceDetectionResult] = []
        mask_count = 0
        no_mask_count = 0
        incorrect_mask_count = 0

        annotated_bgr = frame_bgr.copy() if annotate else None

        for (box_tuple, (label, cls_conf, color_hex)) in zip(valid_boxes, classifications):
            x, y, fw, fh, det_conf = box_tuple
            # Overall confidence combines detector confidence with CNN classification confidence
            combined_conf = round(cls_conf * 0.85 + det_conf * 0.15, 4)

            if label == "Mask":
                mask_count += 1
                bgr_color = (34, 197, 94)    # Green (#22C55E)
            elif label == "No Mask":
                no_mask_count += 1
                bgr_color = (68, 68, 239)    # Red (#EF4444)
            else:  # Incorrect Mask
                incorrect_mask_count += 1
                bgr_color = (11, 158, 245)   # Orange (#F59E0B)

            detections.append(FaceDetectionResult(
                box=BoundingBox(x=int(x), y=int(y), width=int(fw), height=int(fh)),
                label=label,
                confidence=combined_conf,
                color=color_hex
            ))

            if annotate and annotated_bgr is not None:
                # Sleek bounding box rendering
                cv2.rectangle(annotated_bgr, (x, y), (x + fw, y + fh), bgr_color, 2)
                # Corner accents
                corner_len = min(int(fw * 0.2), 20)
                thick = 3
                cv2.line(annotated_bgr, (x, y), (x + corner_len, y), bgr_color, thick)
                cv2.line(annotated_bgr, (x, y), (x, y + corner_len), bgr_color, thick)
                cv2.line(annotated_bgr, (x + fw, y), (x + fw - corner_len, y), bgr_color, thick)
                cv2.line(annotated_bgr, (x + fw, y), (x + fw, y + corner_len), bgr_color, thick)

                label_text = f"{label} {int(combined_conf * 100)}%"
                font = cv2.FONT_HERSHEY_SIMPLEX
                (tw, th), _ = cv2.getTextSize(label_text, font, 0.48, 1)
                lbl_y = max(0, y - th - 8)
                cv2.rectangle(annotated_bgr, (x, lbl_y), (x + tw + 10, y), bgr_color, -1)
                cv2.putText(annotated_bgr, label_text, (x + 5, y - 4), font, 0.48, (255, 255, 255), 1, cv2.LINE_AA)

        total_faces = len(detections)
        compliance_pct = (mask_count / total_faces * 100.0) if total_faces > 0 else 100.0

        annotated_b64 = None
        if annotate and annotated_bgr is not None:
            self._draw_hud_overlay(annotated_bgr, total_faces, mask_count, no_mask_count, incorrect_mask_count, compliance_pct)
            _, buffer = cv2.imencode(".jpg", annotated_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
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
            frame_dims=FrameDimensions(width=int(orig_w), height=int(orig_h)),
            annotated_image=annotated_b64
        )

    def _draw_hud_overlay(self, img: np.ndarray, total: int, mask: int, no_mask: int, incorrect: int, compliance: float):
        h, w = img.shape[:2]
        hud_h = 32
        overlay = img.copy()
        cv2.rectangle(overlay, (0, 0), (w, hud_h), (16, 19, 29), -1)
        cv2.addWeighted(overlay, 0.75, img, 0.25, 0, img)

        hud_text = f"Faces: {total} | Compliant: {mask} | Violations: {no_mask} | Improper: {incorrect} | Compliance: {compliance:.1f}%"
        cv2.putText(img, hud_text, (12, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (255, 255, 255), 1, cv2.LINE_AA)
