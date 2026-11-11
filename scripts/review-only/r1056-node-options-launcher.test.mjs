import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const runner=fileURLToPath(new URL('../run-four-emulator-acceptance.sh', import.meta.url));
const runnerSource=readFileSync(runner,'utf8');
test('R1056 shell entrypoint denies inherited NODE_OPTIONS before Node or pnpm',()=>{
 const preflight=runnerSource.indexOf('[[ -z "${NODE_OPTIONS:-}" ]]');
 const nodeCall=runnerSource.indexOf('command -v node');
 const pnpmCall=runnerSource.indexOf('command -v pnpm');
 assert.ok(preflight>0 && preflight<nodeCall && preflight<pnpmCall);
 for(const NODE_OPTIONS of ['-r SYNTHETIC_PRELOAD_CREDENTIAL_CANARY', '--inspect-brk=127.0.0.1:9229', '--max-old-space-size=1024']){
   const result=spawnSync('bash',[runner],{
     env:{PATH:process.env.PATH||'/usr/bin:/bin',NODE_OPTIONS},
     encoding:'utf8',timeout:2000
   });
   assert.equal(result.status,1);
   assert.match(result.stderr,/URAI_FOUR_EMULATOR_HOLD: Inherited NODE_OPTIONS is forbidden/);
   assert.ok(!result.stderr.includes('SYNTHETIC_PRELOAD_CREDENTIAL_CANARY'));
   assert.equal(result.stdout,'');
 }
});
