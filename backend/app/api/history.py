from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.database_models import DetectionRecord

router = APIRouter(prefix="/history", tags=["History"])

@router.get("")
def list_history(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns historical detection snapshots and aggregated compliance ratios.
    """
    query = db.query(DetectionRecord)

    if camera_id:
        query = query.filter(DetectionRecord.camera_id == camera_id)

    total = query.count()
    records = query.order_by(DetectionRecord.timestamp.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [r.to_dict() for r in records]
    }
