-- AirPulse initial schema. Blocks are separated by the sentinel line:
--   -- >>> STATEMENT SPLIT <<<
-- Supabase-specific objects (auth.users trigger, realtime publication, RLS grants to
-- the "authenticated" role) are guarded so this file also runs on plain PostgreSQL
-- (local Docker, CI) where those objects/roles do not exist.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- >>> STATEMENT SPLIT <<<
CREATE TYPE app_role AS ENUM ('viewer', 'analyst', 'admin');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE data_origin AS ENUM ('LIVE', 'REPLAY', 'SYNTHETIC', 'IMPORTED', 'REFERENCE');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE source_type AS ENUM ('AIRLINE', 'OTA', 'GOVERNMENT_API', 'GOVERNMENT_FILE', 'REPLAY', 'SYNTHETIC');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE collection_method AS ENUM ('HTTP', 'PLAYWRIGHT', 'SCRAPY', 'API', 'FILE', 'REPLAY', 'SYNTHETIC');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE collection_run_status AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE collection_trigger_type AS ENUM ('SCHEDULED', 'MANUAL', 'REPLAY', 'SYNTHETIC', 'REFERENCE_SYNC', 'SCRAPING_TEST');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE pipeline_status AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE scraping_test_status AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'PARTIAL', 'FAILED');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE data_mode AS ENUM ('LIVE', 'REPLAY', 'SYNTHETIC');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE validation_status AS ENUM ('VALID', 'WARNING', 'REJECTED');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE anomaly_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE anomaly_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED', 'RESOLVED');
-- >>> STATEMENT SPLIT <<<
CREATE TYPE alert_status AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
-- >>> STATEMENT SPLIT <<<
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- >>> STATEMENT SPLIT <<<
-- PROFILES. On Supabase this references auth.users; on plain PostgreSQL the FK is
-- created only if the auth schema exists.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  organization text,
  role app_role NOT NULL DEFAULT 'viewer',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- >>> STATEMENT SPLIT <<<
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;
-- >>> STATEMENT SPLIT <<<
CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_active ON public.profiles (active);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- >>> STATEMENT SPLIT <<<
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
-- >>> STATEMENT SPLIT <<<
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.airports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iata_code varchar(3) UNIQUE NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  state text,
  country text NOT NULL DEFAULT 'India',
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text DEFAULT 'Asia/Kolkata',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_airports_iata_code ON public.airports (iata_code);
CREATE INDEX idx_airports_active ON public.airports (active);
CREATE TRIGGER trg_airports_updated_at BEFORE UPDATE ON public.airports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_airport_id uuid REFERENCES public.airports(id),
  destination_airport_id uuid REFERENCES public.airports(id),
  route_code text UNIQUE NOT NULL,
  market_code text,
  distance_km numeric(10,2),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ck_routes_distinct_airports CHECK (origin_airport_id <> destination_airport_id)
);
CREATE INDEX idx_routes_origin_airport ON public.routes (origin_airport_id);
CREATE INDEX idx_routes_destination_airport ON public.routes (destination_airport_id);
CREATE INDEX idx_routes_active ON public.routes (active);
CREATE INDEX idx_routes_market_code ON public.routes (market_code);
CREATE TRIGGER trg_routes_updated_at BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  source_type source_type NOT NULL,
  collection_method collection_method NOT NULL,
  base_url text,
  enabled boolean DEFAULT true,
  active boolean DEFAULT true,
  supports_live_collection boolean DEFAULT false,
  requires_javascript boolean DEFAULT false,
  rate_limit_per_minute integer,
  timeout_seconds integer DEFAULT 30,
  max_retries integer DEFAULT 3,
  priority integer DEFAULT 100,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer DEFAULT 0,
  reliability_score numeric(5,4),
  collector_version text,
  parser_version text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_sources_source_type ON public.sources (source_type);
CREATE INDEX idx_sources_enabled ON public.sources (enabled);
CREATE INDEX idx_sources_active ON public.sources (active);
CREATE TRIGGER trg_sources_updated_at BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.fare_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text,
  cabin text,
  baggage_allowance text,
  refundable boolean,
  meal_included boolean,
  seat_included boolean,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER trg_fare_products_updated_at BEFORE UPDATE ON public.fare_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.collection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id),
  run_type text,
  trigger_type collection_trigger_type,
  data_origin data_origin,
  triggered_by uuid REFERENCES public.profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  status collection_run_status DEFAULT 'QUEUED',
  routes_requested integer DEFAULT 0,
  searches_requested integer DEFAULT 0,
  requests_successful integer DEFAULT 0,
  requests_failed integer DEFAULT 0,
  quotes_received integer DEFAULT 0,
  quotes_validated integer DEFAULT 0,
  quotes_rejected integer DEFAULT 0,
  duplicates_detected integer DEFAULT 0,
  duration_ms bigint,
  collector_version text,
  parser_version text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_collection_runs_status ON public.collection_runs (status);
CREATE INDEX idx_collection_runs_source ON public.collection_runs (source_id);
CREATE INDEX idx_collection_runs_started_at ON public.collection_runs (started_at DESC);
CREATE INDEX idx_collection_runs_trigger_type ON public.collection_runs (trigger_type);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_run_id uuid REFERENCES public.collection_runs(id),
  pipeline_type text NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  status pipeline_status DEFAULT 'QUEUED',
  records_input integer DEFAULT 0,
  records_processed integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  error_summary text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_pipeline_runs_collection_run ON public.pipeline_runs (collection_run_id);
CREATE INDEX idx_pipeline_runs_status ON public.pipeline_runs (status);
CREATE INDEX idx_pipeline_runs_type ON public.pipeline_runs (pipeline_type);
CREATE INDEX idx_pipeline_runs_created_at ON public.pipeline_runs (created_at DESC);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.pipeline_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id uuid NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  step_name text NOT NULL,
  step_order integer NOT NULL,
  status pipeline_status DEFAULT 'QUEUED',
  started_at timestamptz,
  finished_at timestamptz,
  records_input integer DEFAULT 0,
  records_output integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  duration_ms bigint,
  message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_pipeline_step_name UNIQUE (pipeline_run_id, step_name)
);
CREATE INDEX idx_pipeline_steps_run ON public.pipeline_steps (pipeline_run_id);
CREATE INDEX idx_pipeline_steps_status ON public.pipeline_steps (status);
CREATE INDEX idx_pipeline_steps_order ON public.pipeline_steps (step_order);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.scraping_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id),
  origin text NOT NULL,
  destination text NOT NULL,
  departure_date date NOT NULL,
  booking_window_days integer NOT NULL,
  mode data_mode NOT NULL,
  status scraping_test_status DEFAULT 'QUEUED',
  started_at timestamptz,
  finished_at timestamptz,
  source_reachable boolean,
  request_submitted boolean DEFAULT false,
  response_received boolean DEFAULT false,
  http_status integer,
  response_size_bytes bigint,
  raw_response_saved boolean DEFAULT false,
  raw_response_hash text,
  quotes_found integer DEFAULT 0,
  quotes_parsed integer DEFAULT 0,
  quotes_normalized integer DEFAULT 0,
  quotes_validated integer DEFAULT 0,
  quotes_rejected integer DEFAULT 0,
  database_write_verified boolean DEFAULT false,
  collector_version text,
  parser_version text,
  failure_stage text,
  failure_reason text,
  triggered_by uuid REFERENCES public.profiles(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_scraping_test_runs_source ON public.scraping_test_runs (source_id);
CREATE INDEX idx_scraping_test_runs_status ON public.scraping_test_runs (status);
CREATE INDEX idx_scraping_test_runs_created_at ON public.scraping_test_runs (created_at DESC);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.raw_fares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_run_id uuid REFERENCES public.collection_runs(id),
  scraping_test_run_id uuid REFERENCES public.scraping_test_runs(id),
  source_id uuid REFERENCES public.sources(id),
  request_id uuid,
  data_origin data_origin,
  origin_requested varchar(3),
  destination_requested varchar(3),
  departure_requested date,
  booking_window_requested integer,
  collected_at timestamptz NOT NULL,
  http_status integer,
  raw_payload jsonb,
  raw_storage_path text,
  response_hash text NOT NULL,
  collector_version text,
  parser_version text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_raw_fares_collection_run ON public.raw_fares (collection_run_id);
CREATE INDEX idx_raw_fares_source ON public.raw_fares (source_id);
CREATE INDEX idx_raw_fares_collected_at ON public.raw_fares (collected_at DESC);
CREATE INDEX idx_raw_fares_origin_requested ON public.raw_fares (origin_requested);
CREATE INDEX idx_raw_fares_destination_requested ON public.raw_fares (destination_requested);
CREATE INDEX idx_raw_fares_response_hash ON public.raw_fares (response_hash);
-- >>> STATEMENT SPLIT <<<
CREATE OR REPLACE FUNCTION public.prevent_raw_fare_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.raw_payload IS DISTINCT FROM OLD.raw_payload
     OR NEW.response_hash IS DISTINCT FROM OLD.response_hash
     OR NEW.collected_at IS DISTINCT FROM OLD.collected_at
     OR NEW.source_id IS DISTINCT FROM OLD.source_id THEN
    RAISE EXCEPTION 'raw_fares records are immutable: raw_payload/response_hash/collected_at/source_id cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_raw_fares_immutable BEFORE UPDATE ON public.raw_fares FOR EACH ROW EXECUTE FUNCTION public.prevent_raw_fare_mutation();
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.validated_fares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_fare_id uuid REFERENCES public.raw_fares(id),
  collection_run_id uuid REFERENCES public.collection_runs(id),
  source_id uuid REFERENCES public.sources(id),
  route_id uuid REFERENCES public.routes(id),
  fare_product_id uuid REFERENCES public.fare_products(id),
  data_origin data_origin,
  airline text NOT NULL,
  flight_number text,
  origin varchar(3) NOT NULL,
  destination varchar(3) NOT NULL,
  departure_at timestamptz NOT NULL,
  arrival_at timestamptz,
  booking_window_days integer NOT NULL,
  cabin text DEFAULT 'Economy',
  fare_class text,
  refundable boolean,
  baggage_allowance text,
  base_fare numeric(14,2) NOT NULL,
  taxes numeric(14,2) DEFAULT 0,
  mandatory_fees numeric(14,2) DEFAULT 0,
  convenience_fee numeric(14,2),
  total_fare numeric(14,2) NOT NULL,
  normalized_total_fare numeric(14,2) NOT NULL,
  currency char(3) DEFAULT 'INR',
  validation_status validation_status NOT NULL,
  validation_errors jsonb DEFAULT '[]'::jsonb,
  duplicate_group_id uuid,
  is_duplicate boolean DEFAULT false,
  quote_hash text NOT NULL,
  collected_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ck_vf_distinct_od CHECK (origin <> destination),
  CONSTRAINT ck_vf_total_fare_pos CHECK (total_fare > 0),
  CONSTRAINT ck_vf_base_fare_nonneg CHECK (base_fare >= 0),
  CONSTRAINT ck_vf_taxes_nonneg CHECK (taxes >= 0),
  CONSTRAINT ck_vf_fees_nonneg CHECK (mandatory_fees >= 0),
  CONSTRAINT ck_vf_bw_nonneg CHECK (booking_window_days >= 0)
);
CREATE INDEX idx_vf_route_collected ON public.validated_fares (route_id, collected_at DESC);
CREATE INDEX idx_vf_source_collected ON public.validated_fares (source_id, collected_at DESC);
CREATE INDEX idx_vf_od_collected ON public.validated_fares (origin, destination, collected_at DESC);
CREATE INDEX idx_vf_booking_window ON public.validated_fares (booking_window_days, collected_at DESC);
CREATE INDEX idx_vf_validation_status ON public.validated_fares (validation_status);
CREATE INDEX idx_vf_is_duplicate ON public.validated_fares (is_duplicate);
CREATE INDEX idx_vf_quote_hash ON public.validated_fares (quote_hash);
CREATE INDEX idx_vf_departure_at ON public.validated_fares (departure_at);
CREATE INDEX idx_vf_data_origin ON public.validated_fares (data_origin);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.fare_index_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_id uuid UNIQUE REFERENCES public.validated_fares(id) ON DELETE CASCADE,
  eligible boolean NOT NULL,
  reason_code text NOT NULL,
  methodology_version text NOT NULL,
  evaluated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX idx_eligibility_eligible ON public.fare_index_eligibility (eligible);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.fare_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_id uuid UNIQUE REFERENCES public.validated_fares(id),
  route_id uuid REFERENCES public.routes(id),
  booking_window_days integer,
  day_of_week integer,
  is_weekend boolean,
  is_festival boolean,
  season text,
  distance_km numeric(10,2),
  route_recent_median numeric(14,2),
  route_recent_mean numeric(14,2),
  route_recent_std numeric(14,2),
  route_volatility numeric(10,6),
  fuel_price numeric(14,4),
  demand_proxy numeric(14,4),
  feature_version text NOT NULL,
  features jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.fare_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_id uuid REFERENCES public.validated_fares(id),
  model_id uuid,
  model_version text NOT NULL,
  predicted_fare numeric(14,2) NOT NULL,
  prediction_lower numeric(14,2),
  prediction_upper numeric(14,2),
  residual numeric(14,2),
  residual_pct numeric(12,6),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_predictions_fare ON public.fare_predictions (fare_id);
CREATE INDEX idx_predictions_model_version ON public.fare_predictions (model_version);
CREATE INDEX idx_predictions_created_at ON public.fare_predictions (created_at DESC);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_id uuid REFERENCES public.validated_fares(id),
  prediction_id uuid REFERENCES public.fare_predictions(id),
  route_id uuid REFERENCES public.routes(id),
  source_id uuid REFERENCES public.sources(id),
  anomaly_score numeric(8,6),
  anomaly_percentile numeric(8,6),
  severity anomaly_severity,
  status anomaly_status DEFAULT 'OPEN',
  anomaly_type text,
  actual_fare numeric(14,2),
  expected_fare numeric(14,2),
  residual numeric(14,2),
  residual_pct numeric(12,6),
  evidence jsonb DEFAULT '{}'::jsonb,
  detected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_anomalies_status ON public.anomalies (status);
CREATE INDEX idx_anomalies_severity ON public.anomalies (severity);
CREATE INDEX idx_anomalies_route ON public.anomalies (route_id);
CREATE INDEX idx_anomalies_detected_at ON public.anomalies (detected_at DESC);
CREATE INDEX idx_anomalies_source ON public.anomalies (source_id);
CREATE INDEX idx_anomalies_status_detected ON public.anomalies (status, detected_at DESC);
CREATE INDEX idx_anomalies_route_detected ON public.anomalies (route_id, detected_at DESC);
CREATE TRIGGER trg_anomalies_updated_at BEFORE UPDATE ON public.anomalies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.shap_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id uuid REFERENCES public.anomalies(id) ON DELETE CASCADE,
  model_version text,
  base_value numeric(14,4),
  predicted_value numeric(14,4),
  features jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_shap_anomaly ON public.shap_explanations (anomaly_id);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.anomaly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id uuid REFERENCES public.anomalies(id),
  reviewer_id uuid REFERENCES public.profiles(id),
  decision text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_anomaly_reviews_anomaly ON public.anomaly_reviews (anomaly_id);
CREATE INDEX idx_anomaly_reviews_reviewer ON public.anomaly_reviews (reviewer_id);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text,
  severity anomaly_severity,
  status alert_status DEFAULT 'OPEN',
  title text NOT NULL,
  message text NOT NULL,
  route_id uuid REFERENCES public.routes(id),
  source_id uuid REFERENCES public.sources(id),
  anomaly_id uuid REFERENCES public.anomalies(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz
);
CREATE INDEX idx_alerts_status ON public.alerts (status);
CREATE INDEX idx_alerts_severity ON public.alerts (severity);
CREATE INDEX idx_alerts_created_at ON public.alerts (created_at DESC);
CREATE INDEX idx_alerts_route ON public.alerts (route_id);
CREATE INDEX idx_alerts_source ON public.alerts (source_id);
CREATE INDEX idx_alerts_status_created ON public.alerts (status, created_at DESC);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.index_baskets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text UNIQUE NOT NULL,
  description text,
  base_period_start date,
  base_period_end date,
  active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.index_basket_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid REFERENCES public.index_baskets(id),
  route_id uuid REFERENCES public.routes(id),
  booking_window_days integer NOT NULL,
  weight numeric(14,10) NOT NULL,
  effective_from date,
  effective_to date,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT uq_basket_route_window UNIQUE (basket_id, route_id, booking_window_days)
);
CREATE INDEX idx_basket_routes_basket ON public.index_basket_routes (basket_id);
CREATE INDEX idx_basket_routes_route ON public.index_basket_routes (route_id);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.airfare_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  index_date date NOT NULL,
  index_type text DEFAULT 'NATIONAL',
  route_id uuid REFERENCES public.routes(id),
  booking_window_days integer,
  index_value numeric(14,6) NOT NULL,
  daily_change_pct numeric(12,6),
  weekly_change_pct numeric(12,6),
  monthly_change_pct numeric(12,6),
  coverage_quality_score numeric(8,6),
  route_coverage_pct numeric(8,6),
  source_coverage_pct numeric(8,6),
  freshness_score numeric(8,6),
  methodology_version text NOT NULL,
  basket_version text NOT NULL,
  calculated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX uq_airfare_index_identity ON public.airfare_index (
  index_date, index_type,
  COALESCE(route_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(booking_window_days, -1),
  methodology_version, basket_version
);
CREATE INDEX idx_airfare_index_date ON public.airfare_index (index_date DESC);
CREATE INDEX idx_airfare_index_route ON public.airfare_index (route_id);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.index_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airfare_index_id uuid REFERENCES public.airfare_index(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.routes(id),
  booking_window_days integer,
  base_price numeric(14,2),
  current_price numeric(14,2),
  price_relative numeric(14,8),
  weight numeric(14,10),
  weighted_contribution numeric(14,8),
  eligible_observations integer,
  metadata jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX idx_index_components_index ON public.index_components (airfare_index_id);
CREATE INDEX idx_index_components_route ON public.index_components (route_id);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.reference_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id),
  dataset_name text NOT NULL,
  dataset_code text,
  dataset_version text,
  data_origin data_origin DEFAULT 'REFERENCE',
  reference_period_start date,
  reference_period_end date,
  retrieved_at timestamptz DEFAULT now(),
  source_url text,
  checksum text,
  storage_path text,
  file_format text,
  status text,
  row_count bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ref_datasets_source_retrieved ON public.reference_datasets (source_id, retrieved_at DESC);
CREATE INDEX idx_ref_datasets_code ON public.reference_datasets (dataset_code);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.route_traffic_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_dataset_id uuid REFERENCES public.reference_datasets(id),
  route_id uuid REFERENCES public.routes(id),
  period_start date,
  period_end date,
  passenger_count bigint,
  traffic_share numeric(14,10),
  weight numeric(14,10),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_rtw_dataset ON public.route_traffic_weights (reference_dataset_id);
CREATE INDEX idx_rtw_route ON public.route_traffic_weights (route_id);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.benchmark_fares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_dataset_id uuid REFERENCES public.reference_datasets(id),
  route_id uuid REFERENCES public.routes(id),
  period_start date,
  period_end date,
  benchmark_type text,
  value numeric(14,4),
  unit text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_benchmark_dataset ON public.benchmark_fares (reference_dataset_id);
CREATE INDEX idx_benchmark_route ON public.benchmark_fares (route_id);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.source_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id),
  checked_at timestamptz DEFAULT now(),
  status text,
  success_rate numeric(8,6),
  failure_rate numeric(8,6),
  average_latency_ms numeric(14,2),
  empty_result_rate numeric(8,6),
  parse_error_rate numeric(8,6),
  route_coverage_pct numeric(8,6),
  freshness_minutes numeric(14,2),
  consecutive_failures integer,
  reliability_score numeric(8,6),
  metadata jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX idx_source_health_source_checked ON public.source_health_logs (source_id, checked_at DESC);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date date,
  end_date date,
  event_name text,
  event_type text,
  region text,
  impact_level integer,
  source text,
  version text,
  metadata jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX idx_calendar_events_date ON public.calendar_events (event_date);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.fuel_price_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date date UNIQUE,
  value numeric(14,4),
  unit text,
  source text,
  version text,
  created_at timestamptz DEFAULT now()
);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.model_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text,
  model_type text,
  version text,
  status text,
  trained_at timestamptz,
  training_start date,
  training_end date,
  metrics jsonb DEFAULT '{}'::jsonb,
  feature_schema jsonb DEFAULT '{}'::jsonb,
  artifact_storage_path text,
  checksum text,
  active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_model_name_version UNIQUE (model_name, version)
);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.backtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by uuid REFERENCES public.profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  status text,
  period_start date,
  period_end date,
  benchmark_dataset_id uuid REFERENCES public.reference_datasets(id),
  methodology_version text,
  basket_version text,
  fareguard_version text,
  priceguard_version text,
  metrics jsonb DEFAULT '{}'::jsonb,
  error_summary text,
  created_at timestamptz DEFAULT now()
);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  entity_type text,
  entity_id text,
  request_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_actor ON public.audit_events (actor_id);
CREATE INDEX idx_audit_action ON public.audit_events (action);
CREATE INDEX idx_audit_created_at ON public.audit_events (created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_events (entity_type, entity_id);
-- >>> STATEMENT SPLIT <<<
CREATE TABLE public.dataset_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES public.profiles(id),
  filename text,
  storage_path text,
  file_format text,
  file_size_bytes bigint,
  status text,
  detected_columns jsonb,
  column_mapping jsonb,
  total_rows bigint DEFAULT 0,
  valid_rows bigint DEFAULT 0,
  warning_rows bigint DEFAULT 0,
  rejected_rows bigint DEFAULT 0,
  duplicate_rows bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  validated_at timestamptz,
  committed_at timestamptz
);
CREATE INDEX idx_dataset_imports_uploaded_by ON public.dataset_imports (uploaded_by);
-- >>> STATEMENT SPLIT <<<
-- Database functions
CREATE OR REPLACE FUNCTION public.get_latest_source_health(p_source_id uuid)
RETURNS SETOF public.source_health_logs LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT * FROM public.source_health_logs WHERE source_id = p_source_id ORDER BY checked_at DESC LIMIT 1;
$$;
-- >>> STATEMENT SPLIT <<<
CREATE OR REPLACE FUNCTION public.get_latest_apix()
RETURNS SETOF public.airfare_index LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT * FROM public.airfare_index WHERE index_type = 'NATIONAL' AND route_id IS NULL ORDER BY index_date DESC, calculated_at DESC LIMIT 1;
$$;
-- >>> STATEMENT SPLIT <<<
CREATE OR REPLACE FUNCTION public.get_route_daily_median(p_route_id uuid, p_date date)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY normalized_total_fare)
  FROM public.validated_fares
  WHERE route_id = p_route_id AND validation_status = 'VALID' AND is_duplicate = false AND collected_at::date = p_date;
$$;
-- >>> STATEMENT SPLIT <<<
CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'quotes_today', (SELECT count(*) FROM public.raw_fares WHERE collected_at::date = current_date),
    'validated_today', (SELECT count(*) FROM public.validated_fares WHERE collected_at::date = current_date AND validation_status = 'VALID'),
    'rejected_today', (SELECT count(*) FROM public.validated_fares WHERE collected_at::date = current_date AND validation_status = 'REJECTED'),
    'duplicates_today', (SELECT count(*) FROM public.validated_fares WHERE collected_at::date = current_date AND is_duplicate = true),
    'open_anomalies', (SELECT count(*) FROM public.anomalies WHERE status = 'OPEN'),
    'critical_anomalies', (SELECT count(*) FROM public.anomalies WHERE severity = 'CRITICAL' AND status = 'OPEN'),
    'open_alerts', (SELECT count(*) FROM public.alerts WHERE status = 'OPEN'),
    'total_sources', (SELECT count(*) FROM public.sources WHERE active = true),
    'latest_index_value', (SELECT index_value FROM public.airfare_index WHERE index_type = 'NATIONAL' AND route_id IS NULL ORDER BY index_date DESC LIMIT 1)
  );
$$;
-- >>> STATEMENT SPLIT <<<
CREATE OR REPLACE VIEW public.dataset_catalog
WITH (security_invoker = true) AS
  SELECT rd.id AS dataset_id, rd.dataset_name, 'REFERENCE'::text AS dataset_type,
    s.display_name AS source, s.source_type::text AS source_type,
    rd.reference_period_start AS period_start, rd.reference_period_end AS period_end,
    rd.row_count, rd.dataset_version AS version, rd.status, rd.retrieved_at AS produced_at, 'REFERENCE'::text AS badge
  FROM public.reference_datasets rd LEFT JOIN public.sources s ON s.id = rd.source_id
  UNION ALL
  SELECT di.id, di.filename, 'IMPORTED'::text, p.full_name, 'IMPORT'::text,
    NULL::date, NULL::date, di.total_rows, NULL::text, di.status, di.created_at, 'IMPORTED'::text
  FROM public.dataset_imports di LEFT JOIN public.profiles p ON p.id = di.uploaded_by
  UNION ALL
  SELECT cr.id, concat('Collection ', to_char(cr.started_at, 'YYYY-MM-DD HH24:MI')),
    CASE cr.data_origin WHEN 'LIVE' THEN 'LIVE_COLLECTION' WHEN 'REPLAY' THEN 'REPLAY' WHEN 'SYNTHETIC' THEN 'SYNTHETIC' ELSE 'LIVE_COLLECTION' END,
    s.display_name, s.source_type::text, NULL::date, NULL::date, cr.quotes_received,
    cr.collector_version, cr.status::text, cr.started_at, COALESCE(cr.data_origin::text, 'LIVE')
  FROM public.collection_runs cr LEFT JOIN public.sources s ON s.id = cr.source_id;
-- >>> STATEMENT SPLIT <<<
CREATE MATERIALIZED VIEW public.mv_daily_route_fares AS
  SELECT vf.collected_at::date AS date, vf.route_id, vf.booking_window_days,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vf.normalized_total_fare) AS median_fare,
    avg(vf.normalized_total_fare) AS mean_fare, min(vf.normalized_total_fare) AS min_fare,
    max(vf.normalized_total_fare) AS max_fare, count(*) AS observation_count,
    count(DISTINCT vf.source_id) AS source_count, count(DISTINCT vf.airline) AS airline_count
  FROM public.validated_fares vf WHERE vf.validation_status = 'VALID' AND vf.is_duplicate = false
  GROUP BY vf.collected_at::date, vf.route_id, vf.booking_window_days;
CREATE UNIQUE INDEX uq_mv_daily_route_fares ON public.mv_daily_route_fares (date, route_id, booking_window_days);
-- >>> STATEMENT SPLIT <<<
CREATE MATERIALIZED VIEW public.mv_dashboard_daily_summary AS
  WITH days AS (SELECT DISTINCT collected_at::date AS date FROM public.raw_fares)
  SELECT d.date,
    (SELECT count(*) FROM public.raw_fares rf WHERE rf.collected_at::date = d.date) AS quotes_count,
    (SELECT count(*) FROM public.validated_fares vf WHERE vf.collected_at::date = d.date AND vf.validation_status = 'VALID') AS validated_count,
    (SELECT count(*) FROM public.validated_fares vf WHERE vf.collected_at::date = d.date AND vf.validation_status = 'REJECTED') AS rejected_count,
    (SELECT count(*) FROM public.validated_fares vf WHERE vf.collected_at::date = d.date AND vf.is_duplicate = true) AS duplicate_count,
    (SELECT count(*) FROM public.anomalies a WHERE a.detected_at::date = d.date) AS anomaly_count,
    (SELECT count(*) FROM public.anomalies a WHERE a.detected_at::date = d.date AND a.severity = 'CRITICAL') AS critical_anomaly_count,
    (SELECT count(*) FROM public.alerts al WHERE al.created_at::date = d.date) AS alert_count,
    (SELECT count(*) FROM public.sources s WHERE s.active = true AND s.consecutive_failures = 0) AS healthy_sources,
    (SELECT count(*) FROM public.sources s WHERE s.active = true) AS total_sources
  FROM days d;
CREATE UNIQUE INDEX uq_mv_dashboard_daily_summary ON public.mv_dashboard_daily_summary (date);
-- >>> STATEMENT SPLIT <<<
CREATE OR REPLACE FUNCTION public.refresh_dashboard_views()
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_route_fares;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dashboard_daily_summary;
EXCEPTION WHEN feature_not_supported OR object_not_in_prerequisite_state THEN
  REFRESH MATERIALIZED VIEW public.mv_daily_route_fares;
  REFRESH MATERIALIZED VIEW public.mv_dashboard_daily_summary;
END;
$$;
-- >>> STATEMENT SPLIT <<<
-- Supabase-only: RLS helper functions, policies, and realtime publication.
-- Guarded so plain PostgreSQL (no "authenticated"/"anon" roles, no supabase_realtime
-- publication, no auth.uid()) skips these without failing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    CREATE OR REPLACE FUNCTION public.current_app_role()
    RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
      SELECT role FROM public.profiles WHERE id = auth.uid();
    $fn$;
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
      SELECT public.current_app_role() = 'admin'; $fn$;
    CREATE OR REPLACE FUNCTION public.is_analyst_or_admin()
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
      SELECT public.current_app_role() IN ('analyst','admin'); $fn$;

    REVOKE ALL ON FUNCTION public.current_app_role() FROM public, anon;
    REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
    REVOKE ALL ON FUNCTION public.is_analyst_or_admin() FROM public, anon;
    REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.is_analyst_or_admin() TO authenticated;

    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY profiles_select_self ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
    CREATE POLICY profiles_update_self_no_escalation ON public.profiles FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid()
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
        AND active = (SELECT p.active FROM public.profiles p WHERE p.id = auth.uid()));
    CREATE POLICY profiles_admin_all ON public.profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

    ALTER TABLE public.anomaly_reviews ENABLE ROW LEVEL SECURITY;
    CREATE POLICY anomaly_reviews_insert ON public.anomaly_reviews FOR INSERT TO authenticated WITH CHECK (public.is_analyst_or_admin() AND reviewer_id = auth.uid());
    CREATE POLICY anomaly_reviews_select ON public.anomaly_reviews FOR SELECT TO authenticated USING (true);
    CREATE POLICY anomaly_reviews_admin_modify ON public.anomaly_reviews FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    CREATE POLICY anomaly_reviews_admin_delete ON public.anomaly_reviews FOR DELETE TO authenticated USING (public.is_admin());

    ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY alerts_select ON public.alerts FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;
    CREATE POLICY anomalies_select ON public.anomalies FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.collection_runs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY collection_runs_select ON public.collection_runs FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY pipeline_runs_select ON public.pipeline_runs FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.pipeline_steps ENABLE ROW LEVEL SECURITY;
    CREATE POLICY pipeline_steps_select ON public.pipeline_steps FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.scraping_test_runs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY scraping_test_runs_select ON public.scraping_test_runs FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.source_health_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY source_health_logs_select ON public.source_health_logs FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.airfare_index ENABLE ROW LEVEL SECURITY;
    CREATE POLICY airfare_index_select ON public.airfare_index FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;
    CREATE POLICY airports_select ON public.airports FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
    CREATE POLICY routes_select ON public.routes FOR SELECT TO authenticated USING (true);
    ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
    CREATE POLICY sources_select ON public.sources FOR SELECT TO authenticated USING (true);

    -- Backend-only tables: RLS on, no policies (service role bypasses RLS).
    ALTER TABLE public.raw_fares ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.validated_fares ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.fare_predictions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.fare_features ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.fare_index_eligibility ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.index_components ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.reference_datasets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.route_traffic_weights ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.benchmark_fares ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.model_registry ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.dataset_imports ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.shap_explanations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.index_baskets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.index_basket_routes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.fare_products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.fuel_price_series ENABLE ROW LEVEL SECURITY;

    REVOKE ALL ON public.mv_daily_route_fares FROM anon, authenticated;
    REVOKE ALL ON public.mv_dashboard_daily_summary FROM anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.collection_runs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_runs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_steps;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scraping_test_runs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.anomalies;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.source_health_logs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.airfare_index;
    ALTER TABLE public.collection_runs REPLICA IDENTITY FULL;
    ALTER TABLE public.pipeline_runs REPLICA IDENTITY FULL;
    ALTER TABLE public.pipeline_steps REPLICA IDENTITY FULL;
    ALTER TABLE public.scraping_test_runs REPLICA IDENTITY FULL;
    ALTER TABLE public.alerts REPLICA IDENTITY FULL;
    ALTER TABLE public.anomalies REPLICA IDENTITY FULL;
  END IF;
END;
$$;

-- >>> STATEMENT SPLIT <<<
-- Keep the Alembic bookkeeping table out of the exposed REST API on Supabase.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alembic_version') THEN
    ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.alembic_version FROM anon, authenticated;
  END IF;
END;
$$;
