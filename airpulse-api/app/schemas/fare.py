from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    booking_window_bucket: Optional[str] = None
    actual_lead_days: Optional[int] = None
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
    fareguard_prediction: Optional[float] = None
    priceguard_score: Optional[float] = None
    anomaly_status: Optional[str] = "NORMAL"
    # Source identity — resolved from the sources table join so the frontend
    # does not have to hardcode a label.  None when source is not registered.
    source_name: Optional[str] = None          # e.g. "HappyFares", "Goibibo"
    source_display_name: Optional[str] = None  # e.g. "HappyFares (prototype)"
    acquisition_method: Optional[str] = None   # e.g. "CRAWL4AI", "HTTP", "CSV_IMPORT"

    @model_validator(mode='before')
    @classmethod
    def _pull_source_attrs(cls, data: Any) -> Any:
        """When populating from an ORM object that has the repo-attached
        _source_name / _source_display_name / _acquisition_method attributes,
        pull them into the data dict so Pydantic picks them up as top-level fields.

        For plain dict inputs (tests, JSON deserialization) this is a no-op.
        """
        if not hasattr(data, '_source_name'):
            # Dict / mapping path — nothing to do, Pydantic handles normally
            return data

        # ORM object path: the model_validator receives the ORM instance before
        # Pydantic maps fields.  We return a plain dict that uses the *alias*
        # names expected by the schema (e.g. 'airline_code' from alias 'airline').
        obj = data
        # Build a flat dict keyed by the Python field name.
        # For aliased fields we must read the ORM attribute name, not the alias.
        alias_map: dict[str, str] = {}
        for fname, finfo in cls.model_fields.items():
            alias = finfo.validation_alias
            if isinstance(alias, str):
                alias_map[fname] = alias  # fname -> orm_attr_name

        d: dict[str, Any] = {}
        for fname in cls.model_fields:
            orm_attr = alias_map.get(fname, fname)
            try:
                d[fname] = getattr(obj, orm_attr, None)
            except Exception:
                d[fname] = None

        # Override with the private repo-attached source attributes
        d['source_name'] = getattr(obj, '_source_name', None)
        d['source_display_name'] = getattr(obj, '_source_display_name', None)
        d['acquisition_method'] = getattr(obj, '_acquisition_method', None)
        return d


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
