#!/usr/bin/env python3
"""Training-only geometric descriptor consensus for modeled/source-bound SfM research.

Only consumes feature/keypoint data from separately verified TRAIN images and
camera poses. Does not inspect excluded images, fix unknown camera calibration,
admit images, authorize Gaussian compute, or replace independent holdout gates.
Exact constants below reproduce Wave 10 modeled-source research policy; they
are training-side research diagnostics, not photoreal/artistic acceptance.
"""
from collections import defaultdict
from math import isfinite

REPROJECTION_RADIUS_PX = 2.5
MATCH_DESCRIPTOR_MAX_L2 = 100.0
ALIAS_DESCRIPTOR_MAX_L2 = 60.0
ALIAS_POINT_MIN_SEPARATION = 0.5
MIN_OTHER_TRAIN_FRAMES = 2
STATUS = 'TRAIN_ONLY_DESCRIPTOR_CONSENSUS_RESEARCH_NOT_ADMITTED'


def refuse(condition, message):
    if not condition:
        raise ValueError(message)


def sha_ok(text):
    return isinstance(text,str) and len(text)==64 and all(c in '0123456789abcdef' for c in text)


def dist_sq(a,b,cutoff=float('inf')):
    if len(a)!=len(b): raise ValueError('DESCRIPTOR_DIMENSION_MISMATCH')
    total=0.0
    for x,y in zip(a,b):
        d=float(x)-float(y)
        total+=d*d
        if total>cutoff:return total
    return total


def finite_vector(values,n,reason):
    refuse(isinstance(values,(list,tuple)) and len(values)==n and
           all(isinstance(v,(int,float)) and isfinite(v) for v in values),reason)


def camera_project(xyz, frame):
    pose=frame['camera_to_world_m']; cal=frame['calibration']
    refuse(isinstance(pose,(list,tuple)) and len(pose)==4 and
           all(isinstance(row,(list,tuple)) and len(row)==4 for row in pose), 'BAD_TRAIN_CAMERA')
    refuse(all(isfinite(float(z)) for row in pose for z in row), 'NONFINITE_TRAIN_CAMERA')
    refuse(all(abs(float(pose[3][j])-float(j==3))<1e-6 for j in range(4)), 'BAD_TRAIN_CAMERA')
    R=[[float(pose[i][j]) for j in range(3)] for i in range(3)]
    for i in range(3):
        refuse(abs(sum(R[i][k]**2 for k in range(3))-1.)<1e-3,'BAD_TRAIN_ROTATION')
        for j in range(i):
            refuse(abs(sum(R[i][k]*R[j][k] for k in range(3)))<1e-3,'BAD_TRAIN_ROTATION')
    det=R[0][0]*(R[1][1]*R[2][2]-R[1][2]*R[2][1])-R[0][1]*(R[1][0]*R[2][2]-R[1][2]*R[2][0])+R[0][2]*(R[1][0]*R[2][1]-R[1][1]*R[2][0])
    refuse(abs(det-1.)<1e-3,'BAD_TRAIN_ROTATION')
    center=[float(pose[k][3]) for k in range(3)]
    v=[float(xyz[k])-center[k] for k in range(3)]
    c=[sum(R[k][j]*v[k] for k in range(3)) for j in range(3)]
    if c[2]<=.1:return None
    return (cal['fx']*c[0]/c[2]+cal['cx'],cal['fy']*c[1]/c[2]+cal['cy'])


def image_grid(keypoints,radius=REPROJECTION_RADIUS_PX):
    buckets=defaultdict(list)
    for i,xy in enumerate(keypoints):
        finite_vector(xy,2,'BAD_TRAIN_FEATURE_LOCATION')
        bucket=(int(xy[0]//radius),int(xy[1]//radius))
        buckets[bucket].append(i)
    return buckets


def training_descriptor_consensus(landmarks,train_frames,trusted_training_sha256,excluded_survey,
                                  policy=None):
    """Return research-only accepted landmark IDs; never returns training permission.

    landmarks: list of {id,xyz,descriptor,origin_frame_ids}
    train_frames: list of {id,survey,split,image_sha256,calibration,camera_to_world_m,
                           keypoint_xy,keypoint_descriptors}
    trusted_training_sha256: independent source manifest mapping frame id->verified
      original training image SHA-256 (caller separately hashes the image bytes).
    """
    expected={'reprojection_radius_px':REPROJECTION_RADIUS_PX,
              'descriptor_match_max_l2':MATCH_DESCRIPTOR_MAX_L2,
              'descriptor_alias_max_l2':ALIAS_DESCRIPTOR_MAX_L2,
              'alias_min_3d_separation':ALIAS_POINT_MIN_SEPARATION,
              'min_other_training_views':MIN_OTHER_TRAIN_FRAMES}
    refuse(policy is None or policy==expected,'RESEARCH_TRAINING_POLICY_MODIFIED')
    refuse(isinstance(excluded_survey,str) and excluded_survey,'EXCLUDED_HOLDOUT_SURVEY_REQUIRED')
    refuse(isinstance(trusted_training_sha256,dict) and trusted_training_sha256,'TRUSTED_TRAIN_MANIFEST_MISSING')
    refuse(isinstance(train_frames,list) and len(train_frames)>=4,'INSUFFICIENT_TRAIN_VIEWS')
    refuse(isinstance(landmarks,list) and landmarks,'TRAIN_LANDMARKS_REQUIRED')
    image_ids=set();image_sha=set()
    grids=[]
    for view in train_frames:
        i=view.get('id')
        refuse(isinstance(i,str) and i.startswith('train/') and i not in image_ids,
               'DUPLICATE_OR_HELDOUT_TRAIN_IMAGE')
        image_ids.add(i)
        refuse(view.get('split')=='train' and view.get('survey')!=excluded_survey,
               'HELDOUT_SOURCE_LEAK')
        sha=view.get('image_sha256')
        refuse(sha_ok(sha) and sha==trusted_training_sha256.get(i) and sha not in image_sha,
               'UNBOUND_OR_DUPLICATE_TRAIN_SOURCE')
        image_sha.add(sha)
        c=view.get('calibration',{})
        refuse(all(k in c and isinstance(c[k],(int,float)) and isfinite(c[k]) for k in ('fx','fy','cx','cy','width','height')) and
               c['fx']>0 and c['fy']>0 and c['width']>=1 and c['height']>=1,
               'BAD_TRAIN_CALIBRATION')
        pts=view.get('keypoint_xy');desc=view.get('keypoint_descriptors')
        refuse(isinstance(pts,list) and isinstance(desc,list) and len(pts)==len(desc),
               'BAD_TRAIN_FEATURE_ARRAY')
        buckets=image_grid(pts)
        grids.append(buckets)
    refuse(set(trusted_training_sha256)==image_ids,'INCOMPLETE_TRUSTED_TRAIN_MANIFEST')
    seen_points=set();dims=None
    for point in landmarks:
        pid=point.get('id')
        refuse(isinstance(pid,(int,str)) and pid not in seen_points,'DUPLICATE_POINT_ID')
        seen_points.add(pid)
        finite_vector(point.get('xyz'),3,'BAD_POINT_COORDINATES')
        d=point.get('descriptor')
        refuse(isinstance(d,(list,tuple)) and len(d)>=8 and all(isinstance(v,(int,float)) and isfinite(v) for v in d), 'BAD_POINT_DESCRIPTOR')
        if dims is None:dims=len(d)
        refuse(len(d)==dims,'DESCRIPTOR_DIMENSION_MISMATCH')
        seeds=point.get('origin_frame_ids')
        refuse(isinstance(seeds,(list,tuple)) and len(seeds)==2 and len(set(seeds))==2 and all(s in image_ids for s in seeds),
               'SEED_IMAGE_NOT_TRAIN_ONLY')
    # All feature descriptors must use same descriptor dimension; reject silent truncation.
    for view in train_frames:
        for d in view['keypoint_descriptors']:
            refuse(isinstance(d,(list,tuple)) and len(d)==dims and all(isinstance(z,(int,float)) and isfinite(z) for z in d),
                   'BAD_TRAIN_DESCRIPTOR')
    xy_radius2=REPROJECTION_RADIUS_PX**2;desc_max2=MATCH_DESCRIPTOR_MAX_L2**2
    support=[0]*len(landmarks)
    for vi,view in enumerate(train_frames):
        buckets=grids[vi];cal=view['calibration']
        for pi,point in enumerate(landmarks):
            if view['id'] in point['origin_frame_ids']:continue
            predicted=camera_project(point['xyz'],view)
            if predicted is None:continue
            px,py=predicted
            if not(0<px<cal['width'] and 0<py<cal['height']):continue
            ix,iy=int(px//REPROJECTION_RADIUS_PX),int(py//REPROJECTION_RADIUS_PX)
            ok=False
            for x in (ix-1,ix,ix+1):
                if ok:break
                for y in (iy-1,iy,iy+1):
                    if ok:break
                    for k in buckets.get((x,y),()):
                        a,b=view['keypoint_xy'][k]
                        if (a-px)**2+(b-py)**2 <= xy_radius2 and dist_sq(view['keypoint_descriptors'][k],point['descriptor'],desc_max2)<=desc_max2:
                            ok=True;break
            if ok:support[pi]+=1
    ambiguous=[False]*len(landmarks)
    alias2=ALIAS_DESCRIPTOR_MAX_L2**2;distance2=ALIAS_POINT_MIN_SEPARATION**2
    for i in range(len(landmarks)):
        for j in range(i+1,len(landmarks)):
            if dist_sq(landmarks[i]['descriptor'],landmarks[j]['descriptor'],alias2)<alias2:
                if dist_sq(landmarks[i]['xyz'],landmarks[j]['xyz'],distance2)>distance2:
                    ambiguous[i]=True;ambiguous[j]=True
    accepted=[i for i in range(len(landmarks)) if support[i]>=MIN_OTHER_TRAIN_FRAMES and not ambiguous[i]]
    return {'schema':'urai-train-descriptor-consensus-1',
            'classification':STATUS,'candidate_landmarks':len(landmarks),
            'supported_in_other_training_views':sum(n>=MIN_OTHER_TRAIN_FRAMES for n in support),
            'ambiguous_landmarks':sum(ambiguous),'retained_landmarks':len(accepted),
            'retained_landmark_ids':[landmarks[i]['id'] for i in accepted],
            'support_by_landmark':{str(landmarks[i]['id']):support[i] for i in range(len(landmarks))},
            'training_views_hashed':len(image_ids),'excluded_survey':excluded_survey,
            'holdout_images_read':0,'heldout_geometry_accepted':False,
            'frames_admitted':0,'gaussian_training_permitted':False,'paid_compute_authorized':False,
            'release_permitted':False,'policy':expected}
