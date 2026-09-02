from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.pagination import PaginatedResponse, PaginationMeta, PaginationParams
from app.core.security import require_analyst, require_viewer, UserContext
from app.db.repositories.fares import FareRepository
from app.db.session import get_db
from app.schemas.common import APIResponse
from app.schemas.fare import FareFilterParams, ValidatedFareResponse
from app.services.provenance_service import ProvenanceService

router = APIRouter(prefix="/fares", tags=["Fares"])


@router.get("", response_model=PaginatedResponse[ValidatedFareResponse])
async def list_fares(
    origin: Optional[str] = Query(None, description="Origin IATA code, e.g. DEL"),
    destination: Optional[str] = Query(None, description="Destination IATA code, e.g. BOM"),
    airline: Optional[str] = Query(None, description="Airline code, e.g. 6E"),
    booking_window: Optional[int] = Query(None),
    validation_status: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    repo = FareRepository(db)
    filters = FareFilterParams(
        origin=origin,
        destination=destination,
        airline=airline,
        booking_window=booking_window,
        validation_status=validation_status,
    )
    items, total = await repo.list_validated_fares(
        filters=filters, limit=pagination.page_size, offset=pagination.offset
    )
    total_pages = (total + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        success=True,
        data=[ValidatedFareResponse.model_validate(item) for item in items],
        meta=PaginationMeta(
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/{fare_id}", response_model=APIResponse)
async def get_fare_provenance(
    fare_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_viewer),
):
    """Returns complete cryptographic and transformation lineage for an observed fare:
    Raw Source -> Normalization -> Validation -> Features -> ML FareGuard -> PriceGuard Anomaly -> SHAP -> Index."""
    prov_service = ProvenanceService(db)
    prov = await prov_service.get_fare_provenance(fare_id)
    return APIResponse(success=True, data=prov)
