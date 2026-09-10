const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const {QueryClient}=require('@tanstack/react-query');
const root=path.join(__dirname,'../src');
let mode='real',payload={items:[],active_count:0},options;
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
function load(file){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(name=>{
 if(name==='@tanstack/react-query')return {useQuery:o=>{options=o;return {data:client.getQueryData(o.queryKey)}}};
 if(name==='@/lib/providers/DataModeProvider')return {useDataMode:()=>({mode})};
 if(name==='@/lib/api/client')return {getData:async()=>payload};
 if(name==='@/lib/mock-data/shocks')return load('lib/mock-data/shocks.ts');
 return require(name);
},m.exports,m);return m.exports;}
const {usePriceShocks}=load('lib/hooks/usePriceShocks.ts');
(async()=>{
 client.setQueryData(['dashboard-summary','real'],{critical_anomalies:12,open_anomalies:14});
 assert.equal(usePriceShocks().activeCount,0);
 await client.fetchQuery(options);assert.equal(usePriceShocks().activeCount,0);
 payload={items:[{id:'a'},{id:'b'},{id:'c'}],active_count:3};
 await client.invalidateQueries({queryKey:['price-shocks']});await client.fetchQuery(options);
 assert.equal(usePriceShocks().activeCount,3);assert.equal(usePriceShocks().shocks.length,3);
 payload={items:[],active_count:0};await client.invalidateQueries({queryKey:['price-shocks']});await client.fetchQuery(options);
 assert.equal(usePriceShocks().activeCount,0);
 mode='mock';assert.equal(usePriceShocks().activeCount,0);await client.fetchQuery(options);assert.equal(usePriceShocks().activeCount,2);
 mode='real';assert.equal(usePriceShocks().activeCount,0);
 const read=f=>fs.readFileSync(path.join(root,f),'utf8');
 assert(read('components/layout/Sidebar.tsx').includes("'/shocks': shocksLoading || shocksError ? undefined : activeCount"));
 assert(read('app/(dashboard)/shocks/page.tsx').includes('usePriceShocks()'));
 assert(read('lib/hooks/useRealtimeSubscription.ts').includes('alerts: [["alerts"], ["dashboard-summary"], ["price-shocks"]]'));
 assert(read('components/layout/AppShell.tsx').includes('useRealtimeSubscription();'));
 assert(!read('components/layout/AppShell.tsx').includes('REALTIME_LABEL'));
 assert(!read('components/layout/TopCommandBar.tsx').includes('Updated 2m ago'));
 assert(read('components/layout/Sidebar.tsx').includes("label: 'Live Scraping', href: '/scraping-test', icon: Terminal"));
 assert(!read('app/(dashboard)/overview/page.tsx').includes('Latest ingestion timestamp:'));
 const {DataFreshness}=load('components/ui/DataFreshness.tsx');
 for(const isRealtime of [true,false])assert.equal(DataFreshness({isRealtime,timestamp:new Date(),source:'AirPulse Backend (live)'}),null);
 console.log('Shared shock cache, live/demo isolation, realtime invalidation, 0/3 counts, anomaly isolation, badge removal and unchanged navigation checks passed.');
 client.clear();
})().catch(e=>{console.error(e);process.exitCode=1;client.clear();});
