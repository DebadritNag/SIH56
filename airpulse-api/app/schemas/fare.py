from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import CabinClass, ValidationStatus


class SearchRequest(BaseModel):
    origin: str = Field(..., min_length=3, max_length=3, description="3-letter IATA code, e.g. DEL")
    destination: str = Field(..., min_length=3, max_length=3, description="3-letter IATA code, e.g. BOM")
    departure_date: date
    return_date: Optional[date] = None
    passengers: int = Field(1, ge=1, le=9)
    cabin_class: CabinClass = CabinClass.ECONOMY
    booking_window: int = Field(..., ge=0, le=365)


class RawFareCreate(BaseModel):
    collection_run_id: Optional[UUID] = None
    source_id: UUID
    route_id: Optional[UUID] = None
    search_origin: str
    search_destination: str
    search_departure_date: date
    search_return_date: Optional[date] = None
    request_id: UUID
    raw_payload: Dict[str, Any]
    response_hash: str
    http_status: Optional[int] = 200
    collector_version: str = "1.0.0"
    parser_version: str = "1.0.0"


class ParsedFareRecord(BaseModel):
    raw_fare_id: UUID
    source_id: UUID
    airline_code: str
    flight_number: Optional[str] = None
    origin_code: str
    destination_code: str
    departure_time_str: str
    arrival_time_str: Optional[str] = None
    cabin_class: str
    fare_class: Optional[str] = None
    refundable: Optional[bool] = False
    baggage_kg: Optional[float] = 15.0
    base_fare: Decimal
    taxes: Decimal
    fees: Decimal
    total_fare: Decimal
    currency: str = "INR"
    collected_at: datetime


class NormalizedFareRecord(BaseModel):
    raw_fare_id: UUID
    source_id: UUID
    route_id: Optional[UUID] = None
    airline_code: str
    flight_number: Optional[str] = None
    origin_code: str
    destination_code: str
    departure_at: datetime
    arrival_at: Optional[datetime] = None
    booking_window_days: int
    cabin_class: str = "economy"
    fare_class: Optional[str] = None
    refundable: Optional[bool] = False
    baggage_kg: Optional[float] = 15.0
    base_fare: Decimal
    taxes: Decimal
    fees: Decimal
    total_fare: Decimal
    currency: str = "INR"
    normalized_total_fare: Decimal
    collected_at: datetime


class ValidatedFareResponse(BaseModel):
    # Populate from ORM attributes; map live column names onto the API's field names.
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    raw_fare_id: Optional[UUID] = None
    source_id: Optional[UUID] = None
    route_id: Optional[UUID] = None
    data_origin: Optional[str] = None
    airline_code: str = Field(validation_alias="airline")
    flight_number: Optional[str] = None
    origin_code: str = Field(validation_alias="origin")
    destination_code: str = Field(validation_alias="destination")
    departure_at: datetime
    arrival_at: Optional[datetime] = None
    booking_window_days: Optional[int] = None
    cabin_class: Optional[str] = Field(default=None, validation_alias="cabin")
    fare_class: Optional[str] = None
    refundable: Optional[bool] = None
    baggage_allowance: Optional[str] = None
    base_fare: Optional[Decimal] = None
    taxes: Optional[Decimal] = None
    mandatory_fees: Optional[Decimal] = None
    total_fare: Decimal
    currency: str
    normalized_total_fare: Decimal
    validation_status: str
    validation_errors: Optional[Any] = None
    duplicate_group_id: Optional[UUID] = None
    is_duplicate: bool = False
    quote_hash: str
    collected_at: datetime
    created_at: datetime


class FareFilterParams(BaseModel):
    origin: Optional[str] = None
    destination: Optional[str] = None
    route: Optional[str] = None
    airline: Optional[str] = None
    source: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    booking_window: Optional[int] = None
    min_fare: Optional[Decimal] = None
    max_fare: Optional[Decimal] = None
    validation_status: Optional[str] = None
    anomaly_status: Optional[str] = None
