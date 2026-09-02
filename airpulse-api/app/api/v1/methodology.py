from fastapi import APIRouter, Depends
from app.core.security import require_viewer, UserContext
from app.schemas.common import APIResponse
from app.services.methodology_service import MethodologyService

router = APIRouter(prefix="/methodology", tags=["Methodology"])


@router.get("/current", response_model=APIResponse)
async def get_current_methodology(
    current_user: UserContext = Depends(require_viewer),
):
    """Exposes official transparent methodology documentation for MoSPI / RBI auditability."""
    data = MethodologyService.get_current_methodology()
    return APIResponse(success=True, data=data)
