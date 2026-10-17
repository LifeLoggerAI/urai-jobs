"""Synthetic, no-owner-media tests for World001 capture screening.

Tests execute the real image-scoring kernel and source manifest controls.
No training, real-media access, provider calls, holdout or admission.
"""
import importlib.util
import math
from pathlib import Path
import sys
import tempfile
import unittest
sys.dont_write_bytecode = True

SOURCE = Path(__file__).with_name('world001-capture-image-quality.py')
spec = importlib.util.spec_from_file_location('urai_world001_capture_quality', SOURCE)
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)


def patterned(w=96, h=96, cell=6, low=40, high=210):
    return [[low if ((x//cell + y//cell) % 2) else high for x in range(w)] for y in range(h)]


def physical_packet():
    return {
        'schema': 'urai-world001-source-correction-1',
        'scene_authority': {'kind':'CALIBRATED_PHYSICAL_CAPTURE',
                            'source_truth':'CALIBRATED_PHOTOGRAPHIC_CAPTURE'},
        'paid_compute_authorized': False,
        'gaussian_training_permitted': False,
        'sessions': [{'id':'train_capture_a','capture_controls': {
            'camera_id':'camera001','lens_id':'lens001', 'focus':'MANUAL_LOCKED',
            'exposure':'MANUAL_LOCKED','white_balance':'MANUAL_LOCKED'}}],
        'calibrations': {'cal_001': {'camera_id':'camera001','lens_id':'lens001',
                                    'distortion_status':'CALIBRATED_ZERO_OR_RECTIFIED'}},
        'views': [{'id':f'v{i}','split':'train','session_id':'train_capture_a',
                   'calibration_id':'cal_001'} for i in range(8)],
        'evaluation_plan': {'source_disjoint_holdout': True,
                            'holdout_images_materialized': False,
                            'reserved_future_session_id':'untouched_future_capture'}
    }


class ImageQualityTests(unittest.TestCase):
    def test_textured_well_exposed_pixels_pass_screen(self):
        r = q.inspect_luma_grid(patterned())
        self.assertTrue(r['diagnostic_pass'], r['flags'])
        self.assertEqual(r['flags'], [])
        self.assertGreater(r['metrics']['laplacian_variance'], 28)
        self.assertGreater(r['metrics']['corner_fraction'], 0)

    def test_uniform_frame_fails_focus_contrast_texture(self):
        r = q.inspect_luma_grid([[125] * 64 for _ in range(64)])
        self.assertFalse(r['diagnostic_pass'])
        self.assertIn('CAPTURE_LOW_SHARPNESS_ESTIMATE', r['flags'])
        self.assertIn('CAPTURE_LOW_CONTRAST', r['flags'])
        self.assertIn('CAPTURE_INSUFFICIENT_CORNER_TEXTURE', r['flags'])

    def test_clipped_checkerboard_is_not_exposure_accepted(self):
        r = q.inspect_luma_grid(patterned(low=0, high=255))
        self.assertIn('CAPTURE_EXPOSURE_CLIPPING_EXCESS', r['flags'])

    def test_luma_outside_screen_is_not_accepted(self):
        r = q.inspect_luma_grid([[235 + (x%6) for x in range(80)] for y in range(80)])
        self.assertIn('CAPTURE_EXPOSURE_MEAN_OUTSIDE_SCREEN', r['flags'])

    def test_one_direction_texture_is_not_accepted_as_two_axis(self):
        r = q.inspect_luma_grid([[50 if (y//4)%2 else 200 for x in range(80)] for y in range(80)])
        self.assertIn('CAPTURE_DIRECTIONAL_DETAIL_IMBALANCE', r['flags'])

    def test_bad_grid_shape_rejected(self):
        with self.assertRaisesRegex(ValueError, 'IMAGE_SAMPLE_GRID_INVALID'):
            q.inspect_luma_grid([[123]*64 for _ in range(32)] + [[2]])

    def test_unsafe_pixel_value_rejected(self):
        r = patterned();r[1][1] = 256
        with self.assertRaisesRegex(ValueError, 'IMAGE_LUMA_INVALID'):
            q.inspect_luma_grid(r)
        r = patterned();r[1][1] = math.nan
        with self.assertRaisesRegex(ValueError, 'IMAGE_LUMA_INVALID'):
            q.inspect_luma_grid(r)

    def test_too_small_grid_rejected(self):
        with self.assertRaisesRegex(ValueError, 'IMAGE_SAMPLE_GRID_TOO_SMALL'):
            q.inspect_luma_grid(patterned(16,16))

    def test_png_decoder_reads_actual_image_pixels_when_available(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest('Pillow is optional for CI synthetic kernel tests')
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/'capture.png'
            img = Image.new('L', (1280,720))
            data = [40 if ((x//25+y//25)%2) else 210 for y in range(720) for x in range(1280)]
            img.putdata(data)
            img.save(p)
            grid=q.decode_owner_local_png(p)
            self.assertTrue(q.inspect_luma_grid(grid)['diagnostic_pass'])


class CameraControlTests(unittest.TestCase):
    def test_calibrated_physical_locked_packet_passes_control_gate(self):
        r=q.verify_locked_capture_metadata(physical_packet())
        self.assertEqual(r['train_views'],8)
        self.assertEqual(r['distinct_calibrations'],1)

    def test_render_is_not_relabelled_photograph(self):
        m=physical_packet();m['scene_authority']['kind']='CONTROLLED_RENDER_FIXED_SCENE'
        with self.assertRaisesRegex(ValueError,'CAPTURE_PHYSICAL_SOURCE_REQUIRED'):
            q.verify_locked_capture_metadata(m)

    def test_focus_and_exposure_must_be_locked(self):
        for prop in ('focus','exposure','white_balance'):
            m=physical_packet();m['sessions'][0]['capture_controls'][prop]='AUTO'
            with self.subTest(prop=prop), self.assertRaisesRegex(ValueError,'CAPTURE_CAMERA_CONTROLS_NOT_LOCKED'):
                q.verify_locked_capture_metadata(m)

    def test_lens_identity_drift_rejected(self):
        m=physical_packet();m['calibrations']['cal_001']['lens_id']='other'
        with self.assertRaisesRegex(ValueError,'CAPTURE_LENS_OR_CALIBRATION_DRIFT'):
            q.verify_locked_capture_metadata(m)

    def test_distortion_not_calibrated_rejected(self):
        m=physical_packet();m['calibrations']['cal_001']['distortion_status']='UNKNOWN'
        with self.assertRaisesRegex(ValueError,'CAPTURE_LENS_OR_CALIBRATION_DRIFT'):
            q.verify_locked_capture_metadata(m)

    def test_holdout_never_admitted_into_training_screen(self):
        m=physical_packet();m['views'][0]['split']='holdout'
        with self.assertRaisesRegex(ValueError,'CAPTURE_HOLDOUT_OR_UNKNOWN_VIEW_REFUSED'):
            q.verify_locked_capture_metadata(m)

    def test_future_holdout_must_remain_unmaterialized(self):
        m=physical_packet();m['evaluation_plan']['holdout_images_materialized']=True
        with self.assertRaisesRegex(ValueError,'CAPTURE_HOLDOUT_NOT_FROZEN'):
            q.verify_locked_capture_metadata(m)
    def test_blank_or_path_like_future_holdout_id_never_reserves_a_disjoint_session(self):
        for invalid in ('', '  ', '.', '..', '../future', 'future/next', 'future\\\\next',
                        ' future', 'future '):
            m=physical_packet()
            m['evaluation_plan']['reserved_future_session_id']=invalid
            with self.subTest(value=invalid), self.assertRaisesRegex(
                    ValueError, 'CAPTURE_HOLDOUT_NOT_FROZEN'):
                q.verify_locked_capture_metadata(m)

    def test_current_train_session_cannot_be_renamed_as_future_holdout(self):
        m=physical_packet()
        m['evaluation_plan']['reserved_future_session_id']='train_capture_a'
        with self.assertRaisesRegex(ValueError, 'CAPTURE_HOLDOUT_NOT_FROZEN'):
            q.verify_locked_capture_metadata(m)

    def test_blank_or_whitespace_padded_training_view_id_is_rejected(self):
        for invalid in ('', '  ', ' view001', 'view001 '):
            m=physical_packet()
            m['views'][0]['id']=invalid
            with self.subTest(value=invalid), self.assertRaisesRegex(
                    ValueError, 'CAPTURE_VIEW_ID_INVALID'):
                q.verify_locked_capture_metadata(m)


    def test_different_camera_identity_rejected(self):
        m=physical_packet();m['calibrations']['cal_001']['camera_id']='foreign'
        with self.assertRaisesRegex(ValueError,'CAPTURE_LENS_OR_CALIBRATION_DRIFT'):
            q.verify_locked_capture_metadata(m)

    def test_paid_capture_authority_never_granted(self):
        m=physical_packet();m['gaussian_training_permitted']=True
        with self.assertRaisesRegex(ValueError,'CAPTURE_NO_GPU_OR_PAID_ADMISSION'):
            q.verify_locked_capture_metadata(m)

    def test_duplicate_frames_rejected(self):
        m=physical_packet();m['views'][1]['id']=m['views'][0]['id']
        with self.assertRaisesRegex(ValueError,'CAPTURE_DUPLICATE_VIEW_ID'):
            q.verify_locked_capture_metadata(m)


if __name__ == '__main__':
    unittest.main(verbosity=2)
