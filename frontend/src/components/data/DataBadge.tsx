"use client";

import { Database, FlaskConical } from "lucide-react";

/** Visible "MOCK DATA" badge. Rendered whenever displayed data is not live/real. */
export function MockBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ${className}`}
      title="This is demonstration data, not live scraped/processed data."
    >
      <FlaskConical className="h-3 w-3" />
      Mock Data
    </span>
  );
}

/** Small "LIVE" badge for real data. */
export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ${className}`}
      title="Live data from the AirPulse backend."
    >
      <Database className="h-3 w-3" />
      Live
    </span>
  );
}

interface DataSourceMetaProps {
  isMock: boolean;
  source?: string;
  lastUpdated?: string | null;
  className?: string;
}

function formatTs(ts?: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

/** Inline badge + source + last-updated line for any data surface. */
export function DataSourceMeta({ isMock, source, lastUpdated, className = "" }: DataSourceMetaProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 text-[10px] text-[#667085] ${className}`}>
      {isMock ? <MockBadge /> : <LiveBadge />}
      <span>Source: {source ?? (isMock ? "Demo dataset" : "AirPulse backend")}</span>
      <span>•</span>
      <span>Updated: {formatTs(lastUpdated)}</span>
    </div>
  );
}
