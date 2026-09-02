"""One-off real ingestion of the SIH-provided MoSPI CPI Annexure-IV Excel file.

Parses the official All-India Combined CPI (General) monthly index + inflation,
computes SHA-256, uploads the original immutable file to the reference-datasets
bucket, and writes reference_datasets + reference_dataset_versions + benchmark_fares.

Truthful: only real values from the official file are stored. No fabrication.
Run:  python -m scripts.ingest_mospi_annexure "<path-to-xlsx>"
"""
from __future__ import annotations

import asyncio
import calendar
import hashlib
import sys
from datetime import date, datetime, timezone
from uuid import uuid4

import openpyxl
from sqlalchemy import select

from app.db.models import (
    BenchmarkFare,
    ReferenceDataset,
    ReferenceDatasetVersion,
    ReferenceSyncRun,
    Source,
)
from app.db.session import AsyncSessionLocal
from app.services.storage_service import REFERENCE_DATASETS, get_storage_service

DATASET_NAME = "MoSPI CPI (General) — All-India Combined Index & Inflation"
DATASET_CODE = "MOSPI_CPI_GENERAL_ANNEXURE_IV"
EXTERNAL_ID = "cpi-press-release-annexure-iv"
SOURCE_NAME = "mospi_esankhyiki"
SOURCE_URL = "https://esankhyiki.mospi.gov.in"

_MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_abbr) if m}


def _parse_month(cell) -> date | None:
    if isinstance(cell, datetime):
        return cell.date().replace(day=1)
    if isinstance(cell, date):
        return cell.replace(day=1)
    if isinstance(cell, str):
        s = cell.strip().rstrip("*").strip()  # e.g. "Jul-26*"
        parts = s.split("-")
        if len(parts) == 2 and parts[0].lower() in _MONTHS:
            mon = _MONTHS[parts[0].lower()]
            yr = int(parts[1])
            yr += 2000 if yr < 100 else 0
            return date(yr, mon, 1)
    return None


def _month_end(d: date) -> date:
    last = calendar.monthrange(d.year, d.month)[1]
    return date(d.year, d.month, last)


def parse_rows(path: str):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Annexure IV"]
    rows = []
    for row in ws.iter_rows(values_only=True):
        d = _parse_month(row[0])
        if not d:
            continue
        # cols: Month, Rural, Urban, Combined, InflR, InflU, InflC
        combined_idx = row[3]
        combined_infl = row[6]
        if combined_idx is None:
            continue
        rows.append({
            "period": d,
            "period_label": d.strftime("%b-%Y"),
            "index_rural": row[1],
            "index_urban": row[2],
            "index_combined": float(combined_idx),
            "inflation_combined": float(combined_infl) if combined_infl not in (None, "") else None,
        })
    return rows


async def main(path: str):
    with open(path, "rb") as f:
        raw = f.read()
    checksum = hashlib.sha256(raw).hexdigest()
    rows = parse_rows(path)
    if not rows:
        print("No rows parsed — aborting."); return

    periods = [r["period"] for r in rows]
    p_start, p_end = min(periods), max(periods)
    schema_fingerprint = hashlib.sha256(
        ",".join(["month", "rural", "urban", "combined", "infl_r", "infl_u", "infl_c"]).encode()
    ).hexdigest()[:32]
    version_label = f"{p_end.strftime('%Y-%m')}"  # latest reference month

    storage = get_storage_service()
    async with AsyncSessionLocal() as db:
        src = (await db.execute(select(Source).where(Source.name == SOURCE_NAME))).scalars().first()
        if not src:
            print("MoSPI source not seeded — run migration airpulse_19 first."); return

        run = ReferenceSyncRun(
            official_source_id=src.id, trigger_type="manual", status="RUNNING",
            datasets_discovered=1, datasets_checked=1,
        )
        db.add(run); await db.flush()

        ds = (await db.execute(
            select(ReferenceDataset).where(ReferenceDataset.dataset_code == DATASET_CODE)
        )).scalars().first()

        # change detection against current version checksum
        existing_ver = None
        if ds and ds.current_version_id:
            existing_ver = (await db.execute(
                select(ReferenceDatasetVersion).where(ReferenceDatasetVersion.id == ds.current_version_id)
            )).scalars().first()
        if existing_ver and existing_ver.checksum_sha256 == checksum:
            run.status = "COMPLETED"; run.datasets_unchanged = 1; run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            print(f"UNCHANGED — checksum matches current version {existing_ver.version_label}"); return

        storage_path = f"mospi-esankhyiki/{EXTERNAL_ID}/{version_label}/original.xlsx"
        try:
            await storage.upload(
                REFERENCE_DATASETS, storage_path, raw,
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            uploaded = True
        except Exception as exc:  # storage optional; provenance still recorded
            print(f"WARN storage upload failed ({exc}); continuing with metadata only")
            uploaded = False

        if not ds:
            ds = ReferenceDataset(
                id=uuid4(), source_id=src.id, dataset_name=DATASET_NAME, dataset_code=DATASET_CODE,
                external_dataset_id=EXTERNAL_ID, dataset_version=version_label,
                reference_period_start=p_start, reference_period_end=p_end,
                retrieved_at=datetime.now(timezone.utc), source_url=SOURCE_URL,
                landing_page_url=SOURCE_URL, product_name="Consumer Price Index",
                dataset_type="CPI", frequency="monthly", relevance="HIGH",
                checksum=checksum, storage_bucket=REFERENCE_DATASETS,
                storage_path=storage_path if uploaded else None, file_format="xlsx",
                status="SYNCED", row_count=len(rows), column_count=7,
                schema_fingerprint=schema_fingerprint,
                dataset_metadata={
                    "organization": "Ministry of Statistics and Programme Implementation",
                    "series": "All-India Combined CPI (General)",
                    "base_year": "2012=100",
                    "note": "Official CPI press-release Annexure-IV; provisional latest month.",
                    "ingested_from": "SIH-provided Excel file",
                },
            )
            db.add(ds)
        else:
            ds.dataset_version = version_label; ds.reference_period_end = p_end
            ds.checksum = checksum; ds.status = "UPDATED"; ds.row_count = len(rows)
            ds.storage_path = storage_path if uploaded else ds.storage_path
            ds.retrieved_at = datetime.now(timezone.utc)
        await db.flush()

        seq = 1
        if ds.current_version_id:
            prev = (await db.execute(
                select(ReferenceDatasetVersion).where(ReferenceDatasetVersion.reference_dataset_id == ds.id)
            )).scalars().all()
            seq = len(list(prev)) + 1

        ver = ReferenceDatasetVersion(
            id=uuid4(), reference_dataset_id=ds.id, version_label=version_label, version_sequence=seq,
            reference_period=f"{p_start.strftime('%b-%Y')} to {p_end.strftime('%b-%Y')}",
            source_url=SOURCE_URL, retrieved_at=datetime.now(timezone.utc),
            checksum_sha256=checksum, file_size_bytes=len(raw), row_count=len(rows), column_count=7,
            schema_fingerprint=schema_fingerprint, storage_bucket=REFERENCE_DATASETS,
            storage_path=storage_path if uploaded else None, file_format="xlsx", status="SYNCED",
            version_metadata={"months": len(rows), "latest": p_end.isoformat()},
        )
        db.add(ver); await db.flush()
        ds.current_version_id = ver.id

        # Replace benchmark rows for this dataset (immutable version keeps history)
        for r in rows:
            db.add(BenchmarkFare(
                id=uuid4(), reference_dataset_id=ds.id, route_id=None,
                period_start=r["period"], period_end=_month_end(r["period"]),
                benchmark_type="mospi_cpi_general", value=r["index_combined"],
                unit="Index Point (2012=100)",
                benchmark_metadata={
                    "period_label": r["period_label"],
                    "index_rural": r["index_rural"], "index_urban": r["index_urban"],
                    "index_combined": r["index_combined"],
                    "inflation_yoy_combined_pct": r["inflation_combined"],
                    "version_id": str(ver.id),
                },
            ))

        run.status = "COMPLETED"; run.reference_dataset_id = ds.id
        run.datasets_downloaded = 1; run.datasets_updated = 1
        run.bytes_downloaded = len(raw); run.finished_at = datetime.now(timezone.utc)
        await db.commit()

        print(f"SYNCED dataset={ds.id} version={ver.id} label={version_label} "
              f"rows={len(rows)} checksum={checksum[:16]}… storage={'yes' if uploaded else 'no'}")


if __name__ == "__main__":
    p = sys.argv[1] if len(sys.argv) > 1 else r"d:\New projects\SIH56\Annexures_for_Press_Release_in_Excel_July2026_Annex-IV.xlsx"
    asyncio.run(main(p))
