-- Unknown fare components must stay unknown for total-only OTA observations.
ALTER TABLE public.validated_fares ALTER COLUMN base_fare DROP NOT NULL;

-- Existing operational tables already have RLS; no new exposed tables needed.
CREATE INDEX IF NOT EXISTS pipeline_runs_live_queue_idx
ON public.pipeline_runs (status, created_at)
WHERE pipeline_type IN ('live_acquisition', 'live_ingestion');
CREATE INDEX IF NOT EXISTS raw_fares_collection_live_idx
ON public.raw_fares (collection_run_id);

INSERT INTO public.sources
    (id, name, display_name, source_type, base_url, enabled, active,
     collection_method, rate_limit_per_minute, timeout_seconds, max_retries,
     supports_live_collection, requires_javascript, priority, collector_version, metadata)
VALUES
    (gen_random_uuid(), 'yatra', 'Yatra', 'OTA',
     'https://flight.yatra.com/air-search-ui/dom2/trigger', true, true,
     'SCRAPY', 6, 25, 0, true, false, 1, 'yatra-v2',
     '{"live_prototype":true,"preferred_engine":"AUTO","max_results":10,"hard_cap":15,"policy_status":"MANUAL_REVIEW_REQUIRED"}'::jsonb)
ON CONFLICT (name) DO NOTHING;
