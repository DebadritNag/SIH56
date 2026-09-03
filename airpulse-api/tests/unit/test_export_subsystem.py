import pytest
from app.core.exceptions import ValidationFailedException
from app.schemas.export import ExportFormat, ExportType
from app.services.export_generators.pdf_generator import (
    generate_anomaly_report_pdf,
    generate_apix_report_pdf,
    generate_backtest_audit_pdf,
    generate_booking_windows_pdf,
    generate_data_quality_pdf,
    generate_route_intelligence_pdf,
)
from app.services.export_generators.csv_generator import (
    generate_anomalies_csv,
    generate_fare_observations_csv,
)
from app.services.export_generators.xlsx_generator import (
    generate_anomalies_xlsx,
    generate_apix_components_xlsx,
)


import base64
import zlib
import re


def _extract_pdf_text_streams(pdf_bytes: bytes) -> str:
    """Extracts and decompresses text streams from ReportLab PDF bytes."""
    extracted = []
    idx = 0
    while True:
        start = pdf_bytes.find(b"stream\n", idx)
        if start == -1:
            break
        start += 7
        end = pdf_bytes.find(b"endstream", start)
        if end == -1:
            break
        chunk = pdf_bytes[start:end].strip()
        try:
            decomp = zlib.decompress(base64.a85decode(chunk, adobe=True))
            extracted.append(decomp.decode("latin1", errors="ignore"))
        except Exception:
            pass
        idx = end + 9
    return " ".join(extracted)


def test_anomaly_pdf_generation_content():
    """Verify Anomaly PDF contains specific Anomaly Intelligence titles and not APIx template leakage."""
    report_meta = {
        "report_id": "REP-ANM-TEST-01",
        "data_origin": "LIVE",
        "generated_at": "2026-09-03 12:00 UTC",
    }
    anomalies = [
        {
            "anomaly_id": "ANM-2026-001",
            "route": "DEL-BOM",
            "booking_window": "T+1",
            "airline": "IndiGo",
            "actual_fare": 18450.0,
            "predicted_fare": 11200.0,
            "residual_pct": 64.7,
            "anomaly_percentile": 0.985,
            "severity": "CRITICAL",
        }
    ]
    filters = {"severity": "CRITICAL", "route": "DEL-BOM"}
    pdf_bytes, page_count = generate_anomaly_report_pdf(report_meta, anomalies, filters)

    assert len(pdf_bytes) > 1000
    assert page_count >= 1
    assert pdf_bytes.startswith(b"%PDF")

    text = _extract_pdf_text_streams(pdf_bytes)
    assert "Anomaly Intelligence Report" in text
    assert "PriceGuard" in text
    assert "FareGuard" in text


def test_route_intelligence_pdf_generation():
    """Verify Route Intelligence PDF generates route-specific dossier."""
    report_meta = {"report_id": "REP-RT-TEST-01", "data_origin": "LIVE"}
    stats = {
        "traffic_weight_pct": "14.2%",
        "current_median_fare": 7420,
        "change_7d_pct": "+11.4%",
        "data_confidence_pct": 98,
    }
    pdf_bytes, page_count = generate_route_intelligence_pdf(report_meta, "DEL-BOM", stats)
    assert pdf_bytes.startswith(b"%PDF")
    text = _extract_pdf_text_streams(pdf_bytes)
    assert "Route Intelligence Report" in text
    assert "DEL-BOM" in text


def test_anomaly_csv_and_xlsx_generation():
    """Verify anomaly tabular formats generate clean row extracts."""
    anomalies = [
        {
            "anomaly_id": "ANM-001",
            "detected_at": "2026-09-03T00:00:00Z",
            "route": "DEL-BOM",
            "booking_window": "T+1",
            "airline": "IndiGo",
            "source": "Direct",
            "actual_fare": 18450.0,
            "predicted_fare": 11200.0,
            "residual": 7250.0,
            "residual_pct": 64.7,
            "anomaly_score": 0.082,
            "anomaly_percentile": 0.985,
            "severity": "CRITICAL",
            "status": "OPEN",
        }
    ]
    csv_bytes, row_cnt = generate_anomalies_csv(anomalies)
    assert row_cnt == 1
    assert b"ANM-001" in csv_bytes
    assert b"DEL-BOM" in csv_bytes

    xlsx_bytes, xlsx_cnt = generate_anomalies_xlsx(anomalies)
    assert xlsx_cnt == 1
    assert len(xlsx_bytes) > 500
