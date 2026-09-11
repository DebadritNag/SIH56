const fs=require('node:fs'), path=require('node:path'), ts=require('typescript'), assert=require('node:assert/strict');
const React=require('react'), {renderToStaticMarkup}=require('react-dom/server');
let response=null, loading=false;
function load(file){
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports','module',code)(name=>{
  if(name==='@/lib/canonical-fare')return load('lib/canonical-fare.ts');
  if(name==='@/lib/hooks/useResources')return {useFareProvenance:()=>({data:response,isLoading:loading})};
  if(name==='@/lib/providers/DataModeProvider')return {useDataMode:()=>({mode:'real'})};
  if(name==='@/lib/api/client')return {};
  if(name==='@/lib/formatters')return {formatINR:value=>`INR ${value}`};
  if(name==='@/lib/utils/timestamps')return {formatTimestamp:value=>value??'Not recorded'};
  if(name==='@/components/ui/Badge')return {OriginBadge:({origin})=>React.createElement('span',null,origin)};
  return require(name);
 },m.exports,m);return m.exports;
}
const {mapLiveFare,windowDescription}=load('lib/canonical-fare.ts');
const {FareProvenanceDrawer}=load('components/drawers/FareProvenanceDrawer.tsx');
const audit={data_origin:'LIVE',source_provider:'HappyFares',collection_run_id:'collection-real',ingestion_run_id:'ingestion-real',pipeline_run_id:'pipeline-real',acquisition_method:'CRAWL4AI',actual_lead_days:19,booking_window_bucket:'T+15',payload_sha256:'raw-payload-hash',lineage_steps:[{title:'PriceGuard',status:'NOT_SCORED',detail:'PREDICTION_UNAVAILABLE'}]};
const payload={id:'observation-real',origin_code:'DEL',destination_code:'BOM',departure_date:'2026-09-30',collected_at:'2026-09-11T00:00:00Z',source_provider:'HappyFares',collection_run_id:'collection-real',data_origin:'LIVE',total_fare:6000,actual_lead_days:19,booking_window_bucket:'T+15',fareguard_prediction:null,priceguard_status:'NOT_SCORED',anomaly_status:'NORMAL',collector_version:'happyfares-crawl4ai-v1',payload_sha256:'raw-payload-hash',audit};
const row=mapLiveFare(payload);
assert.equal(row.anomaly_status,'NOT_SCORED');assert.equal(row.provenance.fareguard_prediction,null);
assert.equal(row.source,audit.source_provider);assert.equal(row.provenance.response_hash,'raw-payload-hash');
assert.equal(windowDescription(row.booking_window,row.actual_lead_days),'T+15 bucket · 19 actual lead days');
assert.equal(windowDescription('T+1',0),'T+1 bucket · 0 actual lead days');
assert(!windowDescription('T+15',null).includes('0 actual'));
for(const classification of ['NORMAL','CRITICAL'])assert.equal(mapLiveFare({...payload,priceguard_status:'SCORED',anomaly_status:classification,fareguard_prediction:5000}).anomaly_status,classification);
assert.equal(mapLiveFare({...payload,data_origin:'IMPORTED'}).origin_type,'IMPORTED');
loading=true;
let markup=renderToStaticMarkup(React.createElement(FareProvenanceDrawer,{fare:row,onClose:()=>{}}));
for(const value of ['HappyFares','CRAWL4AI','ingestion-real','pipeline-real','19 actual lead days','PREDICTION_UNAVAILABLE','raw-payload-hash'])assert(markup.includes(value),value);
assert(!markup.includes('Unknown Source'));assert(!markup.includes('telemetry-v'));assert(!markup.includes('0 actual lead days'));
response=audit;loading=false;
markup=renderToStaticMarkup(React.createElement(FareProvenanceDrawer,{fare:row,onClose:()=>{}}));
assert(markup.includes('NOT_SCORED'));assert(!markup.includes('>NORMAL<'));
console.log('Canonical row/drawer rendering, provenance, null predictions, NOT_SCORED, imported origin and exact/bucket lead-day checks passed.');
