import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const helper = readFileSync(new URL('../functions/src/privacy/lifeMovieBoundedResponse.ts', import.meta.url),'utf8');
const compiled = ts.transpileModule(helper, {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  reportDiagnostics:true,
});
assert.equal(compiled.diagnostics?.length||0,0);
const module={exports:{}};
vm.runInNewContext(compiled.outputText,{module,exports:module.exports,Buffer,Error,Number,ArrayBuffer,JSON,Math});
const read=module.exports.readLifeMovieBoundedJson;
assert.equal(typeof read,'function');
const bytes = str=>new TextEncoder().encode(str);
const reply = (str, headers={}) => new Response(str,{headers:{'content-type':'application/json',...headers}});
const rejects = async(resp,pattern) => assert.rejects(()=>read(resp),pattern);

test('actual JSON streams parse with exact returned value', async()=>{
  const input={result:{allowed:true,ownerUid:'owner-123',scope:'life-movie.render'}};
  const got=await read(reply(JSON.stringify(input)));
  assert.deepEqual(JSON.parse(JSON.stringify(got)),input);
});
test('multi-chunk valid body succeeds without response.text()',async()=>{
  const chunks=['{"result":','{"ok":true}}'];
  let readText=0;
  const response=reply(JSON.stringify({unused:true}));
  Object.defineProperty(response,'body',{value:new ReadableStream({start(c){for(const s of chunks)c.enqueue(bytes(s));c.close();}})});
  response.text=()=>{readText++;throw Error('unbounded text() invoked');};
  assert.equal((await read(response)).result.ok,true);
  assert.equal(readText,0);
});
test('untrusted 16 KiB advertised length rejected before consuming stream',async()=>{
  let touched=0;
  const response=reply('{}',{'content-length':'16385'});
  Object.defineProperty(response,'body',{value:new ReadableStream({pull(c){touched++;c.enqueue(bytes('{}'));c.close();}})});
  await rejects(response,/invalid_length/);
  assert.ok(touched <= 1);
});
test('missing, invalid and dishonest Content-Length cannot bypass byte cap',async()=>{
  for(const bad of ['NaN','-1','99999999999','16385','3.5','1e9']){
    await rejects(reply('{}',{'content-length':bad}),/invalid_length/);
  }
  for(const hdr of [{},{'content-length':'1'}]){
    await rejects(reply('x'.repeat(16385),hdr),/oversize/);
  }
});
test('a malicious endless response is cancelled after reaching hard limit',async()=>{
  let pulls=0,cancelled=0;
  const stream=new ReadableStream({
    pull(c){pulls++;c.enqueue(bytes('x'.repeat(8193)));},
    cancel(){cancelled++;}
  },{highWaterMark:0});
  const response=reply('{}');
  Object.defineProperty(response,'body',{value:stream});
  await rejects(response,/oversize/);
  assert.ok(pulls<=3,'must stop rather than buffer an unlimited provider response');
  assert.equal(cancelled,1);
});
test('exact boundary admits valid JSON and next byte denies',async()=>{
  const pad=16384-JSON.stringify({r:''}).length;
  const valid=JSON.stringify({r:'x'.repeat(pad)});
  assert.equal(bytes(valid).length,16384);
  assert.equal((await read(reply(valid))).r.length,pad);
  await rejects(reply(valid+'x'),/oversize/);
});
test('empty, malformed JSON and invalid streams fail closed',async()=>{
  await rejects(reply(''),/empty/);
  await rejects(reply('{invalid'),/SyntaxError|Unexpected/);
  const response=reply('{}');
  Object.defineProperty(response,'body',{value:null});
  await rejects(response,/missing_stream/);
});
test('invalid bytes cannot sneak past the limit or be parsed',async()=>{
  const response=reply('{}');
  Object.defineProperty(response,'body',{value:new ReadableStream({start(c){c.enqueue({byteLength:1});c.close();}})});
  await rejects(response,/invalid_chunk/);
});
test('invalid caller limits reject without reading anything',async()=>{
  for(const limit of [-1,0,16385,NaN,1.5])await assert.rejects(()=>read(reply('{}'),limit),/invalid_limit/);
});
test('real provider wrappers import shared limit and never call response.text()',()=>{
  for(const name of ['lifeMovieConsentTransport.ts','lifeMovieJobsTokenProvider.ts']){
    const content=readFileSync(new URL('../functions/src/privacy/'+name,import.meta.url),'utf8');
    assert.match(content,/readLifeMovieBoundedJson/);
    assert.doesNotMatch(content, /await response\.text\(\)/);
  }
});
