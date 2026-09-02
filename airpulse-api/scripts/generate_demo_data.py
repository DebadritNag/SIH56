import asyncio
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.db.models import (
    Base,
    CollectionRun,
    FareFeature,
    FareIndexEligibility,
    PipelineRun,
    RawFare,
    Route,
    Source,
    ValidatedFare,
)
from app.db.session import AsyncSessionLocal, engine
from app.core.utils import compute_payload_hash, utc_now
from app.services.fare_parser import FareParser
from app.services.fare_normalizer import FareNormalizer
from app.services.fare_validator import FareValidator
from app.services.fare_deduplicator import FareDeduplicator
from app.services.eligibility_service import EligibilityService
from app.ml.features import FeatureBuilder


async def generate_demo_dataset():
    """Generates 45 days of realistic domestic airfare data across 20 routes, 4 sources, and 5 booking windows."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Load routes and sources
        routes = list((await session.execute(select(Route))).scalars().all())
        sources = list((await session.execute(select(Source))).scalars().all())

        if not routes or not sources:
            print("Please run scripts/seed_airports_routes.py and scripts/seed_sources.py first!")
            return

        pipeline = PipelineRun(
            id=uuid4(),
            pipeline_type="demo_data_generation",
            started_at=utc_now(),
            status="running",
            version="1.0.0",
        )
        session.add(pipeline)
        await session.flush()

        today = date.today()
        start_date = today - timedelta(days=45)
        booking_windows = [1, 7, 15, 30, 45]
        airlines = ["6E", "AI", "IX", "QP", "SG"]

        quote_hash_map = {}
        total_raw = 0
        total_valid = 0

        print(f"Generating 45 days of synthetic data ({start_date} to {today})...")

        for day_offset in range(46):
            current_date = start_date + timedelta(days=day_offset)
            is_weekend = current_date.weekday() in [4, 5, 6]
            is_festival = day_offset in [15, 32]  # Diwali / Festive peaks

            # Subsample routes each day for realism
            daily_routes = random.sample(routes, min(12, len(routes)))

            for route in daily_routes:
                for window in booking_windows:
                    dep_date = current_date + timedelta(days=window)
                    src = random.choice(sources)

                    col_run = CollectionRun(
                        id=uuid4(),
                        source_id=src.id,
                        origin=route.origin_code,
                        destination=route.destination_code,
                        departure_date=dep_date,
                        booking_window=window,
                        started_at=datetime.combine(current_date, datetime.min.time(), tzinfo=timezone.utc),
                        status="completed",
                    )
                    session.add(col_run)

                    # Generate 2-3 quotes per carrier
                    for carrier in random.sample(airlines, 3):
                        flight_num = f"{carrier}-{random.randint(201, 899)}"
                        dep_dt = datetime(dep_date.year, dep_date.month, dep_date.day, random.randint(6, 21), 0, tzinfo=timezone.utc)
                        
                        # Price modeling
                        base_fare_est = (route.distance_km * 3.8) + 1200.0
                        lead_multiplier = 1.65 if window <= 1 else (1.25 if window <= 7 else (1.0 if window <= 15 else 0.85))
                        weekend_mult = 1.10 if is_weekend else 1.0
                        fest_mult = 1.35 if is_festival else 1.0

                        # Occasional price shock simulation (1% chance)
                        shock_mult = 1.60 if random.random() < 0.01 else 1.0

                        calculated_base = round(base_fare_est * lead_multiplier * weekend_mult * fest_mult * shock_mult + random.uniform(-180, 220), 2)
                        taxes = round(calculated_base * 0.12, 2)
                        fees = 450.0
                        total = calculated_base + taxes + fees

                        raw_dict = {
                            "source": src.name,
                            "carrier": carrier,
                            "flight_no": flight_num,
                            "src": route.origin_code,
                            "dst": route.destination_code,
                            "departure_iso": dep_dt.isoformat(),
                            "booking_window": window,
                            "base_price": calculated_base,
                            "tax_amount": taxes,
                            "mandatory_fees": fees,
                            "gross_total": total,
                        }

                        raw_id = uuid4()
                        raw_record = RawFare(
                            id=raw_id,
                            collection_run_id=col_run.id,
                            source_id=src.id,
                            route_id=route.id,
                            search_origin=route.origin_code,
                            search_destination=route.destination_code,
                            search_departure_date=dep_date,
                            collected_at=datetime.combine(current_date, datetime.min.time(), tzinfo=timezone.utc),
                            request_id=uuid4(),
                            raw_payload=raw_dict,
                            response_hash=compute_payload_hash(raw_dict),
                            http_status=200,
                        )
                        session.add(raw_record)
                        total_raw += 1

                        # Discrete Pipeline: Parse -> Normalize -> Validate -> Deduplicate
                        parsed = FareParser.parse_record(raw_id, src.id, raw_dict)
                        norm = FareNormalizer.normalize(parsed, route.id)
                        val_status, val_errors = FareValidator.validate(norm)

                        quote_hash = FareDeduplicator.generate_quote_hash(norm)
                        is_dup, dup_id = FareDeduplicator.evaluate_duplicate(quote_hash, quote_hash_map)

                        val_fare = ValidatedFare(
                            id=uuid4(),
                            raw_fare_id=raw_id,
                            source_id=src.id,
                            route_id=route.id,
                            airline_code=norm.airline_code,
                            flight_number=norm.flight_number,
                            origin_code=norm.origin_code,
                            destination_code=norm.destination_code,
                            departure_at=norm.departure_at,
                            booking_window_days=norm.booking_window_days,
                            cabin_class=norm.cabin_class,
                            refundable=norm.refundable,
                            baggage_kg=norm.baggage_kg,
                            base_fare=norm.base_fare,
                            taxes=norm.taxes,
                            fees=norm.fees,
                            total_fare=norm.total_fare,
                            currency=norm.currency,
                            normalized_total_fare=norm.normalized_total_fare,
                            validation_status=val_status.value,
                            validation_errors=val_errors,
                            duplicate_group_id=dup_id,
                            is_duplicate=is_dup,
                            quote_hash=quote_hash,
                            collected_at=norm.collected_at,
                        )
                        session.add(val_fare)
                        total_valid += 1

                        # Eligibility
                        eligible, reason = EligibilityService.evaluate_eligibility(norm, val_status, is_dup)
                        elig_rec = FareIndexEligibility(
                            id=uuid4(),
                            fare_id=val_fare.id,
                            eligible=eligible,
                            reason_code=reason.value,
                            methodology_version="apix-v1.2",
                        )
                        session.add(elig_rec)

                        # Feature Build
                        feat_dict = FeatureBuilder.build_features_for_fare(
                            fare_id=str(val_fare.id),
                            departure_dt=norm.departure_at,
                            booking_window_days=norm.booking_window_days,
                            distance_km=route.distance_km,
                            airline_code=norm.airline_code,
                            cabin_class=norm.cabin_class,
                            route_recent_median=base_fare_est,
                            is_festival=is_festival,
                        )
                        feat_rec = FareFeature(
                            id=uuid4(),
                            fare_id=val_fare.id,
                            distance_km=feat_dict["distance_km"],
                            booking_window_days=feat_dict["booking_window_days"],
                            day_of_week=feat_dict["day_of_week"],
                            is_weekend=bool(feat_dict["is_weekend"]),
                            month=feat_dict["month"],
                            season=feat_dict["season"],
                            is_festival=bool(feat_dict["is_festival"]),
                            fuel_price=feat_dict["fuel_price"],
                            synthetic_route_demand_score=feat_dict["synthetic_route_demand_score"],
                            route_recent_median=feat_dict["route_recent_median"],
                            route_recent_std=feat_dict["route_recent_std"],
                            route_recent_volatility=feat_dict["route_recent_volatility"],
                            source_reliability_score=feat_dict["source_reliability_score"],
                        )
                        session.add(feat_rec)

            if day_offset % 10 == 0:
                print(f"Processed day offset {day_offset}/45... committing batch.")
                await session.commit()

        pipeline.status = "completed"
        pipeline.records_received = total_raw
        pipeline.records_processed = total_valid
        pipeline.completed_at = utc_now()
        await session.commit()

        print(f"Successfully completed demo data generation: {total_raw} raw quotes, {total_valid} validated fares ingested.")


if __name__ == "__main__":
    asyncio.run(generate_demo_dataset())
