from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.database_models import CameraRecord
from app.schemas.camera_schemas import CameraCreate, CameraUpdate, CameraResponse

router = APIRouter(prefix="/cameras", tags=["Camera Management"])

@router.get("", response_model=List[CameraResponse])
def get_cameras(db: Session = Depends(get_db)):
    """
    List all configured cameras and their real-time monitoring statuses.
    """
    cameras = db.query(CameraRecord).order_by(CameraRecord.id.asc()).all()
    return [
        CameraResponse(
            id=c.id,
            camera_name=c.camera_name,
            camera_location=c.camera_location,
            camera_status=c.camera_status,
            camera_source=c.camera_source,
            created_at=c.created_at.isoformat() if c.created_at else ""
        )
        for c in cameras
    ]

@router.post("", response_model=CameraResponse)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)):
    """
    Register a new camera device or CCTV RTSP feed.
    """
    existing = db.query(CameraRecord).filter(CameraRecord.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Camera with ID {payload.id} already exists.")

    cam = CameraRecord(
        id=payload.id,
        camera_name=payload.camera_name,
        camera_location=payload.camera_location,
        camera_status=payload.camera_status or "online",
        camera_source=payload.camera_source or "0"
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return CameraResponse(
        id=cam.id,
        camera_name=cam.camera_name,
        camera_location=cam.camera_location,
        camera_status=cam.camera_status,
        camera_source=cam.camera_source,
        created_at=cam.created_at.isoformat()
    )

@router.put("/{camera_id}", response_model=CameraResponse)
def update_camera(camera_id: str, payload: CameraUpdate, db: Session = Depends(get_db)):
    """
    Update camera status, location, or video source URI.
    """
    cam = db.query(CameraRecord).filter(CameraRecord.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found.")

    if payload.camera_name is not None:
        cam.camera_name = payload.camera_name
    if payload.camera_location is not None:
        cam.camera_location = payload.camera_location
    if payload.camera_status is not None:
        cam.camera_status = payload.camera_status
    if payload.camera_source is not None:
        cam.camera_source = payload.camera_source

    db.commit()
    db.refresh(cam)
    return CameraResponse(
        id=cam.id,
        camera_name=cam.camera_name,
        camera_location=cam.camera_location,
        camera_status=cam.camera_status,
        camera_source=cam.camera_source,
        created_at=cam.created_at.isoformat()
    )

@router.delete("/{camera_id}")
def delete_camera(camera_id: str, db: Session = Depends(get_db)):
    """
    Remove a camera feed from monitoring.
    """
    cam = db.query(CameraRecord).filter(CameraRecord.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found.")
    db.delete(cam)
    db.commit()
    return {"status": "success", "message": f"Camera {camera_id} removed successfully."}
