import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { prepareQueue, verifyPackage, quarantineCandidate, canonicalJson, sha256 } from '../factory.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../cli.mjs');
const modelForgeRoot = path.resolve(here, '../../../../world-factory-assets/model_forge');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-world-offline-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const specsDir = path.join(dir, 'specs'); fs.mkdirSync(specsDir);
  const kit = {
    id: 'kit:interior-chair:v1', role: 'furniture', description: 'Plain solid timber side chair with restrained joinery and no invented ornament.',
    dimensionsMeters: { width: 0.5, height: 0.9, depth: 0.52 }, materialIntent: ['Unbranded oak', 'Satin clear finish'],
    candidateProviders: ['meshy', 'tripo', 'rodin', 'replicate'], output: { format: 'GLB', maxTriangles: 120000 },
    source: { type: 'original_specification', creator: 'UrAi' }, rights: { status: 'ORIGINAL_SPEC_ONLY', commercialUse: 'UNKNOWN_FOR_PROVIDER_OUTPUT' },
  };
  const spec = { id: 'urai.generic.world.kitchen', version: '1.0.0', batch: 1, title: 'Generic kitchen', truthClassification: 'GENERIC', status: 'SPECIFIED', modularKit: [kit] };
  const specFile = path.join(specsDir, 'kitchen.json'); fs.writeFileSync(specFile, canonicalJson(spec));
  const authority = {
    schemaVersion: 'urai-generic-world-factory-authority-v1', observedAt: '2026-10-07T00:00:00Z', spendAuthorized: false, integrationAuthorized: false,
    repositories: {
      studio: { repository: 'LifeLoggerAI/urai-studio', head: '1'.repeat(40), issue: 153 },
      jobs: { repository: 'LifeLoggerAI/urai-jobs', head: '2'.repeat(40), issue: 152 },
      assetFactory: { repository: 'LifeLoggerAI/asset-factory', head: '3'.repeat(40) },
    },
  };
  const authorityFile = path.join(dir, 'authority.json'); fs.writeFileSync(authorityFile, canonicalJson(authority));
  const options = { specsDir, outputDir: path.join(dir, 'packages'), authorityFile };
  return { dir, spec, specFile, kit, authority, authorityFile, options };
}

function candidateGlb({ badIndex = false, externalImage = false } = {}) {
  const binary = Buffer.alloc(44);
  [0, 0, 0, 0.5, 0, 0, 0, 0.9, 0].forEach((value, i) => binary.writeFloatLE(value, i * 4));
  [0, 1, badIndex ? 8 : 2].forEach((value, i) => binary.writeUInt16LE(value, 36 + i * 2));
  const gltf = {
    asset: { version: '2.0', generator: 'TEST_FIXTURE_NOT_PRODUCTION' }, scene: 0,
    scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }],
    buffers: [{ byteLength: 42 }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.5, 0.3, 0.2, 1], metallicFactor: 0, roughnessFactor: 0.6 } }],
  };
  if (externalImage) gltf.images = [{ uri: 'missing-texture.png' }];
  const json = Buffer.from(JSON.stringify(gltf)); const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
  const output = Buffer.alloc(12 + 8 + padded.length + 8 + binary.length);
  output.write('glTF', 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20);
  const offset = 20 + padded.length; output.writeUInt32LE(binary.length, offset); output.writeUInt32LE(0x004e4942, offset + 4); binary.copy(output, offset + 8);
  return output;
}

function importInputs(f, result, { badIndex, externalImage, rights = 'UNKNOWN' } = {}) {
  const catalog = JSON.parse(fs.readFileSync(path.join(result.packageDir, 'catalog.json'), 'utf8'));
  const jobId = catalog.jobs[0].id;
  const job = JSON.parse(fs.readFileSync(path.join(result.packageDir, 'jobs', `${jobId}.json`), 'utf8'));
  const glb = candidateGlb({ badIndex, externalImage });
  const glbFile = path.join(f.dir, 'candidate.glb'); fs.writeFileSync(glbFile, glb);
  const provenance = {
    schemaVersion: 'urai-generic-world-output-provenance-v1', truthClassification: 'GENERIC', jobId,
    sourceKitSha256: job.sourceKitSha256, providerSpecSha256: job.providerSpec.sha256, provider: job.provider,
    providerSubmissionId: 'TEST_FIXTURE_NOT_REAL_PROVIDER_EVIDENCE', creator: 'Offline test fixture', generationDate: '2026-10-07T00:00:00Z',
    license: { status: rights, commercialUse: rights === 'CLEAR', identifier: rights === 'CLEAR' ? 'TEST_FIXTURE_ORIGINAL' : 'UNKNOWN' }, outputSha256: sha256(glb),
  };
  const provenanceFile = path.join(f.dir, 'provenance.json'); fs.writeFileSync(provenanceFile, canonicalJson(provenance));
  return { options: { packageDir: result.packageDir, jobId, glbFile, provenanceFile, outputDir: path.join(f.dir, 'quarantine'), modelForgeRoot }, provenance, provenanceFile, glbFile };
}

test('preparation is deterministic, idempotent, generic, bounded and does not inspect spend environment', (t) => {
  const f = fixture(t);
  const old = process.env.URAI_MODEL_FORGE_SPEND_AUTHORIZED;
  process.env.URAI_MODEL_FORGE_SPEND_AUTHORIZED = '1';
  t.after(() => { if (old === undefined) delete process.env.URAI_MODEL_FORGE_SPEND_AUTHORIZED; else process.env.URAI_MODEL_FORGE_SPEND_AUTHORIZED = old; });
  const first = prepareQueue(f.options), second = prepareQueue(f.options);
  assert.equal(first.ok, true); assert.equal(first.worldsPrepared, 1); assert.equal(first.providerJobsReady, 1);
  assert.equal(first.providerCalls, 0); assert.equal(first.totalSpent, 0); assert.equal(first.runtimeIntegrated, false);
  assert.equal(first.reused, false); assert.equal(second.reused, true); assert.equal(second.packageId, first.packageId); assert.equal(second.receiptSha256, first.receiptSha256);
  const catalog = JSON.parse(fs.readFileSync(path.join(first.packageDir, 'catalog.json'), 'utf8'));
  const job = JSON.parse(fs.readFileSync(path.join(first.packageDir, catalog.jobs[0].path), 'utf8'));
  assert.equal(job.spend.authorized, false); assert.equal(job.runtimeAdmission.admitted, false); assert.equal(job.runtimeAdmission.submissionId, null);
  assert.equal(job.expectedResourceNeed.credits, 'UNKNOWN');
});

test('identical shared modular kits reuse one job across families', (t) => {
  const f = fixture(t); const second = structuredClone(f.spec); second.id = 'urai.generic.world.diner'; second.title = 'Generic diner'; second.batch = 2;
  fs.writeFileSync(path.join(f.options.specsDir, 'diner.json'), canonicalJson(second));
  const result = prepareQueue(f.options); assert.equal(result.worldsPrepared, 2); assert.equal(result.providerJobsReady, 1);
});

test('conflicting shared kit changes require a versioned successor', (t) => {
  const f = fixture(t); const second = structuredClone(f.spec); second.id = 'urai.generic.world.diner'; second.modularKit[0].dimensionsMeters.height = 1.2;
  fs.writeFileSync(path.join(f.options.specsDir, 'diner.json'), canonicalJson(second));
  assert.throws(() => prepareQueue(f.options), /conflicting content/);
  assert.equal(fs.existsSync(f.options.outputDir), false);
});

for (const change of [
  { label: 'top-level autobiographical truth', apply: (spec) => { spec.truthClassification = 'RECORDED SOURCE TRUTH'; } },
  { label: 'nested truth laundering', apply: (spec) => { spec.modularKit[0].truthClassification = 'SPATIALLY RECONSTRUCTABLE'; } },
  { label: 'real-person likeness', apply: (spec) => { spec.modularKit[0].realPersonLikeness = true; } },
  { label: 'nested spend authority', apply: (spec) => { spec.modularKit[0].spendAuthorized = true; } },
  { label: 'fabricated accepted status', apply: (spec) => { spec.status = 'ACCEPTED'; } },
  { label: 'fabricated launch integration', apply: (spec) => { spec.launchIntegrated = true; } },
]) test(`rejects ${change.label}`, (t) => {
  const f = fixture(t); change.apply(f.spec); fs.writeFileSync(f.specFile, canonicalJson(f.spec));
  assert.throws(() => prepareQueue(f.options)); assert.equal(fs.existsSync(f.options.outputDir), false);
});

test('explicit authority spend flag is rejected, regardless of credentials', (t) => {
  const f = fixture(t); f.authority.spendAuthorized = true; fs.writeFileSync(f.authorityFile, canonicalJson(f.authority));
  assert.throws(() => prepareQueue(f.options), /spendAuthorized:false/);
});

test('CLI cannot submit or authorize spending', () => {
  for (const args of [['execute'], ['prepare', '--execute', 'true'], ['prepare', '--spend', 'true'], ['prepare', '--provider', 'unknown-adapter']]) {
    const child = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(child.status, 1); assert.match(child.stderr, /REJECTED/);
  }
});

test('exact input changes yield a new immutable package; old package remains valid', (t) => {
  const f = fixture(t); const first = prepareQueue(f.options);
  f.spec.version = '1.0.1'; f.spec.modularKit[0].id = 'kit:interior-chair:v2'; fs.writeFileSync(f.specFile, canonicalJson(f.spec));
  const second = prepareQueue(f.options); assert.notEqual(first.packageId, second.packageId); assert.equal(verifyPackage(first.packageDir).ok, true);
});

test('hash corruption and unreceipted assets are rejected', (t) => {
  const f = fixture(t); const result = prepareQueue(f.options);
  const catalog = path.join(result.packageDir, 'catalog.json'); fs.appendFileSync(catalog, ' ');
  assert.throws(() => verifyPackage(result.packageDir), /hash mismatch/);
  fs.writeFileSync(catalog, fs.readFileSync(catalog).subarray(0, fs.statSync(catalog).size - 1));
  fs.writeFileSync(path.join(result.packageDir, 'unreceipted.glb'), 'fake');
  assert.throws(() => verifyPackage(result.packageDir), /unreceipted/);
});

test('quarantine retains an actual structurally checked GLB with unknown rights as BLOCKED', { skip: !fs.existsSync(path.join(modelForgeRoot, 'validate-glb.mjs')) }, (t) => {
  const f = fixture(t), result = prepareQueue(f.options), input = importInputs(f, result);
  const imported = quarantineCandidate(input.options);
  assert.equal(imported.status, 'BLOCKED'); assert.equal(imported.candidateGenerated, true); assert.equal(imported.structuralChecks.counts.triangles, 1);
  assert.equal(imported.fullAssetMachineValidated, false); assert.equal(imported.visualReviewPerformed, false); assert.equal(imported.runtimeIntegrated, false);
  assert.equal(imported.providerCallsPerformedByImporter, 0); assert.equal(fs.existsSync(path.join(imported.quarantineDir, 'candidate.glb')), true);
  assert.equal(quarantineCandidate(input.options).reused, true);
});

test('clear test-fixture rights still grant only GENERATED, never acceptance', { skip: !fs.existsSync(path.join(modelForgeRoot, 'validate-glb.mjs')) }, (t) => {
  const f = fixture(t), result = prepareQueue(f.options), input = importInputs(f, result, { rights: 'CLEAR' });
  const imported = quarantineCandidate(input.options);
  assert.equal(imported.status, 'GENERATED'); assert.equal(imported.assetAccepted, false); assert.equal(imported.independentlyApproved, false);
});

test('quarantine rejects mismatched provenance hash and fabricated acceptance', (t) => {
  const f = fixture(t), result = prepareQueue(f.options), input = importInputs(f, result);
  input.provenance.outputSha256 = '0'.repeat(64); fs.writeFileSync(input.provenanceFile, canonicalJson(input.provenance));
  assert.throws(() => quarantineCandidate(input.options), /SHA-256/);
  input.provenance.outputSha256 = sha256(fs.readFileSync(input.glbFile)); input.provenance.accepted = true;
  fs.writeFileSync(input.provenanceFile, canonicalJson(input.provenance)); assert.throws(() => quarantineCandidate(input.options), /acceptance/);
});

test('unfilled readiness template cannot be imported as actual output', (t) => {
  const f = fixture(t), result = prepareQueue(f.options), input = importInputs(f, result);
  input.provenance.templateOnly = true; fs.writeFileSync(input.provenanceFile, canonicalJson(input.provenance));
  assert.throws(() => quarantineCandidate(input.options), /readiness template/);
});

test('quarantine rejects broken indices and missing/external texture dependencies', (t) => {
  const f = fixture(t), result = prepareQueue(f.options);
  assert.throws(() => quarantineCandidate(importInputs(f, result, { badIndex: true }).options), /vertex range/);
  assert.throws(() => quarantineCandidate(importInputs(f, result, { externalImage: true }).options), /missing\/external image/);
});

test('quarantine rejects malformed GLB bytes even if provenance repeats their hash', (t) => {
  const f = fixture(t), result = prepareQueue(f.options), input = importInputs(f, result);
  const corrupted = fs.readFileSync(input.glbFile); corrupted.writeUInt32LE(corrupted.length + 100, 8); fs.writeFileSync(input.glbFile, corrupted);
  input.provenance.outputSha256 = sha256(corrupted); fs.writeFileSync(input.provenanceFile, canonicalJson(input.provenance));
  assert.throws(() => quarantineCandidate(input.options), /declared length/);
});
