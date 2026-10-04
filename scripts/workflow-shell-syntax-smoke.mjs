import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateWorkflowShellBlocks } from './workflow-shell-syntax.mjs';

const source = fs.readFileSync('.github/workflows/urai-jobs-production-deploy.yml', 'utf8');
const valid = validateWorkflowShellBlocks(source);
assert.equal(valid.failures.length, 0, valid.failures.join('\n'));
assert.equal(valid.blocks, (source.match(/^ +run: \|[-+]?\s*$/gm) || []).length, 'every multiline run block must be covered');
const brokenIndent = source.replace(/\n          NODE\n/, '\nNODE\n');
assert.notEqual(brokenIndent, source);
assert.ok(validateWorkflowShellBlocks(brokenIndent).failures.length > 0, 'original escaped heredoc must fail');
const unterminated = source.replace(/\n          NODE\n/, '\n          MISSING_TERMINATOR\n');
assert.ok(validateWorkflowShellBlocks(unterminated).failures.length > 0, 'unterminated heredoc must fail even when Bash returns zero');
const unsafeToExecute = 'steps:\n  - name: Syntax only\n    run: |\n      exit 42\n';
assert.equal(validateWorkflowShellBlocks(unsafeToExecute).failures.length, 0, 'verification must never execute a workflow command');
console.log(`PASS ${valid.blocks} canonical shell blocks plus escaped/unterminated heredoc regressions; zero commands executed`);
