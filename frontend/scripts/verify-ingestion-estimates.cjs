const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const path=require('node:path');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/ingestion-estimate.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('exports','module',code)(m.exports,m);const x=m.exports;
for(const [n,band,seconds] of [[20,'small',40],[80,'medium',70],[400,'large',230],[1000,'very large',530]]) {
 assert.equal(x.batchSize(n),band); assert.equal(x.estimateIngestion(n,[]).seconds,seconds);
}
const history=[40,42,900].map(duration_seconds=>({observation_count:80,duration_seconds}));
const original=JSON.stringify(history);
assert.equal(x.estimateIngestion(80,history).seconds,42);
assert.equal(x.estimateIngestion(800,history).historical,false);
assert.equal(JSON.stringify(history),original,'history must not mutate');
assert.equal(x.estimateIngestion(80,history.slice(0,2)).historical,false);
assert.equal(x.estimateIngestion(20,[],{base_seconds:10,per_observation_seconds:2,min_history:3}).seconds,50);
assert.match(x.remainingRange(40,134),/Taking longer/);
const p={status:'RUNNING',completed_stages:10,total_stages:10};
assert.equal(x.confirmedProgress(p),99);
assert.equal(x.confirmedProgress({...p,status:'COMPLETED'}),100);
assert(x.confirmedProgress({...p,status:'FAILED'})<100);
assert.equal(x.confirmedProgress({...p,completed_stages:1,total_stages:2,completed_stage_names:['VALIDATE']},{VALIDATE:1,FAREGUARD:9}),10);
assert.equal(x.smoothEstimate(40,100),52);
assert(x.smoothEstimate(100,40)>40);
console.log('Ingestion estimate checks passed: size bands, median, fallback, immutable history, overrun, confirmed progress, stage weighting, smooth estimate updates.');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const uiCode=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/components/ui/CollectionProgress.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const ui={exports:{}};new Function('require','module','exports',uiCode)(name=>name==='@/lib/ingestion-estimate'?x:require(name),ui,ui.exports);
function render(status,elapsed=5) {return renderToStaticMarkup(React.createElement(ui.exports.CollectionProgress,{progress:{status,observation_count:80,completed_stages:10,total_stages:10,current_stage:'FAREGUARD',started_at:new Date(Date.now()-elapsed*1000).toISOString()}}));}
assert.match(render('FAILED'),/aria-busy="false"/);
assert.match(render('COMPLETED'),/value="100"/);
assert.match(render('RUNNING'),/value="99"/);
const overdue=render('RUNNING',300);
assert.match(overdue,/Taking longer than usual/);
assert(!/<progress[^>]*value=/.test(overdue));
assert.match(overdue,/aria-busy="true"/);
console.log('Progress rendering passed: failure stops animation; backend completion alone sets 100; overdue remains indeterminate.');
