/**
 * R1046 non-disclosure regression. No real tokens, providers, Firebase
 * network access or cloud credentials. Synthetic canaries only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

const entry=fileURLToPath(new URL('./life-movies-write-reservations.review-emulator.mjs',import.meta.url));
const base={
 PATH:process.env.PATH||'/usr/bin:/bin',
 HOME:process.env.HOME||'/tmp',
 URAI_EMULATOR_PROJECT:'urai-staging-test',
 FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
 FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199',
};
for(const key of ['RUNPOD_API_KEY','GITHUB_TOKEN','GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN']){
 test('R1046 '+key+' is rejected without echoing the synthetic token',()=>{
  const marker='R1046_SYNTHETIC_MUST_NOT_LEAK_'+key;
  const result=spawnSync(process.execPath,[entry],{
   env:{...base,[key]:marker},encoding:'utf8',timeout:5000
  });
  assert.notEqual(result.status,0,'unsafe credential was not rejected');
  assert.match(result.stderr,new RegExp(key+' must be absent'));
  assert.equal((result.stdout+result.stderr).includes(marker),false,'synthetic token leaked to output');
 });
}
test('R1046 emulator fixture refuses sensitive credentials before any Firebase import',()=>{
 const src=readFileSync(entry,'utf8');
 const checks=src.indexOf("for (const name of ['GOOGLE_APPLICATION_CREDENTIALS'");
 const imports=src.indexOf("const require = createRequire(");
 assert.ok(checks>=0&&imports>checks,'credential protection must precede Firebase SDK loads');
 assert.match(src,/if \(process\.env\[name\]\) throw new Error\(name \+ ' must be absent'\)/);
});