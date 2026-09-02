"""
Create the 5 private AirPulse Storage buckets via the Supabase Storage API.

On the hosted project these buckets are already created by migration
``airpulse_12_storage_buckets``. This script is for provisioning a fresh Supabase
project or re-creating buckets. It uses the SERVICE ROLE key (backend-only).

Buckets (all PRIVATE):
  raw-responses, imported-datasets, reference-datasets, backtest-reports, model-artifacts

Run:
    python scripts/setup_storage_buckets.py
"""
from __future__ import annotations

import httpx

from app.config import settings
from app.services.storage_service import ALL_BUCKETS


def create_buckets() -> None:
    base = settings.SUPABASE_URL.rstrip("/")
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not key or "placeholder" in key or "CHANGE_ME" in key:
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY is not configured. Set it in .env (backend-only).")

    headers = {"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"}
    with httpx.Client(timeout=30.0) as client:
        for bucket in ALL_BUCKETS:
            resp = client.post(
                f"{base}/storage/v1/bucket",
                headers=headers,
                json={"id": bucket, "name": bucket, "public": False},
            )
            if resp.status_code in (200, 201):
                print(f"created bucket: {bucket} (private)")
            elif resp.status_code == 409 or "already exists" in resp.text.lower():
                print(f"bucket exists: {bucket}")
            else:
                print(f"bucket {bucket}: HTTP {resp.status_code} {resp.text}")


if __name__ == "__main__":
    create_buckets()
