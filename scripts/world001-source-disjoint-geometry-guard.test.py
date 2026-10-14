#!/usr/bin/env python3
"""Pure-stdlib red/green regressions for interpretive whole-survey evidence gate."""
import copy, importlib.util, json, math, pathlib, tempfile, unittest
MODULE=pathlib.Path(__file__).with_name('world001-source-disjoint-geometry-guard.py')
spec=importlib.util.spec_from_file_location('urai_world001_geometry',MODULE)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class World001GeometryContracts(unittest.TestCase):
    def test_mutual_ratio_order_and_determinism(self):
        a=[(0,2,11.,40.), (1,2,1.,50.), (2,4,10.,20.), (3,5,9.,30.)]
        b=[(2,1,2.,50.), (2,0,10.,50.), (4,2,8.,12.), (5,3,7.,30.)]
        self.assertEqual(mod.reciprocal_ratio_pairs(a,b),[(1,2,1.),(3,5,9.),(2,4,10.)])
        self.assertEqual(mod.reciprocal_ratio_pairs(list(reversed(a)),list(reversed(b))),[(1,2,1.),(3,5,9.),(2,4,10.)])
    def test_reciprocal_fails_ambiguous_repeated_features(self):
        self.assertEqual(mod.reciprocal_ratio_pairs([(0,3,10.,11.)],[(3,0,10.,60.)]),[])
        self.assertEqual(mod.reciprocal_ratio_pairs([(0,3,10.,40.)],[(3,0,10.,11.)]),[])
    def test_mutual_refuses_nonfinite_and_unsafe_ratio(self):
        for arg in [-1., 0.,1.,1.1]:
            with self.assertRaises(ValueError):mod.reciprocal_ratio_pairs([],[],ratio=arg)
        with self.assertRaises(ValueError):mod.reciprocal_ratio_pairs([(0,0,float('nan'),10)],[])
    def test_track_requires_distinct_surveys_and_parallax(self):
        r=[{'frame':'s1-1','survey':'S01','reprojection_px':1,'depth':3,'camera_to_landmark_ray':[0,0,1]},
           {'frame':'s1-2','survey':'S01','reprojection_px':1,'depth':3,'camera_to_landmark_ray':[0.03,0,1]},
           {'frame':'s2-1','survey':'S02','reprojection_px':2,'depth':3,'camera_to_landmark_ray':[.12,0,1]}]
        a=mod.robust_training_track(r,'S04');self.assertGreater(a['max_parallax_deg'],3)
        with self.assertRaisesRegex(ValueError,'HELDOUT_TRACK_LEAK'):
            mod.robust_training_track(r+[dict(r[0],survey='S04')],'S04')
        with self.assertRaisesRegex(ValueError,'TRACK_ONE_SURVEY'):
            mod.robust_training_track([dict(x,survey='S01') for x in r],'S04')
        with self.assertRaisesRegex(ValueError,'TRACK_REPROJECTION_OR_DEPTH_INVALID'):
            mod.robust_training_track([r[0],r[1],dict(r[2],reprojection_px=200)],'S04')
        with self.assertRaisesRegex(ValueError,'TRACK_WEAK_TRIANGULATION'):
            mod.robust_training_track([r[0],r[1],dict(r[2],camera_to_landmark_ray=[.01,0,1])],'S04')
    def test_private_path_refusal(self):
        with tempfile.TemporaryDirectory() as td:
            p=pathlib.Path(td);(p/'safe.jpg').write_bytes(b'private')
            self.assertEqual(mod.inside(p,'safe.jpg'),p/'safe.jpg')
            for bad in ['../safe.jpg','/etc/passwd','a\\b','']:
                with self.assertRaises(ValueError):mod.inside(p,bad)
            (p/'bad.jpg').symlink_to(p/'safe.jpg')
            with self.assertRaises(ValueError):mod.inside(p,'bad.jpg')
    def test_whole_survey_negative_admission_mutations(self):
        with tempfile.TemporaryDirectory() as td:
            d=pathlib.Path(td);frame=[]
            training_surveys=['S01_PUSH','S02_PULLBACK','S03_LEFT','S05_CW_ARC','S06_CCW_ARC','S07_ELEVATION','S08_DIAGONAL']
            for i in range(50):
                survey=training_surveys[i%7] if i<44 else 'S04_RIGHT'
                split='train' if i<44 else 'holdout'
                name=f'{split}/{survey}/frame{i:03d}.jpg'
                f=d/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(f'synthetic fixture {i}'.encode())
                frame.append({'frame_file':name,'frame_sha256':mod.digest(f),'survey':survey,'split':split})
            proto={'world':'URAI-IW-001-QUIET-RESET','truth_class':'INTERPRETIVE_NOT_AUTOBIOGRAPHICAL','excluded_survey':'S04_RIGHT','training_surveys':training_surveys,'train_count':44,'holdout_count':6,'no_paid_generation':True,'source_authority':'fake training-safe test pixels','frozen_thresholds_unchanged':mod.THRESHOLDS,'frames':frame}
            def write_json(name,value):
                q=d/name;q.write_text(json.dumps(value),encoding='utf-8');return q
            proto_path=write_json('proto.json',proto)
            model=d/'train.pkl';model.write_bytes(b'training-state-test-only')
            refined=d/'frozen.npz';refined.write_bytes(b'ba-state-test-only')
            ba={'inputs':{'frozen_original_protocol_sha256':mod.digest(proto_path),'frozen_W1_training_model_sha256':mod.digest(model),'registered_train_only_frames':[r['frame_file'] for r in frame[:44]]},'no_holdout_images_loaded':True,'filter':{'min_track_views':3,'min_source_surveys':2,'min_max_triangulation_angle_deg':3},'optimization':{'output_npz_sha256':mod.digest(refined),'cpu_only':True,'gpu_used':False}}
            ba_path=write_json('ba.json',ba)
            views=[{'frame':r['frame_file'],'image_sha256':r['frame_sha256'],'status':'S04_LOCALIZED_FROZEN_TRAIN_BA','pose_inliers':60,'test_correspondences':30,'unfitted_median_px':2.,'unfitted_p90_px':20.,'unfitted_inlier_rate_5px':.7} for r in frame[44:]]
            ev={'frozen_protocol_sha256':mod.digest(proto_path),'frozen_training_state_sha256':mod.digest(model),'frozen_train_side_BA_sha256':mod.digest(refined),'heldout_survey':'S04_RIGHT','thresholds_unchanged':mod.THRESHOLDS,'original_W1_S08_failure_unchanged':True,'provider_spend':0,'production_gaussian_trained':False,'accepted_frames':0,'per_view':views,'heldout_views_localized':6,'median_of_per_view_unfitted_medians_px':2.,'median_of_per_view_unfitted_p90_px':20.,'median_of_per_view_unfitted_rate_5px':.7,'geometric_screen_pass':False}
            ev_path=write_json('eval.json',ev)
            def run():
                return mod.review(d,proto_path,model,refined,ba_path,ev_path)
            out=run()
            self.assertEqual(out['status'],'GEOMETRY_SCREEN_FAILED_NO_TRAINING')
            self.assertFalse(out['training_permitted'])
            self.assertTrue(out['source_frames_verified'])
            damaged=copy.deepcopy(ev);damaged['geometric_screen_pass']=True
            write_json('eval.json',damaged)
            with self.assertRaisesRegex(ValueError,'RESULT_MISREPRESENTED'):run()
            write_json('eval.json',ev)
            changed=copy.deepcopy(proto);changed['frozen_thresholds_unchanged']['heldout_p90_unfitted_reproj_px']=30.0
            write_json('proto.json',changed)
            with self.assertRaisesRegex(ValueError,'FROZEN_THRESHOLD_CHANGED'):run()
            write_json('proto.json',proto)
            bad=copy.deepcopy(ba);bad['inputs']['registered_train_only_frames'][0]=frame[44]['frame_file']
            write_json('ba.json',bad)
            with self.assertRaisesRegex(ValueError,'BA_TRAIN_SOURCE_OR_ISOLATION_INVALID'):run()
            write_json('ba.json',ba)
            (d/frame[44]['frame_file']).write_bytes(b'bad heldout mutation')
            with self.assertRaisesRegex(ValueError,'FRAME_SHA256_INVALID'):run()

    def test_immutable_threshold_contract(self):
        self.assertEqual(mod.THRESHOLDS['heldout_median_unfitted_reproj_px'],4.0)
        self.assertEqual(mod.THRESHOLDS['heldout_p90_unfitted_reproj_px'],8.0)

if __name__=='__main__':unittest.main(verbosity=2)
