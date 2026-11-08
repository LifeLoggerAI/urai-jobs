/** R881: parse the actual exported TypeScript—not transpiled/rewritten mocks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// The Functions workspace declares and installs TypeScript as a development
// dependency. Require from that workspace to ensure the same compiler parser.
const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = requireFromFunctions('typescript');
const checks = [
  ['functions/src/jobs/admin.ts', ['listJobs', 'listJobLogs', 'retryJob']],
  ['functions/src/jobs/admin-v2.ts', ['listJobsV2', 'listJobLogsV2', 'retryJobV2']],
];
for (const [path, expected] of checks) {
  test('R881 exact original TypeScript parse and export surfaces: ' + path, () => {
    const bytes = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    const source = ts.createSourceFile(path, bytes, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const errors = source.parseDiagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(
      errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
      [], 'The source file must be parsed by TypeScript without syntax errors'
    );
    for (const name of expected) {
      const exported = source.statements.filter(stmt =>
        ts.isVariableStatement(stmt) &&
        stmt.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) &&
        stmt.declarationList.declarations.some(decl => ts.isIdentifier(decl.name) && decl.name.text === name)
      );
      assert.equal(exported.length, 1, name + ' must remain one exported callable');
      const expr = exported[0].declarationList.declarations.find(decl => ts.isIdentifier(decl.name) && decl.name.text === name)?.initializer;
      assert.ok(expr && ts.isCallExpression(expr), name + ' must remain a callable definition');
      const callback = expr.arguments.at(-1);
      assert.ok(callback && ts.isArrowFunction(callback) && ts.isBlock(callback.body),
        name + ' must have a real arrow function body, not an expression/invalid declaration');
    }
  });
}
