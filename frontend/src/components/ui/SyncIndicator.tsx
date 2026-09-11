"use client";

/**
 * SyncIndicator — lightweight inline synchronization state badge.
 *
 * Used on Overview and other pages to signal that fresh data is being fetched
 * in the background after an invalidation event (collection / ingestion /
 * mode switch / filter change). Unlike a full-screen spinner it does NOT block
 * interaction — it sits inline next to a value or in a card header.
 *
 * Usage:
 *   {isFetching && <SyncIndicator />}
 *   <SyncIndicator label="Syncing latest observations…" />
 */
import React from "react";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface SyncIndicatorProps {
  /** Short label shown next to the spinner. */
  label?: string;
  /** Visual variant. "inline" (default) sits inside a card; "banner" spans a row. */
  variant?: "inline" | "banner";
  className?: string;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  label = "Syncing…",
  variant = "inline",
  className,
}) => {
  if (variant === "banner") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={clsx(
          "flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs font-medium text-blue-700",
          className,
        )}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none flex-shrink-0" />
        {label}
      </div>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={clsx(
        "inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded animate-pulse motion-reduce:animate-none",
        className,
      )}
    >
      <Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" />
      {label}
    </span>
  );
};

/**
 * MetricCardSkeleton — animated skeleton matching MetricCard dimensions.
 * Use when the initial data fetch is still pending (isPending=true).
 */
export const MetricCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden
    className={clsx(
      "bg-white border border-[#E4E7EC] rounded-lg p-4 flex flex-col justify-between shadow-xs",
      className,
    )}
  >
    <div className="h-3 w-24 bg-slate-200 rounded animate-pulse motion-reduce:animate-none" />
    <div className="my-3 h-7 w-20 bg-slate-200 rounded animate-pulse motion-reduce:animate-none" />
    <div className="h-2.5 w-32 bg-slate-100 rounded animate-pulse motion-reduce:animate-none" />
  </div>
);

/**
 * ChartSkeleton — animated placeholder for EChart panels while loading.
 */
export const ChartSkeleton: React.FC<{ height?: string; className?: string }> = ({
  height = "200px",
  className,
}) => (
  <div
    aria-hidden
    style={{ height }}
    className={clsx(
      "w-full rounded bg-slate-100 animate-pulse motion-reduce:animate-none",
      className,
    )}
  />
);

/**
 * TableSkeleton — animated placeholder for data tables while loading.
 */
export const TableSkeleton: React.FC<{ rows?: number; className?: string }> = ({
  rows = 5,
  className,
}) => (
  <div
    aria-hidden
    className={clsx("space-y-2", className)}
  >
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="h-9 w-full bg-slate-100 rounded animate-pulse motion-reduce:animate-none"
        style={{ animationDelay: `${i * 60}ms` }}
      />
    ))}
  </div>
);
