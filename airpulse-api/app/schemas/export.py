from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ExportType(str, Enum):
    FARE_OBSERVATIONS = "FARE_OBSERVATIONS"
    APIX_INDEX = "APIX_INDEX"
    APIX_COMPONENTS = "APIX_COMPONENTS"
    ROUTE_INTELLIGENCE = "ROUTE_INTELLIGENCE"
    BOOKING_WINDOW_ANALYSIS = "BOOKING_WINDOW_ANALYSIS"
    ANOMALIES = "ANOMALIES"
    PRICE_SHOCKS = "PRICE_SHOCKS"
    ALERTS = "ALERTS"
    SOURCE_HEALTH = "SOURCE_HEALTH"
    COLLECTION_RUN = "COLLECTION_RUN"
    PIPELINE_RUN = "PIPELINE_RUN"
    INGESTION_REPORT = "INGESTION_REPORT"
    DATA_QUALITY = "DATA_QUALITY"
    BACKTEST_DATA = "BACKTEST_DATA"
    BACKTEST_AUDIT_PDF = "BACKTEST_AUDIT_PDF"
    METHODOLOGY_REPORT = "METHODOLOGY_REPORT"
    PROVENANCE_REPORT = "PROVENANCE_REPORT"
    REFERENCE_DATASET = "REFERENCE_DATASET"
    BASKET_DEFINITION = "BASKET_DEFINITION"
    MODEL_REPORT = "MODEL_REPORT"
    SYSTEM_DIAGNOSTICS_REPORT = "SYSTEM_DIAGNOSTICS_REPORT"
    SYSTEM_SELF_TEST_REPORT = "SYSTEM_SELF_TEST_REPORT"
    OVERVIEW_REPORT = "OVERVIEW_REPORT"
    CHART_IMAGE = "CHART_IMAGE"


class ExportFormat(str, Enum):
    CSV = "CSV"
    XLSX = "XLSX"
    PDF = "PDF"
    PNG = "PNG"
    JSON = "JSON"
    ZIP = "ZIP"


class ExportStatus(str, Enum):
    QUEUED = "QUEUED"
    GENERATING = "GENERATING"
    UPLOADING = "UPLOADING"
    READY = "READY"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


# Allowed format mapping
ALLOWED_FORMAT_MAPPING: Dict[ExportType, List[ExportFormat]] = {
    ExportType.FARE_OBSERVATIONS: [ExportFormat.CSV, ExportFormat.XLSX, ExportFormat.JSON],
    ExportType.APIX_INDEX: [ExportFormat.CSV, ExportFormat.XLSX, ExportFormat.PDF],
    ExportType.APIX_COMPONENTS: [ExportFormat.CSV, ExportFormat.XLSX],
    ExportType.ROUTE_INTELLIGENCE: [ExportFormat.CSV, ExportFormat.XLSX, ExportFormat.PDF],
    ExportType.BOOKING_WINDOW_ANALYSIS: [ExportFormat.CSV, ExportFormat.XLSX, ExportFormat.PDF],
    ExportType.ANOMALIES: [ExportFormat.CSV, ExportFormat.XLSX, ExportFormat.PDF],
    ExportType.PRICE_SHOCKS: [ExportFormat.CSV, ExportFormat.XLSX, ExportFormat.PDF],
    ExportType.ALERTS: [ExportFormat.CSV, ExportFormat.PDF],
    ExportType.SOURCE_HEALTH: [ExportFormat.CSV, ExportFormat.XLSX, ExportFormat.PDF],
    ExportType.COLLECTION_RUN: [ExportFormat.CSV, ExportFormat.JSON],
    ExportType.PIPELINE_RUN: [ExportFormat.CSV, ExportFormat.JSON, ExportFormat.PDF],
    ExportType.INGESTION_REPORT: [ExportFormat.CSV, ExportFormat.JSON, ExportFormat.PDF],
    ExportType.DATA_QUALITY: [ExportFormat.PDF, ExportFormat.XLSX, ExportFormat.CSV],
    ExportType.BACKTEST_DATA: [ExportFormat.XLSX, ExportFormat.CSV],
    ExportType.BACKTEST_AUDIT_PDF: [ExportFormat.PDF, ExportFormat.XLSX, ExportFormat.ZIP],
    ExportType.METHODOLOGY_REPORT: [ExportFormat.PDF],
    ExportType.PROVENANCE_REPORT: [ExportFormat.PDF, ExportFormat.JSON],
    ExportType.REFERENCE_DATASET: [ExportFormat.CSV, ExportFormat.XLSX],
    ExportType.BASKET_DEFINITION: [ExportFormat.CSV, ExportFormat.XLSX],
    ExportType.MODEL_REPORT: [ExportFormat.PDF, ExportFormat.XLSX, ExportFormat.JSON],
    ExportType.SYSTEM_DIAGNOSTICS_REPORT: [ExportFormat.PDF, ExportFormat.JSON],
    ExportType.SYSTEM_SELF_TEST_REPORT: [ExportFormat.PDF, ExportFormat.JSON],
    ExportType.OVERVIEW_REPORT: [ExportFormat.PDF, ExportFormat.CSV, ExportFormat.XLSX],
    ExportType.CHART_IMAGE: [ExportFormat.PNG, ExportFormat.PDF],
}


class CreateExportRequest(BaseModel):
    export_type: ExportType
    format: ExportFormat
    title: Optional[str] = None
    description: Optional[str] = None
    filters: Dict[str, Any] = Field(default_factory=dict)
    parameters: Dict[str, Any] = Field(default_factory=dict)


class ExportJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    requested_by: Optional[str] = None
    export_type: ExportType
    export_format: ExportFormat
    title: str
    description: Optional[str] = None
    filename: str
    status: ExportStatus
    progress_percent: Optional[float] = None
    current_stage: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    parameters: Optional[Dict[str, Any]] = None
    storage_bucket: Optional[str] = None
    storage_path: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    row_count: Optional[int] = None
    page_count: Optional[int] = None
    checksum_sha256: Optional[str] = None
    data_origin: str = "LIVE"
    generated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="job_metadata")


class ExportDownloadResponse(BaseModel):
    download_url: str
    filename: str
    mime_type: str
    file_size_bytes: Optional[int] = None
    checksum_sha256: Optional[str] = None
    expires_at: Optional[datetime] = None
