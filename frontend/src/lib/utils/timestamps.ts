/**
 * AirPulse Canonical Timestamp & Freshness Utilities
 * 
 * Strict separation between:
 *  - Observed Time (when fare was seen in source market)
 *  - Pipeline/Processing Times (when AirPulse ingested, validated, scored, indexed)
 * 
 * Storage: Canonical UTC (timestamptz) from backend
 * Display: Asia/Kolkata (IST)
 * 
 * Authoritative timestamps MUST come from persisted backend records.
 * Client current time is ONLY used for relative difference ('12s ago').
 */

export type TimestampFormat = 
  | 'absolute'   // 06 Sep 2026, 12:08:03 AM IST
  | 'compact'    // 06 Sep · 12:08 AM
  | 'relative'   // 12 seconds ago / just now
  | 'timeOnly'   // 12:08:03 AM IST
  | 'dateOnly'   // 06 Sep 2026
  | 'technical'  // 12:08:01.102 IST
  | 'tooltip';   // 06 September 2026, 00:08:03 IST

export interface FormatTimestampOptions {
  format?: TimestampFormat;
  fallback?: string;
  includeSeconds?: boolean;
}

export function parseTimestamp(val?: string | number | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatRelativeTime(targetDate: Date, baseDate = new Date()): string {
  const diffSec = Math.floor((baseDate.getTime() - targetDate.getTime()) / 1000);

  if (diffSec < 0) {
    // Slight clock skew or future scheduled
    return 'just now';
  }
  if (diffSec < 5) {
    return 'just now';
  }
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return 'yesterday';
  }
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export function formatTimestamp(
  val?: string | number | Date | null,
  options: FormatTimestampOptions = {}
): string {
  const { format = 'absolute', fallback = '—', includeSeconds = true } = options;
  const d = parseTimestamp(val);
  if (!d) return fallback;

  try {
    switch (format) {
      case 'relative':
        return formatRelativeTime(d);

      case 'compact': {
        const parts = new Intl.DateTimeFormat('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        }).formatToParts(d);
        const day = parts.find((p) => p.type === 'day')?.value || '';
        const month = parts.find((p) => p.type === 'month')?.value || '';
        const hour = parts.find((p) => p.type === 'hour')?.value || '';
        const min = parts.find((p) => p.type === 'minute')?.value || '';
        const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value?.toUpperCase() || '';
        return `${day} ${month} · ${hour}:${min} ${dayPeriod}`;
      }

      case 'timeOnly': {
        const parts = new Intl.DateTimeFormat('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
          second: includeSeconds ? '2-digit' : undefined,
          hour12: true,
          timeZone: 'Asia/Kolkata',
        }).formatToParts(d);
        const hour = parts.find((p) => p.type === 'hour')?.value || '';
        const min = parts.find((p) => p.type === 'minute')?.value || '';
        const sec = includeSeconds ? parts.find((p) => p.type === 'second')?.value : null;
        const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value?.toUpperCase() || '';
        return sec ? `${hour}:${min}:${sec} ${dayPeriod} IST` : `${hour}:${min} ${dayPeriod} IST`;
      }

      case 'dateOnly': {
        return new Intl.DateTimeFormat('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        }).format(d);
      }

      case 'technical': {
        const parts = new Intl.DateTimeFormat('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata',
        }).format(d);
        const ms = String(d.getMilliseconds()).padStart(3, '0');
        return `${parts}.${ms} IST`;
      }

      case 'tooltip': {
        const parts = new Intl.DateTimeFormat('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata',
        }).format(d);
        return `${parts} IST`;
      }

      case 'absolute':
      default: {
        const parts = new Intl.DateTimeFormat('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: includeSeconds ? '2-digit' : undefined,
          hour12: true,
          timeZone: 'Asia/Kolkata',
        }).formatToParts(d);

        const day = parts.find((p) => p.type === 'day')?.value || '';
        const month = parts.find((p) => p.type === 'month')?.value || '';
        const year = parts.find((p) => p.type === 'year')?.value || '';
        const hour = parts.find((p) => p.type === 'hour')?.value || '';
        const min = parts.find((p) => p.type === 'minute')?.value || '';
        const sec = includeSeconds ? parts.find((p) => p.type === 'second')?.value : null;
        const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value?.toUpperCase() || '';

        const timeStr = sec ? `${hour}:${min}:${sec} ${dayPeriod}` : `${hour}:${min} ${dayPeriod}`;
        return `${day} ${month} ${year}, ${timeStr} IST`;
      }
    }
  } catch {
    return String(val);
  }
}

export function formatDurationMs(ms?: number | null): string {
  if (ms === undefined || ms === null || isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}
