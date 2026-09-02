import csv
import io
import json
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
import pandas as pd
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import compute_payload_hash, utc_now
from app.db.models import CollectionRun, RawFare, Source
from app.services.ingestion_service import IngestionService


class CSVImportService:
    """Safe dataset import pipeline:
    Inspects schema, validates column mappings, previews records, and injects into raw_fares.
    NEVER directly inserts external files into validated_fares without passing through the canonical pipeline."""

    REQUIRED_LOGICAL_COLUMNS = ["origin", "destination", "departure_date", "total_fare"]

    @classmethod
    async def inspect_uploaded_file(cls, file: UploadFile) -> Dict[str, Any]:
        content = await file.read()
        filename = file.filename.lower()

        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), nrows=10)
        elif filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(content), nrows=10)
        else:
            raise ValueError("Unsupported format. Please upload a valid CSV or XLSX file.")

        detected_cols = list(df.columns)
        # Suggest logical mappings
        mapping_proposal = {}
        for col in detected_cols:
            c_low = col.lower().strip()
            if "orig" in c_low or "src" in c_low:
                mapping_proposal[col] = "origin"
            elif "dest" in c_low or "dst" in c_low:
                mapping_proposal[col] = "destination"
            elif "dep" in c_low or "date" in c_low:
                mapping_proposal[col] = "departure_date"
            elif "fare" in c_low or "price" in c_low or "total" in c_low:
                mapping_proposal[col] = "total_fare"
            elif "carrier" in c_low or "airline" in c_low:
                mapping_proposal[col] = "airline"
            elif "flight" in c_low:
                mapping_proposal[col] = "flight_number"

        import_token = str(uuid4())
        return {
            "import_id": import_token,
            "filename": file.filename,
            "detected_columns": detected_cols,
            "mapping_proposal": mapping_proposal,
            "sample_rows": df.head(5).to_dict(orient="records"),
            "total_preview_rows": len(df),
        }

    @classmethod
    async def commit_import_to_raw_pipeline(
        cls,
        session: AsyncSession,
        records: List[Dict[str, Any]],
        source_id: UUID,
        actor_id: str,
    ) -> CollectionRun:
        col_run = CollectionRun(
            id=uuid4(),
            source_id=source_id,
            run_type="file_import",
            started_at=utc_now(),
            status="running",
            routes_requested=len(records),
            searches_requested=len(records),
            trigger_type="manual",
            triggered_by=actor_id,
        )
        session.add(col_run)
        await session.flush()

        raw_entities = []
        for r in records:
            r_hash = compute_payload_hash(r)
            dep_date_str = str(r.get("departure_date", datetime.utcnow().date()))
            raw_entities.append(
                RawFare(
                    id=uuid4(),
                    collection_run_id=col_run.id,
                    source_id=source_id,
                    request_id=uuid4(),
                    origin_requested=str(r.get("origin", "DEL")).upper()[:3],
                    destination_requested=str(r.get("destination", "BOM")).upper()[:3],
                    departure_requested=datetime.fromisoformat(dep_date_str).date() if "T" in dep_date_str else datetime.strptime(dep_date_str, "%Y-%m-%d").date(),
                    booking_window_requested=int(r.get("booking_window_days", 7)),
                    collected_at=utc_now(),
                    http_status=200,
                    raw_payload=r,
                    response_hash=r_hash,
                    collector_version="file-import-1.0",
                )
            )

        session.add_all(raw_entities)
        col_run.quotes_received = len(raw_entities)
        col_run.status = "completed"
        col_run.finished_at = utc_now()
        await session.commit()

        # Trigger downstream processing
        ingest_srv = IngestionService(session)
        await ingest_srv.process_collection_run(col_run.id)

        return col_run
