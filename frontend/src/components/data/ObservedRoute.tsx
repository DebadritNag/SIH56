'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getData } from '@/lib/api/client';
import { formatINR } from '@/lib/formatters';
import { EChartWrapper } from '@/components/charts/EChartWrapper';

export function ObservedRoute() {
  const [route, setRoute] = useState('DEL-BOM');
  const q = useQuery({
    queryKey: ['observed-route', route],
    queryFn: () => getData<{ current_median_fare: number | null; observation_count: number;
      source_coverage_count: number; booking_window_breakdown: Record<string, number> }>(`/routes/${route}/insights`),
  });
  const windows = Object.entries(q.data?.booking_window_breakdown ?? {}).sort((a,b) => Number(a[0].slice(1))-Number(b[0].slice(1)));
  return <div className="space-y-5 rounded border bg-white p-6">
    <h1 className="text-xl font-semibold">Route Intelligence — Observed Fares</h1>
    <select aria-label="Route" value={route} onChange={e => setRoute(e.target.value)} className="border rounded p-2">
      {['DEL-BOM','DEL-BLR','BOM-BLR','DEL-CCU','BLR-HYD','MAA-DEL'].map(code => <option key={code}>{code}</option>)}
    </select>
    {q.isPending ? <p>Loading observations…</p> : q.isError ? <p>Unable to load observations.</p> : <>
      <p className="text-2xl font-semibold">Median fare: {q.data?.current_median_fare == null ? '—' : formatINR(q.data.current_median_fare)}</p>
      <p>{q.data?.observation_count ?? 0} observations · {q.data?.source_coverage_count ?? 0} sources</p>
      <h2 className="font-semibold">Mean fare by advance-purchase day</h2>
      {windows.length ? <EChartWrapper option={{ tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: windows.map(([label]) => label) }, yAxis: { type: 'value', name: 'INR' }, series: [{ name: 'Observed mean fare', type: 'bar', data: windows.map(([,fare]) => fare) }] }} /> : <p>No fare observations available for this route.</p>}
      <p className="text-sm text-slate-500">Aggregated across stored imported and live observations. Historical changes and route APIx require matching comparison-period data.</p>
    </>}
  </div>;
}
