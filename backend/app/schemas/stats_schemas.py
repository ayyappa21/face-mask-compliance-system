from typing import List, Optional
from pydantic import BaseModel

class SummaryStatistics(BaseModel):
    total_people_detected: int
    mask_compliant_count: int
    no_mask_count: int
    incorrect_mask_count: int
    overall_compliance_percentage: float
    total_violations_recorded: int
    active_cameras_count: int
    live_status: str

class TrendDataPoint(BaseModel):
    time_label: str
    mask: int
    no_mask: int
    incorrect: int
    compliance: float

class CategoryBreakdown(BaseModel):
    name: str
    value: int
    color: str

class AnalyticsOverview(BaseModel):
    summary: SummaryStatistics
    trends: List[TrendDataPoint]
    category_distribution: List[CategoryBreakdown]
