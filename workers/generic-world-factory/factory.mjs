import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ADAPTER_IDS = Object.freeze(['meshy', 'tripo', 'rodin', 'replicate']);
export const KNOWN_TRUTH_STATES = Object.freeze(['GENERIC', 'INTERPRETIVE', 'RECORDED SOURCE TRUTH', 'SPATIALLY RECONSTRUCTABLE', 'UNKNOWN']);
const PACKAGE_SCHEMA = 'urai-generic-world-provider-queue-v1';
const PACKAGE_VERSION = '1.0.0';
const MAX_SPEC_BYTES = 1024 * 1024;
const MAX_GLB_BYTES = 250 * 1024 * 1024;
const requiredString = (value, label, maximum = 2048) => {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} must be a non-empty string of at most ${maximum} characters`);
  return value;
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const compare = (a, b) => a.localeCompare(b, 'en');
const isSha = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const isId = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,160}$/.test(value) && !value.includes('..');

export function canonicalJson(value) {
  const sort = (item) => {
    if (Array.isArray(item)) return item.map(sort);
    if (isObject(item)) return Object.fromEntries(Object.keys(item).sort(compare).map((key) => [key, sort(item[key])]));
    return item;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

export function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function readLimited(file, maximum) {
  const info = fs.lstatSync(file);
  assert(info.isFile() && !info.isSymbolicLink(), `Input must be a regular, non-symlink file: ${file}`);
  assert(info.size > 0 && info.size <= maximum, `Input size out of bounds: ${file}`);
  return fs.readFileSync(file);
}

function readJson(file) { return JSON.parse(readLimited(file, MAX_SPEC_BYTES).toString('utf8')); }

function contained(root, relative) {
  assert(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative) && !relative.includes('\\'), 'Invalid relative artifact path');
  const resolved = path.resolve(root, relative);
  assert(resolved.startsWith(`${path.resolve(root)}${path.sep}`), 'Artifact path escapes package');
  return resolved;
}

function findSpecFiles(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => compare(a.name, b.name))) {
      assert(!entry.isSymbolicLink(), `Symlinks are not accepted in inputs: ${entry.name}`);
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(file);
    }
  };
  walk(dir);
  assert(files.length > 0 && files.length <= 5000, 'Expected 1-5000 governed world JSON specs');
  return files;
}

function findPackageFiles(dir) {
  const files = [];
  const walk = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), 'Package symlinks are forbidden');
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), relative);
      else { assert(entry.isFile(), 'Package special files are forbidden'); files.push(relative); }
    }
  };
  walk(dir, '');
  return files.sort(compare);
}

function enforceGeneric(value, location = 'spec') {
  if (Array.isArray(value)) { value.forEach((item, i) => enforceGeneric(item, `${location}[${i}]`)); return; }
  if (!isObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (['truthClassification', 'truthState'].includes(key)) assert(item === 'GENERIC', `${location}.${key} must remain GENERIC; personal truth requires a separate governed lane`);
    if (['autobiographicalTruth', 'realPersonLikeness', 'personalMemoryTruth', 'productionIntegrated', 'launchIntegrated', 'runtimeIntegrated', 'assetAccepted', 'releaseAccepted', 'independentlyApproved', 'xrCertified', 'goldenMaster'].includes(key)) {
      assert(item === false || item === null, `${location}.${key} cannot be asserted by generic preparation`);
    }
    if (['spendAuthorized', 'integrationAuthorized', 'promote', 'execute'].includes(key)) assert(item === false || item === null, `${location}.${key} cannot authorize work in this offline tool`);
    enforceGeneric(item, `${location}.${key}`);
  }
}

export function validateWorldSpec(spec) {
  assert(isObject(spec), 'World spec must be an object');
  assert(isId(spec.id), 'World id must be a deterministic lowercase identifier without paths');
  assert(typeof spec.version === 'string' && /^\d+\.\d+\.\d+$/.test(spec.version), 'World version must be semver');
  assert(Number.isInteger(spec.batch) && spec.batch > 0, 'World batch must be a positive integer');
  requiredString(spec.title, 'World title', 200);
  assert(spec.truthClassification === 'GENERIC', 'World truthClassification must be GENERIC');
  assert(spec.status === 'SPECIFIED', 'Input must be a specification, not an inferred generated or accepted world');
  enforceGeneric(spec);
  assert(Array.isArray(spec.modularKit) && spec.modularKit.length > 0 && spec.modularKit.length <= 250, 'Each world requires 1-250 modularKit entries');
  const ids = new Set();
  for (const kit of spec.modularKit) {
    assert(isObject(kit) && isId(kit.id), 'Modular kit id must be a deterministic lowercase identifier without paths');
    assert(!ids.has(kit.id), `Duplicate kit in world ${spec.id}: ${kit.id}`);
    ids.add(kit.id);
    requiredString(kit.role, `${kit.id}.role`, 100);
    requiredString(kit.description, `${kit.id}.description`, 2000);
    assert(isObject(kit.dimensionsMeters), `${kit.id}.dimensionsMeters is required`);
    for (const axis of ['width', 'height', 'depth']) assert(Number.isFinite(kit.dimensionsMeters[axis]) && kit.dimensionsMeters[axis] > 0 && kit.dimensionsMeters[axis] <= 1000, `${kit.id}: ${axis} must be a positive metric dimension <=1000`);
    assert(Array.isArray(kit.candidateProviders) && kit.candidateProviders.length > 0 && new Set(kit.candidateProviders).size === kit.candidateProviders.length, `${kit.id}.candidateProviders must be non-empty and unique`);
    for (const adapter of kit.candidateProviders) assert(ADAPTER_IDS.includes(adapter), `Unknown Model Forge adapter ${adapter}`);
    assert(isObject(kit.output) && kit.output.format === 'GLB', `${kit.id}.output.format must be GLB`);
    assert(isObject(kit.source) && isObject(kit.rights), `${kit.id} requires source and rights records`);
    assert(typeof kit.materialIntent === 'string' || (Array.isArray(kit.materialIntent) && kit.materialIntent.every((item) => typeof item === 'string')), `${kit.id}.materialIntent must be text or an array of text`);
  }
  return spec;
}

function validateAuthority(authority) {
  assert(isObject(authority) && authority.schemaVersion === 'urai-generic-world-factory-authority-v1', 'Authority schemaVersion must be urai-generic-world-factory-authority-v1');
  assert(typeof authority.observedAt === 'string' && Number.isFinite(Date.parse(authority.observedAt)), 'Authority observedAt must be an ISO date');
  assert(authority.spendAuthorized === false && authority.integrationAuthorized === false, 'This lane must bind spendAuthorized:false and integrationAuthorized:false');
  for (const name of ['studio', 'jobs', 'assetFactory']) {
    const repo = authority.repositories?.[name];
    assert(isObject(repo) && typeof repo.repository === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.repository), `Authority repository missing for ${name}`);
    assert(typeof repo.head === 'string' && /^[0-9a-f]{40}$/.test(repo.head), `Authority exact 40-character head missing for ${name}`);
  }
  assert(authority.repositories.studio.issue === 153 && authority.repositories.jobs.issue === 152, 'Authority must reference the existing Studio #153 and Jobs #152 lanes');
  assert(authority.repositories.assetFactory.repository === 'LifeLoggerAI/asset-factory', 'Use the canonical existing Asset Factory; no competing resolver');
  enforceGeneric(authority, 'authority');
}

function safeName(id, digest) {
  const readable = id.replace(/[^a-z0-9._-]/g, '-').slice(0, 72);
  return `${readable}-${digest.slice(0, 16)}`;
}

function kitPrompt(kit) {
  const size = kit.dimensionsMeters;
  const material = Array.isArray(kit.materialIntent) ? kit.materialIntent.join('; ') : kit.materialIntent;
  const prompt = `Original generic modular ${kit.role}; one separable asset, not a whole environment. No real place/person, brands, logos, visible text, sci-fi, low-poly filler, floating parts or intersecting geometry. Physically plausible PBR, believable wear, correct UVs/normals; meter scale, +Y up, reusable grounded pivot. ${kit.description} Target bounding dimensions ${size.width}m wide x ${size.height}m high x ${size.depth}m deep. Materials: ${material}. Clear passage where applicable; no arms/hands, forced characters or inaccessible hazards. GLB with embedded PBR textures. Generic exploration candidate only; visual/rights review required.`;
  assert(prompt.length <= 1024, `${kit.id}: provider prompt exceeds 1024 characters; shorten the modular description without removing safety requirements`);
  return prompt;
}

const lifecycle = {
  schemaVersion: 'urai-generic-world-offline-state-machine-v1',
  definitionVersion: PACKAGE_VERSION,
  states: ['SPECIFIED', 'READY_FOR_PROVIDER', 'GENERATED', 'MACHINE_VALIDATED', 'VISUALLY_REVIEWED', 'ACCEPTED', 'BLOCKED', 'NEEDS_REWORK'],
  offlineTransitions: [
    { from: 'SPECIFIED', to: 'READY_FOR_PROVIDER', guard: 'Generic spec and authority validated; does not authorize spend or submission' },
    { from: 'READY_FOR_PROVIDER', to: 'GENERATED', guard: 'Actual local GLB and exact provider provenance imported into quarantine; no runtime admission' },
    { from: 'READY_FOR_PROVIDER', to: 'BLOCKED', guard: 'External spend, credential, source or license dependency' },
    { from: 'GENERATED', to: 'NEEDS_REWORK', guard: 'Machine or visual defect; retained version and hashes' },
  ],
  externalTransitions: [
    { from: 'GENERATED', to: 'MACHINE_VALIDATED', owner: 'Asset Factory', guard: 'Full geometry, material, UV, scale, collision/nav, LOD and budget QA evidence' },
    { from: 'MACHINE_VALIDATED', to: 'VISUALLY_REVIEWED', owner: 'Designated visual reviewer', guard: 'Literal preview and runtime pixels reviewed' },
    { from: 'VISUALLY_REVIEWED', to: 'ACCEPTED', owner: 'Asset Factory governance', guard: 'Explicit visual, rights and asset acceptance; runtime/release acceptance separate' },
  ],
  acceptedDoesNotMean: ['runtime-integrated', 'production-deployed', 'release-accepted', 'independently-approved', 'XR-device-certified'],
  paidExecutionImplementation: null,
  credentialsInspected: false,
  networkCalls: 0,
};

export function prepareQueue({ specsDir, outputDir, authorityFile, provider = 'meshy' }) {
  requiredString(specsDir, 'specsDir'); requiredString(outputDir, 'outputDir'); requiredString(authorityFile, 'authorityFile');
  assert(ADAPTER_IDS.includes(provider), `Unknown Model Forge adapter ${provider}`);
  const specsRoot = fs.realpathSync(specsDir);
  const outputRoot = path.resolve(outputDir);
  assert(outputRoot !== specsRoot && !outputRoot.startsWith(`${specsRoot}${path.sep}`), 'Output must not be written inside governed input specs');
  const authorityBytes = readLimited(authorityFile, MAX_SPEC_BYTES);
  const authority = JSON.parse(authorityBytes.toString('utf8'));
  validateAuthority(authority);
  const worlds = findSpecFiles(specsRoot).map((file) => {
    const bytes = readLimited(file, MAX_SPEC_BYTES);
    const spec = validateWorldSpec(JSON.parse(bytes.toString('utf8')));
    return { spec, bytes, sha256: sha256(bytes), relativePath: path.relative(specsRoot, file).split(path.sep).join('/') };
  }).sort((a, b) => compare(a.spec.id, b.spec.id));
  assert(new Set(worlds.map((world) => world.spec.id)).size === worlds.length, 'World identifiers must be unique; use versioned successors in separate packages');
  const implementationDir = path.dirname(fileURLToPath(import.meta.url));
  const implementation = ['factory.mjs', 'cli.mjs', 'package.json'].map((name) => {
    const bytes = readLimited(path.join(implementationDir, name), MAX_SPEC_BYTES);
    return { name, bytes, sha256: sha256(bytes) };
  });
  const inputSet = {
    schemaVersion: PACKAGE_SCHEMA, preparationVersion: PACKAGE_VERSION, provider,
    authoritySha256: sha256(authorityBytes),
    implementation: implementation.map(({ name, sha256: digest }) => ({ name, sha256: digest })),
    worlds: worlds.map((world) => ({ id: world.spec.id, version: world.spec.version, batch: world.spec.batch, sha256: world.sha256, relativePath: world.relativePath })),
  };
  const packageHash = sha256(canonicalJson(inputSet));
  const packageId = `gwq-${packageHash}`;
  const finalDir = path.join(outputRoot, packageId);
  if (fs.existsSync(finalDir)) return { ...verifyPackage(finalDir), reused: true };
  const grouped = new Map();
  for (const world of worlds) {
    for (const kit of world.spec.modularKit) {
      const kitHash = sha256(canonicalJson(kit));
      const existing = grouped.get(kit.id);
      assert(!existing || existing.kitHash === kitHash, `Shared kit ${kit.id} has conflicting content; version the successor instead of overwriting reusable authority`);
      if (!existing) grouped.set(kit.id, { kit, kitHash, worlds: [] });
      grouped.get(kit.id).worlds.push({ id: world.spec.id, specSha256: world.sha256, batch: world.spec.batch, version: world.spec.version });
    }
  }
  const artifactMap = new Map();
  const put = (relativePath, content) => { assert(!artifactMap.has(relativePath), 'Duplicate output artifact'); artifactMap.set(relativePath, Buffer.isBuffer(content) ? content : Buffer.from(canonicalJson(content))); };
  put('input-set.json', inputSet);
  put('authority.json', authorityBytes);
  put('state-machine.json', lifecycle);
  for (const source of implementation) put(`implementation/${source.name}`, source.bytes);
  for (const world of worlds) put(`inputs/${safeName(world.spec.id, world.sha256)}.json`, world.bytes);
  const kits = [];
  const jobs = [];
  for (const entry of [...grouped.values()].sort((a, b) => compare(a.kit.id, b.kit.id))) {
    const { kit, kitHash } = entry;
    assert(kit.candidateProviders.includes(provider), `${kit.id} does not nominate ${provider}; select an existing adapter`);
    const assetId = safeName(kit.id, kitHash);
    const maxTriangles = Number(kit.output.maxTriangles ?? 120000);
    assert(Number.isInteger(maxTriangles) && maxTriangles >= 100 && maxTriangles <= 2000000, `${kit.id}.output.maxTriangles is outside Model Forge bounds`);
    const seed = parseInt(kitHash.slice(0, 8), 16);
    const providerSpec = {
      id: assetId, prompt: kitPrompt(kit), providers: [provider], referenceImages: [],
      generation: { maxProviderAttempts: 1, seed },
      target: { meters: Math.max(...Object.values(kit.dimensionsMeters)), hero: true, maxTriangles, textureResolution: '4k', pbr: true },
      authority: {
        source: 'UrAi Generic World Library governed modular specification; generic exploration candidate',
        truthClassification: 'GENERIC', sourceKitId: kit.id, sourceKitSha256: kitHash,
        worldSpecBindings: entry.worlds, authorityInputSha256: inputSet.authoritySha256,
        autobiographicalTruth: false, independentlyApproved: false, productionIntegrated: false,
        assetAcceptance: 'NOT_ACCEPTED', runtimeAcceptance: 'NOT_INTEGRATED', releaseAcceptance: 'NOT_ACCEPTED',
      },
    };
    const providerSpecSha256 = sha256(canonicalJson(providerSpec));
    const jobHash = sha256(canonicalJson({ kitHash, providerSpecSha256, authoritySha256: inputSet.authoritySha256, packageId }));
    const jobId = `gwjob-${jobHash}`;
    const specPath = `provider-specs/${assetId}.json`;
    put(specPath, providerSpec);
    const provenanceTemplate = {
      schemaVersion: 'urai-generic-world-output-provenance-v1',
      templateOnly: true, actualOutputExists: false, truthClassification: 'GENERIC', jobId,
      sourceKitSha256: kitHash, providerSpecSha256, provider,
      providerSubmissionId: null, creator: null, generationDate: null, outputSha256: null,
      license: { status: 'UNKNOWN', commercialUse: 'UNKNOWN', identifier: null, restrictions: null, attributionRequirement: 'UNKNOWN', termsCheckedAt: null, termsSource: null },
      accepted: false, visualAcceptance: false, runtimeIntegrated: false,
      instructions: 'Fill only from actual governed provider output and current verified terms. Remove templateOnly and actualOutputExists template fields once output exists. Do not fabricate IDs, hashes, rights or acceptance.',
    };
    const provenanceTemplatePath = `provenance-templates/${jobId}.json`;
    const provenanceTemplateSha256 = sha256(canonicalJson(provenanceTemplate));
    put(provenanceTemplatePath, provenanceTemplate);
    const job = {
      schemaVersion: 'urai-generic-world-provider-job-v1', id: jobId, idempotencyKey: jobHash,
      status: 'READY_FOR_PROVIDER', truthClassification: 'GENERIC', sourceKitId: kit.id, sourceKitSha256: kitHash,
      worldSpecBindings: entry.worlds, provider, providerAlternatives: kit.candidateProviders.filter((id) => id !== provider),
      operation: 'asset.generate', operationContract: 'Existing legacy asset-worker operation; offline proposal only',
      runtimeAdmission: { admitted: false, submitted: false, submissionId: null, reason: 'Current live Asset worker dispatch does not carry this per-kit spec; no runtime or repository_dispatch submission' },
      executionBoundary: { owner: 'LifeLoggerAI/asset-factory', entrypoint: 'model_forge/forge.mjs', adapterId: provider, resolverModified: false },
      providerSpec: { path: specPath, sha256: providerSpecSha256 },
      sourceInputs: { kit: kit.source, rights: kit.rights, referenceImages: [], mode: 'TEXT_EXPLORATION', finalProductionAuthority: false },
      expectedOutputs: { format: 'GLB', embeddedPbrTextures: true, model: 'candidate.glb', provenance: 'provenance.json', provenanceTemplate: { path: provenanceTemplatePath, sha256: provenanceTemplateSha256 }, structuralValidation: 'validation.json', cleanup: ['lod0.glb', 'lod1.glb', 'lod2.glb'], actualOutputCount: 0 },
      expectedResourceNeed: { maxProviderAttempts: 1, credits: 'UNKNOWN', approximateComputeSeconds: 'UNKNOWN', priceSource: null, costQuoteRequired: true },
      spend: { authorized: false, totalSpent: 0, currency: null, approvalRequired: true, credentialInspected: false, providerSubmissionId: null },
      beforePaidExecution: ['Refresh factory authority', 'Obtain explicit bounded provider/credit approval', 'Quote current provider cost', 'Resolve credential using existing governed boundary', 'Select governed references if targeting final production art'],
      postGeneration: ['Import into quarantine', 'Validate and clean via Model Forge', 'Resolve commercial rights', 'Produce actual scene previews and performance evidence', 'Obtain explicit visual and asset acceptance', 'Request separate runtime integration and release acceptance'],
      neverAutomaticallyGranted: ['autobiographical-truth', 'asset-accepted', 'runtime-integrated', 'launch-integrated', 'production-deployed', 'independently-approved', 'XR-certified'],
    };
    put(`jobs/${jobId}.json`, job);
    kits.push({ id: kit.id, sha256: kitHash, providerSpecSha256, reusableByWorlds: entry.worlds.map((world) => world.id), source: kit.source, rights: kit.rights, status: 'READY_FOR_PROVIDER' });
    jobs.push({ id: jobId, kitId: kit.id, path: `jobs/${jobId}.json`, provider, status: 'READY_FOR_PROVIDER' });
  }
  put('catalog.json', {
    schemaVersion: PACKAGE_SCHEMA, packageId, inputSetSha256: packageHash,
    truthClassification: 'GENERIC', worlds: inputSet.worlds, kits, jobs,
    outputAssets: 0, previewRenders: 0, providerCalls: 0, spendAuthorized: false,
    launchIntegrated: false, independentlyApproved: false, xrCertified: false,
  });
  const manifest = {
    schemaVersion: 'urai-generic-world-content-manifest-v1', packageId,
    files: [...artifactMap.entries()].map(([file, bytes]) => ({ path: file, bytes: bytes.length, sha256: sha256(bytes) })).sort((a, b) => compare(a.path, b.path)),
  };
  put('content-manifest.json', manifest);
  put('receipt.json', {
    schemaVersion: 'urai-generic-world-preparation-receipt-v1', packageId, generatedAt: new Date().toISOString(),
    inputSetSha256: packageHash, contentManifestSha256: sha256(canonicalJson(manifest)),
    worldsPrepared: worlds.length, worldFamilyBatches: [...new Set(worlds.map((world) => world.spec.batch))].sort((a, b) => a - b),
    uniqueModularKitsPrepared: kits.length, providerJobsPrepared: jobs.length,
    checks: ['Generic truth boundary', 'Specification state', 'Version and identifiers', 'Metric target dimensions', 'Shared-kit exact content consistency', 'Existing Model Forge adapter IDs', 'Model Forge input format and prompt size', 'Exact authority and input SHA-256 bindings', 'One-attempt bound', 'Zero execution and spend'],
    machineValidationScope: 'Specification and offline packet integrity only; no generated geometry, visual quality, runtime or device validation',
    actualAssetsGenerated: 0, previewRendersCreated: 0, paidProviderCalls: 0, providerSubmissionIds: [], totalSpent: 0,
    truthClassification: 'GENERIC', assetAccepted: false, runtimeIntegrated: false, releaseAccepted: false, independentlyApproved: false, xrCertified: false,
    blockedDependencies: ['Explicit provider spend authorization', 'Governed provider credential', 'Current cost quote', 'Governed references for final-art intent', 'Actual provider output', 'Visual, rights and full asset QA acceptance'],
  });
  const checksumText = [...artifactMap.entries()].sort(([a], [b]) => compare(a, b)).map(([file, bytes]) => `${sha256(bytes)}  ${file}`).join('\n') + '\n';
  artifactMap.set('checksums.sha256', Buffer.from(checksumText));
  fs.mkdirSync(outputRoot, { recursive: true });
  const staging = fs.mkdtempSync(path.join(outputRoot, '.gwq-stage-'));
  try {
    for (const [relativePath, bytes] of artifactMap) {
      const file = contained(staging, relativePath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes, { flag: 'wx' });
    }
    verifyPackage(staging);
    if (fs.existsSync(finalDir)) { const existing = verifyPackage(finalDir); fs.rmSync(staging, { recursive: true }); return { ...existing, reused: true }; }
    fs.renameSync(staging, finalDir);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true }); throw error;
  }
  return { ...verifyPackage(finalDir), reused: false };
}

export function verifyPackage(packageDir) {
  requiredString(packageDir, 'packageDir');
  const root = path.resolve(packageDir);
  const checksums = readLimited(path.join(root, 'checksums.sha256'), 20 * 1024 * 1024).toString('utf8');
  const records = checksums.trim().split('\n').map((line) => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line); assert(match, 'Malformed package checksum entry');
    return { sha256: match[1], path: match[2] };
  });
  assert(new Set(records.map((record) => record.path)).size === records.length, 'Duplicate checksum entry');
  const inventory = new Map(records.map((record) => [record.path, record.sha256]));
  assert(canonicalJson(findPackageFiles(root)) === canonicalJson([...inventory.keys(), 'checksums.sha256'].sort(compare)), 'Package contains missing or unreceipted files');
  for (const record of records) {
    const bytes = readLimited(contained(root, record.path), MAX_GLB_BYTES);
    assert(sha256(bytes) === record.sha256, `Artifact hash mismatch: ${record.path}`);
  }
  const must = ['input-set.json', 'authority.json', 'state-machine.json', 'catalog.json', 'content-manifest.json', 'receipt.json'];
  for (const name of must) assert(inventory.has(name), `Missing package contract ${name}`);
  const authority = readJson(path.join(root, 'authority.json')); validateAuthority(authority);
  const inputSet = readJson(path.join(root, 'input-set.json'));
  const catalog = readJson(path.join(root, 'catalog.json'));
  const receipt = readJson(path.join(root, 'receipt.json'));
  const manifest = readJson(path.join(root, 'content-manifest.json'));
  const expectedId = `gwq-${sha256(canonicalJson(inputSet))}`;
  assert(catalog.schemaVersion === PACKAGE_SCHEMA && inputSet.schemaVersion === PACKAGE_SCHEMA, 'Package schema mismatch');
  assert([catalog, receipt, manifest].every((item) => item.packageId === expectedId), 'Package id must bind exact input set');
  assert(inputSet.authoritySha256 === inventory.get('authority.json'), 'Authority digest mismatch');
  for (const source of inputSet.implementation ?? []) assert(inventory.get(`implementation/${source.name}`) === source.sha256, 'Preparation implementation digest mismatch');
  assert(inputSet.implementation?.length === 3, 'Preparation implementation bindings missing');
  assert(canonicalJson(inputSet.worlds) === canonicalJson(catalog.worlds), 'Catalog worlds do not match immutable input set');
  assert(inputSet.preparationVersion === PACKAGE_VERSION && ADAPTER_IDS.includes(inputSet.provider), 'Unknown preparation or provider version');
  assert(receipt.contentManifestSha256 === inventory.get('content-manifest.json'), 'Content manifest digest mismatch');
  const baseInventory = [...inventory.keys()].filter((name) => !['content-manifest.json', 'receipt.json'].includes(name)).sort(compare);
  assert(canonicalJson(manifest.files.map((record) => record.path).sort(compare)) === canonicalJson(baseInventory), 'Manifest must cover every input and job artifact exactly once');
  for (const record of manifest.files) {
    assert(inventory.get(record.path) === record.sha256, 'Manifest/checksum mismatch');
    assert(fs.statSync(contained(root, record.path)).size === record.bytes, 'Manifest byte size mismatch');
  }
  assert(receipt.paidProviderCalls === 0 && receipt.totalSpent === 0 && receipt.runtimeIntegrated === false, 'Offline receipt cannot claim execution or integration');
  const sourceKits = new Map();
  for (const world of catalog.worlds) {
    assert(isSha(world.sha256), 'World SHA-256 missing');
    const bytes = readLimited(path.join(root, 'inputs', `${safeName(world.id, world.sha256)}.json`), MAX_SPEC_BYTES);
    assert(sha256(bytes) === world.sha256, 'World exact bytes hash mismatch');
    const spec = validateWorldSpec(JSON.parse(bytes.toString('utf8')));
    assert(spec.id === world.id && spec.version === world.version && spec.batch === world.batch, 'World identity/version binding mismatch');
    for (const kit of spec.modularKit) {
      const hash = sha256(canonicalJson(kit));
      const existing = sourceKits.get(kit.id);
      assert(!existing || existing.hash === hash, 'Conflicting reusable source kit content');
      if (!existing) sourceKits.set(kit.id, { kit, hash, worlds: [] });
      sourceKits.get(kit.id).worlds.push({ id: spec.id, specSha256: world.sha256, batch: spec.batch, version: spec.version });
    }
  }
  assert(catalog.jobs.length === sourceKits.size && catalog.kits.length === sourceKits.size, 'Queue must cover all unique modular kits exactly once');
  assert(new Set(catalog.jobs.map((record) => record.kitId)).size === sourceKits.size, 'Duplicate/missing queue kit');
  for (const record of catalog.jobs) {
    assert(inventory.has(record.path), 'Unlisted job dependency');
    const job = readJson(contained(root, record.path));
    assert(job.id === record.id && job.status === 'READY_FOR_PROVIDER' && job.truthClassification === 'GENERIC', 'Offline job status/truth mismatch');
    assert(job.spend.authorized === false && job.spend.totalSpent === 0 && job.spend.providerSubmissionId === null && job.runtimeAdmission.submitted === false && job.runtimeAdmission.admitted === false, 'Offline job cannot assert spend or live admission');
    assert(inventory.get(job.providerSpec.path) === job.providerSpec.sha256, 'Provider spec dependency mismatch');
    assert(inventory.get(job.expectedOutputs.provenanceTemplate.path) === job.expectedOutputs.provenanceTemplate.sha256, 'Provenance template dependency mismatch');
    const template = readJson(contained(root, job.expectedOutputs.provenanceTemplate.path));
    assert(template.templateOnly === true && template.actualOutputExists === false && template.providerSubmissionId === null && template.outputSha256 === null, 'Unexecuted queue provenance cannot claim provider output');
    const spec = readJson(contained(root, job.providerSpec.path));
    const source = sourceKits.get(job.sourceKitId);
    assert(source && source.hash === job.sourceKitSha256 && record.kitId === job.sourceKitId, 'Source modular kit SHA-256 mismatch');
    assert(canonicalJson(source.worlds) === canonicalJson(job.worldSpecBindings), 'Job world source binding mismatch');
    const calculatedJobHash = sha256(canonicalJson({ kitHash: source.hash, providerSpecSha256: job.providerSpec.sha256, authoritySha256: inputSet.authoritySha256, packageId: expectedId }));
    assert(job.id === `gwjob-${calculatedJobHash}` && job.idempotencyKey === calculatedJobHash, 'Job idempotency key/source digest mismatch');
    assert(spec.providers.length === 1 && spec.providers[0] === job.provider && ADAPTER_IDS.includes(job.provider), 'Provider adapter mismatch');
    assert(job.provider === inputSet.provider && spec.prompt === kitPrompt(source.kit), 'Provider selection or exact modular prompt mismatch');
    assert(spec.target.meters === Math.max(...Object.values(source.kit.dimensionsMeters)) && spec.target.maxTriangles === Number(source.kit.output.maxTriangles ?? 120000), 'Metric/budget target does not match source kit');
    assert(spec.prompt.length <= 1024 && spec.generation.maxProviderAttempts === 1 && spec.target.pbr === true, 'Model Forge prompt/attempt/material bound mismatch');
    enforceGeneric(spec);
  }
  return {
    ok: true, packageId: expectedId, packageDir: root, worldsPrepared: catalog.worlds.length, uniqueModularKitsPrepared: catalog.kits.length,
    providerJobsReady: catalog.jobs.length, filesHashVerified: records.length,
    manifestSha256: inventory.get('content-manifest.json'), receiptSha256: inventory.get('receipt.json'),
    validationScope: 'Offline specs and provider packets; not generated asset or visual acceptance',
    providerCalls: 0, totalSpent: 0, runtimeIntegrated: false,
  };
}

function inspectEmbeddedGlb(bytes) {
  assert(bytes.length >= 28 && bytes.toString('ascii', 0, 4) === 'glTF', 'Candidate is not GLB');
  assert(bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'GLB version/declared length invalid');
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    assert(offset + 8 <= bytes.length, 'Truncated GLB chunk header');
    const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert(size % 4 === 0 && offset + 8 + size <= bytes.length, 'GLB chunk alignment/bounds invalid');
    chunks.push({ size, type, start: offset + 8 }); offset += 8 + size;
  }
  assert(chunks.length === 2 && chunks[0].type === 0x4e4f534a && chunks[1].type === 0x004e4942, 'Quarantine expects one JSON and one embedded BIN chunk');
  const gltf = JSON.parse(bytes.toString('utf8', chunks[0].start, chunks[0].start + chunks[0].size).trim());
  assert(gltf.asset?.version === '2.0' && Array.isArray(gltf.meshes) && gltf.meshes.length > 0, 'GLB must contain actual glTF 2.0 meshes');
  assert(!gltf.extensionsRequired?.length, 'Required extensions need separate governed support validation');
  assert(gltf.buffers?.length === 1 && !gltf.buffers[0].uri && Number.isInteger(gltf.buffers[0].byteLength) && gltf.buffers[0].byteLength > 0 && gltf.buffers[0].byteLength <= chunks[1].size && chunks[1].size - gltf.buffers[0].byteLength <= 3, 'GLB must contain one valid embedded binary buffer');
  for (const view of gltf.bufferViews ?? []) {
    assert(view.buffer === 0 && Number.isInteger(view.byteLength) && view.byteLength > 0 && Number.isInteger(view.byteOffset ?? 0) && (view.byteOffset ?? 0) >= 0 && (view.byteOffset ?? 0) + view.byteLength <= gltf.buffers[0].byteLength, 'GLB buffer view bounds invalid');
  }
  const elementCounts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const formats = { 5120: [1, 'readInt8'], 5121: [1, 'readUInt8'], 5122: [2, 'readInt16LE'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE'] };
  const readAccessor = (index) => {
    const accessor = gltf.accessors?.[index];
    const view = gltf.bufferViews?.[accessor?.bufferView];
    assert(accessor && view && !accessor.sparse && elementCounts[accessor.type] && formats[accessor.componentType], 'Accessor format/buffer reference unsupported');
    assert(Number.isInteger(accessor.count) && accessor.count > 0 && accessor.count <= 10000000, 'Accessor count invalid');
    const [componentBytes, readMethod] = formats[accessor.componentType];
    const elementBytes = componentBytes * elementCounts[accessor.type];
    const stride = view.byteStride ?? elementBytes;
    const offset = accessor.byteOffset ?? 0;
    assert(Number.isInteger(offset) && offset >= 0 && offset % componentBytes === 0 && Number.isInteger(stride) && stride >= elementBytes && stride % componentBytes === 0 && (accessor.count - 1) * stride + offset + elementBytes <= view.byteLength, 'Accessor byte bounds/stride invalid');
    const start = chunks[1].start + (view.byteOffset ?? 0) + offset;
    let minimum = Infinity, maximum = -Infinity;
    for (let item = 0; item < accessor.count; item += 1) {
      for (let component = 0; component < elementCounts[accessor.type]; component += 1) {
        const value = bytes[readMethod](start + item * stride + component * componentBytes);
        assert(Number.isFinite(value), 'Non-finite GLB geometry value'); minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
      }
    }
    return { minimum, maximum };
  };
  for (const image of gltf.images ?? []) assert(!image.uri && Number.isInteger(image.bufferView) && gltf.bufferViews?.[image.bufferView] && ['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType), 'GLB textures must be embedded; missing/external image rejected');
  for (const material of gltf.materials ?? []) {
    const slots = [material.pbrMetallicRoughness?.baseColorTexture, material.pbrMetallicRoughness?.metallicRoughnessTexture, material.normalTexture, material.occlusionTexture, material.emissiveTexture].filter(Boolean);
    for (const slot of slots) {
      const texture = gltf.textures?.[slot.index];
      assert(texture && Number.isInteger(texture.source) && gltf.images?.[texture.source], 'GLB material has a broken texture binding');
    }
  }
  let triangles = 0;
  for (const mesh of gltf.meshes) {
    assert(Array.isArray(mesh.primitives) && mesh.primitives.length > 0, 'GLB has empty mesh');
    for (const primitive of mesh.primitives) {
      assert((primitive.mode ?? 4) === 4, 'Quarantine admits triangle primitives only');
      const position = gltf.accessors?.[primitive.attributes?.POSITION];
      assert(position && position.type === 'VEC3' && position.componentType === 5126 && Number.isInteger(position.count) && position.count >= 3 && gltf.bufferViews?.[position.bufferView], 'GLB primitive lacks valid POSITION data');
      readAccessor(primitive.attributes.POSITION);
      if (primitive.indices !== undefined) {
        const indices = gltf.accessors?.[primitive.indices];
        assert(indices && indices.type === 'SCALAR' && [5121, 5123, 5125].includes(indices.componentType) && Number.isInteger(indices.count) && indices.count >= 3 && indices.count % 3 === 0 && gltf.bufferViews?.[indices.bufferView], 'GLB index accessor invalid');
        assert(readAccessor(primitive.indices).maximum < position.count, 'GLB index exceeds vertex range');
        triangles += indices.count / 3;
      } else { assert(position.count % 3 === 0, 'Unindexed triangle vertex count invalid'); triangles += position.count / 3; }
      if (primitive.material !== undefined) assert(gltf.materials?.[primitive.material], 'GLB primitive references missing material');
    }
  }
  return { triangles, meshes: gltf.meshes.length, materials: gltf.materials?.length ?? 0, images: gltf.images?.length ?? 0 };
}

export function quarantineCandidate({ packageDir, jobId, glbFile, provenanceFile, outputDir, modelForgeRoot }) {
  const packageProof = verifyPackage(packageDir);
  for (const [label, value] of Object.entries({ jobId, glbFile, provenanceFile, outputDir, modelForgeRoot })) requiredString(value, label);
  assert(/^gwjob-[0-9a-f]{64}$/.test(jobId), 'Invalid prepared job ID');
  const job = readJson(path.join(packageProof.packageDir, 'jobs', `${jobId}.json`));
  const provenanceBytes = readLimited(provenanceFile, MAX_SPEC_BYTES);
  const provenance = JSON.parse(provenanceBytes.toString('utf8'));
  assert(isObject(provenance) && provenance.schemaVersion === 'urai-generic-world-output-provenance-v1', 'Candidate provenance schema mismatch');
  assert(provenance.templateOnly !== true && provenance.actualOutputExists !== false, 'A readiness template is not actual provider provenance');
  enforceGeneric(provenance, 'candidateProvenance');
  assert(provenance.truthClassification === 'GENERIC' && provenance.jobId === jobId && provenance.sourceKitSha256 === job.sourceKitSha256 && provenance.providerSpecSha256 === job.providerSpec.sha256, 'Candidate source/truth/job bindings do not match prepared job');
  assert(provenance.provider === job.provider, 'Candidate must use its prepared Model Forge adapter');
  requiredString(provenance.providerSubmissionId, 'Actual provider submission ID', 500);
  requiredString(provenance.creator, 'Identifiable creator/provider', 500);
  assert(Number.isFinite(Date.parse(provenance.generationDate)), 'Generation date required');
  assert(isObject(provenance.license) && ['CLEAR', 'UNKNOWN', 'RESTRICTED'].includes(provenance.license.status), 'License record required, with explicit known/unknown status');
  assert(provenance.accepted !== true && provenance.visualAcceptance !== true && provenance.runtimeIntegrated !== true, 'Candidate import cannot grant acceptance or runtime integration');
  const bytes = readLimited(glbFile, MAX_GLB_BYTES);
  const candidateSha256 = sha256(bytes);
  assert(isSha(provenance.outputSha256) && provenance.outputSha256 === candidateSha256, 'Actual output SHA-256 does not match provenance');
  const inspection = inspectEmbeddedGlb(bytes);
  const spec = readJson(contained(packageProof.packageDir, job.providerSpec.path));
  assert(inspection.triangles <= spec.target.maxTriangles, 'Actual triangle count exceeds prepared target');
  const validator = path.resolve(modelForgeRoot, 'validate-glb.mjs');
  assert(fs.lstatSync(validator).isFile(), 'Existing Asset Factory Model Forge validator is required');
  const child = spawnSync(process.execPath, [validator, path.resolve(glbFile), String(spec.target.maxTriangles)], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, shell: false });
  assert(!child.error && child.status === 0, `Existing Model Forge validation rejected candidate: ${(child.stderr || child.error?.message || '').slice(0, 600)}`);
  const existingReport = JSON.parse(child.stdout);
  assert(existingReport.sha256 === candidateSha256, 'Existing validator output digest mismatch');
  const commercialRightsKnown = provenance.license.status === 'CLEAR' && provenance.license.commercialUse === true && typeof provenance.license.identifier === 'string' && provenance.license.identifier.trim();
  const quarantineHash = sha256(canonicalJson({ packageId: packageProof.packageId, jobId, candidateSha256, provenanceSha256: sha256(provenanceBytes) }));
  const target = path.resolve(outputDir, `gwcandidate-${quarantineHash}`);
  assert(!target.startsWith(`${path.resolve(packageDir)}${path.sep}`), 'Never mutate immutable prepared package');
  if (fs.existsSync(target)) {
    const receipt = readJson(path.join(target, 'receipt.json'));
    assert(receipt.outputSha256 === sha256(readLimited(path.join(target, 'candidate.glb'), MAX_GLB_BYTES)) && receipt.provenanceSha256 === sha256(readLimited(path.join(target, 'provenance.json'), MAX_SPEC_BYTES)), 'Quarantine history was changed');
    return { ...receipt, quarantineDir: target, reused: true };
  }
  const receipt = {
    schemaVersion: 'urai-generic-world-quarantine-receipt-v1', quarantineId: `gwcandidate-${quarantineHash}`, importedAt: new Date().toISOString(),
    packageId: packageProof.packageId, jobId, sourceKitId: job.sourceKitId, provider: job.provider,
    actualProviderSubmissionId: provenance.providerSubmissionId, truthClassification: 'GENERIC', status: commercialRightsKnown ? 'GENERATED' : 'BLOCKED',
    candidateGenerated: true, outputSha256: candidateSha256, outputBytes: bytes.length, provenanceSha256: sha256(provenanceBytes),
    structuralChecks: { performed: true, existingModelForgeValidatorSha256: sha256(readLimited(validator, MAX_SPEC_BYTES)), embeddedDependencies: true, counts: inspection },
    fullAssetMachineValidated: false, visualReviewPerformed: false, assetAccepted: false, runtimeIntegrated: false, releaseAccepted: false, independentlyApproved: false, xrCertified: false,
    providerCallsPerformedByImporter: 0, totalSpentByImporter: 0,
    unresolved: [...(!commercialRightsKnown ? ['Commercial license/rights unresolved'] : []), 'Scale and orientation must be measured against target', 'UV/normals and geometry detail QA', 'Collision/nav and safe teleport', 'Desktop/mobile/XR LOD and actual performance', 'Required preview shots', 'Literal visual review', 'Governed asset acceptance', 'Separate runtime and release acceptance'],
    limitations: ['Structural parsing is not full glTF Validator certification', 'No missing-file resolution or governed asset resolver changes', 'No promotion or runtime integration'],
  };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(target), '.gwcandidate-stage-'));
  try {
    const artifacts = new Map([
      ['candidate.glb', bytes], ['provenance.json', provenanceBytes],
      ['model-forge-validation.json', Buffer.from(canonicalJson(existingReport))],
      ['receipt.json', Buffer.from(canonicalJson(receipt))],
    ]);
    const sums = [];
    for (const [relative, content] of artifacts) { fs.writeFileSync(path.join(staging, relative), content, { flag: 'wx' }); sums.push(`${sha256(content)}  ${relative}`); }
    fs.writeFileSync(path.join(staging, 'checksums.sha256'), sums.sort(compare).join('\n') + '\n', { flag: 'wx' });
    fs.renameSync(staging, target);
  } catch (error) { fs.rmSync(staging, { recursive: true, force: true }); throw error; }
  return { ...receipt, quarantineDir: target, reused: false };
}
