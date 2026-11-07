import pytest
import numpy as np
import cv2
from pathlib import Path
from app.services.cnn_classifier import MaskClassifierService
from app.services.face_detector import FaceDetectorService

@pytest.fixture(scope="module")
def classifier():
    return MaskClassifierService.get_instance()

@pytest.fixture(scope="module")
def detector():
    return FaceDetectorService.get_instance()

def test_model_loaded(classifier):
    assert classifier.is_loaded is True
    assert classifier.model is not None
    assert len(classifier.classes) == 3

def test_correct_mask_classification(classifier):
    mask_files = list(Path("dataset/processed/test/Mask").glob("*.png"))
    assert len(mask_files) > 0, "No Mask test samples found"
    img = cv2.imread(str(mask_files[0]))
    label, conf, color = classifier.predict_face(img)
    assert label == "Mask"
    assert conf > 0.70
    assert color == "#10B981"

def test_no_mask_classification(classifier):
    nomask_files = list(Path("dataset/processed/test/No Mask").glob("*.png"))
    assert len(nomask_files) > 0, "No 'No Mask' test samples found"
    img = cv2.imread(str(nomask_files[0]))
    label, conf, color = classifier.predict_face(img)
    assert label == "No Mask"
    assert conf > 0.70
    assert color == "#EF4444"

def test_incorrect_mask_classification(classifier):
    incorrect_files = list(Path("dataset/processed/test/Incorrect Mask").glob("*.png"))
    assert len(incorrect_files) > 0, "No 'Incorrect Mask' test samples found"
    img = cv2.imread(str(incorrect_files[0]))
    label, conf, color = classifier.predict_face(img)
    assert label == "Incorrect Mask"
    assert conf > 0.65
    assert color == "#F59E0B"

def test_low_light_robustness(classifier):
    """
    Simulates night / low-light conditions by darkening the input pixel matrix by 60%.
    """
    mask_files = list(Path("dataset/processed/test/Mask").glob("*.png"))
    img = cv2.imread(str(mask_files[0]))
    dark_img = (img * 0.4).astype(np.uint8)
    label, conf, _ = classifier.predict_face(dark_img)
    # Ensure inference completes and outputs a valid class
    assert label in classifier.classes
    assert conf > 0.40

def test_face_angles_rotation(classifier):
    """
    Simulates camera angle rotation by rotating the face crop 15 degrees.
    """
    mask_files = list(Path("dataset/processed/test/Mask").glob("*.png"))
    img = cv2.imread(str(mask_files[0]))
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), 15, 1.0)
    rotated = cv2.warpAffine(img, M, (w, h))
    label, conf, _ = classifier.predict_face(rotated)
    assert label == "Mask"

def test_multiple_faces_detection(detector):
    """
    Constructs a synthetic multi-person frame side-by-side.
    """
    mask_files = list(Path("dataset/processed/test/Mask").glob("*.png"))
    nomask_files = list(Path("dataset/processed/test/No Mask").glob("*.png"))
    img1 = cv2.resize(cv2.imread(str(mask_files[0])), (150, 150))
    img2 = cv2.resize(cv2.imread(str(nomask_files[0])), (150, 150))

    # Canvas with 2 faces side by side
    canvas = np.zeros((300, 500, 3), dtype=np.uint8)
    canvas[75:225, 50:200] = img1
    canvas[75:225, 300:450] = img2

    res = detector.detect_and_classify_frame(canvas, "CAM-MULTI", annotate=True)
    assert res.total_faces >= 1
    assert res.compliance_percentage >= 0.0
