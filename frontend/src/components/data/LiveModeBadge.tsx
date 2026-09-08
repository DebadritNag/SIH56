"use client";

/**
 * LiveModeBadge — shows the canonical Live Mode status badge.
 *
 * Variants:
 *   HYBRID           green   "HYBRID LIVE + IMPORTED"
 *   LIVE_DATA        emerald "LIVE DATA"
 *   IMPORTED_FALLBACK amber  "IMPORTED FALLBACK"
 *   EMPTY            slate   "No data available"
 *   loading          slate   skeleton pulse
 *
 * Use this wherever the DataContextResolver mode needs to be visible:
 *   overview, booking-windows, route intelligence, fare explorer, anomalies, etc.
 *
 * In DEMO mode it shows the mock mode label with a flask icon so it is never
 * confused with real Live Mode data.
 */
import React from "react";
import { Database, FlaskConical, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import type { LiveModeStatus } from "@/lib/api/endpoints";

interface Props {
  ctx: LiveModeStatus | null | undefined;
  loading?: boolean;
  /** When true (Demo mode), show a clearly-labelled demo badge instead */
  isMock?: boolean;
  className?: string;
}

const MODE_STYLES: Record<string, string> = {
  HYBRID:
    "bg-emerald-50 text-emerald-800 border-emerald-300",
  LIVE_DATA:
    "bg-emerald-50 text-emerald-800 border-emerald-300",
  IMPORTED_FALLBACK:
    "bg-amber-50 text-amber-900 border-amber-400",
  EMPTY:
    "bg-slate-100 text-slate-600 border-slate-300",
};

const MODE_DOT: Record<string, string> = {
  HYBRID: "bg-emerald-500 animate-pulse",
  LIVE_DATA: "bg-emerald-500 animate-pulse",
  IMPORTED_FALLBACK: "bg-amber-500",
  EMPTY: "bg-slate-400",
};

export function LiveModeBadge({ ctx, loading, isMock, className = "" }: Props) {
  if (isMock) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-bold bg-indigo-50 text-indigo-800 border-indigo-300 ${className}`}
        title="Demo Mode — showing synthetic/demo data, not real observations"
      >
        <FlaskConical className="w-3 h-3" />
        DEMO MODE
      </span>
    );
  }

  if (loading && !ctx) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-bold bg-slate-100 text-slate-500 border-slate-200 animate-pulse ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        Loading…
      </span>
    );
  }

  const mode = ctx?.mode ?? "EMPTY";
  const label = ctx?.mode_label ?? "No data";
  const health = ctx?.health_badge;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-bold ${MODE_STYLES[mode] ?? MODE_STYLES.EMPTY}`}
        title={`Live Mode: ${label}${health ? ` — ${health}` : ""}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${MODE_DOT[mode] ?? "bg-slate-400"}`} />
        {label}
      </span>
      {health && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold bg-rose-50 text-rose-700 border-rose-300"
          title={health}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          {health}
        </span>
      )}
    </span>
  );
}

/** Compact inline version for tight spaces (sidebar, table headers). */
export function LiveModePill({ ctx, isMock }: { ctx: LiveModeStatus | null | undefined; isMock?: boolean }) {
  if (isMock) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
        <FlaskConical className="w-2.5 h-2.5" />
        DEMO
      </span>
    );
  }
  const mode = ctx?.mode ?? "EMPTY";
  const live = ctx?.live_count ?? 0;
  const imported = ctx?.imported_count ?? 0;
  if (mode === "EMPTY") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        <WifiOff className="w-2.5 h-2.5" />
        No data
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Wifi className="w-2.5 h-2.5" />
      {mode === "HYBRID"
        ? `LIVE ${live} + IMP ${imported}`
        : mode === "LIVE_DATA"
        ? `LIVE ${live}`
        : `IMP ${imported}`}
    </span>
  );
}

/** Data composition strip — shows "LIVE: 5 | IMPORTED: 26 | Total: 31" */
export function DataCompositionStrip({ ctx, className = "" }: { ctx: LiveModeStatus | null | undefined; className?: string }) {
  if (!ctx || ctx.mode === "EMPTY") return null;
  return (
    <div className={`flex items-center gap-3 text-[10px] font-mono text-[#667085] ${className}`}>
      {ctx.live_count > 0 && (
        <span className="flex items-center gap-1">
          <Database className="w-2.5 h-2.5 text-emerald-600" />
          <span className="text-emerald-700 font-bold">LIVE {ctx.live_count}</span>
        </span>
      )}
      {ctx.imported_count > 0 && (
        <span className="flex items-center gap-1">
          <Database className="w-2.5 h-2.5 text-blue-500" />
          <span className="text-blue-700 font-bold">IMPORTED {ctx.imported_count}</span>
        </span>
      )}
      <span className="text-[#475467]">Total {ctx.total_eligible} eligible</span>
      {ctx.historical_days > 0 && (
        <span className="text-[#475467]">· {ctx.historical_days}d history</span>
      )}
    </div>
  );
}
