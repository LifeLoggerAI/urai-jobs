'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { constants } = require('node:fs');

const HANDLE = /^[A-Za-z0-9._:-]{8,512}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const FRAME = /^\d{6}\.(png|jpg)$/;

function validateMaskMetadata(input) {
  if (!input || typeof input !== 'object') throw new Error('MASK_INPUT_INVALID');
  for (const name of ['dynamicsPresent', 'maskRequired']) {
    if (input[name] !== undefined && typeof input[name] !== 'boolean') throw new Error('MASK_REQUIREMENT_INVALID');
  }
  const required = input.dynamicsPresent === true || input.maskRequired === true;
  if (input.mask === undefined) {
    if (required) throw new Error('DYNAMIC_SOURCE_MASK_REQUIRED');
    return null;
  }
  const mask = input.mask;
  if (!mask || typeof mask !== 'object' || mask.accepted !== true
    || !HANDLE.test(String(mask.inputRef || '')) || mask.inputRef === input.inputRef
    || !SHA256.test(String(mask.sha256 || '')) || mask.frameSha256 !== input.sha256
    || !SHA256.test(String(mask.frameSha256 || '')) || mask.frameProvenanceRef !== input.frameProvenanceRef
    || !HANDLE.test(String(mask.frameProvenanceRef || '')) || !HANDLE.test(String(mask.maskProvenanceRef || ''))
    || !Number.isSafeInteger(mask.byteSize) || mask.byteSize < 33 || mask.byteSize > 64 * 1024 * 1024
    || mask.mimeType !== 'image/png') throw new Error('ACCEPTED_MASK_BINDING_INVALID');
  // The protected manifest remains the authority. Do not return private paths,
  // current owner identity, filenames, URLs or untrusted extra metadata.
  return { inputRef: mask.inputRef, accepted: true, frameSha256: mask.frameSha256,
    frameProvenanceRef: mask.frameProvenanceRef, maskProvenanceRef: mask.maskProvenanceRef,
    sha256: mask.sha256, byteSize: mask.byteSize, mimeType: 'image/png' };
}

function pngDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('MASK_PNG_HEADER_INVALID');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 16384 || height > 16384 || width * height > 64 * 1024 * 1024) throw new Error('MASK_PNG_DIMENSIONS_INVALID');
  return { width, height };
}

function bindMasksToTransforms(transforms, lineage) {
  if (!transforms || !Array.isArray(transforms.frames) || !Array.isArray(lineage) || lineage.length > 3000) throw new Error('MASK_CAMERA_MANIFEST_INVALID');
  const sorted = [...lineage].sort((a, b) => String(a.filename).localeCompare(String(b.filename), 'en'));
  const maskByPath = new Map();
  const names = new Set();
  sorted.forEach((input, index) => {
    if (!FRAME.test(String(input.filename || '')) || names.has(input.filename)) throw new Error('MASK_FRAME_NAME_INVALID');
    names.add(input.filename);
    const mask = validateMaskMetadata(input);
    const basename = `frame_${String(index + 1).padStart(5, '0')}`;
    maskByPath.set(`images/${basename}.${input.filename.split('.').at(-1)}`, mask ? { path: `masks/${basename}.png`, dimensions: input.maskDimensions } : null);
  });
  const bound = JSON.parse(JSON.stringify(transforms));
  const seen = new Set(); let maskedRegisteredViews = 0;
  for (const frame of bound.frames) {
    const name = String(frame?.file_path || '').replace(/^\.\//, '');
    if (!maskByPath.has(name) || seen.has(name)) throw new Error('MASK_CAMERA_BINDING_INVALID');
    seen.add(name);
    const expected = maskByPath.get(name);
    if (frame.mask_path !== undefined && frame.mask_path !== expected?.path) throw new Error('MASK_PATH_BINDING_MISMATCH');
    if (expected) {
      const width = frame.w ?? bound.w, height = frame.h ?? bound.h;
      if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1
        || expected.dimensions?.width !== width || expected.dimensions?.height !== height) throw new Error('MASK_CAMERA_DIMENSIONS_MISMATCH');
      frame.mask_path = expected.path; maskedRegisteredViews++;
    }
  }
  if (maskedRegisteredViews > 0 && maskedRegisteredViews !== bound.frames.length) {
    // Nerfstudio requires a mask for every registered view once masks are used.
    // The caller may supply verified all-white masks for static views; no mask
    // is silently synthesized or substituted by this binding layer.
    throw new Error('MASK_REGISTERED_COVERAGE_INCOMPLETE');
  }
  return { transforms: bound, receipt: { schemaVersion: 'urai-source-bound-mask-binding-v1',
    maskedRegisteredViews, totalRegisteredViews: bound.frames.length, sourceHashBindingVerified: true,
    maskDownscalePolicy: 'EXPLICIT_NATIVE_DOWNSCALE_FACTOR_ONE', candidateAcceptance: false,
    publicReleaseAuthorized: false } };
}

async function prepareSfmMasks(workspace, lineage) {
  if (!Array.isArray(lineage) || lineage.length < 3 || lineage.length > 3000) throw new Error('MASK_SFM_INPUT_INVALID');
  const sorted = [...lineage].sort((a, b) => String(a.filename).localeCompare(String(b.filename), 'en'));
  const masks = sorted.map(validateMaskMetadata);
  if (masks.every((mask) => !mask)) return null;
  // Native COLMAP and radiance training must use the same admitted masks. Do
  // not fill a missing static mask, or defer coverage failure until after SfM.
  if (masks.some((mask) => !mask)) throw new Error('MASK_SFM_COVERAGE_INCOMPLETE');
  const destination = path.join(workspace, '05_colmap_processed', 'sfm-masks');
  await fs.mkdir(destination, { recursive: true, mode: 0o700 });
  const names = new Set(), entries = [];
  for (const [index, input] of sorted.entries()) {
    if (!FRAME.test(String(input.filename || '')) || names.has(input.filename)) throw new Error('MASK_FRAME_NAME_INVALID');
    names.add(input.filename);
    const bytes = await fs.readFile(path.join(workspace, 'source-masks', input.filename.replace(/\.(png|jpg)$/, '.png')));
    const mask = masks[index], dimensions = pngDimensions(bytes);
    if (bytes.length !== mask.byteSize || crypto.createHash('sha256').update(bytes).digest('hex') !== mask.sha256) throw new Error('MASK_SFM_FIXITY_MISMATCH');
    const imageName = `frame_${String(index + 1).padStart(5, '0')}.${input.filename.split('.').at(-1)}`;
    // COLMAP appends .png to the complete image name, including its extension.
    await fs.copyFile(path.join(workspace, 'source-masks', input.filename.replace(/\.(png|jpg)$/, '.png')),
      path.join(destination, `${imageName}.png`), constants.COPYFILE_EXCL);
    entries.push({ sourceFilename: input.filename, imageName, sourceSha256: input.sha256, sourceByteSize: input.byteSize,
      maskSha256: mask.sha256, maskByteSize: mask.byteSize, ...dimensions });
  }
  const manifest = { schemaVersion: 'urai-source-bound-sfm-mask-v1', entries };
  const bytes = Buffer.from(JSON.stringify(manifest));
  await fs.writeFile(path.join(workspace, 'sfm-mask-authority.json'), bytes, { flag: 'wx', mode: 0o600 });
  return { schemaVersion: manifest.schemaVersion, manifestSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    maskedInputViews: entries.length, candidateAcceptance: false, publicReleaseAuthorized: false };
}

function verifySfmMaskReceipt(receipt, prepared) {
  if (!prepared || receipt?.schemaVersion !== 'urai-native-colmap-mask-application-v1'
    || receipt.manifestSha256 !== prepared.manifestSha256 || receipt.maskedInputViews !== prepared.maskedInputViews
    || receipt.maskFlag !== '--ImageReader.mask_path' || receipt.nativeDimensionsVerified !== true
    || receipt.featureExtractionSucceeded !== true || receipt.candidateAcceptance !== false) throw new Error('MASK_SFM_APPLICATION_UNVERIFIED');
  return JSON.parse(JSON.stringify(receipt));
}

module.exports = { validateMaskMetadata, pngDimensions, bindMasksToTransforms, prepareSfmMasks, verifySfmMaskReceipt };
