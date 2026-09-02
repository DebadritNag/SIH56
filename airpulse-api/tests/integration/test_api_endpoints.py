import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_and_ready_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["status"] == "healthy"

        res_ready = await client.get("/ready")
        assert res_ready.status_code == 200
        assert res_ready.json()["data"]["status"] == "ready"


@pytest.mark.asyncio
async def test_dashboard_summary_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Pass mock demo token
        headers = {"Authorization": "Bearer demo-token"}
        res = await client.get("/api/v1/dashboard/summary", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "latest_index" in data["data"]
        assert "quotes_24h" in data["data"]
