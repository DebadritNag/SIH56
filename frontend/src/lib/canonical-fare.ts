import type { FareObservation } from '@/types';

export function windowDescription(bucket?: string | null, days?: number | null): string {
  const exact = days == null ? 'Actual lead days unavailable' : `${days} actual lead days`;
  return bucket ? `${bucket} bucket · ${exact}` : exact;
}

export function mapLiveFare(f: Record<string, any>): FareObservation {
  const audit = f.audit ?? null;
  const prediction = typeof f.fareguard_prediction === 'number' && Number.isFinite(f.fareguard_prediction) && f.fareguard_prediction > 0 ? f.fareguard_prediction : null;
  const classification = f.priceguard_status === 'SCORED' ? f.anomaly_status ?? 'NOT_SCORED' : 'NOT_SCORED';
  return {
    id: String(f.id), collected_at: f.collected_at ?? '—',
    route: `${f.origin_code ?? f.origin} → ${f.destination_code ?? f.destination}`,
    departure_date: f.departure_date ?? (f.departure_at ? new Date(f.departure_at).toLocaleDateString('en-GB', {timeZone:'Asia/Kolkata'}) : '—'),
    booking_window: f.booking_window_bucket ?? 'Unknown bucket', actual_lead_days: f.actual_lead_days ?? null,
    airline: f.airline_code ?? f.airline, flight_number: f.flight_number ?? '—',
    source: f.source_provider ?? f.source_display_name ?? f.source_name ?? 'Unknown Source',
    base_fare: Number(f.base_fare ?? 0), taxes: Number(f.taxes ?? 0), fees: Number(f.mandatory_fees ?? 0), total_fare: Number(f.total_fare),
    validation_status: f.validation_status, anomaly_status: classification, origin_type: f.data_origin,
    audit,
    provenance: {
      collection_run_id: f.collection_run_id ?? '—', response_hash: f.payload_sha256 ?? 'Not recorded',
      collector_version: f.collector_version ?? 'Not recorded', parser_version: f.parser_version ?? 'Not recorded',
      fareguard_prediction: prediction, priceguard_score: f.priceguard_status === 'SCORED' ? f.priceguard_score ?? null : null,
      index_eligible: audit?.index_eligibility?.eligible ?? false, pipeline_steps: [],
    },
  };
}
