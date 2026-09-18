'use client';

import type { EChartsOption } from 'echarts';
import { formatINR } from '@/lib/formatters';

export type RouteObservations = {
  average_fare: number | null; min_fare: number | null; max_fare: number | null;
  live_count: number; imported_count: number; latest_observation: string | null;
  current_median_fare: number | null; distance_km: number | null;
  observation_count: number; source_coverage_count: number;
  booking_window_breakdown: Record<string, number | null>;
};
export const WINDOWS = [1, 7, 15, 30, 45];
// Preserve the page's existing window grouping. This is a display filter only.
export const windowForDay = (day: number) => day <= 2 ? 1 : day <= 10 ? 7 : day <= 20 ? 15 : day <= 35 ? 30 : 45;
export const knownNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const fareText = (value: unknown) => knownNumber(value) ? formatINR(value) : 'Unavailable';
export function observationTime(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) + ' IST';
}
export function routeContext(data?: RouteObservations): string {
  if (!data) return 'Awaiting route data';
  if (data.live_count > 0 && data.imported_count > 0) return 'Hybrid LIVE + IMPORTED';
  if (data.live_count > 0) return 'LIVE observations';
  if (data.imported_count > 0) return 'IMPORTED fallback';
  return 'No eligible observations';
}
export function observedCurve(data: Record<string, number | null>, selected: number[]) {
  const points = Object.entries(data).map(([label, fare]) => ({ day: Number(label.replace(/^T\+?/, '')), fare: knownNumber(fare) ? fare : null }))
    .filter(p => Number.isFinite(p.day) && p.day >= 0 && selected.includes(windowForDay(p.day)));
  // Mark empty selected buckets, without assigning a fare or interpolating them.
  for (const window of selected) if (!points.some(p => windowForDay(p.day) === window)) points.push({ day: window, fare: null });
  return points.sort((a, b) => b.day - a.day);
}
export function observedCurveOption(points: ReturnType<typeof observedCurve>): EChartsOption {
  return {
    aria: { enabled: true, description: 'Observed mean airfare by advance-purchase lead time. Missing booking windows are gaps.' },
    animationDuration: 180,
    grid: { left: 14, right: 20, top: 34, bottom: 28, containLabel: true },
    tooltip: { trigger: 'axis', confine: true, renderMode: 'richText', backgroundColor: '#0f172a', borderWidth: 0, textStyle: { color: '#fff', fontSize: 12 }, formatter: (params: unknown) => {
      const item = Array.isArray(params) ? params[0] as { dataIndex: number } : null;
      const point = item ? points[item.dataIndex] : undefined;
      return point ? `T+${point.day}\nObserved mean fare: ${fareText(point.fare)}` : '';
    } },
    xAxis: { type: 'category', data: points.map(p => `T+${p.day}`), boundaryGap: true, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#64748b', fontSize: 11 } },
    yAxis: { type: 'value', name: 'INR', axisLabel: { color: '#64748b', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{ name: 'Stored observed mean fare', type: 'line', connectNulls: false, smooth: false, symbol: 'circle', symbolSize: 7, lineStyle: { width: 2, color: '#2563eb' }, itemStyle: { color: '#2563eb', borderColor: '#fff', borderWidth: 2 }, data: points.map(p => p.fare) }],
  };
}
export function Unavailable({ children = 'Unavailable' }: { children?: React.ReactNode }) {
  return <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500">{children}</span>;
}
export function RouteSkeleton({ label, tall = false }: { label: string; tall?: boolean }) {
  return <div role="status" aria-label={label} className={tall ? 'flex min-h-[280px] flex-col justify-center gap-5' : 'space-y-3'}><span className="sr-only">{label}</span><div className="h-5 w-2/3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" /><div className={`${tall ? 'h-32' : 'h-8'} w-full animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none`} /></div>;
}
export function FareRange({ min, median, max }: { min?: number | null; median?: number | null; max?: number | null }) {
  if (!knownNumber(min) || !knownNumber(median) || !knownNumber(max) || min > median || median > max) return null;
  const position = max === min ? 50 : (median - min) / (max - min) * 100;
  return <div aria-label={`Observed range: minimum ${fareText(min)}, median ${fareText(median)}, maximum ${fareText(max)}`} className="mt-5 border-t border-slate-100 pt-4"><div className="flex justify-between text-[10px] text-slate-500"><span>Minimum</span><span>Maximum</span></div><div className="relative my-2 h-1.5 rounded-full bg-blue-100"><span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 ring-1 ring-blue-300" style={{ left: `${position}%` }} title={`Median: ${fareText(median)}`} /></div><div className="flex justify-between text-xs font-medium tabular-nums"><span>{fareText(min)}</span><span>{fareText(max)}</span></div><p className="mt-1 text-[10px] text-slate-500">Marker: current median</p></div>;
}
