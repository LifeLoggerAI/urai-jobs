#!/usr/bin/env python3
"""Train-only camera/landmark cross-survey check for interpretive World001.

For each *training* source survey in a point track, triangulate without that
survey, then project the estimate into that withheld TRAIN source. This isolates
weak/ambiguous 3D tracks before candidate training assembly. Never handles real
user memory, an S04/S08 evaluation split, or a paid Gaussian-training job.

Only supports research-stage diagnostic admission to the set of strong training
landmarks. It cannot grant accepted source frames, geometry certification,
provider spending, artistic review, or launch permissions.
"""
from collections import defaultdict
from math import acos, degrees, hypot, isfinite, sqrt
from statistics import median

STATUS_PASS='TRAIN_TRACK_LOSO_PASSED_NOT_ADMITTED'
STATUS_FAIL='TRAIN_TRACK_LOSO_FAILED'
STATUS_DEGENERATE='TRAIN_TRACK_LOSO_DEGENERATE'
STATUS_INSUFFICIENT='TRAIN_TRACK_TWO_SURVEYS_INSUFFICIENT'


def require(cond, error):
    if not cond:raise ValueError(error)


def three_solve(a, b):
    """Full pivot Gaussian elimination. Degeneracy is a refusal, not a success."""
    mat=[list(map(float, row))+[float(b[i])] for i,row in enumerate(a)]
    scale=max(abs(x) for row in a for x in row)
    if not isfinite(scale) or scale <= 1.e-15:return None
    for col in range(3):
        top=max(range(col,3),key=lambda row:abs(mat[row][col]))
        if abs(mat[top][col]) <= scale*1.e-7:return None
        mat[col],mat[top]=mat[top],mat[col]
        inv=1/mat[col][col]
        for j in range(col,4):mat[col][j]*=inv
        for i in range(3):
            if i==col:continue
            factor=mat[i][col]
            for j in range(col,4):mat[i][j]-=factor*mat[col][j]
    ans=tuple(row[3] for row in mat)
    return ans if all(isfinite(x) for x in ans) else None


def matrix_validate(R,t):
    require(isinstance(R,(list,tuple)) and len(R)==3 and
            all(isinstance(row,(list,tuple)) and len(row)==3 for row in R), 'CAMERA_ROTATION_INVALID')
    require(isinstance(t,(list,tuple)) and len(t)==3, 'CAMERA_TRANSLATION_INVALID')
    require(all(isfinite(float(x)) for row in R for x in row) and
            all(isfinite(float(x)) for x in t), 'CAMERA_NONFINITE')
    # Camera poses are externally estimated; do not silently normalize a bad matrix.
    for i in range(3):
        norm=sum(float(R[i][k])**2 for k in range(3))
        require(abs(norm-1)<1.e-3, 'CAMERA_ROTATION_NONORTHONORMAL')
        for j in range(i):
            require(abs(sum(float(R[i][k])*float(R[j][k]) for k in range(3)))<1.e-3,
                    'CAMERA_ROTATION_NONORTHONORMAL')


def normalized_ray(obs):
    R=obs['rotation'];t=obs['translation'];matrix_validate(R,t)
    f=float(obs['focal_px']);cx=float(obs['principal_x']);cy=float(obs['principal_y'])
    u=float(obs['pixel_u']);v=float(obs['pixel_v'])
    require(all(isfinite(x) for x in (f,cx,cy,u,v)) and f>0, 'CAMERA_INTRINSICS_INVALID')
    cam=((u-cx)/f,(v-cy)/f,1.)
    ray=[sum(float(R[j][i])*cam[j] for j in range(3)) for i in range(3)]
    norm=sqrt(sum(x*x for x in ray));require(norm>1.e-12,'RAY_INVALID')
    direction=[x/norm for x in ray]
    center=[-sum(float(R[j][i])*float(t[j]) for j in range(3)) for i in range(3)]
    return center,direction


def triangulate(obs):
    if len(obs)<3:return None
    a=[[0.0]*3 for _ in range(3)];b=[0.0]*3
    for row in obs:
        center,d=normalized_ray(row)
        for i in range(3):
            for j in range(3):
                value=float(i==j)-d[i]*d[j]
                a[i][j]+=value
                b[i]+=value*center[j]
    return three_solve(a,b)


def point_reprojection(xyz,obs):
    R=obs['rotation'];t=obs['translation']
    cam=[sum(float(R[i][j])*xyz[j] for j in range(3))+float(t[i]) for i in range(3)]
    if not all(isfinite(x) for x in cam) or cam[2]<=.05:return None
    u=float(obs['focal_px'])*cam[0]/cam[2]+float(obs['principal_x'])
    v=float(obs['focal_px'])*cam[1]/cam[2]+float(obs['principal_y'])
    return hypot(u-float(obs['pixel_u']),v-float(obs['pixel_v']))


def train_only_survey_out_geometry(observations, excluded_evaluation_survey,
                                    max_cross_survey_median_px=8.0):
    """Classify one landmark without ever reading an evaluation survey pixel.

    max_cross_survey_median_px is a *train-track diagnostic*, not the 8-px
    independent heldout-p90 acceptance criterion. Never weaken either to pass.
    """
    require(isinstance(excluded_evaluation_survey,str) and excluded_evaluation_survey,
            'EXCLUDED_EVALUATION_SURVEY_REQUIRED')
    require(max_cross_survey_median_px==8.0, 'TRAIN_GATE_THRESHOLD_MODIFIED')
    require(observations and isinstance(observations,list), 'TRACK_OBSERVATIONS_REQUIRED')
    require(all(isinstance(o,dict) and isinstance(o.get('survey'),str) and
                isinstance(o.get('frame'),str) for o in observations), 'OBSERVATION_IDENTITY_REQUIRED')
    require(all(o['survey']!=excluded_evaluation_survey and o['frame'].startswith('train/')
                for o in observations),'HELDOUT_SOURCE_LEAK')
    require(len({o['frame'] for o in observations})==len(observations),'DUPLICATE_TRAIN_IMAGE')
    groups=defaultdict(list)
    for row in observations:
        normalized_ray(row) # prevalidate all data; do not ignore malformed cameras
        groups[row['survey']].append(row)
    result={'source_groups':len(groups),'train_observations':len(observations),
            'per_training_survey':[],'max_train_survey_out_median_px':None,
            'admitted_source_frames':0,'paid_compute_allowed':False}
    if len(groups)<3:
        result['status']=STATUS_INSUFFICIENT
        return result
    for withheld in sorted(groups):
        remainder=[o for survey,rows in groups.items() if survey!=withheld for o in rows]
        if len(remainder)<3 or len(set(o['survey'] for o in remainder))<2:
            result['status']=STATUS_DEGENERATE;return result
        xyz=triangulate(remainder)
        if xyz is None:
            result['status']=STATUS_DEGENERATE;return result
        errors=[point_reprojection(xyz,o) for o in groups[withheld]]
        if any(e is None for e in errors):
            result['status']=STATUS_DEGENERATE;return result
        m=float(median(errors));result['per_training_survey'].append({'survey':withheld,
            'observations':len(errors),'median_reproj_px':m,'max_reproj_px':max(errors)})
    maximum=max(x['median_reproj_px'] for x in result['per_training_survey'])
    result['max_train_survey_out_median_px']=maximum
    result['status']=STATUS_PASS if maximum<=max_cross_survey_median_px else STATUS_FAIL
    return result
