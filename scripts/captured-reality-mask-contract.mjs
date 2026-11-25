import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateMaskMetadata, pngDimensions, bindMasksToTransforms } = require('../workers/captured-reality-worker/reconstruction-masks.js');
const frame = { inputRef: 'synthetic_input_01', filename: '000001.png', sha256: 'a'.repeat(64), frameProvenanceRef: 'synthetic_frame_receipt_01', dynamicsPresent: true, maskDimensions: { width: 720, height: 1280 },
  mask: { inputRef: 'synthetic_mask_01', frameSha256: 'a'.repeat(64), frameProvenanceRef: 'synthetic_frame_receipt_01', maskProvenanceRef: 'synthetic_mask_receipt_01', sha256: 'b'.repeat(64), byteSize: 100, mimeType: 'image/png', accepted: true, path: 'private/synthetic-mask.png', ignored: 'private-extra' } };
const mask = validateMaskMetadata(frame);
assert.equal(mask.sha256, 'b'.repeat(64));
assert.equal(mask.path, undefined); assert.equal(mask.ignored, undefined); assert.equal(mask.accepted, true);
assert.throws(() => validateMaskMetadata({ ...frame, mask: undefined }), /REQUIRED/);
assert.throws(() => validateMaskMetadata({ ...frame, dynamicsPresent: 'false' }), /REQUIREMENT/);
for (const change of [{ accepted: false }, { frameSha256: 'c'.repeat(64) }, { frameProvenanceRef: 'foreign_frame_receipt' }, { maskProvenanceRef: '' }, { mimeType: 'image/jpeg' }, { byteSize: 0 }, { inputRef: frame.inputRef }]) {
  assert.throws(() => validateMaskMetadata({ ...frame, mask: { ...frame.mask, ...change } }), /BINDING/);
}
assert.equal(validateMaskMetadata({ ...frame, dynamicsPresent: false, mask: undefined }), null);
assert.throws(() => validateMaskMetadata({ ...frame, dynamicsPresent: false, maskRequired: true, mask: undefined }), /REQUIRED/);
const png = Buffer.alloc(33); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.writeUInt32BE(13, 8); png.write('IHDR', 12); png.writeUInt32BE(720, 16); png.writeUInt32BE(1280, 20);
assert.deepEqual(pngDimensions(png), { width: 720, height: 1280 });
assert.throws(() => pngDimensions(Buffer.alloc(33)), /HEADER/);
const oversized = Buffer.from(png); oversized.writeUInt32BE(16385, 16); assert.throws(() => pngDimensions(oversized), /DIMENSIONS/);
const transforms = { w: 720, h: 1280, frames: [{ file_path: 'images/frame_00001.png' }] };
const bound = bindMasksToTransforms(transforms, [frame]);
assert.equal(bound.transforms.frames[0].mask_path, 'masks/frame_00001.png');
assert.equal(bound.receipt.maskedRegisteredViews, 1); assert.equal(bound.receipt.candidateAcceptance, false);
assert.equal(transforms.frames[0].mask_path, undefined);
assert.throws(() => bindMasksToTransforms(transforms, [{ ...frame, maskDimensions: undefined }]), /DIMENSIONS/);
assert.throws(() => bindMasksToTransforms(transforms, [{ ...frame, maskDimensions: { width: 1280, height: 720 } }]), /DIMENSIONS/);
assert.throws(() => bindMasksToTransforms({ frames: [{ file_path: '../private.png' }] }, [frame]), /CAMERA_BINDING/);
assert.throws(() => bindMasksToTransforms({ frames: [{ file_path: 'images/frame_00001.png', mask_path: '../private.png' }] }, [frame]), /PATH_BINDING/);
assert.throws(() => bindMasksToTransforms({ ...transforms, frames: [...transforms.frames, { file_path: 'images/frame_00002.png' }] }, [frame, { ...frame, filename: '000002.png', dynamicsPresent: false, mask: undefined }]), /COVERAGE/);
console.log('PASS source-bound mask metadata, exact frame/provenance binding, private-path redaction, required dynamic masks and per-camera coverage (synthetic controls only)');
