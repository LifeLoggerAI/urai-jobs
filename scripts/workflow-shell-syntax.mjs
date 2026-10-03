import { spawnSync } from 'node:child_process';

// Check literal run blocks without executing them or expanding credentials.
// A heredoc terminator outside the YAML block must not silently escape review.
export function validateWorkflowShellBlocks(source) {
  const lines = source.split('\n');
  const failures = [];
  let blocks = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^( +)run: \|[-+]?\s*$/.exec(lines[index]);
    if (!match) continue;
    const contentIndent = match[1].length + 2;
    const content = [];
    let next = index + 1;
    while (next < lines.length && (!lines[next].trim() || lines[next].startsWith(' '.repeat(contentIndent)))) {
      content.push(lines[next].slice(contentIndent));
      next += 1;
    }
    // Actions resolves expressions before Bash; substitute a non-executable
    // placeholder for syntax checking, never evaluate the Actions expression.
    const script = content.join('\n').replace(/\$\{\{[\s\S]*?\}\}/g, 'ACTIONS_VALUE');
    const result = spawnSync('bash', ['-n'], { input: script, encoding: 'utf8' });
    if (result.error || result.status !== 0 || /here-document .*delimited by end-of-file/.test(result.stderr)) {
      failures.push(`run block at line ${index + 1}: ${result.error?.message || result.stderr.trim()}`);
    }
    blocks += 1;
    index = next - 1;
  }
  if (!blocks) failures.push('No literal shell run blocks were checked');
  return { blocks, failures };
}
