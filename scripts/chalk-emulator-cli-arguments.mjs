// Small, dependency-free pure contract for the Windows Firebase CLI command.
// Keep all components fixed: no user-supplied shell interpolation.
const fixed = Object.freeze([
  '--yes', 'firebase-tools@15.24.0', 'emulators:exec',
  '--project', 'demo-urai-jobs', '--only', 'auth,firestore,functions',
  'node scripts/chalk-dual-emulator-proof.mjs',
]);
export function chalkFirebaseExecArgs() { return [...fixed]; }
export function chalkFirebaseWindowsCommand() {
  const args = chalkFirebaseExecArgs();
  return 'npx ' + args.slice(0,-1).join(' ') + ' "' + args.at(-1) + '"';
}
export function chalkSupportedJavaVersion(output) {
  if (typeof output !== 'string') return false;
  const m = /(?:openjdk|java) version "(\d+)(?:[.\"+-]|$)/i.exec(output);
  return Boolean(m && Number(m[1]) >= 21);
}
