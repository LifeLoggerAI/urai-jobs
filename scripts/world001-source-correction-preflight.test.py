#!/usr/bin/env python3
"""Contract regressions; all fixture pixels are synthetic/locally generated."""
import copy,hashlib,importlib.util,json,math,pathlib,tempfile,unittest,struct
from PIL import Image
module=pathlib.Path(__file__).with_name('world001-source-correction-preflight.py')
spec=importlib.util.spec_from_file_location('correction',module)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
H='a'*64

def extrinsic(center_x):
    return [[1.,0.,0.,float(center_x)],[0.,1.,0.,0.],[0.,0.,1.,0.],[0.,0.,0.,1.]]

def pixel_of(point,x,calib):
    return [calib['fx']*(point[0]-x)/point[2]+calib['cx'],
            calib['fy']*point[1]/point[2]+calib['cy']]

class CorrectionPreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=pathlib.Path(self.temp.name)
        cal={'model':'PINHOLE','fx':1536.,'fy':1536.,'cx':640.,'cy':360.,'width':1280,'height':720,
             'distortion_status':'CALIBRATED_ZERO_OR_RECTIFIED','evidence_method':'known_scene_render_camera',
             'source_evidence_sha256':H}
        points={f'A{i}':{'class':'STATIC_ARCHITECTURE','annotation_authority_sha256':H,
             'xyz_m':[(-.5+.2*i),(-.2+.04*i),8.]} for i in range(8)}
        coords={'train':[-1.5,-1.2,-.9,-.6,-.3,0.,.3,.6,.9,1.2]}
        v=[]
        for role,xx in coords.items():
            for i,x in enumerate(xx):
                name=f'{role}/v{i}.png';p=self.root/name;p.parent.mkdir(exist_ok=True)
                img=Image.new('RGB',(1280,720),(i*12+5,35,i*4+10));img.save(p)
                obs={a:pixel_of(z['xyz_m'],x,cal) for a,z in points.items()}
                v.append({'id':f'{role}{i}','session_id':'TRA',
                          'split':role,'file':name,'sha256':m.digest(p),'frame_index':i,
                          'width':1280,'height':720,'calibration_id':'cam01','camera_to_world_m':extrinsic(x),
                          'observed_static_anchors':obs})
        # Actual source bytes: a tiny but structurally valid GLB 2.0 test scene.
        scene={'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[0]}],
               'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0}}]}],
               'buffers':[{'byteLength':36}], 'bufferViews':[{'buffer':0,'byteLength':36}],
               'accessors':[{'bufferView':0,'componentType':5126,'count':3,'type':'VEC3'}]}
        j=json.dumps(scene,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
        verts=struct.pack('<9f',0.,0.,0.,1.,0.,0.,0.,1.,0.)
        total=12+8+len(j)+8+len(verts)
        model=b'glTF'+struct.pack('<II',2,total)+struct.pack('<II',len(j),0x4E4F534A)+j
        model+=struct.pack('<II',len(verts),0x004E4942)+verts
        geometry=self.root/'approved-home-fixed-scene.glb';geometry.write_bytes(model)
        calibration=self.root/'camera-calibration.txt';calibration.write_text('fixture projection camera 1536 px focal\n')
        scale=self.root/'metric-scale.txt';scale.write_text('fixture 2.0 meter reference; not production evidence\n')
        annotation=self.root/'static-architecture.txt';annotation.write_text('fixture static anchors A0-A7\n')
        cal['source_evidence_file']='camera-calibration.txt'
        cal['source_evidence_sha256']=m.digest(calibration)
        for item in points.values():
            item['annotation_authority_file']='static-architecture.txt'
            item['annotation_authority_sha256']=m.digest(annotation)
        self.manifest={
            'schema':m.SCHEMA,'world':m.WORLD,'truth_class':m.TRUTH,
            'original_media_unchanged':True,'paid_compute_authorized':False,
            'gaussian_training_permitted':False,'frozen_acceptance':m.ORIGINAL_CRITERIA.copy(),
            'original_evidence':{k:H for k in ('frozen_w4_protocol_sha256','frozen_w4_training_model_sha256','frozen_w4_holdout_sha256')},
            'scene_authority':{'kind':'CONTROLLED_RENDER_FIXED_SCENE','source_truth':'DECLARED_RENDER_NOT_PHOTOGRAPH',
                                'asset_sha256':m.digest(geometry),'file':'approved-home-fixed-scene.glb','approved_design_reference':'fixture only'},
            'metric_scale':{'units':'meters','known_distance_m':2.0,'independent_evidence_sha256':m.digest(scale),'evidence_file':'metric-scale.txt'},
            'calibrations':{'cam01':cal},'static_anchors':points,
            'sessions':[{'id':'TRA','scene_asset_sha256':m.digest(geometry),'source_kind':'CONTROLLED_RENDER_FIXED_SCENE'}],
            'views':v,
            'segments':[{'id':s,'ordered_view_ids':ids} for s,ids in zip(m.REQUIRED_SEGMENTS,
                       (['train0','train1','train2'],['train2','train3','train4'],
                        ['train4','train5','train6'],['train6','train7','train8','train9']))],
            'evaluation_plan':{'frozen_before_capture':True,'frozen_protocol_sha256':H,
                               'source_disjoint_holdout':True,'reserved_future_session_id':'FUTURE_HOLDOUT',
                               'holdout_images_materialized':False},
        }
        self.manifest_original_lock=copy.deepcopy(self.manifest['original_evidence'])
    def run_manifest(self):return m.preflight(self.root,self.manifest,self.manifest_original_lock)
    def expect(self,reason):
        with self.assertRaisesRegex(ValueError,reason):self.run_manifest()
    def test_metadata_fixture_can_be_screened_but_never_admitted(self):
        r=self.run_manifest()
        self.assertEqual(r['source_files_sha_verified'],10)
        self.assertEqual(r['train_frames'],10)
        self.assertFalse(r['training_permitted'])
        self.assertFalse(r['external_holdout_passed'])
        self.assertFalse(r['physical_scene_consistency_independently_verified'])
        self.assertTrue(r['source_geometry_file_hash_verified'])
        self.assertEqual(r['source_geometry_inventory']['scene_meshes'],1)
        self.assertEqual(r['calibration_files_hash_verified'],1)
        self.assertEqual(r['static_annotation_files_hash_verified'],8)
        self.assertEqual(r['status'],'TRAIN_SOURCE_PACKET_FORMAT_VERIFIED_GEOMETRY_NOT_ACCEPTED')
    def test_missing_scene_file_refused(self):
        self.manifest['scene_authority']['file']='unknown.glb'
        self.expect('SOURCE_FILE_MISSING_OR_LINKED')
    def test_modified_scene_bytes_refused(self):
        (self.root/'approved-home-fixed-scene.glb').write_bytes(b'swapped geometry')
        self.expect('COHERENT_SCENE_FILE_MISSING_OR_HASH_INVALID')
    def test_scene_bytes_not_valid_glb_refused(self):
        p=self.root/'approved-home-fixed-scene.glb';p.write_bytes(b'not a glb binary')
        self.manifest['scene_authority']['asset_sha256']=m.digest(p)
        self.expect('MODELED_SCENE_SIZE_INVALID')
    def test_false_metric_evidence_refused(self):
        self.manifest['metric_scale']['independent_evidence_sha256']=H
        self.expect('METRIC_SCALE_EVIDENCE_FILE_INVALID')
    def test_missing_calibration_file_refused(self):
        self.manifest['calibrations']['cam01']['source_evidence_file']='nonexistent.txt'
        self.expect('SOURCE_FILE_MISSING_OR_LINKED')
    def test_modified_static_anchor_evidence_refused(self):
        (self.root/'static-architecture.txt').write_bytes(b'changed annotations')
        self.expect('STATIC_ANCHOR_EVIDENCE_FILE_INVALID')
    def test_pretend_render_is_photograph_rejected(self):
        self.manifest['scene_authority']['source_truth']='CALIBRATED_PHOTOGRAPHIC_CAPTURE';self.expect('RENDER_MISREPRESENTED')
    def test_missing_calibration_provenance_refused(self):
        self.manifest['calibrations']['cam01']['source_evidence_sha256']='';self.expect('CALIBRATION_EVIDENCE_UNVERIFIED')
    def test_metric_scale_must_not_be_arbitrary(self):
        self.manifest['metric_scale']['units']='arbitrary';self.expect('METRIC_SCALE_NOT_VERIFIED')
    def test_substituted_frame_rejected(self):
        (self.root/'train/v0.png').write_bytes(b'changed source');self.expect('SOURCE_FRAME_SHA256_INVALID')
    def test_low_image_resolution_refused(self):
        self.manifest['calibrations']['cam01']['height']=600;self.expect('CAMERA_INTRINSICS_INVALID')
    def test_heldout_images_never_inspected_during_training_preflight(self):
        self.manifest['views'][5]['split']='holdout';self.expect('HOLDOUT_NOT_PERMITTED_IN_TRAIN_SOURCE_PREFLIGHT')
    def test_invalid_camera_handedness_refused(self):
        self.manifest['views'][1]['camera_to_world_m'][2][2]=-1.;self.expect('POSE_HANDEDNESS_INVALID')
    def test_static_anchor_mismatch_refused(self):
        self.manifest['views'][4]['observed_static_anchors']['A1'][0]+=10.;self.expect('STATIC_ANCHOR_POSE_REPROJECTION_INCONSISTENT')
    def test_without_all_late_view_segments_refuses(self):
        self.manifest['segments'].pop();self.expect('MISSING_REQUIRED_LATE_VIEW_BRIDGES')
    def test_no_overlap_between_adjacent_views_refused(self):
        self.manifest['views'][0]['observed_static_anchors']={k:v for k,v in self.manifest['views'][0]['observed_static_anchors'].items() if k in ('A0','A1','A2','A3','A4','A5')}
        self.manifest['views'][1]['observed_static_anchors']={k:v for k,v in self.manifest['views'][1]['observed_static_anchors'].items() if k in ('A2','A3','A4','A5','A6','A7')}
        self.expect('ADJACENT_VIEW_OVERLAP_INSUFFICIENT')
    def test_low_endpoint_parallax_refused(self):
        for view in self.manifest['views']:
            x=0.0;view['camera_to_world_m']=extrinsic(x)
            view['observed_static_anchors']={k:pixel_of(z['xyz_m'],x,self.manifest['calibrations']['cam01']) for k,z in self.manifest['static_anchors'].items()}
        self.expect('BRIDGE_ENDPOINT_PARALLAX_INSUFFICIENT')
    def test_independent_future_holdout_must_be_reserved(self):
        self.manifest['evaluation_plan']['reserved_future_session_id']='TRA'
        self.expect('INDEPENDENT_FUTURE_HOLDOUT_NOT_PRESERVED')
    def test_old_acceptance_threshold_cannot_change(self):
        self.manifest['frozen_acceptance']['heldout_p90_unfitted_reproj_px']=20.;self.expect('FROZEN_ACCEPTANCE_POLICY_MODIFIED')
    def test_frozen_w4_baseline_identity_rejects_rebinding(self):
        self.manifest['original_evidence']['frozen_w4_training_model_sha256']='b'*64
        self.expect('FROZEN_W4_BASELINE_IDENTITY_NOT_VERIFIED')
    def test_no_trusted_baseline_receipt_refused(self):
        with self.assertRaisesRegex(ValueError,'FROZEN_W4_BASELINE_IDENTITY_NOT_VERIFIED'):
            m.preflight(self.root,self.manifest)
    def test_no_gpu_or_spend_authority(self):
        self.manifest['paid_compute_authorized']=True;self.expect('FINANCIAL_OR_SOURCE_FENCE_INVALID')
    def test_no_private_path_escape(self):
        self.manifest['views'][0]['file']='../other.png';self.expect('UNSAFE_PATH')

if __name__=='__main__':unittest.main(verbosity=2)
