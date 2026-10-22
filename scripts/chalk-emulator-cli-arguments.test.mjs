import test from 'node:test';
import assert from 'node:assert/strict';
import {chalkFirebaseExecArgs,chalkFirebaseWindowsCommand,chalkSupportedJavaVersion} from './chalk-emulator-cli-arguments.mjs';

test('POSIX passes emulator command as exactly one argument',()=>{
 const args=chalkFirebaseExecArgs();
 assert.deepEqual(args.slice(-2),['auth,firestore,functions','node scripts/chalk-dual-emulator-proof.mjs']);
 assert.equal(args.length,8);
});
test('Windows quotes the emulator script as a single command argument',()=>{
 const cmd=chalkFirebaseWindowsCommand();
 assert.equal(cmd,'npx --yes firebase-tools@15.24.0 emulators:exec --project demo-urai-jobs --only auth,firestore,functions "node scripts/chalk-dual-emulator-proof.mjs"');
 assert.equal(cmd.includes('&&'),false);
 assert.equal(cmd.includes('urai-4dc1d'),false);
});
test('fixed command remains unchanged across repeated calls',()=>{
 const args=chalkFirebaseExecArgs();args.push('run-deploy');
 assert.equal(chalkFirebaseExecArgs().length,8);
 assert.equal(chalkFirebaseWindowsCommand().includes('run-deploy'),false);
});
for (const version of ['openjdk version "21.0.12" 2026-01-01','java version "22.0.1"','openjdk version "24-ea"'])
 test('accepts Java >= 21: '+version,()=>assert.equal(chalkSupportedJavaVersion(version),true));
for (const version of ['java version "17.0.1"','openjdk version "20.0.2"','Java unknown','',null])
 test('denies old/invalid Java: '+String(version),()=>assert.equal(chalkSupportedJavaVersion(version),false));
