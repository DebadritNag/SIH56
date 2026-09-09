'use client';
import { useQuery } from '@tanstack/react-query';
import { getData } from '@/lib/api/client';
import { EChartWrapper } from '@/components/charts/EChartWrapper';

type History = { historical_days: number; dgca_benchmark_available: boolean; observations: { date: string; observations: number; mean_fare: number; live_count: number; imported_count: number }[]; indices: { index_date: string; index_value: number }[] };
export default function ObservedHistory() {
  const q = useQuery({ queryKey: ['observed-history'], queryFn: () => getData<History>('/live-mode/history'), refetchInterval: 15000 });
  return <main className="space-y-5"><h1 className="text-2xl font-semibold">AirPulse observed history & backtesting</h1>
    {q.isPending && <p>Loading observed history…</p>}{q.error && <p role="alert">{q.error.message}</p>}
    {q.data && <><p>Historical coverage: {q.data.historical_days} observed days (UTC). Missing dates are left absent.</p>
      <section className="rounded border bg-white p-5"><h2 className="font-semibold">AirPulse APIx history</h2>{q.data.indices.length ? <EChartWrapper option={{ xAxis: { type: 'category', data: q.data.indices.map(r => r.index_date) }, yAxis: { type: 'value' }, tooltip: { trigger: 'axis' }, series: [{ type: 'line', name: 'Observed APIx', data: q.data.indices.map(r => r.index_value) }] }} /> : <p className="mt-3 text-sm text-slate-500">No calculated APIx series yet. An observed base period and matching basket data are required.</p>}</section>
      <section className="rounded border bg-white p-5"><h2 className="font-semibold">Available fare observations</h2><p className="my-2 text-sm text-slate-500">Daily mean fares describe stored quotes; they are not an airfare index.</p><table className="w-full text-left text-sm"><thead><tr><th>Date (UTC)</th><th>LIVE</th><th>IMPORTED</th><th>Total</th><th>Mean fare</th></tr></thead><tbody>{q.data.observations.map(r => <tr key={r.date} className="border-t"><td className="py-3">{r.date}</td><td>{r.live_count}</td><td>{r.imported_count}</td><td>{r.observations}</td><td>₹{Number(r.mean_fare).toFixed(2)}</td></tr>)}</tbody></table>{!q.data.observations.length && <p>No genuine observations available.</p>}</section>
      <section className="rounded border bg-white p-5"><h2 className="font-semibold">Official benchmark comparison</h2><p>{q.data.dgca_benchmark_available ? 'Verified DGCA data is loaded; a comparable period and series are required before displaying comparison metrics.' : 'DGCA benchmark not loaded. AirPulse observations remain available above.'}</p></section>
    </>}
  </main>;
}
