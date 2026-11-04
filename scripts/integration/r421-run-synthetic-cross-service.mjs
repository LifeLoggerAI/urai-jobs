/**
 * Nonproduction, pin-checked, cross-repository signed-identity rehearsal.
 * NO Firebase Auth emulator, real issuer, production signer or positive render grant.
 * Required checkouts: Jobs (this repo), Privacy and Studio at pinned source blobs.
 * Does not modify tracked sources. Only synthetic in-memory HTTP/Firestore.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const jobsRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const privacyRoot=path.resolve(process.env.URAI_PRIVACY_ROOT||path.join(jobsRoot,'../urai-privacy'));
const studioRoot=path.resolve(process.env.URAI_STUDIO_ROOT||path.join(jobsRoot,'../urai-studio'));
const typeRequire=createRequire(pathToFileURL(path.join(jobsRoot,'functions/package.json')));
let ts;
try{ts=typeRequire('typescript')}catch{throw Error('Install original Jobs Functions dependencies: typescript required for source-bound rehearsal')}
const pin=[
 ['jobs','functions/src/privacy/lifeMovieConsentGate.ts','53761ac0f5c0340563b13fdd9a12a90e75409d42'],
 ['jobs','functions/src/privacy/lifeMovieBoundedResponse.ts','88b5c3117b9c8d5d8d903efc015b58bc17590b0d'],
 ['jobs','functions/src/privacy/lifeMovieConsentDecision.ts','c1e05bf386bd47ff64bec20623cc50f29a9d1aa5'],
 ['jobs','functions/src/privacy/lifeMovieConsentTransport.ts','c1bdbb0f196f2f678bdf2d377d1aa0eea0cc56ae'],
 ['jobs','functions/src/privacy/lifeMovieJobsTokenProvider.ts','648225708e055592ee697e0dc342bfcf1bc144e4'],
 ['jobs','functions/src/privacy/lifeMovieJobsPrivacyClient.ts','73d65b003f4141cd471db1e6a0edff9d7a1c747f'],
 ['jobs','functions/src/privacy/lifeMovieAdmissionPreflight.ts','ed9d6289d3443aa634748649a2df19c64016c02f'],
 ['jobs','functions/src/jobs/studioLifeMovieContract.ts','5f944e906de7243d7415ac479cf92356b09c84c9'],
 ['privacy','functions/src/life-movie-jobs-identity.ts','78f3cfe4b22fd39500ce3d94de55c9c5f46c7970'],
 ['privacy','functions/src/consent-decision.ts','35c699bd225c687bab8f1fd8e7315facc16c8148'],
 ['privacy','functions/src/life-movie-scoped-receipt.ts','a41f4cf9c2efb525115ec31359d936c8b2f66f6e'],
 ['privacy','functions/src/life-movie-render-authorization.ts','a75e4f2297c331baa52b044f2842820adbdc7fc8'],
 ['privacy','functions/src/life-movie-deletion-fence.ts','e08751e59846b06e366d93d1d8bdac7afeaf3b6e'],
 ['privacy','functions/src/cross-user-authority.ts','443097baa409c289b4189f98e4c56c7ab70aaa31'],
 ['studio','apps/studio/lib/studio-life-movie-jobs-client.ts','0ca262e114b0439426d75cf7ac510e289ba315eb'],
 ['studio','apps/studio/lib/studio-life-movie-longform-contract.ts','b61484f218a46b56fbe479dadec73595b8599b3f'],
 ['studio','apps/studio/lib/studio-life-movie-jobs-bridge.ts','c995395da7f543659512dc633e3a2497ff4bb6ff'],
];
function gitBlob(buffer){return createHash('sha1').update(Buffer.concat([Buffer.from('blob '+buffer.length+'\0'),buffer])).digest('hex')}
const roots={jobs:jobsRoot,privacy:privacyRoot,studio:studioRoot};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'urai-r421-synthetic-'));
let failed=false;
try{
 for(const [repo,relative,expected] of pin){
  const sourcePath=path.join(roots[repo],relative);
  const source=fs.readFileSync(sourcePath),actual=gitBlob(source);
  if(actual!==expected)throw Error(`STALE_OR_CHANGED_SOURCE ${repo}/${relative}: ${actual} != ${expected}`);
  if(relative==='functions/src/jobs/studioLifeMovieContract.ts'){
   const ast=ts.createSourceFile(relative,source.toString('utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
   const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='deriveStudioLifeMovieRenderScope');
   if(!fn)throw Error('Life Movie source derivation missing');
   const portion=source.toString('utf8').slice(fn.getStart(ast),fn.end);
   const code=ts.transpileModule("import {createHash} from 'node:crypto';\n"+portion,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:relative,reportDiagnostics:true});
   if(code.diagnostics?.length)throw Error('Scope compiler diagnostics');
   const out=path.join(tmp,repo,relative.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,code.outputText);continue;
  }
  const transpiled=ts.transpileModule(source.toString('utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:relative,reportDiagnostics:true});
  if(transpiled.diagnostics?.length)throw Error('TypeScript transpile diagnostics '+relative);
  const out=path.join(tmp,repo,relative.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,transpiled.outputText);
 }
 const stub=path.join(tmp,'studio/node_modules/server-only');fs.mkdirSync(stub,{recursive:true});fs.writeFileSync(path.join(stub,'index.js'),'module.exports={};\n');
 console.log('R421_PIN_VERIFIED',pin.length,'source blobs, three repositories. Synthetic only.');
 const r=spawnSync(process.execPath,['--test',path.join(jobsRoot,'scripts/integration/r421-synthetic-cross-service.test.mjs')],{env:{...process.env,R421_COMPILED_ROOT:tmp},stdio:'inherit',timeout:30000});
 if(r.error)throw r.error;
 if(r.status!==0){failed=true;console.error('R421_REHEARSAL_FAILED',r.status)}
 else console.log('R421_SYNTHETIC_REHEARSAL_PASSED; REAL EMULATOR AND PRODUCTION ADMISSION NOT PROVEN');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
if(failed)process.exitCode=1;
