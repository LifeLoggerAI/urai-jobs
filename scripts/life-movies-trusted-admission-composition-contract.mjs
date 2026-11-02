import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const read = file => readFileSync(new URL('../functions/src/privacy/' + file, import.meta.url), 'utf8');
const composition = read('lifeMovieTrustedAdmission.ts');
const sourceRights = read('lifeMovieFirebaseSourceRightsAdapter.ts');
const admission = read('lifeMovieAdmissionPreflight.ts');
const privacy = read('lifeMovieJobsPrivacyClient.ts');
const gate = read('lifeMovieConsentGate.ts');
let checks = 0;
function has(source, pattern) { assert.match(source, pattern); checks++; }
function lacks(source, pattern) { assert.doesNotMatch(source, pattern); checks++; }
for (const [source, name] of [[composition,'composition'],[sourceRights,'adapter'],[admission,'preflight'],[privacy,'client']]) {
  const result = ts.transpileModule(source, { fileName: name + '.ts', reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022 } });
  assert.equal((result.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
  checks++;
}
has(composition, /createFirebaseLifeMovieSourceRightsVerifier\(/);
has(composition, /createAuthenticatedJobsPrivacyConsentClient\(/);
has(composition, /createLifeMovieAdmissionPreflight\(/);
has(composition, /verifySourceRights,\s*getCurrentPrivacyDecision/);
has(composition, /typeof dependencies\.nowMs !== 'function'/);
has(composition, /throw new Error\(UNAVAILABLE\)/);
lacks(composition, /process\.env|createCustomToken\(|lifeMovieConsentAuthorityAvailable\(/);
has(sourceRights, /typeof config\.assertCurrentOwner !== 'function'/);
has(sourceRights, /readRightsRecord\(id\)/);
has(sourceRights, /recordDecision\(event\)/);
has(admission, /await deps\.verifySourceRights\(/);
has(admission, /await deps\.getCurrentPrivacyDecision\(/);
has(privacy, /createDedicatedJobsFirebaseIdTokenProvider\(/);
has(gate, /lifeMovieConsentAuthorityAvailable\(\): boolean \{\s*return false;/);
console.log('[PASS] ' + checks + ' static composition guards; no Firebase or protected runtime acceptance.');
