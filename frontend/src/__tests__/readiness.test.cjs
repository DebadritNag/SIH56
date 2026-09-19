const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup:render}=require('react-dom/server');
const {load}=require('./corridors-and-pdf.test.cjs');
const fs=require('node:fs'),path=require('node:path');
const el=(C,props={})=>render(React.createElement(C,props));
const ui=load('components/readiness/ReadinessUI.tsx');
const Skeleton=load('components/skeletons/OverviewSkeleton.tsx').OverviewSkeleton;
const sk=el(Skeleton);
for(const label of ['Airfare Intelligence Overview','Preparing live intelligence','Latest Live Observations','Route Activity','ACTIVE ANOMALIES']) assert.ok(sk.includes(label));
assert.ok(sk.includes('aria-busy="true"'));
assert.ok(!sk.includes('Checking processed observations'));
assert.ok(!sk.includes('Awaiting ingestion'));
assert.ok(!sk.includes('No eligible'));
assert.ok(el(Skeleton,{error:'Network unavailable',retry:()=>{}}).includes('Retry'));
const progress=el(ui.Progress,{count:35,required:30,label:'History'});
assert.ok(progress.includes('width:100%'));
const apiData={status:'MISSING_BASE_PERIOD',required_days:null,collected_days:9,remaining_days:null,history_note:'No configured minimum',eligible_observations:111,eligible_route_count:3,live_days:7,imported_days:2,requirements:{history:'UNAVAILABLE',weights:'NOT_MET',base:'UNAVAILABLE',current:'UNAVAILABLE'},base_period:{configured:false,start:null,end:null,available_components:0,required_components:0,status:'UNAVAILABLE'},distinct_observation_dates:[{date:'2026-09-19',observations:5,live_count:5,imported_count:0,routes:['DEL-BOM'],windows:['T+7']}],routes:[],booking_windows:[]};
const API=load('components/readiness/APIxReadinessDashboard.tsx').APIxReadinessDashboard;
const html=el(API,{data:apiData});
assert.ok(html.includes('No configured minimum'));
assert.ok(html.includes('2026-09-19'));
assert.ok(!html.includes('30 days of'));
for (const n of [0,12,30,31]) {
 const text=el(API,{data:{...apiData,required_days:30,collected_days:n,remaining_days:Math.max(30-n,0)}});
 assert.ok(text.includes(n>=30?'History requirement met':`${30-n} days remaining`));
}
let responses={}, queries=[];
const Observed=load('components/ObservedIndex.tsx',{
 '@tanstack/react-query':{useQuery:opts=>{queries.push(opts);return responses[opts.queryKey[0]]||{isPending:true};}},
 '@/lib/api/client':{},
});
responses={'apix-latest':{isError:true,error:Error('network')},'apix-readiness':{isError:true}};
assert.ok(el(Observed.default).includes('Unable to load APIx readiness'));
assert.ok(!el(Observed.default).includes('genuine observation days collected'));
responses={'apix-latest':{isSuccess:true,data:null},'apix-readiness':{data:apiData}};
assert.ok(el(Observed.default).includes('APIx Readiness'));
responses={'apix-latest':{data:{id:'persisted',index_date:'2026-09-19',index_value:107.25}},'apix-components':{data:[]}};
assert.ok(el(Observed.default).includes('107.25'));
assert.ok(!el(Observed.default).includes('Building an observed'));
const shockData={status:'INSUFFICIENT_SOURCE_COVERAGE',available_sources:1,required_sources:2,remaining_sources:1,shock_threshold_pct:20,min_quotes:10,min_robust_zscore:3,synchronization_window_minutes:null,coverage_period:'Current UTC day',candidate_count:null,eligible_routes:1,latest_observed_at:null,note:'Coverage alone is not confirmation.',sources:[{id:'one',name:'HappyFares',latest:'2026-09-19',routes:['DEL-BOM'],windows:['T+7']}]};
let shockQuery={data:shockData,isFetching:true};
const Shock=load('components/readiness/PriceShockReadiness.tsx',{'@tanstack/react-query':{useQuery:()=>shockQuery},'@/lib/api/client':{}});
assert.ok(el(Shock.PriceShockReadiness).includes('Refreshing verification state'));
assert.ok(el(Shock.PriceShockReadiness).includes('HappyFares'));
assert.ok(el(Shock.PriceShockReadinessView,{data:shockData}).includes('UNAVAILABLE'));
assert.ok(!el(Shock.PriceShockReadinessView,{data:shockData}).includes('0 candidates'));
shockQuery={isError:true};assert.ok(el(Shock.PriceShockReadiness).includes('Unable to load Price Shock'));
assert.ok(!el(Shock.PriceShockReadiness).includes('No eligible LIVE'));
let gateQuery={isPending:true},route='/overview';
const Gate=load('components/data/LiveDataGate.tsx',{
 'next/navigation':{usePathname:()=>route},'@tanstack/react-query':{useQuery:()=>gateQuery,useQueryClient:()=>({})},
 '@/lib/providers/DataModeProvider':{useDataMode:()=>({mode:'real'})},'@/lib/api/client':{},'@/components/skeletons/OverviewSkeleton':{OverviewSkeleton:Skeleton},
}).LiveDataGate;
assert.ok(el(Gate,{children:'actual dashboard'}).includes('Preparing live intelligence'));
gateQuery={data:{ready:true},isFetching:true};assert.ok(el(Gate,{children:'actual dashboard'}).includes('actual dashboard'));
gateQuery={isError:true};assert.ok(el(Gate,{children:'actual dashboard'}).includes('Unable to load live overview'));
gateQuery={data:{ready:false}};assert.ok(el(Gate).includes('No processed data published yet'));
route='/apix';gateQuery={isPending:true};assert.equal(el(Gate,{children:'readiness'}),'readiness');
const overview=fs.readFileSync(path.resolve(__dirname,'../app/(dashboard)/overview/page.tsx'),'utf8');
assert.ok(overview.includes('disabled={isCtxLoading || isSummaryPending'));
assert.ok(overview.includes('faresError && !faresList'));
assert.ok(overview.includes('isContribPending'));
assert.ok(!overview.includes('loading={isContribFetching}'));
console.log('PASS: readiness dates, honest unknowns, progress bounds, stored index transition, Overview gate, cached refresh and error states');

let context={ctx:{total_eligible:111,live_count:85,imported_count:26,routes:['DEL-BOM'],historical_days:9,booking_windows:[],booking_window_buckets:[]},hasData:true};
let summaryResult={summary:{open_anomalies:14,quotes_24h:111},data:{},isPending:false};
let contributors={contributors:{up:[],down:[]},isPending:true};
let faresResult={isPending:true};
let errorRetry;
const nullComponent=()=>null;
const Overview=load('app/(dashboard)/overview/page.tsx',{
 'next/navigation':{useRouter:()=>({push:()=>{}}),useSearchParams:()=>new URLSearchParams()},
 '@tanstack/react-query':{useQuery:()=>({isPending:true}),useQueryClient:()=>({invalidateQueries:()=>Promise.resolve()})},
 '@/lib/providers/DataModeProvider':{useDataMode:()=>({mode:'real'})},
 '@/lib/hooks/useLiveModeContext':{useLiveModeContext:()=>context},
 '@/lib/hooks/useDashboard':{useDashboardSummary:()=>summaryResult,useNationalTrend:()=>({}),useRouteContributors:()=>contributors,useSystemTrust:()=>({trust:{}})},
 '@/lib/hooks/usePriceShocks':{usePriceShocks:()=>({activeCount:0})},
 '@/lib/hooks/useResources':{useAnomalies:()=>({isPending:true}),useSources:()=>({isPending:true}),useFares:()=>faresResult},
 '@/lib/api/client':{},'@/lib/notify':{},'@/lib/formatters':{formatINR:n=>String(n)},
 '@/components/readiness/ReadinessUI':{ReadinessError:props=>{errorRetry=props.retry;return React.createElement('div',null,props.title);}},
 '@/components/skeletons/OverviewSkeleton':{OverviewSkeleton:Skeleton},
 '@/components/charts/EChartWrapper':{EChartWrapper:nullComponent},
 '@/components/charts/NationalIndexChart':{NationalIndexChart:nullComponent},
 '@/components/ui/SyncIndicator':{SyncIndicator:nullComponent},
 '@/components/layout/GlobalFilterBar':{GlobalFilterBar:()=>React.createElement('div',null,'Filters')},
 '@/components/data/GenerateReportButton':{GenerateReportButton:p=>React.createElement('button',{disabled:p.disabled},'Generate Report')},
 '@/components/ui/Badge':{OriginBadge:nullComponent},
}).default;
context={...context,isLoading:true,hasData:false};
assert.ok(el(Overview).includes('Preparing live intelligence'));
assert.ok(!el(Overview).includes('No eligible data yet'));
context={...context,isLoading:false,hasData:true};
const progressive=el(Overview);
assert.ok(progressive.includes('111'));
assert.ok(progressive.includes('animate-pulse'));
assert.ok(progressive.includes('disabled=""'));
let retried=false;
faresResult={error:Error('network'),refetch:()=>{retried=true;}};
assert.ok(el(Overview).includes('Unable to load latest observations'));
errorRetry();assert.equal(retried,true);
faresResult={data:{items:[]},isFetching:true};
contributors={contributors:{up:[],down:[]},isPending:false};
summaryResult={...summaryResult,isFetching:true};
assert.ok(el(Overview).includes('111'));
assert.ok(el(Overview).includes('No live observations yet'));
console.log('PASS: actual Overview pending resolver, progressive panels, report gating, retry and cached refresh');
module.exports={apiData,shockData,API,Shock,Skeleton};
