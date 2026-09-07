'use client';

import { useDataMode } from '@/lib/providers/DataModeProvider';
import ObservedIndex from '@/components/ObservedIndex';
import { NationalIndexChart } from '@/components/charts/NationalIndexChart';
import { mockNationalTrend, mockUpwardContributors, mockDownwardContributors } from '@/lib/mock-data/dashboard';
import { formatINR } from '@/lib/formatters';

export default function AirfareIndexPage() {
  const { mode } = useDataMode();
  if (mode === 'real') return <ObservedIndex />;
  const latest = mockNationalTrend[mockNationalTrend.length - 1];
  return <main className="space-y-5">
    <header><h1 className="text-2xl font-semibold text-slate-900">Airfare Price Index</h1><p className="mt-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Demo Mode · Illustrative index values and route contributions for product demonstration.</p></header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ['National APIx', latest.apix.toFixed(2)],
        ['Daily change', `${latest.daily_pct > 0 ? '+' : ''}${latest.daily_pct.toFixed(2)}%`],
        ['Weekly change', `${latest.weekly_pct > 0 ? '+' : ''}${latest.weekly_pct.toFixed(2)}%`],
        ['Monthly change', `${latest.monthly_pct > 0 ? '+' : ''}${latest.monthly_pct.toFixed(2)}%`],
      ].map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-blue-700">{value}</p><p className="mt-2 text-xs text-slate-500">Sample as of {latest.date}</p></div>)}
    </section>
    <section className="rounded-lg border bg-white p-5"><h2 className="font-semibold">National index trend</h2><p className="mb-4 mt-1 text-xs text-slate-500">Illustrative base = 100 · August–September 2026</p><NationalIndexChart data={mockNationalTrend} showBenchmark={false} /></section>
    <section className="rounded-lg border bg-white p-5"><h2 className="mb-4 font-semibold">Sample route contributions</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-3">Route</th><th>Weight</th><th>Median fare</th><th>Fare change</th><th>Contribution</th></tr></thead><tbody>{[...mockUpwardContributors, ...mockDownwardContributors].map(r => <tr key={r.route} className="border-b"><td className="py-3 font-medium">{r.route}</td><td>{r.weight_pct}%</td><td>{formatINR(r.current_median_fare)}</td><td>{r.change_pct > 0 ? '+' : ''}{r.change_pct}%</td><td>{r.apix_contribution > 0 ? '+' : ''}{r.apix_contribution.toFixed(2)} pts</td></tr>)}</tbody></table></div></section>
  </main>;
}
