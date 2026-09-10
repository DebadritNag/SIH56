export type IngestionProgress = { status: string; observation_count?: number | null; current_stage?: string; completed_stages: number; completed_stage_names?: string[]; total_stages: number; started_at?: string; processed_observations?: number; error?: string };
export type TimingRun = { observation_count: number; duration_seconds: number; stage_seconds?: Record<string, number> };
export type EstimateConfig = { base_seconds: number; per_observation_seconds: number; min_history: number };
export const defaultEstimateConfig: EstimateConfig = { base_seconds: 30, per_observation_seconds: 0.5, min_history: 3 };
export function median(values: number[]) { const a = [...values].sort((a,b)=>a-b); const m = Math.floor(a.length/2); return a.length % 2 ? a[m] : (a[m-1]+a[m])/2; }
export function batchSize(count: number) { return count <= 25 ? 'small' : count <= 100 ? 'medium' : count <= 500 ? 'large' : 'very large'; }
export function estimateIngestion(count: number, history: TimingRun[], config=defaultEstimateConfig) {
  const similar = history.slice(0,30).filter(r => Number(r.duration_seconds)>0 && Math.abs(r.observation_count-count) <= Math.max(10,count*0.5));
  const historical = similar.length >= Math.max(3,config.min_history);
  const seconds = historical ? median(similar.map(r=>Number(r.duration_seconds))) : Math.max(1,config.base_seconds+Math.max(0,count)*config.per_observation_seconds);
  const weights: Record<string,number> = {};
  if(historical) for(const name of Object.keys(similar[0].stage_seconds ?? {})) {
    const values = similar.map(r=>r.stage_seconds?.[name]).filter((n):n is number=>typeof n==='number' && n>0);
    if(values.length>=config.min_history) weights[name]=median(values);
  }
  return {seconds,historical,weights};
}
export function confirmedProgress(progress: IngestionProgress, weights: Record<string,number>={}) {
  if(progress.status==='COMPLETED') return 100;
  const total=progress.total_stages;
  const keys=Object.keys(weights);
  const weighted=keys.length===total && total>0 && progress.completed_stage_names?.every(n=>weights[n]>0);
  const fraction=weighted ? (progress.completed_stage_names ?? []).reduce((n,k)=>n+weights[k],0)/keys.reduce((n,k)=>n+weights[k],0) : total>0 ? progress.completed_stages/total : 0;
  return Math.max(0,Math.min(99,Math.floor(fraction*100)));
}
export function remainingRange(estimate:number,elapsed:number) {
  if(elapsed>=estimate) return 'Taking longer than usual…';
  const left=estimate-elapsed;
  return `About ${Math.max(0,Math.floor(left*0.75/10)*10)}–${Math.max(10,Math.ceil(left*1.25/10)*10)}s remaining`;
}
export function smoothEstimate(previous:number,target:number) { return previous+(target-previous)*0.2; }
