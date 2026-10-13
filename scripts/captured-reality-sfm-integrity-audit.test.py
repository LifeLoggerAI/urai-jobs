#!/usr/bin/env python3
"""Synthetic regression tests for private, non-promoting camera-solve audit."""
import copy
import io
from PIL import Image
import hashlib
import importlib.util
import json
import pathlib
import struct
import tempfile
import unittest
import zlib

SCRIPT = pathlib.Path(__file__).with_name('captured-reality-sfm-integrity-audit.py')
spec = importlib.util.spec_from_file_location('urai_sfm_audit', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def png(mode, data, size=(2, 1)):
    image = Image.new(mode, size)
    image.putdata(list(data))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()




def save(root, name, data):
    p = root / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    return hashlib.sha256(data).hexdigest()


def write_json(root, name, obj):
    save(root, name, json.dumps(obj).encode())


def fixture(root, cameras=5):
    frame_items = []
    inputs = []
    for i in range(6):
        split = 'candidate' if i < 5 else 'holdout'
        ident = f'{split}_{i:03d}'
        filename = f'{ident}.png'
        image_data = png('RGB', [(30+i,50+i,70+i),(90+i,110+i,130+i)])
        mask_data = png('L', [255,0])
        derived_data = png('RGB', [(30+i,50+i,70+i),(0,0,0)])
        frame_sha = save(root, f'frames/{filename}', image_data)
        mask_sha = save(root, f'masks/{filename}', mask_data)
        frame_items.append({'split': split, 'id': ident, 'frame': f'frames/{filename}', 'mask': f'masks/{filename}',
                            'source_part':'synthetic.mp4', 'source_timestamp_seconds': 2*i if i < 5 else 100.0,
                            'frame_sha256': frame_sha, 'mask_sha256': mask_sha})
        if split == 'candidate':
            sfm_sha = save(root, f'sfm-images/{filename}', derived_data)
            inputs.append({'file': filename, 'id': ident, 'sha256': sfm_sha})
    write_json(root,'frame-manifest.json',{'schema':'urai-private-static-subset-v1',
                'classification':'PRIVATE_TRAINING_INPUT_NOT_RUNTIME_ASSET',
                'source_parts':[{'name':'synthetic.mp4'}],
                'candidate_count':5, 'holdout_count':1, 'frames':frame_items})
    write_json(root,'sfm-input-receipt.json',{'schema':'urai-private-masked-sfm-input-v1',
                'classification':'PRIVATE_CAMERA_SOLVE_DERIVATIVE',
                'input_manifest_sha256': hashlib.sha256((root/'frame-manifest.json').read_bytes()).hexdigest(),
                'inputs':inputs})
    save(root,'camera-solve-pycolmap-4.2.0/models/0/cameras.bin',
         struct.pack('<QiiQQ4d',1,1,2,2,1,2,1,0.5,0.0))
    i = struct.pack('<Q', cameras)
    for x in range(cameras):
        i += struct.pack('<i4d3di', x + 1, 1, 0, 0, 0, -x, 0, 0, 1)
        observations = [(float(x) + point * .01, 0.5, 1 if (x == 0 and point == 5) or (x == 1 and point == 9) else -1)
                        for point in range(10)]
        i += f'candidate_{x:03d}.png'.encode() + b'\x00' + struct.pack('<Q',len(observations))
        for px, py, point_id in observations:
            i += struct.pack('<ddq', px, py, point_id)
    save(root,'camera-solve-pycolmap-4.2.0/models/0/images.bin',i)
    point = struct.pack('<Q',1) + struct.pack('<QdddBBBdQ',1,1,2,3,25,50,75,0.5,2)
    point += struct.pack('<ii', 1, 5) + struct.pack('<ii', 2, 9)
    save(root,'camera-solve-pycolmap-4.2.0/models/0/points3D.bin',point)
    write_json(root,'camera-solve-pycolmap-4.2.0/camera-solve-quality.json',{
        'registered_images':cameras,'points3d':1,
        'reprojection_error_px':{'mean':0.5}, 'scale_note':'unscaled SfM coordinates'})
    write_json(root,'camera-solve-pycolmap-4.2.0/camera-solve-receipt.json',{
        'classification':'CAMERA_SOLVE_NOT_GAUSSIAN_RECONSTRUCTION',
        'models':[{'registered_images':cameras,'points3d':1}]})


class PrivateCameraSolveTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory(prefix='urai-synthetic-sfm-')
        self.root=pathlib.Path(self.directory.name)
        fixture(self.root)

    def tearDown(self):
        self.directory.cleanup()

    def update(self, name, callback):
        p=self.root/name
        obj=json.loads(p.read_text())
        callback(obj)
        write_json(self.root,name,obj)

    def denied(self, code):
        with self.assertRaises(module.AuditFailure) as failure:
            module.audit(self.root)
        self.assertEqual(str(failure.exception),code)

    def test_valid_synthetic_camera_solve_remains_unaccepted(self):
        result=module.audit(self.root)
        self.assertTrue(result['technicalInputIntegrityVerified'])
        self.assertTrue(result['maskedSfmPixelDerivationVerified'])
        self.assertTrue(result['sourceManifestBindingVerified'])
        self.assertTrue(result['cameraIntrinsicsVerified'])
        self.assertTrue(result['temporalHoldoutIsolationVerified'])
        self.assertEqual((result['candidateViews'],result['holdoutViews'],result['registeredViews']),(5,1,5))
        for item in ('gaussianAssetProduced','metricScaleVerified','privateRuntimeIntegrated',
                     'navigationAccepted','literalVisualAccepted','familyIdentityAccepted','publicReleaseAuthorized'):
            self.assertIs(result[item],False)
        self.assertNotIn(str(self.root),json.dumps(result))

    def test_altered_masked_pixels_cannot_be_accepted_by_forged_receipt(self):
        target='sfm-images/candidate_000.png'
        tampered=png('RGB',[(11,22,33),(44,55,66)])
        forged=save(self.root,target,tampered)
        def alter(obj):obj['inputs'][0]['sha256']=forged
        self.update('sfm-input-receipt.json',alter)
        self.denied('MASK_PIXEL_DERIVATION_INVALID')

    def test_processing_manifest_must_bind_exact_source_manifest(self):
        def alter(obj):obj['input_manifest_sha256']='0'*64
        self.update('sfm-input-receipt.json',alter)
        self.denied('SFM_SOURCE_MANIFEST_BINDING_INVALID')

    def test_invalid_camera_intrinsics_rejected(self):
        target=self.root/'camera-solve-pycolmap-4.2.0/models/0/cameras.bin'
        target.write_bytes(struct.pack('<QiiQQ4d',1,1,2,2,1,0,1,.5,0))
        self.denied('CAMERA_INTRINSICS_INVALID')

    def test_close_source_timestamps_prevent_independent_holdout_claim(self):
        def alter(obj):obj['frames'][-1]['source_timestamp_seconds']=.05
        self.update('frame-manifest.json',alter)
        self.update('sfm-input-receipt.json',lambda obj:obj.update({
            'input_manifest_sha256':hashlib.sha256((self.root/'frame-manifest.json').read_bytes()).hexdigest()}))
        result=module.audit(self.root)
        self.assertFalse(result['temporalHoldoutIsolationVerified'])
        self.assertEqual(result['minSamePartHoldoutSeparationSeconds'],.05)
        self.assertFalse(result['heldoutRadianceMetricsAccepted'])

    def test_frame_changed_after_receipt_is_denied(self):
        with (self.root/'frames/candidate_000.png').open('ab') as f:
            f.write(b'tampered')
        self.denied('SOURCE_FIXITY_MISMATCH')

    def test_holdout_inserted_into_sfm_input_is_denied(self):
        def alter(obj):
            obj['inputs'][0]['file']='holdout_005.png'
        self.update('sfm-input-receipt.json',alter)
        self.denied('SFM_INPUT_IDENTITY_INVALID')

    def test_path_traversal_is_denied(self):
        def alter(obj):
            obj['frames'][0]['frame']='../../candidate_000.png'
        self.update('frame-manifest.json',alter)
        self.update('sfm-input-receipt.json',lambda obj:obj.update({
            'input_manifest_sha256':hashlib.sha256((self.root/'frame-manifest.json').read_bytes()).hexdigest()}))
        self.denied('SOURCE_PATH_INVALID')

    def test_source_symlink_is_denied(self):
        p=self.root/'frames/candidate_000.png'
        p.rename(self.root/'frames/safe.png')
        p.symlink_to(self.root/'frames/safe.png')
        self.denied('SOURCE_SYMLINK_DENIED')

    def test_forged_camera_quality_is_denied(self):
        def alter(obj):
            obj['reprojection_error_px']['mean']=0.02
        self.update('camera-solve-pycolmap-4.2.0/camera-solve-quality.json',alter)
        self.denied('CAMERA_REPROJECTION_INVALID')

    def test_low_registration_is_denied(self):
        fixture(self.root,cameras=3)
        self.denied('CAMERA_REGISTRATION_BELOW_FLOOR')

    def test_missing_metric_scale_disclaimer_is_denied(self):
        def alter(obj):
            obj['scale_note']='verified meters'
        self.update('camera-solve-pycolmap-4.2.0/camera-solve-quality.json',alter)
        self.denied('METRIC_SCALE_MISREPRESENTED')

    def test_nonbinary_privacy_mask_denied_even_with_rehashed_derivative(self):
        ref='masks/candidate_000.png'
        new_mask=png('L',[255,128,0],size=(3,1))
        fresh=save(self.root,ref,new_mask)
        frame_sha=save(self.root,'frames/candidate_000.png',
                       png('RGB',[(30,50,70),(60,70,80),(90,110,130)],size=(3,1)))
        derived_sha=save(self.root,'sfm-images/candidate_000.png',
                         png('RGB',[(30,50,70),(30,35,40),(0,0,0)],size=(3,1)))
        self.update('frame-manifest.json',lambda m:m['frames'][0].update({
            'mask_sha256':fresh,'frame_sha256':frame_sha}))
        self.update('sfm-input-receipt.json',lambda x:x['inputs'][0].update({'sha256':derived_sha}))
        self.update('sfm-input-receipt.json',lambda x:x.update({
            'input_manifest_sha256':hashlib.sha256((self.root/'frame-manifest.json').read_bytes()).hexdigest()}))
        self.denied('MASK_NOT_BINARY')

    def test_different_source_part_labels_do_not_claim_independent_holdout(self):
        self.update('frame-manifest.json',lambda x:(
            x['source_parts'].append({'name':'synthetic-chunk-02.mp4'}),
            x['frames'][-1].update({'source_part':'synthetic-chunk-02.mp4'})))
        self.update('sfm-input-receipt.json',lambda x:x.update({
            'input_manifest_sha256':hashlib.sha256((self.root/'frame-manifest.json').read_bytes()).hexdigest()}))
        receipt=module.audit(self.root)
        self.assertIsNone(receipt['minSamePartHoldoutSeparationSeconds'])
        self.assertFalse(receipt['temporalHoldoutIsolationVerified'])
        self.assertFalse(receipt['independentCaptureSessionVerified'])

    def test_duplicate_point_track_observation_denied(self):
        p=self.root/'camera-solve-pycolmap-4.2.0/models/0/points3D.bin'
        raw=bytearray(p.read_bytes())
        struct.pack_into('<ii',raw,len(raw)-8,1,9)
        p.write_bytes(raw)
        self.denied('POINT_TRACK_INVALID')

    def test_out_of_range_point_observation_is_denied(self):
        p=self.root/'camera-solve-pycolmap-4.2.0/models/0/points3D.bin'
        raw=bytearray(p.read_bytes())
        struct.pack_into('<ii',raw,len(raw)-8,2,99)
        p.write_bytes(raw)
        self.denied('POINT_TRACK_BACKREF_INVALID')

    def test_wrong_2d_point_identity_is_denied(self):
        p=self.root/'camera-solve-pycolmap-4.2.0/models/0/images.bin'
        raw=bytearray(p.read_bytes())
        first=raw.find(b'candidate_000.png\x00')
        self.assertGreater(first,0)
        # Exactly one observation follows its 8-byte length.
        obs=first+len(b'candidate_000.png\x00')+8
        struct.pack_into('<q',raw,obs+16,2)
        p.write_bytes(raw)
        self.denied('POINT_TRACK_BACKREF_INVALID')

    def test_untracked_image_observation_is_denied(self):
        p=self.root/'camera-solve-pycolmap-4.2.0/models/0/images.bin'
        raw=bytearray(p.read_bytes())
        first=raw.find(b'candidate_002.png\x00')
        self.assertGreater(first,0)
        obs=first+len(b'candidate_002.png\x00')+8
        struct.pack_into('<q',raw,obs+16,1)
        p.write_bytes(raw)
        self.denied('POINT_TRACK_BACKREF_INCOMPLETE')

    def test_duplicate_source_part_entries_are_denied(self):
        self.update('frame-manifest.json',lambda x:x['source_parts'].append({'name':'synthetic.mp4'}))
        self.update('sfm-input-receipt.json',lambda x:x.update({
            'input_manifest_sha256':hashlib.sha256((self.root/'frame-manifest.json').read_bytes()).hexdigest()}))
        self.denied('SOURCE_PART_MANIFEST_INVALID')

    def test_bad_3d_binary_is_denied(self):
        p=self.root/'camera-solve-pycolmap-4.2.0/models/0/points3D.bin'
        p.write_bytes(p.read_bytes()[:-1])
        self.denied('POINT_MODEL_INVALID')

if __name__=='__main__':
    unittest.main()