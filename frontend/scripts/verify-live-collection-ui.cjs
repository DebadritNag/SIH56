/* Isolated component-state regression checks; no network calls or live fares. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const fixedNow = Date.now(); Date.now = () => fixedNow;
const root = path.resolve(__dirname, '..');
let scenario, mutations, queries, states;
const corridors = [
  {id:'DEL-BOM',origin:'DEL',destination:'BOM',label:'Delhi (DEL) → Mumbai (BOM)'},
  {id:'DEL-CCU',origin:'DEL',destination:'CCU',label:'Delhi (DEL) → Kolkata (CCU)'},
  {id:'BOM-BLR',origin:'BOM',destination:'BLR',label:'Mumbai (BOM) → Bengaluru (BLR)'},
];
const fakeReact = {...React, useEffect:()=>{}, useRef:value=>({current:value}), useState:init=>{
  const index = states++;
  const value = index === 3 ? 'DEL-CCU' : typeof init === 'function' ? init() : init;
  return [value,()=>{}];
}};
const query = {
  useQueryClient:()=>({invalidateQueries:async()=>{}}),
  useQuery:options=>{
    queries.push(options);
    return {data: options.queryKey[0] === 'live-config' ? {corridors,enabled:true,worker_enabled:true,engine:'CRAWL4AI',...scenario.config} : options.queryKey[0] === 'live-runs' ? (scenario.run ? [scenario.run]:[]) : scenario.run, dataUpdatedAt:Date.now()};
  },
  useMutation:options=>{
    const entry = {options,isPending:false,mutate:()=>entry.calls++,calls:0,reset:()=>{}};
    mutations.push(entry); return entry;
  },
};
function load(file, mocked=false) {
  const filename=path.join(root,file);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>{
    if(name==='react' && mocked) return fakeReact;
    if(name==='@tanstack/react-query') return query;
    if(name==='@/lib/api/client') return {getData:()=>{},postData:(url,payload)=>({url,payload})};
    if(name==='./LiveCollectionTelemetry') return load('src/components/LiveCollectionTelemetry.tsx');
    return require(name);
  },module,module.exports);
  return module.exports;
}
const Component=load('src/components/LiveCollection.tsx',true).default;
function nodes(tree,type) {
  if(!tree || typeof tree!=='object') return [];
  if(Array.isArray(tree)) return tree.flatMap(x=>nodes(x,type));
  return [...(tree.type===type ? [tree]:[]),...nodes(tree.props?.children,type)];
}
function render(run,config={}) {
  scenario={run,config}; mutations=[]; queries=[]; states=0;
  const tree=Component(); return {tree,html:renderToStaticMarkup(tree)};
}
const request={source:'happyfares',origin:'DEL',destination:'CCU',departure_date:'2026-09-17'};
const run={id:'test-run',created_at:new Date().toISOString(),status:'RUNNING',quotes_received:0,metadata:{request,ingestion_state:'ACQUIRING',progress:{stage:'NAVIGATION',status:'RUNNING',stages:[{stage:'POLICY_CHECK',status:'COMPLETED'},{stage:'BROWSER_LAUNCH',status:'COMPLETED'},{stage:'NAVIGATION',status:'RUNNING'}]}},pipelines:[]};
let view=render(run);
assert(nodes(view.tree,'select').every(n=>n.props.disabled));
assert(nodes(view.tree,'input').every(n=>n.props.disabled));
assert(view.html.includes('Scraping live fares'));
assert(view.html.includes('Live Pipeline Telemetry'));
assert(view.html.includes('2 of 6 stages confirmed complete'));
view=render({...run,status:'FAILED',metadata:{request,ingestion_state:'FAILED'}});
assert.equal(nodes(view.tree,'input')[0].props.disabled,false);
const form=nodes(view.tree,'form')[0];
form.props.onSubmit({preventDefault(){}}); form.props.onSubmit({preventDefault(){}});
assert.equal(mutations[0].calls,1,'Immediate double submission must be suppressed');
const sent=mutations[0].options.mutationFn();
assert.equal(sent.payload.origin,'DEL'); assert.equal(sent.payload.destination,'CCU');
assert.match(sent.payload.departure_date,/^\d{4}-\d{2}-\d{2}$/);
assert.equal(sent.payload.max_results,5);
view=render({...run,status:'COMPLETED',metadata:{request,ingestion_state:'QUEUED'},pipelines:[{id:'ingest',pipeline_type:'live_ingestion',status:'RUNNING'}]});
assert(view.html.includes('Sending to Data Ingestion'));
assert(nodes(view.tree,'button').some(n=>n.props.disabled && renderToStaticMarkup(n).includes('Sending to Data Ingestion')));
view=render(undefined,{server_now:new Date().toISOString(),cooldown_until:new Date(Date.now()+180000).toISOString()});
assert(view.html.includes('Source cooldown'));
assert(view.html.includes('Available in 3:00'));
view=render(undefined,{server_now:new Date().toISOString(),cooldown_until:new Date(Date.now()-1000).toISOString()});
assert(!view.html.includes('Source cooldown'));
const overview=fs.readFileSync(path.join(root,'src/app/(dashboard)/overview/page.tsx'),'utf8');
assert(overview.includes('!meta.isMock && isSummaryPending'));
assert(overview.includes('Loading live overview'));
console.log('Live UI checks passed: route/date payload, active controls, failure recovery, double-click guard, cooldown expiry, real stage rendering, asynchronous ingestion, Overview skeleton.');
const target=process.argv.indexOf('--preview');
if(target>=0) {
  const dir=path.join(root,'scratch'); fs.mkdirSync(dir,{recursive:true});
  const cssDir=path.join(root,'.next/static/css');
  const {pathToFileURL}=require('node:url');
  const styles=fs.existsSync(cssDir)?fs.readdirSync(cssDir).filter(f=>f.endsWith('.css')).map(f=>`<link rel="stylesheet" href="${pathToFileURL(path.join(cssDir,f))}">`).join(''):'';
  const html=render(run).html;
  fs.writeFileSync(path.join(dir,'live-ui-preview.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body style="background:#f8fafc;margin:0;font-family:Arial">${html}</body></html>`);
}
