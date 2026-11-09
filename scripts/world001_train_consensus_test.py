"""Pure stdlib synthetic tests: no owner media, provider, pickle or spend."""
import importlib.util
import sys
sys.dont_write_bytecode = True
import pathlib
import tempfile
import unittest
import hashlib

path = pathlib.Path(__file__).with_name('world001_train_consensus.py')
spec = importlib.util.spec_from_file_location('world001_train_consensus', path)
consensus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(consensus)
CAL = {'fx':800.,'fy':800.,'cx':640.,'cy':360.,'width':1280,'height':720}


def source():
    xyz = [[0.,0.,8.]]
    poses, assign, feat = {}, {}, {}
    for i in range(5):
        name = f'train/S0{i+1}/view_{i}'
        center = (i-2)*.1
        R = [[1.,0,0],[0,1.,0],[0,0,1.]]
        t = [[-center],[0.],[0.]]
        poses[name] = (R,t)
        assign[name] = {0:0}
        feat[name] = {'pts': [[640-800*center/8,360.]],'des': [[20.]*128]}
    return {'poses':poses,'assign':assign,'landmarks':xyz},feat


class Tests(unittest.TestCase):
    def test_original_five_frame_consensus_is_not_release_evidence(self):
        model,features=source();r=consensus.score_training_only(model,features,CAL)
        self.assertEqual(r['retained_landmark_indices'],[0])
        self.assertEqual(r['retained_multiple_extra_surveys'],1)
        self.assertFalse(r['gaussian_training_permitted'])
        self.assertFalse(r['independent_holdout_passed'])
        self.assertFalse(r['release_permitted'])
    def test_foreign_owned_keypoint_cannot_fake_multiview_support(self):
        model,features=source()
        model['landmarks'].append([0.,0.,8.])
        for frame in list(features)[:2]:
            features[frame]['pts'].append(list(features[frame]['pts'][0]))
            features[frame]['des'].append([20.]*128)
            model['assign'][frame][1]=1
        result=consensus.score_training_only(model,features,CAL)
        self.assertEqual(result['retained_landmark_indices'],[0])
        self.assertGreaterEqual(result['foreign_owned_descriptor_matches_excluded'],3)
        self.assertEqual(result['landmarks_with_foreign_owned_descriptor_matches'],1)
        self.assertFalse(result['source_quality_threshold_passed'])

    def test_unclaimed_independent_keypoints_may_support_track(self):
        model,features=source()
        model['landmarks'].append([0.,0.,8.])
        for frame in list(features)[:2]:
            features[frame]['pts'].append(list(features[frame]['pts'][0]))
            features[frame]['des'].append([20.]*128)
            model['assign'][frame][1]=1
        for frame in list(features)[2:4]:
            features[frame]['pts'].append(list(features[frame]['pts'][0]))
            features[frame]['des'].append([20.]*128)
        result=consensus.score_training_only(model,features,CAL)
        self.assertEqual(result['retained_landmark_indices'],[0,1])
        self.assertEqual(result['foreign_owned_descriptor_matches_excluded'],3)

    def test_conflicting_keypoint_owner_is_rejected_with_other_survey(self):
        model,features=source()
        model['landmarks'].append([0.,0.,8.])
        for frame in list(features)[:2]:
            features[frame]['pts'].append(list(features[frame]['pts'][0]))
            features[frame]['des'].append([20.]*128)
            model['assign'][frame][1]=1
        for frame in list(features)[2:]:
            self.assertEqual(model['assign'][frame][0],0)
        score=consensus.score_training_only(model,features,CAL)
        self.assertEqual(score['schema'],'URAI_WORLD001_TRAIN_ONLY_CONSENSUS_V3')
        self.assertNotIn(1,score['retained_landmark_indices'])

    def test_feature_descriptor_outliers_rejected(self):
        model,features=source()
        for k in list(features)[2:]:features[k]['des'][0]=[250.]*128
        self.assertEqual(consensus.score_training_only(model,features,CAL)['retained_landmark_indices'],[])
    def test_geometric_outliers_rejected(self):
        model,features=source()
        for k in list(features)[2:]:features[k]['pts'][0][0]+=9
        self.assertEqual(consensus.score_training_only(model,features,CAL)['retained_landmark_indices'],[])
    def test_heldout_image_rejected(self):
        model,features=source();key=list(features)[-1];new=key.replace('train/','holdout/')
        for d in (model['poses'],model['assign'],features):d[new]=d.pop(key)
        with self.assertRaisesRegex(ValueError,'HELDOUT_OR_UNTRUSTED_TRAIN_FRAME'):
            consensus.score_training_only(model,features,CAL)
    def test_policy_frozen(self):
        model,features=source()
        with self.assertRaisesRegex(ValueError,'TRAINING_CONSENSUS_POLICY_MODIFIED'):
            consensus.score_training_only(model,features,CAL,{'reprojection_radius_px':8})
    def test_frame_manifest_required(self):
        model,features=source();features.pop(list(features)[-1])
        with self.assertRaisesRegex(ValueError,'UNBOUND_TRAIN_FRAME'):
            consensus.score_training_only(model,features,CAL)
    def test_seeds_must_exist_and_be_two(self):
        model,features=source();del model['assign'][list(features)[1]][0]
        with self.assertRaisesRegex(ValueError,'UNTRIANGULATED_LANDMARK'):
            # remove all but one seed
            for k in list(model['assign'])[2:]:model['assign'][k].clear()
            consensus.score_training_only(model,features,CAL)
    def test_invalid_intrinsics_denied(self):
        model,features=source();cal=dict(CAL,fx=-2.)
        with self.assertRaisesRegex(ValueError,'INVALID_INTRINSICS'):
            consensus.score_training_only(model,features,cal)
    def test_hash_guard_refuses_wrong_digest_and_unpinned(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'a';p.write_bytes(b'safe')
            with self.assertRaisesRegex(ValueError,'SOURCE_SHA256_MISMATCH'):
                consensus.sha_guard(p,'0'*64)
            with self.assertRaisesRegex(ValueError,'EXPLICIT_VALID_SHA256_REQUIRED'):
                consensus.sha_guard(p,'')
            consensus.sha_guard(p,hashlib.sha256(b'safe').hexdigest())
    def test_research_threshold_not_redefined(self):
        self.assertEqual(consensus.TRAIN_GEOMETRY_MIN_LANDMARKS,800)
        model,features=source();r=consensus.score_training_only(model,features,CAL)
        self.assertFalse(r['source_quality_threshold_passed'])
    def test_bounded_descriptor_kernel(self):
        self.assertLess(consensus.squared_distance([0,0],[3,4],25.1),25.1)
        self.assertGreater(consensus.squared_distance([0,0],[30,40],100),100)


if __name__=='__main__': unittest.main(verbosity=2)