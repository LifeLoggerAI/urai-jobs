'use strict';

const crypto = require('node:crypto');
const SHA256 = /^[a-f0-9]{64}$/;
const FRAME = /^\d{6}\.(png|jpg)$/;
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Reserve radiance-training holdouts from verified input-byte identities before
// SfM runs. Exact copies always share one split, regardless of source handle.
// This cannot certify near-duplicate, temporal or independent-session isolation.
function partitionFrames(inputs) {
  if (!Array.isArray(inputs) || inputs.length < 3 || inputs.length > 3000) throw new Error('SPLIT_INPUT_BUDGET_INVALID');
  const filenames = new Set();
  const records = inputs.map((input) => {
    if (!input || !FRAME.test(String(input.filename || '')) || filenames.has(input.filename)
      || !SHA256.test(String(input.sha256 || '')) || !Number.isSafeInteger(input.byteSize) || input.byteSize < 1) {
      throw new Error('SPLIT_INPUT_IDENTITY_INVALID');
    }
    filenames.add(input.filename);
    return { filename: input.filename, sha256: input.sha256, byteSize: input.byteSize };
  }).sort((a, b) => a.filename.localeCompare(b.filename, 'en'));
  const groups = [...new Set(records.map((record) => record.sha256))].sort();
  const splitByHash = new Map(groups.map((digest) => [digest, 'train']));
  // Three unique training views and two separately reserved view groups are the
  // smallest useful control fixture. A small set stays diagnostic/unaccepted.
  const reserved = groups.length >= 5;
  if (reserved) {
    const perSplit = Math.max(1, Math.floor(groups.length / 10));
    for (let i = 0; i < perSplit; i++) {
      splitByHash.set(groups[i * 2], 'val');
      splitByHash.set(groups[i * 2 + 1], 'test');
    }
  }
  const frames = records.map((record, index) => ({ ...record, split: splitByHash.get(record.sha256),
    processedPath: `images/frame_${String(index + 1).padStart(5, '0')}.${record.filename.split('.').at(-1)}` }));
  return { schemaVersion: 'urai-reconstruction-holdout-v1', reservedBeforeCameraSolve: true,
    policy: 'EXACT_BYTE_HASH_GROUP_DISJOINT', sourceManifestSha256: hash(records), uniqueByteGroups: groups.length,
    duplicateFrameCount: records.length - groups.length, reserved, frames, reservationSha256: hash(frames),
    nearDuplicateIsolationVerified: false, temporalIsolationVerified: false,
    independentCaptureSessionVerified: false, cameraSolveUsesHeldoutImages: true,
    candidateAcceptance: false, publicReleaseAuthorized: false };
}

function bindRegisteredSplits(transforms, reservation) {
  if (!transforms || !Array.isArray(transforms.frames) || !reservation || !Array.isArray(reservation.frames)
    || reservation.reservationSha256 !== hash(reservation.frames)) throw new Error('SPLIT_RESERVATION_INVALID');
  const assigned = new Map(reservation.frames.map((record) => [record.processedPath, record]));
  const seen = new Set(), splits = { train: [], val: [], test: [] };
  for (const frame of transforms.frames) {
    const name = String(frame?.file_path || '').replace(/^\.\//, '');
    const assignedFrame = assigned.get(name);
    if (!assignedFrame || seen.has(name)) throw new Error('SPLIT_CAMERA_BINDING_INVALID');
    const matrix = frame.transform_matrix;
    if (!Array.isArray(matrix) || matrix.length !== 4 || matrix.some((row) => !Array.isArray(row) || row.length !== 4
      || row.some((value) => typeof value !== 'number' || !Number.isFinite(value)))) throw new Error('SPLIT_CAMERA_POSE_INVALID');
    seen.add(name); splits[assignedFrame.split].push(name);
  }
  if (splits.train.length < 3) throw new Error('SPLIT_INSUFFICIENT_TRAINING_CAMERAS');
  const bound = JSON.parse(JSON.stringify(transforms));
  // Empty evaluation subsets are an explicit failure of reserved coverage, not
  // an excuse to evaluate training views and call them held out.
  const evaluable = reservation.reserved && splits.val.length > 0 && splits.test.length > 0;
  if (evaluable) {
    bound.train_filenames = splits.train;
    bound.val_filenames = splits.val;
    bound.test_filenames = splits.test;
  }
  const registeredFrames = reservation.frames.filter((frame) => seen.has(frame.processedPath));
  const hashes = Object.fromEntries(Object.keys(splits).map((split) => [split, new Set(registeredFrames.filter((frame) => frame.split === split).map((frame) => frame.sha256))]));
  for (const left of ['train', 'val', 'test']) for (const right of ['train', 'val', 'test']) {
    if (left !== right && [...hashes[left]].some((digest) => hashes[right].has(digest))) throw new Error('SPLIT_BYTE_LEAKAGE');
  }
  return { transforms: bound, receipt: { schemaVersion: reservation.schemaVersion,
    sourceManifestSha256: reservation.sourceManifestSha256, reservationSha256: reservation.reservationSha256,
    transformsSha256: hash(bound), reservedBeforeCameraSolve: true, exactByteIsolationVerified: true,
    reserved: reservation.reserved, evaluable, registeredTrainingViews: splits.train.length,
    registeredValidationViews: splits.val.length, registeredHoldoutViews: splits.test.length,
    unregisteredReservedViews: reservation.frames.filter((frame) => frame.split !== 'train' && !seen.has(frame.processedPath)).length,
    trainingRadianceUsesHeldoutImages: evaluable ? false : null,
    cameraSolveUsesHeldoutImages: true, sparseSeedUsesHeldoutImages: null,
    nearDuplicateIsolationVerified: false, temporalIsolationVerified: false, independentCaptureSessionVerified: false,
    literalReviewState: 'unreviewed', candidateAcceptance: false, publicReleaseAuthorized: false } };
}

function radianceIsolationArguments() {
  // The SfM point cloud can contain heldout-derived color/geometry. For this
  // bounded evaluation use random initialization and never load those points.
  return ['--pipeline.model.random-init', 'True', 'nerfstudio-data', '--load-3D-points', 'False'];
}

function readHoldoutMetrics(report, receipt) {
  if (!receipt?.evaluable || receipt.sparseSeedUsesHeldoutImages !== false || receipt.trainingRadianceUsesHeldoutImages !== false
    || !report || report.method_name !== 'splatfacto' || !report.results || typeof report.results !== 'object') {
    throw new Error('HOLDOUT_EVALUATION_AUTHORITY_INVALID');
  }
  const metrics = {};
  for (const name of ['psnr', 'ssim', 'lpips', 'psnr_std', 'ssim_std', 'lpips_std', 'fps', 'fps_std']) {
    const value = report.results[name];
    if (value !== undefined) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0
        || (['ssim', 'ssim_std'].includes(name) && value > 1)) throw new Error('HOLDOUT_METRIC_INVALID');
      metrics[name] = value;
    }
  }
  if (!['psnr', 'ssim', 'lpips'].every((name) => name in metrics)) throw new Error('HOLDOUT_METRICS_INCOMPLETE');
  return { schemaVersion: 'urai-reconstruction-heldout-metrics-v1', reservationSha256: receipt.reservationSha256,
    heldOutViewCount: receipt.registeredHoldoutViews, metrics, exactByteIsolationVerified: true,
    cameraSolveUsesHeldoutImages: true, sparseSeedUsesHeldoutImages: false,
    nearDuplicateIsolationVerified: false, temporalIsolationVerified: false, independentCaptureSessionVerified: false,
    literalReviewState: 'unreviewed', candidateAcceptance: false, publicReleaseAuthorized: false };
}

module.exports = { partitionFrames, bindRegisteredSplits, radianceIsolationArguments, readHoldoutMetrics };
