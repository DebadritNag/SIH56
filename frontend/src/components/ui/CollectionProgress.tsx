'use client';

import { useEffect, useState } from 'react';

export function CollectionProgress({ expectedSeconds }: { expectedSeconds?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  const estimated = expectedSeconds && expectedSeconds > 0;
  const percent = estimated ? Math.min(95, Math.floor(elapsed / expectedSeconds * 100)) : undefined;
  const remaining = estimated ? Math.max(0, Math.ceil(expectedSeconds - elapsed)) : undefined;
  return <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-slate-900">
    <div className="flex justify-between text-sm font-semibold"><span>Processing observations</span><span>{percent === undefined ? 'In progress' : `${percent}% estimated`}</span></div>
    <div role="progressbar" aria-label="Estimated collection progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-blue-100">
      <div className={`h-full rounded-full bg-blue-600 transition-all duration-700 ${percent === undefined ? 'w-1/3 animate-pulse' : ''}`} style={percent === undefined ? undefined : { width: `${percent}%` }} />
    </div>
    <div className="flex justify-between text-xs"><span>Elapsed: {elapsed}s</span><span>{remaining === undefined ? 'Time left: calculating…' : remaining > 0 ? `About ${remaining}s left` : 'Taking longer than previous runs…'}</span></div>
    <p className="text-xs text-slate-600">{estimated ? 'Estimate based on previous completed ingestion runs; awaiting backend confirmation.' : 'A percentage and time estimate will be available after a completed run provides timing history.'} Keep this page open while processing.</p>
  </div>;
}
