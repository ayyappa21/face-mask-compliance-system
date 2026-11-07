from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class CameraCreate(BaseModel):
    id: str = Field(..., description="Unique Camera ID e.g. CAM-04")
    camera_name: str = Field(..., description="Camera Name e.g. Entrance East")
    camera_location: str = Field(..., description="Physical Location")
    camera_status: Optional[str] = "online"
    camera_source: Optional[str] = "0"

class CameraUpdate(BaseModel):
    camera_name: Optional[str] = None
    camera_location: Optional[str] = None
    camera_status: Optional[str] = None
    camera_source: Optional[str] = None

class CameraResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    camera_name: str
    camera_location: str
    camera_status: str
    camera_source: str
    created_at: str
