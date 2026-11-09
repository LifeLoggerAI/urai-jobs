#!/usr/bin/env python3
"""Stdlib regressions for train-only survey-out triangulation and fail-closed outputs."""
import importlib.util,pathlib,unittest,copy
p=pathlib.Path(__file__).with_name('world001_train_cross_survey_consistency.py')
s=importlib.util.spec_from_file_location('consistency',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
F=1536.;X=(.5,-.2,10.)
def frame(group,i,center_x,center_y=0.,point=X):
 R=[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]];t=[-center_x,-center_y,0.]
 return {'frame':f'train/{group}/{group}__frame{i:04d}.jpg','survey':group,'rotation':R,'translation':t,'focal_px':F,'principal_x':640.,'principal_y':360.,'pixel_u':640+F*(point[0]-center_x)/point[2],'pixel_v':360+F*(point[1]-center_y)/point[2]}
class Tests(unittest.TestCase):
 def sample(self):return [frame('S01_PUSH',12,-2),frame('S01_PUSH',36,-1),frame('S02_PULLBACK',12,-.7),frame('S02_PULLBACK',36,0),frame('S03_LEFT',12,.5),frame('S03_LEFT',36,1),frame('S05_CW_ARC',12,1.5),frame('S05_CW_ARC',36,2)]
 def test_static_geometry_multiple_surveys_passes(self):
  r=m.train_only_survey_out_geometry(self.sample(),'S04_RIGHT');self.assertEqual(r['status'],m.STATUS_PASS);self.assertAlmostEqual(r['max_train_survey_out_median_px'],0,places=6);self.assertFalse(r['paid_compute_allowed']);self.assertEqual(r['admitted_source_frames'],0)
 def test_cross_survey_conflict_fails(self):
  rows=self.sample()
  for o in rows:
   if o['survey']=='S03_LEFT':o['pixel_u']+=90
  r=m.train_only_survey_out_geometry(rows,'S04_RIGHT');self.assertEqual(r['status'],m.STATUS_FAIL);self.assertGreater(r['max_train_survey_out_median_px'],8)
 def test_two_survey_is_insufficient(self):
  r=m.train_only_survey_out_geometry([x for x in self.sample() if x['survey'] in ('S01_PUSH','S02_PULLBACK')],'S04_RIGHT');self.assertEqual(r['status'],m.STATUS_INSUFFICIENT)
 def test_parallel_degenerate(self):
  rows=self.sample()
  for row in rows: row['translation']=[0.,0.,0.]
  self.assertEqual(m.train_only_survey_out_geometry(rows,'S04_RIGHT')['status'],m.STATUS_DEGENERATE)
 def test_disallow_holdout_feature_leak(self):
  rows=self.sample();rows.append(frame('S04_RIGHT',12,0.))
  with self.assertRaisesRegex(ValueError,'HELDOUT_SOURCE_LEAK'):m.train_only_survey_out_geometry(rows,'S04_RIGHT')
 def test_nonfinite_pose_refusal(self):
  rows=self.sample();rows[0]['rotation'][0][0]=float('nan')
  with self.assertRaisesRegex(ValueError,'CAMERA_NONFINITE'):m.train_only_survey_out_geometry(rows,'S04_RIGHT')
 def test_no_threshold_changes(self):
  with self.assertRaisesRegex(ValueError,'TRAIN_GATE_THRESHOLD_MODIFIED'):m.train_only_survey_out_geometry(self.sample(),'S04_RIGHT',15)
 def test_no_duplicate_feature_and_wrong_paths(self):
  rows=self.sample();rows[0]['frame']=rows[1]['frame']
  with self.assertRaisesRegex(ValueError,'DUPLICATE_TRAIN_IMAGE'):m.train_only_survey_out_geometry(rows,'S04_RIGHT')
  rows=self.sample();rows[0]['frame']=rows[0]['frame'].replace('train/','holdout/')
  with self.assertRaisesRegex(ValueError,'HELDOUT_SOURCE_LEAK'):m.train_only_survey_out_geometry(rows,'S04_RIGHT')
if __name__=='__main__':unittest.main(verbosity=2)
