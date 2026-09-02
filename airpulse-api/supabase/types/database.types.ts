// AUTO-GENERATED Supabase TypeScript types for the AirPulse database.
// Project: airpulse (ref bbvdujskgbqjhawwgxsa, region ap-south-1).
// Regenerate with: supabase gen types typescript --linked > supabase/types/database.types.ts
//
// Frontend usage:
//   import { createClient } from '@supabase/supabase-js'
//   import type { Database } from '@/supabase/types/database.types'
//   const supabase = createClient<Database>(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//   )

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Enums: {
      alert_status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"
      anomaly_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      anomaly_status:
        | "OPEN"
        | "UNDER_REVIEW"
        | "CONFIRMED"
        | "DISMISSED"
        | "RESOLVED"
      app_role: "viewer" | "analyst" | "admin"
      collection_method:
        | "HTTP"
        | "PLAYWRIGHT"
        | "SCRAPY"
        | "API"
        | "FILE"
        | "REPLAY"
        | "SYNTHETIC"
      collection_run_status:
        | "QUEUED"
        | "RUNNING"
        | "COMPLETED"
        | "PARTIAL"
        | "FAILED"
        | "CANCELLED"
      collection_trigger_type:
        | "SCHEDULED"
        | "MANUAL"
        | "REPLAY"
        | "SYNTHETIC"
        | "REFERENCE_SYNC"
        | "SCRAPING_TEST"
      data_mode: "LIVE" | "REPLAY" | "SYNTHETIC"
      data_origin: "LIVE" | "REPLAY" | "SYNTHETIC" | "IMPORTED" | "REFERENCE"
      pipeline_status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED"
      scraping_test_status:
        | "QUEUED"
        | "RUNNING"
        | "PASSED"
        | "PARTIAL"
        | "FAILED"
      source_type:
        | "AIRLINE"
        | "OTA"
        | "GOVERNMENT_API"
        | "GOVERNMENT_FILE"
        | "REPLAY"
        | "SYNTHETIC"
      validation_status: "VALID" | "WARNING" | "REJECTED"
    }
  }
}

// NOTE: The full generated Row/Insert/Update table types are large. This file keeps the
// Enums (most useful on the frontend for badges, filters, and status chips). To regenerate
// the complete typed table definitions, run:
//   supabase gen types typescript --project-id bbvdujskgbqjhawwgxsa > supabase/types/database.types.ts
export const AppRoles = ["viewer", "analyst", "admin"] as const
export const DataOrigins = ["LIVE", "REPLAY", "SYNTHETIC", "IMPORTED", "REFERENCE"] as const
