import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createRequire}from'node:module';import vm from'node:vm';const ts=createRequire(new URL('../functions/package.json', import.meta.url))('typescript');const source=readFileSync(new URL('../functions/src/privacy/lifeMovieCreationAdmission.ts',import.meta.url),'utf8');const m=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});assert.equal((m.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);let n=0;function testEnv(enabled){const calls=[];const module={exports:{}};vm.runInNewContext(m.outputText,{module,exports:module.exports,Promise,Error,require(name){if(name==='./lifeMovieConsentGate.js')return {LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE:'life_movie_consent_authority_unavailable',lifeMovieConsentAuthorityAvailable:()=>enabled};if(name==='./lifeMovieTrustedAdmission.js')return {createTrustedLifeMovieAdmissionPreflight(config,deps){calls.push('factory');return async request=>{calls.push(request);if(deps.reject)throw Error('life_movie_source_rights_unverified')}}};throw Error(name)}},{filename:'creation.js'});return {fn:module.exports.requireLifeMovieCreationAdmission,calls}}const req={ownerUid:'owner-1',tenantId:'tenant-1',consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:'c'.repeat(64)},selection:{projectId:'movie-1',renderPlanDigest:'a'.repeat(64),sources:[{id:'media-1',generation:'1793378565000001'}]}};const authority={config:{},dependencies:{}};for(const [enabled,provided] of [[false,true],[true,false]]){const s=testEnv(enabled);await assert.rejects(()=>s.fn(req,provided?authority:undefined),/authority_unavailable/);assert.equal(s.calls.length,0);n+=2}const x=testEnv(true);await x.fn(req,authority);assert.equal(x.calls.length,2);assert.equal(x.calls[1],req);n+=2;const y=testEnv(true);await assert.rejects(()=>y.fn(req,{config:{},dependencies:{reject:true}}),/source_rights_unverified/);n++;for(const [file,name] of [['../functions/src/jobs/studioLifeMovieBridge.ts','createLifeMovieJob'],['../functions/src/jobs/studioLifeMovieLongformBridge.ts','createPlan']]){const code=readFileSync(new URL(file,import.meta.url),'utf8');const tsFile=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true);const fn=tsFile.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===name);assert.ok(fn?.body);const body=fn.body.getText(tsFile),start=body.indexOf('await requireLifeMovieCreationAdmission(');assert.ok(start>=0);for(const target of ['getFirestore(','.runTransaction(','.create(','.set(']){const i=body.indexOf(target);assert.ok(i<0||start<i,name+' '+target)}assert.match(code,/from '\.\.\/privacy\/lifeMovieCreationAdmission\.js'/);n+=7}
for(const [file,name] of [
  ['../functions/src/jobs/studioLifeMovieBridge.ts','createLifeMovieJob'],
  ['../functions/src/jobs/studioLifeMovieLongformBridge.ts','createPlan']
]){
  const path=new URL(file,import.meta.url);
  const source=readFileSync(path,'utf8');
  const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const creation=parsed.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
  assert.ok(creation?.body,name+' must be a concrete function');
  const calls=[];
  const visit=node=>{
    if(ts.isCallExpression(node)&&node.expression.getText(parsed)==='requireLifeMovieCreationAdmission')calls.push(node);
    ts.forEachChild(node,visit);
  };
  visit(creation.body);
  assert.equal(calls.length,1,name+' must have one admission preflight');
  const arg=calls[0].arguments[0];
  assert.ok(ts.isObjectLiteralExpression(arg),name+' must explicitly bind request authority');
  const selectionField=arg.properties.find(prop=>ts.isPropertyAssignment(prop)&&prop.name.getText(parsed)==='selection');
  assert.ok(selectionField&&ts.isObjectLiteralExpression(selectionField.initializer),
    name+' must project selection rather than forwarding an entire caller payload');
  const fields=selectionField.initializer.properties;
  assert.deepEqual(fields.map(prop=>prop.name.getText(parsed)),['projectId','renderPlanDigest','sources']);
  for(const field of fields){
    assert.ok(ts.isPropertyAssignment(field) && ts.isPropertyAccessExpression(field.initializer));
    assert.equal(field.initializer.expression.getText(parsed),'payload');
    assert.equal(field.initializer.name.text,field.name.getText(parsed));
  }
  n+=10;
}

console.log('[PASS] '+n+' focused creation-boundary assertions; no production authority activated');