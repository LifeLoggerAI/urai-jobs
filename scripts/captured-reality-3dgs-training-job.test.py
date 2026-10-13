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

if __name__ == '__main__':
    unittest.main()
