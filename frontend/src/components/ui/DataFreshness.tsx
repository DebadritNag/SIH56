'use client';

export interface DataFreshnessProps {
  timestamp?: string | number | Date | null;
  label?: string;
  status?: 'live' | 'fresh' | 'aging' | 'stale' | 'idle';
  showRelative?: boolean;
  showAbsolute?: boolean;
  isRealtime?: boolean;
  source?: string;
  className?: string;
}

// Compatibility export: update/status badges are retired globally in both modes.
// Realtime subscriptions are owned by AppShell, not this presentation component.
export function DataFreshness(_props: DataFreshnessProps) { return null; }
