import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const src = readFileSync(new URL('../functions/src/privacy/lifeMovieOutputGeneration.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(js, { module, exports: module.exports, Number, Error });
const parse = module.exports.requirePinnedMovieOutputGeneration;
let pass = 0;
for (const generation of ['1', '9', '1000000000', '1793378565000001', '9007199254740991']) {
  assert.equal(parse(generation), generation);
  pass++;
}
for (const invalid of [null, undefined, 0, 1, -1, 1.5, '', '0', '00', '01', '-1', '+1', '1.0', '1e3',
  '9007199254740992', '99999999999999999999', '1 ', ' 1', 'abc', {}, ['1'], true]) {
  assert.throws(() => parse(invalid), /life_movie_output_generation_invalid/);
  pass++;
}
console.log('[PASS] ' + pass + ' exact private-output generation checks (synthetic, no Storage or media operation).');
