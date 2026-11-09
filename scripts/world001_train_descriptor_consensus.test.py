#!/usr/bin/env python3
"""Pure-stdlib negative and positive tests; synthetic, no private media."""
import copy,hashlib,importlib.util,pathlib,unittest
path=pathlib.Path(__file__).with_name('world001_train_descriptor_consensus.py')
spec=importlib.util.spec_from_file_location('descriptor_consensus',path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
SHA=lambda s:hashlib.sha256(s.encode()).hexdigest()
DESC=lambda n:[float(n)]+[0.0]*127
CAL={'fx':800.,'fy':800.,'cx':640.,'cy':360.,'width':1280,'height':720}
XYZ=[0.,0.,8.]

def fixture():
    points=[{'id':'P0','xyz':XYZ[:],'descriptor':DESC(21),'origin_frame_ids':['train/S01/v0','train/S02/v1']}]
    views=[]
    for i,(survey,cx) in enumerate([('S01',-1.),('S02',-.5),('S03',0),('S05',.5)]):
        name=f'train/{survey}/v{i}'
        uv=[CAL['cx']+CAL['fx']*(XYZ[0]-cx)/XYZ[2],CAL['cy']]
        camera=[[1.,0.,0.,cx],[0.,1.,0.,0.],[0.,0.,1.,0.],[0.,0.,0.,1.]]
        views.append({'id':name,'survey':survey,'split':'train','image_sha256':SHA(name),'calibration':CAL.copy(),
           'camera_to_world_m':camera,'keypoint_xy':[uv],'keypoint_descriptors':[DESC(21)]})
    return points,views,{v['id']:v['image_sha256'] for v in views}
class Tests(unittest.TestCase):
    def run_it(self,modifier=None):
        p,v,h=fixture()
        if modifier:modifier(p,v,h)
        return m.training_descriptor_consensus(p,v,h,'S08')
    def test_consistent_supported_training_point_is_research_only(self):
        a=self.run_it();self.assertEqual(a['retained_landmark_ids'],['P0'])
        self.assertEqual(a['support_by_landmark']['P0'],2)
        for k in ('frames_admitted','gaussian_training_permitted','paid_compute_authorized','release_permitted'):
            self.assertFalse(a[k]);self.assertEqual(a['holdout_images_read'],0)
    def test_training_support_missing_rejected(self):
        def mutate(p,v,h):v[3]['keypoint_descriptors']=[DESC(251)]
        a=self.run_it(mutate);self.assertEqual(a['retained_landmarks'],0)
    def test_feature_projection_mismatch_rejected(self):
        def mutate(p,v,h):v[3]['keypoint_xy'][0][0]+=5.
        self.assertEqual(self.run_it(mutate)['retained_landmarks'],0)
    def test_conflicting_distant_point_descriptor_rejects_both(self):
        def mutate(p,v,h):p.append({'id':'P1','xyz':[10.,0.,8.],'descriptor':DESC(22), 'origin_frame_ids':['train/S01/v0','train/S02/v1']})
        a=self.run_it(mutate);self.assertEqual(a['ambiguous_landmarks'],2);self.assertEqual(a['retained_landmarks'],0)
    def test_nearby_descriptor_not_false_alias(self):
        def mutate(p,v,h):p.append({'id':'P1','xyz':[0.1,0.,8.],'descriptor':DESC(22),'origin_frame_ids':['train/S01/v0','train/S02/v1']})
        a=self.run_it(mutate);self.assertFalse(a['ambiguous_landmarks']);self.assertIn('P0',a['retained_landmark_ids'])
    def test_holdout_survey_never_allowed(self):
        def mutate(p,v,h):v[3]['survey']='S08'
        with self.assertRaisesRegex(ValueError,'HELDOUT_SOURCE_LEAK'):self.run_it(mutate)
    def test_not_train_split(self):
        def mutate(p,v,h):v[3]['split']='holdout'
        with self.assertRaisesRegex(ValueError,'HELDOUT_SOURCE_LEAK'):self.run_it(mutate)
    def test_source_digest_mismatch_refused(self):
        def mutate(p,v,h):v[3]['image_sha256']='a'*64
        with self.assertRaisesRegex(ValueError,'UNBOUND_OR_DUPLICATE_TRAIN_SOURCE'):self.run_it(mutate)
    def test_trusted_manifest_missing_source_refused(self):
        def mutate(p,v,h):h.pop(v[3]['id'])
        with self.assertRaisesRegex(ValueError,'UNBOUND_OR_DUPLICATE_TRAIN_SOURCE'):self.run_it(mutate)
    def test_duplicate_frame_source_refused(self):
        def mutate(p,v,h):v[3]['image_sha256']=v[2]['image_sha256'];h[v[3]['id']]=v[3]['image_sha256']
        with self.assertRaisesRegex(ValueError,'UNBOUND_OR_DUPLICATE_TRAIN_SOURCE'):self.run_it(mutate)
    def test_duplicate_point_identity_refused(self):
        def mutate(p,v,h):p.append(copy.deepcopy(p[0]))
        with self.assertRaisesRegex(ValueError,'DUPLICATE_POINT_ID'):self.run_it(mutate)
    def test_heldout_seed_refused(self):
        def mutate(p,v,h):p[0]['origin_frame_ids']=['train/S01/v0','holdout/S08/v0']
        with self.assertRaisesRegex(ValueError,'SEED_IMAGE_NOT_TRAIN_ONLY'):self.run_it(mutate)
    def test_invalid_camera_refused(self):
        def mutate(p,v,h):v[3]['camera_to_world_m'][0][0]=-1.
        with self.assertRaisesRegex(ValueError,'BAD_TRAIN_ROTATION'):self.run_it(mutate)
    def test_nonfinite_feature_refused(self):
        def mutate(p,v,h):v[2]['keypoint_descriptors'][0][0]=float('nan')
        with self.assertRaisesRegex(ValueError,'BAD_TRAIN_DESCRIPTOR'):self.run_it(mutate)
    def test_training_policy_not_weakened(self):
        p,v,h=fixture()
        with self.assertRaisesRegex(ValueError,'RESEARCH_TRAINING_POLICY_MODIFIED'):
            m.training_descriptor_consensus(p,v,h,'S08',policy={'min_other_training_views':1})
    def test_invalid_descriptor_dimension_refused(self):
        def mutate(p,v,h):v[3]['keypoint_descriptors']=[[5.,6.]]
        with self.assertRaisesRegex(ValueError,'BAD_TRAIN_DESCRIPTOR'):self.run_it(mutate)
    def test_input_unchanged(self):
        p,v,h=fixture();before=copy.deepcopy((p,v,h));m.training_descriptor_consensus(p,v,h,'S08');self.assertEqual((p,v,h),before)

if __name__=='__main__':unittest.main(verbosity=2)
