import argparse
import time
import cv2
import requests
from app.services.face_detector import FaceDetectorService
from app.core.config import settings

def run_camera_stream(
    source="0",
    camera_id="CAM-01",
    sync_api=False,
    api_url="http://localhost:8001/api/detect"
):
    """
    Real-Time OpenCV Desktop & CCTV Video Stream Processing Agent.
    Captures live webcam or RTSP feed, classifies face mask compliance,
    draws HUD bounding boxes, and optionally posts detections to backend.
    """
    cap_source = int(source) if source.isdigit() else source
    cap = cv2.VideoCapture(cap_source)

    if not cap.isOpened():
        print(f"Error: Unable to open video source: {source}")
        return

    # Set camera resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    detector = FaceDetectorService.get_instance()
    print("=" * 65)
    print(f"Starting Real-Time Face Mask Compliance Stream on [{camera_id}]")
    print(f"Source: {source} | Model: MobileNetV2 (Apple Silicon MPS / CPU)")
    print("Press 'q' in the video window to quit.")
    print("=" * 65)

    prev_time = time.time()
    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Warning: Dropped frame or camera stream disconnected. Retrying...")
            time.sleep(0.5)
            continue

        frame_count += 1
        curr_time = time.time()
        fps = 1.0 / max(curr_time - prev_time, 1e-4)
        prev_time = curr_time

        # Run Real-Time Face Detection and Mask Compliance Classification
        response = detector.detect_and_classify_frame(
            frame_bgr=frame,
            camera_id=camera_id,
            annotate=True
        )

        # Draw Real-Time FPS on display
        cv2.putText(
            frame,
            f"FPS: {fps:.1f}",
            (frame.shape[1] - 110, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 255, 255),
            1,
            cv2.LINE_AA
        )

        # Optional: Sync incident telemetry to FastAPI backend
        if sync_api and frame_count % 15 == 0 and response.total_faces > 0:
            try:
                _, buf = cv2.imencode(".jpg", frame)
                files = {"file": ("stream_frame.jpg", buf.tobytes(), "image/jpeg")}
                requests.post(
                    api_url,
                    files=files,
                    data={"camera_id": camera_id, "save_to_db": "true"},
                    timeout=1.5
                )
            except Exception:
                pass

        # Display Live Window
        cv2.imshow(f"Face Mask Compliance Monitoring - {camera_id}", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("User requested exit. Closing stream.")
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Live Face Mask Compliance Video Stream")
    parser.add_argument("--source", type=str, default="0", help="Camera index (e.g. 0) or RTSP URL / video path")
    parser.add_argument("--camera-id", type=str, default="CAM-01", help="Camera identifier")
    parser.add_argument("--sync-api", action="store_true", help="Sync detections to FastAPI backend")
    parser.add_argument("--api-url", type=str, default="http://localhost:8000/api/detect", help="API URL for sync")
    args = parser.parse_args()

    run_camera_stream(
        source=args.source,
        camera_id=args.camera_id,
        sync_api=args.sync_api,
        api_url=args.api_url
    )
