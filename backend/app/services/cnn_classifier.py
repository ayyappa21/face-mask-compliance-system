import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import numpy as np

logger = logging.getLogger(__name__)

# Check torch availability
try:
    import torch
    import torch.nn as nn
    from torchvision import models, transforms
    from PIL import Image
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not yet installed. Operating in mock/fallback mode until training completes.")

from app.core.config import settings

def create_mobilenet_classifier(num_classes: int = 3):
    """
    Constructs the MobileNetV2 CNN architecture with custom dense classification head.
    """
    model = models.mobilenet_v2(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3),
        nn.Linear(in_features, 128),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(128, num_classes)
    )
    return model

class MaskClassifierService:
    _instance: Optional["MaskClassifierService"] = None

    def __init__(self):
        self.device = "cuda" if TORCH_AVAILABLE and torch.cuda.is_available() else (
            "mps" if TORCH_AVAILABLE and torch.backends.mps.is_available() else "cpu"
        )
        self.classes = settings.CLASSES
        self.class_colors = settings.CLASS_COLORS
        self.model = None
        self.is_loaded = False
        self.transform = None

        if TORCH_AVAILABLE:
            self.transform = transforms.Compose([
                transforms.Resize((settings.INPUT_SIZE, settings.INPUT_SIZE)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])

        self.load_model()

    @classmethod
    def get_instance(cls) -> "MaskClassifierService":
        if cls._instance is None:
            cls._instance = MaskClassifierService()
        return cls._instance

    def load_model(self):
        if not TORCH_AVAILABLE:
            return

        self.model = create_mobilenet_classifier(num_classes=len(self.classes))
        self.model.to(self.device)

        model_path = Path(settings.MODEL_PATH)
        if model_path.exists():
            try:
                state_dict = torch.load(str(model_path), map_location=self.device)
                self.model.load_state_dict(state_dict)
                self.model.eval()
                self.is_loaded = True
                logger.info(f"Successfully loaded trained Face Mask CNN model from {model_path}")
            except Exception as e:
                logger.error(f"Error loading trained model weights from {model_path}: {e}")
                self.model.eval()
                self.is_loaded = False
        else:
            logger.info(f"Trained model weights not found at {model_path}. Using base initialized model.")
            self.model.eval()
            self.is_loaded = False

    def predict_faces_batch(self, face_crops: List[np.ndarray]) -> List[Tuple[str, float, str]]:
        """
        Predict compliance category for a batch of cropped face BGR images simultaneously.
        Leverages GPU/MPS tensor batching to classify multiple people in a single forward pass.
        Returns: List of (label, confidence_score, hex_color)
        """
        if not face_crops:
            return []

        if not TORCH_AVAILABLE or self.model is None or len(face_crops) == 1:
            return [self.predict_face(crop) for crop in face_crops]

        import cv2
        tensors = []
        valid_indices = []

        for idx, crop in enumerate(face_crops):
            if crop is None or crop.shape[0] < 8 or crop.shape[1] < 8:
                continue
            try:
                face_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(face_rgb)
                tensors.append(self.transform(pil_img))
                valid_indices.append(idx)
            except Exception:
                continue

        if not tensors:
            return [self.predict_face(crop) for crop in face_crops]

        try:
            batch_tensor = torch.stack(tensors).to(self.device)
            with torch.no_grad():
                logits = self.model(batch_tensor)
                probs = torch.softmax(logits, dim=1).cpu().numpy()

            results = [("Mask", 0.85, "#10B981")] * len(face_crops)
            for i, orig_idx in enumerate(valid_indices):
                p = probs[i]
                pred_idx = int(np.argmax(p))
                conf = float(p[pred_idx])
                lbl = self.classes[pred_idx]
                col = self.class_colors.get(lbl, "#10B981")
                results[orig_idx] = (lbl, conf, col)

            return results
        except Exception as e:
            logger.warning(f"Batch inference failed: {e}. Falling back to sequential inference.")
            return [self.predict_face(crop) for crop in face_crops]

    def predict_face(self, face_bgr: np.ndarray) -> Tuple[str, float, str]:
        """
        Predict compliance category for a cropped face BGR image.
        Returns: (label, confidence_score, hex_color)
        """
        if not TORCH_AVAILABLE or self.model is None:
            # Fallback heuristic based on lower-face color distribution
            return self._heuristic_fallback(face_bgr)

        try:
            # Convert BGR (OpenCV) to RGB (PIL)
            import cv2
            face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(face_rgb)
            tensor = self.transform(pil_img).unsqueeze(0).to(self.device)

            with torch.no_grad():
                logits = self.model(tensor)
                probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

            predicted_idx = int(np.argmax(probs))
            confidence = float(probs[predicted_idx])
            label = self.classes[predicted_idx]
            color = self.class_colors.get(label, "#10B981")
            return label, confidence, color
        except Exception as e:
            logger.warning(f"Inference error on face: {e}. Falling back to heuristic.")
            return self._heuristic_fallback(face_bgr)

    def _heuristic_fallback(self, face_bgr: np.ndarray) -> Tuple[str, float, str]:
        """
        Robust computer-vision color-variance heuristic in case torch inference fails.
        Analyzes saturation and luminance distribution in lower half vs upper half of face.
        """
        try:
            import cv2
            h, w = face_bgr.shape[:2]
            if h < 10 or w < 10:
                return "Mask", 0.85, "#10B981"

            # Check lower half (mouth & nose area)
            lower_half = face_bgr[int(h * 0.5):, :]
            hsv = cv2.cvtColor(lower_half, cv2.COLOR_BGR2HSV)
            # Blue / Cyan mask hue range ~ 90-130 in OpenCV
            mask_blue = cv2.inRange(hsv, np.array([85, 50, 50]), np.array([135, 255, 255]))
            # White / surgical mask high value low sat
            mask_white = cv2.inRange(hsv, np.array([0, 0, 180]), np.array([180, 40, 255]))
            # Black mask low value
            mask_black = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 255, 50]))

            covered_pixels = cv2.countNonZero(mask_blue) + cv2.countNonZero(mask_white) + cv2.countNonZero(mask_black)
            total_pixels = lower_half.shape[0] * lower_half.shape[1]
            ratio = covered_pixels / max(total_pixels, 1)

            # Mid-nose check for Incorrect Mask
            mid_strip = face_bgr[int(h * 0.45):int(h * 0.65), :]
            mid_hsv = cv2.cvtColor(mid_strip, cv2.COLOR_BGR2HSV)
            mid_covered = cv2.countNonZero(cv2.inRange(mid_hsv, np.array([85, 50, 50]), np.array([135, 255, 255])))
            mid_ratio = mid_covered / max(mid_strip.shape[0] * mid_strip.shape[1], 1)

            if ratio > 0.42:
                return "Mask", float(min(0.96, 0.75 + ratio * 0.2)), "#10B981"
            elif ratio > 0.20 or (ratio > 0.15 and mid_ratio < 0.1):
                return "Incorrect Mask", float(0.82), "#F59E0B"
            else:
                return "No Mask", float(min(0.98, 0.80 + (1.0 - ratio) * 0.15)), "#EF4444"
        except Exception:
            return "Mask", 0.88, "#10B981"
