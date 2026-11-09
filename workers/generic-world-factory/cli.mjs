#!/usr/bin/env node
import { prepareQueue, verifyPackage, quarantineCandidate } from './factory.mjs';

const usage = `Usage:
  node workers/generic-world-factory/cli.mjs prepare --specs DIRECTORY --out DIRECTORY --authority FILE [--provider meshy|tripo|rodin|replicate]
  node workers/generic-world-factory/cli.mjs verify --package DIRECTORY
  node workers/generic-world-factory/cli.mjs quarantine --package DIRECTORY --job ID --glb FILE --provenance FILE --out DIRECTORY --model-forge-root DIRECTORY

This tool makes no provider calls, does not inspect credentials, and cannot submit,
accept, promote, integrate, deploy, or spend. READY_FOR_PROVIDER is an offline state.`;

try {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (command === '--help' || command === 'help') {
    console.log(usage);
  } else {
    const values = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i];
      if (!/^--[a-z-]+$/.test(key) || !args[i + 1] || args[i + 1].startsWith('--') || values[key] !== undefined) {
        throw new Error(`Malformed or duplicate argument ${key}`);
      }
      values[key] = args[i + 1];
    }
    const allowed = {
      prepare: ['--specs', '--out', '--authority', '--provider'],
      verify: ['--package'],
      quarantine: ['--package', '--job', '--glb', '--provenance', '--out', '--model-forge-root'],
    }[command];
    if (!allowed) throw new Error(`Unknown command ${command ?? '<none>'}; ${usage}`);
    for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`Unsupported argument ${key}; no execution or spend option exists`);
    let result;
    if (command === 'prepare') result = prepareQueue({ specsDir: values['--specs'], outputDir: values['--out'], authorityFile: values['--authority'], provider: values['--provider'] ?? 'meshy' });
    if (command === 'verify') result = verifyPackage(values['--package']);
    if (command === 'quarantine') result = quarantineCandidate({ packageDir: values['--package'], jobId: values['--job'], glbFile: values['--glb'], provenanceFile: values['--provenance'], outputDir: values['--out'], modelForgeRoot: values['--model-forge-root'] });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(`URAI_GENERIC_WORLD_FACTORY_REJECTED=${error.message}`);
  process.exitCode = 1;
}
