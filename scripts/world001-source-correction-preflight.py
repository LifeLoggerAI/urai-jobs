#!/usr/bin/env python3
"""Fail-closed World001 calibrated-source acquisition preflight (NO training admission).

Intended for FUTURE corrected, physically coherent source captures or declared
controlled renders. Does not accept old source-disjoint W1-W4 geometry as training
authority, touch GPU/providers, or validate visual scene permanence by metadata.

This only checks image bytes, source identity, calibration/pose and annotated
static-structure overlap. All image content and independently approved art remain
outside this module and require a separate qualified reviewer.
"""
import argparse
from collections import defaultdict
import hashlib
import json
import math
import struct
from pathlib import Path
from PIL import Image, UnidentifiedImageError

SCHEMA = 'urai-world001-source-correction-1'
WORLD = 'URAI-IW-001-QUIET-RESET'
TRUTH = 'INTERPRETIVE_NOT_AUTOBIOGRAPHICAL'
REQUIRED_SEGMENTS = (
    'S07_BRIDGE_0060_0084',
    'S07_BRIDGE_0084_0108',
    'S07_BRIDGE_0108_0132',
    'S04_S08_LATE_CROSS_SURVEY',
)
ORIGINAL_CRITERIA = {'heldout_median_unfitted_reproj_px': 4.0,
                     'heldout_p90_unfitted_reproj_px': 8.0,
                     'require_every_withheld_view': True,
                     'reject_any_failing_view': True}
MIN_IMAGE_SIZE = (1280, 720)
MIN_SHARED_STATIC_ANCHORS = 6   # New ACQUISITION screening, NOT final holdout acceptance.
MIN_ENDPOINT_PARALLAX_DEG = 3.0  # Train-side source target, NOT an approved camera solution.


def demand(condition, reason):
    if not condition:
        raise ValueError(reason)


def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()


def hexdigest(value):
    return isinstance(value,str) and len(value)==64 and all(c in '0123456789abcdef' for c in value)


def checked_file(root, filename):
    demand(isinstance(filename,str) and filename and not filename.startswith('/')
           and not filename.startswith('\\') and '\\' not in filename,
           'UNSAFE_PATH')
    parts=Path(filename).parts
    demand(all(part not in ('..','.','') for part in parts), 'UNSAFE_PATH')
    p=Path(root).joinpath(*parts)
    demand(p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(Path(root).resolve()),
           'SOURCE_FILE_MISSING_OR_LINKED')
    return p



def bound_evidence_file(root, filename, expected_sha, missing_reason):
    """Check genuine source/evidence bytes, not a self-declared 64-character hash."""
    demand(hexdigest(expected_sha), missing_reason)
    demand(isinstance(filename, str) and filename.strip(), missing_reason)
    source = checked_file(root, filename)
    demand(source.stat().st_size > 0, missing_reason)
    demand(digest(source) == expected_sha, missing_reason)
    return source


def verified_modeled_scene_glb(path):
    """Validate a real GLB 2.0 scene container; not a photoreal/quality approval."""
    path = Path(path)
    demand(path.suffix.lower() == '.glb', 'MODELED_SCENE_GLTF_REQUIRED')
    demand(24 <= path.stat().st_size <= 128 * 1024 * 1024, 'MODELED_SCENE_SIZE_INVALID')
    with path.open('rb') as f:
        header=f.read(20)
        demand(len(header)==20 and header[:4]==b'glTF', 'MODELED_SCENE_GLB_INVALID')
        _, version, total_length, json_size, kind = struct.unpack('<4sIIII', header)
        demand(version==2 and total_length==path.stat().st_size and
               2<=json_size<=8*1024*1024 and kind==0x4E4F534A and
               json_size%4==0, 'MODELED_SCENE_GLB_INVALID')
        raw=f.read(json_size)
        demand(len(raw)==json_size, 'MODELED_SCENE_GLB_INVALID')
        try:
            model=json.loads(raw.decode('utf-8').rstrip(' \x00'))
        except (UnicodeError, ValueError):
            raise ValueError('MODELED_SCENE_GLTF_JSON_INVALID')
    demand(model.get('asset',{}).get('version')=='2.0' and
           isinstance(model.get('scenes'),list) and model['scenes'] and
           isinstance(model.get('nodes'),list) and model['nodes'] and
           isinstance(model.get('meshes'),list) and model['meshes'] and
           isinstance(model.get('buffers'),list) and model['buffers'] and
           isinstance(model.get('bufferViews'),list) and model['bufferViews'] and
           isinstance(model.get('accessors'),list) and model['accessors'],
           'MODELED_SCENE_GEOMETRY_MISSING')
    return {'scene_nodes': len(model['nodes']), 'scene_meshes': len(model['meshes'])}


def valid_rotation(matrix):
    demand(isinstance(matrix,list) and len(matrix)==4 and
           all(isinstance(row,list) and len(row)==4 for row in matrix),
           'POSE_SHAPE_INVALID')
    R=[[float(v) for v in row[:3]] for row in matrix[:3]]
    t=[float(matrix[i][3]) for i in range(3)]
    demand(all(math.isfinite(z) for row in matrix for z in row), 'POSE_NONFINITE')
    demand(all(abs(float(matrix[3][j])-float(j==3))<=1e-6 for j in range(4)),
           'POSE_LAST_ROW_INVALID')
    for i in range(3):
        demand(abs(sum(R[i][k]*R[i][k] for k in range(3))-1.)<1e-3,
               'POSE_ROTATION_INVALID')
        for j in range(i):
            demand(abs(sum(R[i][k]*R[j][k] for k in range(3)))<1e-3,
                   'POSE_ROTATION_INVALID')
    det=(R[0][0]*(R[1][1]*R[2][2]-R[1][2]*R[2][1])
         -R[0][1]*(R[1][0]*R[2][2]-R[1][2]*R[2][0])
         +R[0][2]*(R[1][0]*R[2][1]-R[1][1]*R[2][0]))
    demand(abs(det-1.)<1e-3,'POSE_HANDEDNESS_INVALID')
    return R,t


def project(xyz,pose,intrinsics):
    R,t=valid_rotation(pose)
    point=[float(xyz[i])-t[i] for i in range(3)]
    # camera_to_world extrinsics: camera-space = R transpose * (world-center)
    c=[sum(R[k][j]*point[k] for k in range(3)) for j in range(3)]
    if not all(math.isfinite(v) for v in c) or c[2]<=0.05:
        return None
    return (intrinsics['fx']*c[0]/c[2]+intrinsics['cx'],
            intrinsics['fy']*c[1]/c[2]+intrinsics['cy'])


def angle_at_anchor(pose_a,pose_b,anchor):
    ca=[float(pose_a[i][3]) for i in range(3)]
    cb=[float(pose_b[i][3]) for i in range(3)]
    a=[float(anchor[i])-ca[i] for i in range(3)]
    b=[float(anchor[i])-cb[i] for i in range(3)]
    n1=math.sqrt(sum(x*x for x in a)); n2=math.sqrt(sum(x*x for x in b))
    demand(n1>1e-8 and n2>1e-8,'DEGENERATE_SOURCE_BASELINE')
    dot=max(-1.,min(1.,sum(a[i]*b[i] for i in range(3))/(n1*n2)))
    return math.degrees(math.acos(dot))


def preflight(root, manifest, trusted_original_lock=None):
    """Metadata/pixel-identity validation only. Does NOT admit training data."""
    root=Path(root)
    p=manifest if isinstance(manifest,dict) else json.loads(Path(manifest).read_text())
    demand(p.get('schema')==SCHEMA and p.get('world')==WORLD and
           p.get('truth_class')==TRUTH,'WORLD_OR_TRUTH_CLASS_INVALID')
    demand(p.get('frozen_acceptance')==ORIGINAL_CRITERIA,
           'FROZEN_ACCEPTANCE_POLICY_MODIFIED')
    demand(p.get('paid_compute_authorized') is False and
           p.get('gaussian_training_permitted') is False and
           p.get('original_media_unchanged') is True,'FINANCIAL_OR_SOURCE_FENCE_INVALID')
    original=p.get('original_evidence',{})
    demand(all(hexdigest(original.get(k)) for k in
               ('frozen_w4_protocol_sha256','frozen_w4_training_model_sha256','frozen_w4_holdout_sha256')),
           'ORIGINAL_EVIDENCE_NOT_BOUND')
    demand(isinstance(trusted_original_lock,dict) and original==trusted_original_lock,
           'FROZEN_W4_BASELINE_IDENTITY_NOT_VERIFIED')
    scene=p.get('scene_authority',{})
    demand(scene.get('kind') in ('CONTROLLED_RENDER_FIXED_SCENE','CALIBRATED_PHYSICAL_CAPTURE')
           and hexdigest(scene.get('asset_sha256')) and scene.get('approved_design_reference'),
           'COHERENT_SCENE_AUTHORITY_MISSING')
    # A source authority is real only when its immutable file bytes match the hash.
    # This is NOT a design acceptance or proof of multiview physical coherence.
    source_asset = bound_evidence_file(root, scene.get('file'), scene.get('asset_sha256'),
                                       'COHERENT_SCENE_FILE_MISSING_OR_HASH_INVALID')
    geometry_inventory = (verified_modeled_scene_glb(source_asset)
                          if scene['kind']=='CONTROLLED_RENDER_FIXED_SCENE'
                          else {'source_file_verified': True})
    # Label renders as renders, not as photographs.
    if scene['kind']=='CONTROLLED_RENDER_FIXED_SCENE':
        demand(scene.get('source_truth')=='DECLARED_RENDER_NOT_PHOTOGRAPH',
               'RENDER_MISREPRESENTED_AS_PHOTOGRAPH')
    else:
        demand(scene.get('source_truth')=='CALIBRATED_PHOTOGRAPHIC_CAPTURE',
               'CAPTURE_TRUTH_LABEL_INVALID')
    scale=p.get('metric_scale',{})
    demand(scale.get('units')=='meters' and isinstance(scale.get('known_distance_m'),(int,float))
           and 0.01 <= scale['known_distance_m'] <= 10000 and
           hexdigest(scale.get('independent_evidence_sha256')),
           'METRIC_SCALE_NOT_VERIFIED')
    bound_evidence_file(root, scale.get('evidence_file'),
                        scale.get('independent_evidence_sha256'),
                        'METRIC_SCALE_EVIDENCE_FILE_INVALID')
    calibrations=p.get('calibrations',{})
    demand(isinstance(calibrations,dict) and calibrations, 'CALIBRATION_MISSING')
    for id,c in calibrations.items():
        demand(isinstance(id,str) and id and c.get('model')=='PINHOLE',
               'CALIBRATION_MODEL_UNKNOWN')
        demand(hexdigest(c.get('source_evidence_sha256')) and
               c.get('evidence_method') in ('physical_checkerboard','known_scene_render_camera'),
               'CALIBRATION_EVIDENCE_UNVERIFIED')
        arr=[c.get(k) for k in ('fx','fy','cx','cy','width','height')]
        demand(all(isinstance(v,(int,float)) and math.isfinite(v) for v in arr) and
               c['fx']>0 and c['fy']>0 and c['width']>=MIN_IMAGE_SIZE[0] and
               c['height']>=MIN_IMAGE_SIZE[1] and
               0<=c['cx']<c['width'] and 0<=c['cy']<c['height'],
               'CAMERA_INTRINSICS_INVALID')
        demand(c.get('distortion_status')=='CALIBRATED_ZERO_OR_RECTIFIED',
               'CAMERA_DISTORTION_UNCALIBRATED')
        bound_evidence_file(root, c.get('source_evidence_file'),
                            c.get('source_evidence_sha256'),
                            'CALIBRATION_EVIDENCE_FILE_INVALID')
    landmarks=p.get('static_anchors',{})
    demand(isinstance(landmarks,dict) and len(landmarks)>=MIN_SHARED_STATIC_ANCHORS,
           'STATIC_ANCHOR_EVIDENCE_MISSING')
    for key,anchor in landmarks.items():
        demand(anchor.get('class')=='STATIC_ARCHITECTURE' and
               hexdigest(anchor.get('annotation_authority_sha256')) and
               len(anchor.get('xyz_m',[]))==3 and
               all(isinstance(v,(int,float)) and math.isfinite(v) for v in anchor['xyz_m']),
               'STATIC_ANCHOR_UNVERIFIED')
        bound_evidence_file(root, anchor.get('annotation_authority_file'),
                            anchor.get('annotation_authority_sha256'),
                            'STATIC_ANCHOR_EVIDENCE_FILE_INVALID')
    sessions=p.get('sessions',[])
    bysession={}
    for s in sessions:
        demand(isinstance(s,dict) and isinstance(s.get('id'),str) and
               s['id'] not in bysession and s.get('scene_asset_sha256')==scene['asset_sha256'] and
               s.get('source_kind')==scene['kind'],
               'SESSION_SCENE_DRIFT_OR_DUPLICATE')
        bysession[s['id']]=s
    demand(bysession,'NO_CAPTURE_SESSIONS')
    viewbyid={}; views=p.get('views',[])
    hashes=set(); splits=defaultdict(set); sessionsplits=defaultdict(set)
    for v in views:
        name=v.get('id');role=v.get('split');session=v.get('session_id')
        demand(isinstance(name,str) and name and name not in viewbyid and
               role == 'train' and session in bysession,
               'HOLDOUT_NOT_PERMITTED_IN_TRAIN_SOURCE_PREFLIGHT')
        c=calibrations.get(v.get('calibration_id'))
        demand(c is not None and v.get('width')==c['width'] and
               v.get('height')==c['height'], 'CAMERA_IMAGE_DIMENSION_MISMATCH')
        path=checked_file(root,v.get('file'))
        demand(hexdigest(v.get('sha256')) and digest(path)==v['sha256'],
               'SOURCE_FRAME_SHA256_INVALID')
        demand(v['sha256'] not in hashes,'DUPLICATE_SOURCE_BYTES_ACROSS_VIEWS')
        hashes.add(v['sha256'])
        try:
            with Image.open(path) as img:
                img.verify()
            with Image.open(path) as img:
                width,height=img.size
                fmt=img.format
        except (UnidentifiedImageError, OSError, ValueError):
            raise ValueError('IMAGE_DECODE_INVALID')
        demand(fmt=='PNG' and (width,height)==(c['width'],c['height']),
               'NATIVE_IMAGE_FORMAT_OR_SIZE_INVALID')
        valid_rotation(v['camera_to_world_m'])
        demand(isinstance(v.get('frame_index'),int) and v['frame_index']>=0,
               'FRAME_INDEX_INVALID')
        obs=v.get('observed_static_anchors',{})
        demand(isinstance(obs,dict) and len(obs)>=MIN_SHARED_STATIC_ANCHORS and
               set(obs).issubset(landmarks),'OBSERVED_STATIC_ANCHOR_COVERAGE_INSUFFICIENT')
        for anchor_id,xy in obs.items():
            demand(isinstance(xy,list) and len(xy)==2 and
                   all(isinstance(i,(float,int)) and math.isfinite(i) for i in xy),
                   'ANCHOR_PIXEL_NONFINITE')
            demand(0<=xy[0]<width and 0<=xy[1]<height,'ANCHOR_PIXEL_OUTSIDE_FRAME')
            target=project(landmarks[anchor_id]['xyz_m'],v['camera_to_world_m'],c)
            demand(target is not None and math.hypot(target[0]-xy[0],target[1]-xy[1])<=4.,
                   'STATIC_ANCHOR_POSE_REPROJECTION_INCONSISTENT')
        viewbyid[name]=v;splits[role].add(name);sessionsplits[session].add(role)
    demand(len(splits['train'])>=8 and not splits['holdout'],
           'TRAIN_CORRECTION_CAPTURE_INCOMPLETE')
    demand(all(len(s)<=1 for s in sessionsplits.values()),
           'CAPTURE_SESSION_SPLIT_LEAK')
    segments=p.get('segments',[]);segmentids=set();covered_views=set()
    for s in segments:
        sid=s.get('id');ordered=s.get('ordered_view_ids',[])
        demand(sid in REQUIRED_SEGMENTS and sid not in segmentids and
               len(ordered)>=2 and len(ordered)==len(set(ordered)) and
               all(v in viewbyid for v in ordered),
               'REQUIRED_BRIDGE_SEGMENT_INCOMPLETE')
        segmentids.add(sid);covered_views.update(ordered)
        for x,y in zip(ordered,ordered[1:]):
            a=viewbyid[x];b=viewbyid[y]
            common=set(a['observed_static_anchors'])&set(b['observed_static_anchors'])
            demand(len(common)>=MIN_SHARED_STATIC_ANCHORS,
                   'ADJACENT_VIEW_OVERLAP_INSUFFICIENT')
        a=viewbyid[ordered[0]];b=viewbyid[ordered[-1]]
        same=set(a['observed_static_anchors'])&set(b['observed_static_anchors'])
        demand(len(same)>=MIN_SHARED_STATIC_ANCHORS,
               'BRIDGE_ENDPOINT_ANCHOR_OVERLAP_INSUFFICIENT')
        angles=[angle_at_anchor(a['camera_to_world_m'],b['camera_to_world_m'],landmarks[k]['xyz_m']) for k in same]
        demand(max(angles)>=MIN_ENDPOINT_PARALLAX_DEG,
               'BRIDGE_ENDPOINT_PARALLAX_INSUFFICIENT')
    demand(segmentids==set(REQUIRED_SEGMENTS),
           'MISSING_REQUIRED_LATE_VIEW_BRIDGES')
    demand(covered_views==set(viewbyid), 'ORPHANED_TRAIN_SOURCE_VIEW')
    ep=p.get('evaluation_plan',{})
    demand(ep.get('frozen_before_capture') is True and
           hexdigest(ep.get('frozen_protocol_sha256')) and
           ep.get('source_disjoint_holdout') is True and
           ep.get('reserved_future_session_id') not in bysession and
           isinstance(ep.get('reserved_future_session_id'),str) and
           ep.get('holdout_images_materialized') is False,
           'INDEPENDENT_FUTURE_HOLDOUT_NOT_PRESERVED')
    return {
      'schema':'urai-world001-source-correction-preflight-receipt-1',
      'source_files_sha_verified':len(views),
      'train_frames':len(splits['train']),'heldout_frames_read':0,
      'segments_validated':sorted(segmentids),'static_anchors_declared':len(landmarks),
      'source_geometry_file_hash_verified': True,
      'source_geometry_inventory': geometry_inventory,
      'calibration_files_hash_verified': len(calibrations),
      'static_annotation_files_hash_verified': len(landmarks),
      'metric_evidence_file_hash_verified': True,
      'status':'TRAIN_SOURCE_PACKET_FORMAT_VERIFIED_GEOMETRY_NOT_ACCEPTED',
      'original_W1_W4_frozen_results_unchanged':True,
      'physical_scene_consistency_independently_verified':False,
      'external_holdout_passed':False,
      'training_permitted':False,'gpu_spend_permitted':False,'frames_admitted':0,
      'canary_or_prod_deploy_permitted':False
    }


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',required=True)
    parser.add_argument('--manifest',required=True)
    parser.add_argument('--trusted-w4-lock',required=True,help='Privately maintained, previously SHA-verified original baseline receipt')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    output=Path(args.output)
    demand(not output.exists(),'REFUSE_RECEIPT_OVERWRITE')
    receipt=preflight(args.root,args.manifest,
                      json.loads(Path(args.trusted_w4_lock).read_text()))
    output.write_text(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
    print(json.dumps(receipt,sort_keys=True))

if __name__=='__main__':main()
