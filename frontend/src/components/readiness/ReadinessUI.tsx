import { Loader2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export const panel = 'rounded-xl border border-slate-200 bg-white p-5 md:p-6';
export function Status({ value }: { value: string }) {
  const good = ['MET', 'READY', 'SOURCE_COVERAGE_AVAILABLE'].includes(value);
  return <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold ${good ? 'bg-emerald-50 text-emerald-800' : value === 'UNAVAILABLE' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'}`}>
    {good ? <CheckCircle2 size={14} /> : <Circle size={14} />}{value.replaceAll('_', ' ')}
  </span>;
}
export function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return <div className={panel}><p className="text-xs font-medium text-slate-600">{label}</p><p className="my-2 text-2xl font-semibold tabular-nums text-slate-900">{value ?? 'Unavailable'}</p><p className="text-xs text-slate-500">{detail}</p></div>;
}
export function ReadinessSkeleton() {
  return <div aria-busy="true" aria-label="Loading readiness" className="space-y-5"><p role="status" className="flex items-center gap-2 text-sm text-blue-700"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" />Loading readiness…</p><div aria-hidden="true" className="h-64 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" /><div aria-hidden="true" className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1,2,3,4].map(i=><div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" />)}</div><div aria-hidden="true" className="h-48 rounded-xl bg-slate-100" /></div>;
}
export function ReadinessError({ title, retry }: { title: string; retry: () => void }) {
  return <div role="alert" className={`${panel} flex flex-wrap items-center gap-3`}><AlertCircle className="text-amber-700" size={20}/><p>{title}</p><button className="rounded border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50" onClick={retry}>Retry</button></div>;
}
export function Progress({ count, required, label }: { count: number; required: number; label: string }) {
  const percent = required > 0 ? Math.min(100, Math.max(0, count / required * 100)) : 0;
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={required} aria-valuenow={Math.min(count,required)} className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${percent}%`}} /></div>;
}
