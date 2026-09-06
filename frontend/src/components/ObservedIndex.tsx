"use client";
import { useQuery } from "@tanstack/react-query";
import { getData } from "@/lib/api/client";

type Index = { id: string; index_date: string; index_value: number; calculated_at: string; basket_version: string; methodology_version: string; metadata?: { base_period_start?: string; base_period_end?: string; matched_weight_coverage?: number; sample_count?: number; live_count?: number; imported_count?: number } };
type Component = { id: string; route_code: string; booking_window_days: number; base_price: number; current_price: number; price_relative: number; weight: number; weighted_contribution: number; eligible_observations: number };

export default function ObservedIndex() {
  const latest = useQuery({ queryKey: ["apix-latest"], queryFn: () => getData<Index | null>("/index/latest"), refetchInterval: 15000 });
  const index = latest.data;
  const components = useQuery({ queryKey: ["apix-components", index?.id], queryFn: () => getData<Component[]>(`/index/${index?.id}/components`), enabled: !!index });
  return <main className="space-y-6 p-6"><h1 className="text-2xl font-semibold">Airfare Price Index</h1><p className="text-sm text-slate-500">Persisted national basket calculated from eligible observed fares. Model predictions do not enter APIx.</p>
    {(latest.error || components.error) && <p role="alert">{(latest.error || components.error)?.message}</p>}
    {latest.isLoading && <p>Loading index…</p>}
    {latest.isSuccess && !index && <p className="rounded border p-6">No calculated index is available. A configured basket, observed base-period fares, and matching current route/window observations are required.</p>}
    {index && <><section className="rounded border p-6"><p className="text-sm">National APIx · {index.index_date}</p><p className="my-3 text-4xl font-semibold">{Number(index.index_value).toFixed(2)}</p><p>Observed base: {index.metadata?.base_period_start ?? "See basket methodology"} {index.metadata?.base_period_end && `to ${index.metadata.base_period_end}`}</p><p>Calculated at: {index.calculated_at}</p><p>Basket: {index.basket_version} · Methodology: {index.methodology_version}</p><p>Observations: {index.metadata?.sample_count ?? "Unknown"} · Live: {index.metadata?.live_count ?? "Unknown"} · Imported: {index.metadata?.imported_count ?? "Unknown"}</p><p>Matched basket weight: {index.metadata?.matched_weight_coverage == null ? "Unknown" : `${(index.metadata.matched_weight_coverage * 100).toFixed(1)}%`}</p></section>
      <div className="overflow-x-auto rounded border p-4"><table className="w-full text-left text-sm"><thead><tr><th>Route</th><th>Window</th><th>Observed base</th><th>Current median</th><th>Relative</th><th>Weight</th><th>Observations</th></tr></thead><tbody>{components.data?.map(c => <tr key={c.id} className="border-t"><td className="py-3">{c.route_code}</td><td>T+{c.booking_window_days}</td><td>₹{Number(c.base_price).toFixed(2)}</td><td>₹{Number(c.current_price).toFixed(2)}</td><td>{(Number(c.price_relative) * 100).toFixed(2)}</td><td>{Number(c.weight).toFixed(4)}</td><td>{c.eligible_observations}</td></tr>)}</tbody></table></div></>}
  </main>;
}
