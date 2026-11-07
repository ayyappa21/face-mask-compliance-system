from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime

from app.database.session import get_db
from app.models.database_models import DetectionRecord, ViolationRecord, CameraRecord
from app.schemas.stats_schemas import SummaryStatistics, TrendDataPoint, CategoryBreakdown, AnalyticsOverview

router = APIRouter(prefix="/statistics", tags=["Statistics"])

@router.get("", response_model=AnalyticsOverview)
def get_statistics(db: Session = Depends(get_db)):
    """
    Returns comprehensive compliance analytics, counts, category distributions,
    and temporal trends for charts and dashboards.
    """
    # Totals
    agg = db.query(
        func.coalesce(func.sum(DetectionRecord.total_faces), 0).label("total_faces"),
        func.coalesce(func.sum(DetectionRecord.mask_count), 0).label("mask_count"),
        func.coalesce(func.sum(DetectionRecord.no_mask_count), 0).label("no_mask_count"),
        func.coalesce(func.sum(DetectionRecord.incorrect_mask_count), 0).label("incorrect_mask_count")
    ).first()

    total_faces = int(agg.total_faces or 0)
    total_mask = int(agg.mask_count or 0)
    total_no_mask = int(agg.no_mask_count or 0)
    total_incorrect = int(agg.incorrect_mask_count or 0)

    compliance_pct = (total_mask / total_faces * 100.0) if total_faces > 0 else 100.0

    violations_count = db.query(ViolationRecord).count()
    active_cameras = db.query(CameraRecord).filter(CameraRecord.camera_status == "online").count()

    summary = SummaryStatistics(
        total_people_detected=total_faces,
        mask_compliant_count=total_mask,
        no_mask_count=total_no_mask,
        incorrect_mask_count=total_incorrect,
        overall_compliance_percentage=round(compliance_pct, 2),
        total_violations_recorded=violations_count,
        active_cameras_count=active_cameras,
        live_status="Operational"
    )

    # Category breakdown for donut/pie chart
    categories = [
        CategoryBreakdown(name="Mask Compliant", value=total_mask, color="#10B981"),
        CategoryBreakdown(name="No Mask", value=total_no_mask, color="#EF4444"),
        CategoryBreakdown(name="Incorrect Mask", value=total_incorrect, color="#F59E0B")
    ]

    # Temporal Trend Data (last 12 records or grouped by timestamp)
    recent_records = (
        db.query(DetectionRecord)
        .order_by(DetectionRecord.timestamp.desc())
        .limit(14)
        .all()
    )
    # Reverse to chronological order
    recent_records = list(reversed(recent_records))

    trends: list[TrendDataPoint] = []
    for rec in recent_records:
        time_str = rec.timestamp.strftime("%H:%M") if rec.timestamp else "N/A"
        trends.append(
            TrendDataPoint(
                time_label=time_str,
                mask=rec.mask_count,
                no_mask=rec.no_mask_count,
                incorrect=rec.incorrect_mask_count,
                compliance=round(rec.compliance_percentage, 1)
            )
        )

    return AnalyticsOverview(
        summary=summary,
        trends=trends,
        category_distribution=categories
    )
