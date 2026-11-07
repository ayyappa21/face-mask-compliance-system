from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.database_models import ViolationRecord

router = APIRouter(prefix="/violations", tags=["Violations"])

@router.get("")
def list_violations(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    category: Optional[str] = Query(None, description="Filter by category ('No Mask' or 'Incorrect Mask')"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns non-compliance incident logs with search, filtering, and pagination.
    """
    query = db.query(ViolationRecord)

    if camera_id:
        query = query.filter(ViolationRecord.camera_id == camera_id)
    if category:
        query = query.filter(ViolationRecord.detection_category.ilike(f"%{category}%"))

    total = query.count()
    records = query.order_by(ViolationRecord.timestamp.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [r.to_dict() for r in records]
    }
