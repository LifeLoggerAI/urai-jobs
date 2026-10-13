import importlib.util
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).parent
SPEC = importlib.util.spec_from_file_location('urai_private_training', ROOT / 'captured-reality-3dgs-training-job.py')
job = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(job)

class TrainingSafety(unittest.TestCase):
    def test_private_paths_refuse_traversal_and_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = pathlib.Path(tmp)
            (base/'safe').write_text('safe')
            (base/'alias').symlink_to(base/'safe')
            self.assertEqual(job.private_file(base, 'safe'), base/'safe')
            for path in ('../escape', '/etc/passwd', 'alias'):
                with self.assertRaisesRegex(ValueError, 'UNSAFE_PRIVATE_PATH|SOURCE_FILE_UNAVAILABLE'):
                    job.private_file(base, path)

    def test_colmap_opencv_to_opengl_camera_transform(self):
        expected = [[1,0,0,-1],[0,-1,0,-2],[0,0,-1,-3],[0,0,0,1]]
        self.assertEqual(job.camera_transform({'q':(1,0,0,0),'t':(1,2,3)}), expected)

    def test_training_authorization_fails_closed_without_private_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            with self.assertRaisesRegex(ValueError,'SOURCE_FILE_UNAVAILABLE'):
                job.prepare(root,root,root/'training',None)
            self.assertFalse((root/'training').exists())


    def test_masked_frame_id_must_match_filename_even_when_receipt_has_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            audit = job.mask_audit_reader()
            forged = {'id': 'candidate_000', 'file': 'candidate_001.png', 'sha256': '0' * 64}
            with self.assertRaisesRegex(ValueError, 'MASKED_FRAME_IDENTITY_INVALID'):
                job.verified_masked_candidate(pathlib.Path(tmp), forged, {}, audit)

    def test_masked_pixels_must_match_source_and_mask_not_just_mutable_hash(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / 'frames').mkdir()
            (root / 'masks').mkdir()
            (root / 'sfm-images').mkdir()
            source = Image.new('RGB', (2, 1))
            source.putdata([(35, 55, 75), (95, 115, 135)])
            source.save(root / 'frames/candidate_000.png')
            mask = Image.new('L', (2, 1))
            mask.putdata([255, 0])
            mask.save(root / 'masks/candidate_000.png')
            derivative = Image.new('RGB', (2, 1))
            derivative.putdata([(35, 55, 75), (0, 0, 0)])
            path = root / 'sfm-images/candidate_000.png'
            derivative.save(path)
            item = {'id': 'candidate_000', 'file': 'candidate_000.png', 'sha256': job.sha(path)}
            frame = {'frame': 'frames/candidate_000.png', 'mask': 'masks/candidate_000.png'}
            audit = job.mask_audit_reader()
            self.assertEqual(job.verified_masked_candidate(root, item, frame, audit), path)
            # Forging both input bytes and its mutable SfM checksum cannot admit unmasked pixels.
            path.write_bytes((root / 'frames/candidate_000.png').read_bytes())
            item['sha256'] = job.sha(path)
            with self.assertRaisesRegex(audit.AuditFailure, 'MASK_PIXEL_DERIVATION_INVALID'):
                job.verified_masked_candidate(root, item, frame, audit)


if __name__ == '__main__':
    unittest.main()
