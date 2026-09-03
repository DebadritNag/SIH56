import pytest
from datetime import date
from app.schemas.runs import SearchRequest
from app.collectors.synthetic_collector import SyntheticCollector
from app.collectors.replay_collector import ReplayCollector
from app.collectors.government.mospi_esankhyiki import MospiESankhyikiAdapter
from app.collectors.government.dgca import DgcaAdapter


@pytest.mark.asyncio
async def test_synthetic_collector_structure_and_pricing():
    collector = SyntheticCollector()
    req = SearchRequest(
        origin="DEL",
        destination="BOM",
        departure_date=date(2026, 10, 15),
        booking_window_days=7,
    )
    quotes = await collector.collect(req)
    assert len(quotes) > 0
    # Must contain 2026 Indian fleet codes
    carriers = {q["carrier"] for q in quotes}
    assert "6E" in carriers
    assert "AI" in carriers
    for q in quotes:
        assert q["base_price"] > 0
        assert q["tax_amount"] >= 0
        assert q["gross_total"] == round(q["base_price"] + q["tax_amount"] + q["mandatory_fees"], 2)


@pytest.mark.asyncio
async def test_replay_collector_deterministic_output():
    collector = ReplayCollector()
    req = SearchRequest(
        origin="BLR",
        destination="DEL",
        departure_date=date(2026, 9, 20),
        booking_window_days=15,
    )
    quotes = await collector.collect(req)
    assert len(quotes) == 3
    parsed = collector.parse(quotes[0])
    assert parsed["src"] == "BLR"
    assert parsed["dst"] == "DEL"


@pytest.mark.asyncio
async def test_mospi_esankhyiki_adapter():
    adapter = MospiESankhyikiAdapter()
    datasets = await adapter.discover_datasets()
    assert len(datasets) >= 2
    assert any("CPI" in d["dataset_name"] for d in datasets)

    ds_payload = adapter.fetch_fixture()
    assert "checksum" in ds_payload
    assert len(ds_payload["checksum"]) == 64
    assert adapter.validate_dataset(ds_payload["raw_bytes"]) is True


@pytest.mark.asyncio
async def test_dgca_adapter():
    adapter = DgcaAdapter()
    ds_payload = await adapter.fetch_dataset("DGCA_CITY_PAIR_TRAFFIC_2026")
    assert "traffic_data" in ds_payload["data"]
    shares_sum = sum(item["traffic_share"] for item in ds_payload["data"]["traffic_data"])
    assert 0.8 <= shares_sum <= 1.2
    assert adapter.validate_dataset(ds_payload["data"]) is True
