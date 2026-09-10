'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { batchSize, confirmedProgress, defaultEstimateConfig, estimateIngestion, remainingRange, smoothEstimate, type EstimateConfig, type IngestionProgress, type TimingRun } from '@/lib/ingestion-estimate';

export function CollectionProgress({ progress, history=[], config=defaultEstimateConfig }: { progress: IngestionProgress; history?: TimingRun[]; config?: EstimateConfig }) {
  const [now,setNow]=useState(Date.now);
  const estimate=estimateIngestion(progress.observation_count ?? 0,history,config);
  // Freeze the weighting basis for this operation; refreshed history informs the next run.
  const [stageWeights] = useState(estimate.weights);
  const [displayEstimate,setDisplayEstimate]=useState(estimate.seconds);
  const active=!['COMPLETED','FAILED'].includes(progress.status);
  useEffect(()=>{ if(!active) return; const timer=setInterval(()=>{setNow(Date.now());setDisplayEstimate(value=>smoothEstimate(value,estimate.seconds));},1000);return()=>clearInterval(timer);},[active,estimate.seconds]);
  const started=Date.parse(progress.started_at ?? '');
  const elapsed=Number.isFinite(started)?Math.max(0,Math.floor((now-started)/1000)):0;
  const size=batchSize(progress.observation_count ?? 0);
  const overdue=active && elapsed>=displayEstimate;
  const percent=confirmedProgress(progress,stageWeights);
  const indeterminate=active && (overdue || size==='very large' || progress.observation_count==null);
  const stage=(progress.current_stage ?? 'Awaiting backend stage').replaceAll('_',' ').toLowerCase();
  return <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-slate-900" aria-busy={active}>
    <p role="status" className="flex items-center gap-2 text-sm font-semibold">{active && <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{progress.status==='COMPLETED'?'Ingestion completed':progress.status==='FAILED'?'Ingestion FAILED':`Processing ${progress.observation_count ?? '…'} observations`}</p>
    <p className="text-xs capitalize">Current stage: {stage}</p>
    <p className="text-xs">{progress.completed_stages}/{progress.total_stages} stages · {size} batch</p>
    {(size!=='small' || !active) && <progress aria-label="Backend confirmed ingestion stages" className="h-2 w-full accent-blue-600" max={100} value={indeterminate?undefined:percent} />}
    {(size==='large'||size==='very large') && <p className="text-xs">Last stage output: {progress.processed_observations ?? '—'} observations</p>}
    <div className="flex flex-wrap justify-between gap-2 text-xs"><span>Elapsed: {elapsed}s</span><span>Estimated total: ~{Math.ceil(displayEstimate/5)*5}s</span></div>
    {active && <p className="text-xs font-medium">{remainingRange(displayEstimate,elapsed)}</p>}
    <p className="text-xs text-slate-600">{active?'Awaiting backend confirmation. ':''}{estimate.historical?'Estimate: rolling median of similarly sized completed runs.':'Estimate: configured stage overhead plus observation count.'} Timing estimates do not measure completion.</p>
    {progress.error && <p role="alert" className="text-xs text-red-700">{progress.error}</p>}
  </div>;
}
