from fastapi import APIRouter
from app.services.hardware_service import get_complete_system_status

router = APIRouter(prefix="/api/hardware", tags=["Hardware"])

@router.get("/status")
def hardware_status():
    """Return live system hardware diagnostic: CPU, RAM, GPU/CUDA, Disk space, and Tool status."""
    return get_complete_system_status()
