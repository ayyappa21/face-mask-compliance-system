import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.config import settings

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["model"]["loaded"] is True

def test_auth_login_success():
    response = client.post(
        "/api/auth/login",
        json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["username"] == settings.ADMIN_USERNAME

def test_auth_login_invalid_password():
    response = client.post(
        "/api/auth/login",
        json={"username": settings.ADMIN_USERNAME, "password": "wrong_password_999"}
    )
    assert response.status_code == 401

def test_get_statistics():
    response = client.get("/api/statistics")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "trends" in data
    assert "category_distribution" in data
    assert data["summary"]["overall_compliance_percentage"] >= 0.0

def test_get_violations():
    response = client.get("/api/violations?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)

def test_get_history():
    response = client.get("/api/history?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data

def test_get_model_info():
    response = client.get("/api/model-info")
    assert response.status_code == 200
    data = response.json()
    assert data["model_name"] == "FaceMask-MobileNetV2-Compliance"
    assert "parameters_count" in data
    assert "metrics" in data
    assert data["metrics"]["accuracy"] > 0.90

def test_camera_crud_lifecycle():
    # 1. Create Camera
    cam_id = "TEST-CAM-99"
    create_res = client.post(
        "/api/cameras",
        json={
            "id": cam_id,
            "camera_name": "Test Science Lab",
            "camera_location": "Building C Room 102",
            "camera_status": "online",
            "camera_source": "0"
        }
    )
    assert create_res.status_code == 200
    assert create_res.json()["id"] == cam_id

    # 2. Get Cameras
    list_res = client.get("/api/cameras")
    assert list_res.status_code == 200
    cam_ids = [c["id"] for c in list_res.json()]
    assert cam_id in cam_ids

    # 3. Update Camera
    update_res = client.put(
        f"/api/cameras/{cam_id}",
        json={"camera_status": "disabled", "camera_location": "Updated Room 105"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["camera_status"] == "disabled"
    assert update_res.json()["camera_location"] == "Updated Room 105"

    # 4. Delete Camera
    del_res = client.delete(f"/api/cameras/{cam_id}")
    assert del_res.status_code == 200

def test_detect_image_upload():
    # Create synthetic test image
    img = np.zeros((150, 150, 3), dtype=np.uint8)
    img[:, :] = (120, 150, 180)
    _, buffer = cv2.imencode(".jpg", img)

    files = {"file": ("test.jpg", io.BytesIO(buffer), "image/jpeg")}
    data = {"camera_id": "CAM-01", "save_to_db": "true"}

    response = client.post("/api/detect", files=files, data=data)
    assert response.status_code == 200
    res_json = response.json()
    assert "total_faces" in res_json
    assert "compliance_percentage" in res_json
    assert "detections" in res_json

def test_detect_invalid_upload():
    response = client.post("/api/detect", data={"camera_id": "CAM-01"})
    assert response.status_code == 400

def test_websocket_connection():
    with client.websocket_connect("/ws/detection?camera_id=TEST-WS") as websocket:
        # Ping
        websocket.send_json({"type": "ping", "timestamp": "12345"})
        resp = websocket.receive_json()
        assert resp["type"] == "pong"
