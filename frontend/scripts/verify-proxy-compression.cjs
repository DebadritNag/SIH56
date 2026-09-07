// Run with: node scripts/verify-proxy-compression.cjs
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');

async function main() {
  const payload = JSON.stringify({ success: true, data: { message: 'Observed fares ₹4968' } });
  const encoders = { gzip: zlib.gzipSync, br: zlib.brotliCompressSync, deflate: zlib.deflateSync, identity: Buffer.from };
  const server = http.createServer((req, res) => {
    const mode = req.url.split('/').pop();
    const encoding = mode === 'slow' ? 'gzip' : mode;
    assert.equal(req.headers['accept-encoding'], 'identity');
    // Intentionally compress anyway to verify safety even if an upstream ignores identity.
    const bytes = encoders[encoding](Buffer.from(payload));
    const send = () => {
    res.writeHead(encoding === 'br' ? 503 : 200, {
      'content-type': 'application/json',
      ...(encoding === 'identity' ? {} : { 'content-encoding': encoding }),
      'content-length': bytes.length,
    });
    res.end(bytes);
    };
    if (mode === 'slow') setTimeout(send, 4500);
    else send();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = `http://127.0.0.1:${server.address().port}`;
    const filename = path.resolve(__dirname, '../src/app/api/proxy/[...path]/route.ts');
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const route = new Module(filename, module);
    route.filename = filename;
    route.paths = Module._nodeModulePaths(path.dirname(filename));
    route._compile(compiled, filename);
    for (const encoding of [...Object.keys(encoders), 'slow']) {
      const response = await route.exports.GET(
        new NextRequest(`http://localhost/api/proxy/${encoding}`, { headers: { 'accept-encoding': 'gzip, br' } }),
        { params: Promise.resolve({ path: [encoding] }) },
      );
      assert.equal(response.status, encoding === 'br' ? 503 : 200);
      assert.equal(response.headers.get('content-encoding'), null);
      assert.equal(response.headers.get('content-length'), null);
      assert.equal(response.headers.get('content-type'), 'application/json');
      assert.deepEqual(await response.json(), JSON.parse(payload));
      console.log(`PASS: ${encoding} response decodes correctly and preserves status`);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
