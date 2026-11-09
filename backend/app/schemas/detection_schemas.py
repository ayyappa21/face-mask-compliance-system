from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class BoundingBox(BaseModel):
    x: int = Field(..., description="Top-left X coordinate")
    y: int = Field(..., description="Top-left Y coordinate")
    width: int = Field(..., description="Bounding box width")
    height: int = Field(..., description="Bounding box height")

class FaceDetectionResult(BaseModel):
    box: BoundingBox
    label: str = Field(..., description="Mask, No Mask, or Incorrect Mask")
    confidence: float = Field(..., description="Classification confidence [0.0 - 1.0]")
    color: str = Field(..., description="Hex color: #10B981, #EF4444, or #F59E0B")

class FrameDimensions(BaseModel):
    width: int
    height: int

class FrameDetectionResponse(BaseModel):
    timestamp: str
    camera_id: Optional[str] = "webcam"
    total_faces: int
    mask_count: int
    no_mask_count: int
    incorrect_mask_count: int
    compliance_percentage: float
    detections: List[FaceDetectionResult]
    frame_dims: Optional[FrameDimensions] = None
    annotated_image: Optional[str] = None  # Base64 data URI if requested

class StreamFrameRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded JPEG/PNG frame or data URI")
    camera_id: Optional[str] = Field("webcam", description="Identifier of the streaming camera")
    save_to_db: Optional[bool] = Field(False, description="Whether to persist telemetry in database")
    return_annotated: Optional[bool] = Field(False, description="Whether to render and return HUD annotated JPEG")

