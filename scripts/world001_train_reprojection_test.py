"""Synthetic stdlib-only fixed-camera refinement tests; no owner media or GPU."""
import copy
import importlib.util
import math
import pathlib
import sys
import unittest
sys.dont_write_bytecode=True
path=pathlib.Path(__file__).with_name('world001_train_reprojection.py')
spec=importlib.util.spec_from_file_location('world001_train_reprojection',path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
CAL={'fx':800.,'fy':800.,'cx':640.,'cy':360.,'width':1280,'height':720}
NAMES=['S01_PUSH','S02_PULLBACK','S03_LEFT','S04_RIGHT','S05_CW_ARC']

def fixture():
    true=[0.3,-0.2,7.]
    points=[[0.5,-0.15,7.5]]
    poses={};assign={};features={}
    for i,survey in enumerate(NAMES):
        name=f'train/{survey}/view_{i}'
        center=(i-2)*0.5
        R=[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]]
        t=[[-center],[0.],[0.]]
        uv=[CAL['cx']+CAL['fx']*(true[0]-center)/true[2],CAL['cy']+CAL['fy']*true[1]/true[2]]
        poses[name]=(R,t);assign[name]={0:0};features[name]={'pts':[uv],'des':[[22.]*128]}
    return {'poses':poses,'assign':assign,'landmarks':points},features

class Tests(unittest.TestCase):
    def test_real_reprojection_decreases_without_admission(self):
        model,features=fixture();original=copy.deepcopy((model,features))
        updated,metrics=mod.refine_training_only(model,features,CAL)
        self.assertLess(metrics['after_p90_reprojection_px'],metrics['before_p90_reprojection_px']*0.1)
        self.assertLess(math.dist(updated['landmarks'][0],[0.3,-0.2,7.]),0.005)
        self.assertFalse(metrics['gaussian_training_permitted'])
        self.assertFalse(metrics['release_permitted'])
        self.assertFalse(metrics['independent_holdout_passed'])
        self.assertEqual(metrics['heldout_images_read'],0)
        self.assertEqual((model,features),original)
    def test_deterministic_result(self):
        a,b=fixture();x1,m1=mod.refine_training_only(a,b,CAL);x2,m2=mod.refine_training_only(a,b,CAL)
        self.assertEqual((x1,m1),(x2,m2))
    def test_two_view_seed_stays_immutable(self):
        model,features=fixture()
        model['landmarks'].append([0.,0.,5.])
        for name in list(model['assign'])[:2]:
            model['assign'][name][1]=1
            features[name]['pts'].append([640.,360.])
            features[name]['des'].append([40.]*128)
        new,m=mod.refine_training_only(model,features,CAL)
        self.assertEqual(new['landmarks'][1],[0.,0.,5.])
        self.assertEqual(m['immutable_two_view_seed_count'],1)
    def test_heldout_s08_survey_refused(self):
        a,b=fixture();old=list(a['poses'])[-1];new='train/S08_DIAGONAL/view_4'
        for obj in (a['poses'],a['assign'],b):obj[new]=obj.pop(old)
        with self.assertRaisesRegex(ValueError,'HELDOUT_OR_UNTRUSTED_TRAIN_FRAME'):
            mod.refine_training_only(a,b,CAL)
    def test_s08_alias_refused(self):
        a,b=fixture();old=list(a['poses'])[-1];new='train/S08_SPOOF/view_4'
        for obj in (a['poses'],a['assign'],b):obj[new]=obj.pop(old)
        with self.assertRaisesRegex(ValueError,'HELDOUT_OR_UNTRUSTED_TRAIN_FRAME'):
            mod.refine_training_only(a,b,CAL)
    def test_heldout_split_refused(self):
        a,b=fixture();old=list(a['poses'])[-1];new=old.replace('train/','holdout/')
        for obj in (a['poses'],a['assign'],b):obj[new]=obj.pop(old)
        with self.assertRaisesRegex(ValueError,'HELDOUT_OR_UNTRUSTED_TRAIN_FRAME'):
            mod.refine_training_only(a,b,CAL)
    def test_policy_override_refused(self):
        a,b=fixture()
        with self.assertRaisesRegex(ValueError,'TRAIN_REPROJECTION_POLICY_MODIFIED'):
            mod.refine_training_only(a,b,CAL,{'huber_radius_px':100.})
    def test_invalid_calibration_refused(self):
        a,b=fixture()
        with self.assertRaisesRegex(ValueError,'BAD_TRAIN_CALIBRATION'):
            mod.refine_training_only(a,b,dict(CAL,fx=-2.))
    def test_missing_training_frame_refused(self):
        a,b=fixture();b.pop(next(iter(b)))
        with self.assertRaisesRegex(ValueError,'UNBOUND_TRAIN_FRAMES'):
            mod.refine_training_only(a,b,CAL)
    def test_duplicate_2d_track_discarded_not_selected(self):
        a,b=fixture();name=list(a['poses'])[2]
        a['assign'][name][1]=0
        b[name]['pts'].append([700.,700.]);b[name]['des'].append([22.]*128)
        updated,receipt=mod.refine_training_only(a,b,CAL)
        self.assertEqual(receipt['duplicate_track_observations_excluded'],1)
        self.assertEqual(receipt['scored_training_observations'],4)
        self.assertEqual(updated['landmarks'][0][2]>0,True)
    def test_nonfinite_observation_refused(self):
        a,b=fixture();b[next(iter(b))]['pts'][0][0]=float('nan')
        with self.assertRaisesRegex(ValueError,'NONFINITE_TRAIN_OBSERVATION'):
            mod.refine_training_only(a,b,CAL)
    def test_no_positive_depth_refused(self):
        a,b=fixture();a['landmarks'][0][2]=-3.
        with self.assertRaisesRegex(ValueError,'TRAIN_CAMERA_NEGATIVE_DEPTH'):
            mod.refine_training_only(a,b,CAL)
    def test_two_observations_minimum(self):
        a,b=fixture()
        for v in list(a['assign'])[1:]:a['assign'][v].clear()
        with self.assertRaisesRegex(ValueError,'UNTRIANGULATED_TRAIN_LANDMARK'):
            mod.refine_training_only(a,b,CAL)
    def test_exact_step_cap_and_reprojection_constants(self):
        self.assertEqual(mod.POLICY['max_step_world'],0.3)
        self.assertEqual(mod.POLICY['huber_radius_px'],2.5)
        self.assertEqual(mod.POLICY['iterations'],10)
        self.assertEqual(mod.POLICY['min_observations'],3)

if __name__=='__main__':unittest.main(verbosity=2)