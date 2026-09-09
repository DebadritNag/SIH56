const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file) {
  const filename=path.resolve(__dirname, '..', file);
  const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod=new Module(filename,module); mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename)); mod._compile(compiled,filename); return mod.exports;
}
(async()=>{
  process.env.NODE_ENV='production'; process.env.BACKEND_ORIGIN='http://13.53.46.72/'; delete process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN;
  const config=load('next.config.ts').default;
  assert.deepEqual(await config.rewrites(),[{source:'/backend-api/:path*',destination:'http://13.53.46.72/:path*'}]);
  process.env.NEXT_PUBLIC_API_BASE_URL='/backend-api'; process.env.NEXT_PUBLIC_API_V1_PREFIX='/api/v1';
  assert.equal(load('src/lib/config.ts').config.apiV1Url,'/backend-api/api/v1');
  process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN='demo-token';
  assert.equal((await config.rewrites())[0].destination,'http://13.53.46.72/:path*');
  assert.equal(load('src/lib/config.ts').config.devBearerToken,'');
  process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN='test-not-a-real-secret';
  await assert.rejects(config.rewrites(),/arbitrary credentials/);
  assert.equal(load('src/lib/config.ts').config.devBearerToken,'');
  delete process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN; delete process.env.BACKEND_ORIGIN;
  await assert.rejects(config.rewrites(),/BACKEND_ORIGIN/);
  process.env.NODE_ENV='development'; process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN='demo-token';
  assert.equal(load('src/lib/config.ts').config.devBearerToken,'demo-token');
  assert.equal((await config.rewrites())[0].destination,'http://127.0.0.1:8000/:path*');
  console.log('PASS: EC2 rewrite, combined API prefix, required production origin, production token rejection, safe development shortcut');
})().catch(e=>{console.error(e);process.exitCode=1;});
