'use strict';
// R1586 review-only security regression. All network sockets are bound to
// 127.0.0.1; Firebase Admin APIs and credentials are never invoked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { once } = require('node:events');
const { createRequire } = require('node:module');

const requireFromFunctions = createRequire(path.join(__dirname, '../functions/package.json'));
const ts = requireFromFunctions('typescript');
const source = fs.readFileSync(path.join(__dirname,
  '../functions/src/privacy/consentRevocationAcknowledgement.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const demoProject='urai-r1586-review-only';
const syntheticToken='R1586_LOCAL_SYNTHETIC_SIGNED_TOKEN_ONLY';

async function bindLoopback(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}
async function close(server) {
  if (server.listening) await new Promise((resolve,reject) =>
    server.close(err => err ? reject(err) : resolve()));
}
function loadAckModule(authPort) {
  const env = {
    URAI_PRIVACY_ACK_PROJECT_ID: demoProject,
    URAI_PRIVACY_ACK_SERVICE_UID: 'synthetic-jobs-consumer',
    URAI_PRIVACY_ACK_FIREBASE_API_KEY: 'SyntheticOnlyApiKey12345',
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}`,
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  };
  const stats = { minted: 0 };
  const local = { exports: {} };
  const runner = vm.runInNewContext(
    '(function(require,module,exports,process,fetch,AbortSignal,URL){' + compiled + '})',
    { console });
  runner((name) => {
    if (name === 'firebase-admin/app') return { getApp: () => ({ options: { projectId: demoProject } }) };
    if (name === 'firebase-admin/auth') return { getAuth: () => ({
      createCustomToken: async () => { stats.minted++; return syntheticToken; },
    }) };
    throw new Error('Unexpected dependency in isolated policy test: ' + name);
  }, local, local.exports, { env }, fetch, AbortSignal, URL);
  return { ...local.exports, stats };
}

for (const status of [301,302,307,308]) {
  test(`Firebase custom token cannot follow Identity Toolkit HTTP ${status} redirect`, async () => {
    const counts = { source: 0, receiver: 0 };
    const receiver = http.createServer(async (req,res) => {
      counts.receiver++;
      for await (const chunk of req) { void chunk; }
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({ idToken: 'SyntheticOnlyFallbackIdToken12345' }));
    });
    const sourceServer = http.createServer(async (req,res) => {
      counts.source++;
      for await (const chunk of req) { void chunk; }
      res.writeHead(status,{ location: `http://127.0.0.1:${receiver.address().port}/unexpected-receiver` });
      res.end();
    });
    try {
      await bindLoopback(receiver);
      const sourcePort = await bindLoopback(sourceServer);
      const api = loadAckModule(sourcePort);
      await assert.rejects(api.jobsPrivacyIdToken(), {name:'TypeError'});
      assert.equal(api.stats.minted, 1, 'synthetic signer should be invoked once');
      assert.equal(counts.source, 1, 'only configured loopback port should be reached');
      assert.equal(counts.receiver, 0, 'redirect destination must receive zero requests');
    } finally {
      await close(sourceServer); await close(receiver);
    }
  });
}

test('direct local Identity Toolkit exchange still works without a redirect', async () => {
  let requests=0;
  const server=http.createServer(async(req,res)=>{
    requests++;
    assert.equal(req.method,'POST');
    assert.equal(req.url.startsWith('/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key='),true);
    let body=''; for await(const chunk of req) body+=chunk;
    assert.equal(JSON.parse(body).token,syntheticToken);
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({ idToken: 'SyntheticOnlyDirectIdToken123456' }));
  });
  try {
    const port=await bindLoopback(server);
    const api=loadAckModule(port);
    const token=await api.jobsPrivacyIdToken();
    assert.equal(token,'SyntheticOnlyDirectIdToken123456');
    assert.equal(api.stats.minted,1);
    assert.equal(requests,1);
  } finally { await close(server); }
});
