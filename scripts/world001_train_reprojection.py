#!/usr/bin/env python3
"""Source-bound, train-only robust fixed-camera XYZ refinement (research, never release).

The caller must independently validate and SHA-pin original training inputs; the
optional local CLI performs that validation BEFORE opening trusted pickles. No
holdout imagery, external API, GPU, payment or release decision is touched.
"""
import argparse
import hashlib
import json
import math
import pickle
from pathlib import Path

POLICY = {
    'huber_radius_px': 2.5,
    'iterations': 10,
    'max_step_world': 0.3,
    'damping': 0.001,
    'min_observations': 3,
}


def _finite(x):
    return math.isfinite(float(x))


def _quantile(values, q):
    a = sorted(values)
    if not a:
        raise ValueError('TRAIN_OBSERVATIONS_REQUIRED')
    x = (len(a)-1)*q
    i = int(x)
    return a[i] + (a[min(i+1,len(a)-1)] - a[i])*(x-i)


def _solve3(H, b):
    a = [[float(H[i][j]) for j in range(3)] + [float(b[i])] for i in range(3)]
    for col in range(3):
        row = max(range(col, 3), key=lambda k: abs(a[k][col]))
        if abs(a[row][col]) < 1e-12:
            raise ValueError('DEGENERATE_TRAIN_TRIANGULATION')
        a[row], a[col] = a[col], a[row]
        pivot = a[col][col]
        for k in range(col+1,3):
            factor = a[k][col] / pivot
            for j in range(col,4):
                a[k][j] -= factor*a[col][j]
    x = [0.0]*3
    for i in range(2,-1,-1):
        x[i] = (a[i][3] - sum(a[i][j]*x[j] for j in range(i+1,3))) / a[i][i]
    return x


def _residual_and_jacobian(X, frame, xy, cal):
    R, t = frame
    z = [sum(float(R[i][k])*X[k] for k in range(3)) + float(t[i][0]) for i in range(3)]
    if not all(map(_finite,z)) or z[2] <= 0.1:
        raise ValueError('TRAIN_CAMERA_NEGATIVE_DEPTH')
    a,b = z[0]/z[2],z[1]/z[2]
    px = (cal['fx']*a + cal['cx'],cal['fy']*b + cal['cy'])
    residual = [float(xy[i])-px[i] for i in range(2)]
    J = [[cal['fx']*(float(R[0][k])-a*float(R[2][k]))/z[2] for k in range(3)],
         [cal['fy']*(float(R[1][k])-b*float(R[2][k]))/z[2] for k in range(3)]]
    return residual, J


def refine_training_only(model, features, calibration, policy=None):
    """Return (new model, metrics); original input remains unchanged.

    The training camera poses are fixed. The 2-view triangulation seeds are
    immutable. Tracks with >2 views undergo bounded Huber XYZ re-triangulation.
    Same 2.5 px metric is used to report geometry; descriptor policy is not
    changed and is independently checked by the existing consensus component.
    """
    if policy is not None and policy != POLICY:
        raise ValueError('TRAIN_REPROJECTION_POLICY_MODIFIED')
    c = {name: float(calibration[name]) for name in ('fx','fy','cx','cy','width','height')}
    if not all(map(_finite,c.values())) or min(c['fx'],c['fy'],c['width'],c['height']) <= 0:
        raise ValueError('BAD_TRAIN_CALIBRATION')
    poses, assignments, landmarks = model['poses'],model['assign'],model['landmarks']
    frames = sorted(poses)
    if len(frames) < 4 or set(frames)!=set(features) or set(frames)!=set(assignments):
        raise ValueError('UNBOUND_TRAIN_FRAMES')
    if any(not frame.startswith('train/') or len(frame.split('/'))!=3 or
           not frame.split('/')[1] in ('S01_PUSH','S02_PULLBACK','S03_LEFT','S04_RIGHT','S05_CW_ARC','S06_CCW_ARC','S07_ELEVATION')
           for frame in frames):
        raise ValueError('HELDOUT_OR_UNTRUSTED_TRAIN_FRAME')
    points = [[float(z) for z in v] for v in landmarks]
    if any(len(p)!=3 or not all(map(_finite,p)) for p in points):
        raise ValueError('BAD_TRAIN_POINT')
    obs = [[] for _ in points]
    duplicate_observations = 0
    for name in frames:
        pose = poses[name]
        pts = features[name]['pts']
        des = features[name]['des']
        if len(pts)!=len(des):
            raise ValueError('FEATURE_DESCRIPTOR_LENGTH_MISMATCH')
        best = {}
        for index,pid in assignments[name].items():
            if type(pid) is not int or not 0<=pid<len(points) or not 0<=int(index)<len(pts):
                raise ValueError('BAD_TRAIN_OBSERVATION_ID')
            xy = pts[index]
            if len(xy)!=2 or not all(map(_finite,xy)):
                raise ValueError('NONFINITE_TRAIN_OBSERVATION')
            # Duplicate 2D assignments for a landmark in one camera are
            # ambiguous. Exclude the ENTIRE ambiguous view, never cherry-pick.
            if pid in best:
                best[pid] = None
                duplicate_observations += 1
            else:
                best[pid] = (pose,xy)
        for pid,value in best.items():
            if value is not None:
                obs[pid].append(value)
    if any(len(row)<2 for row in obs):
        raise ValueError('UNTRIANGULATED_TRAIN_LANDMARK')
    def error_distribution(X):
        errors=[]
        for i,rows in enumerate(obs):
            for pose,xy in rows:
                r,_=_residual_and_jacobian(X[i],pose,xy,c)
                errors.append(math.hypot(*r))
        return errors
    initial = error_distribution(points)
    refined = 0
    for i,rows in enumerate(obs):
        if len(rows) < POLICY['min_observations']:
            continue
        X = points[i]
        for _ in range(POLICY['iterations']):
            H = [[0.0]*3 for _ in range(3)]
            b = [0.0]*3
            for pose,xy in rows:
                r,J = _residual_and_jacobian(X,pose,xy,c)
                err = math.hypot(*r)
                w = min(1.0, POLICY['huber_radius_px']/max(err,1e-8))
                for a in range(3):
                    b[a] += w*(J[0][a]*r[0] + J[1][a]*r[1])
                    for k in range(3):
                        H[a][k] += w*(J[0][a]*J[0][k]+J[1][a]*J[1][k])
            for j in range(3):
                H[j][j] += POLICY['damping']
            step = _solve3(H,b)
            length = math.sqrt(sum(v*v for v in step))
            scale = min(1.0, POLICY['max_step_world']/max(length,1e-12))
            X = [X[j]+step[j]*scale for j in range(3)]
        points[i] = X
        refined += 1
    final = error_distribution(points)
    out = dict(model)
    out['landmarks'] = points
    out['algorithm'] = 'fixed_camera_10iter_huber_xyz_train_only_research_no_holdout'
    metrics = {
        'schema': 'URAI_WORLD001_TRAIN_XYZ_REFINEMENT_V1',
        'classification': 'RESEARCH_ONLY_NOT_ACCEPTED',
        'train_frame_count': len(frames),
        'candidate_landmarks': len(points),
        'refined_multiview_landmarks': refined,
        'duplicate_track_observations_excluded': duplicate_observations,
        'scored_training_observations': len(initial),
        'before_median_reprojection_px': _quantile(initial,0.5),
        'before_p90_reprojection_px': _quantile(initial,0.9),
        'after_median_reprojection_px': _quantile(final,0.5),
        'after_p90_reprojection_px': _quantile(final,0.9),
        'before_fraction_within_2_5_px': sum(v<=2.5 for v in initial)/len(initial),
        'after_fraction_within_2_5_px': sum(v<=2.5 for v in final)/len(final),
        'immutable_two_view_seed_count': sum(len(row)==2 for row in obs),
        'policy': dict(POLICY),
        'heldout_images_read': 0,
        'frames_admitted': 0,
        'gaussian_training_permitted': False,
        'independent_holdout_passed': False,
        'release_permitted': False,
    }
    return out,metrics


def main():
    # Exact local source identity follows existing source guard; no new trust root.
    import world001_train_consensus as trusted
    from PIL import Image
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--trusted-owner-local-root',required=True)
    ap.add_argument('--protocol-sha256',required=True)
    ap.add_argument('--training-sha256',required=True)
    ap.add_argument('--features-sha256',required=True)
    ap.add_argument('--receipt-path',required=True)
    ap.add_argument('--private-model-path')
    args=ap.parse_args()
    root=Path(args.trusted_owner_local_root).resolve()
    p=root/'whole_survey_holdout_PROTOCOL_FROZEN.json'
    state=root/'training_ONLY_S08_EXCLUDED_frozen.pkl'
    feature=root/'features_train.pkl'
    for path,expected in ((p,args.protocol_sha256),(state,args.training_sha256),(feature,args.features_sha256)):
        trusted.sha_guard(path,expected)
    frozen=json.loads(p.read_text(encoding='utf-8'))
    rows={row['frame_file']:row for row in frozen['frames'] if row['split']=='train'}
    if len(rows)!=44 or sum(row['split']=='holdout' for row in frozen['frames'])!=6:
        raise ValueError('FROZEN_SPLIT_MISMATCH')
    sizes=set()
    for name,row in rows.items():
        if not name.startswith('train/') or '/S08_' in name:
            raise ValueError('HELDOUT_SOURCE_LEAK')
        path=(root/name).resolve()
        if not path.is_relative_to(root):
            raise ValueError('TRAIN_SOURCE_PATH_ESCAPE')
        trusted.sha_guard(path,row['frame_sha256'])
        with Image.open(path) as im:
            sizes.add(im.size)
    if len(sizes)!=1:
        raise ValueError('TRAIN_DIMENSIONS_MISMATCH')
    w,h=next(iter(sizes))
    cal=dict(frozen['intrinsic_prior'],width=w,height=h)
    # Local frozen snapshot only; hash verified above BEFORE trusted deserialization.
    model=pickle.loads(state.read_bytes());features=pickle.loads(feature.read_bytes())
    if set(rows)!=set(model['poses']) or set(rows)!=set(model['assign']) or set(rows)!=set(features):
        raise ValueError('TRAIN_SOURCE_IDENTITY_MISMATCH')
    improved,report=refine_training_only(model,features,cal)
    pre=trusted.score_training_only(model,features,cal)
    post=trusted.score_training_only(improved,features,cal)
    report.update({
        'source_protocol_sha256':args.protocol_sha256,
        'source_training_sha256':args.training_sha256,
        'source_features_sha256':args.features_sha256,
        'verified_train_frame_hashes':len(rows),
        'consensus_before':pre['supported_in_two_other_training_frames'],
        'consensus_after':post['supported_in_two_other_training_frames'],
        'source_quality_threshold_landmarks':trusted.TRAIN_GEOMETRY_MIN_LANDMARKS,
        'source_quality_threshold_passed':post['source_quality_threshold_passed'],
        'native_source_review_required':True,
    })
    receipt=Path(args.receipt_path).resolve()
    if receipt.exists():
        raise ValueError('IMMUTABLE_RECEIPT_ALREADY_EXISTS')
    if args.private_model_path:
        target=Path(args.private_model_path).resolve()
        if target.exists() or not target.is_relative_to(root):
            raise ValueError('PRIVATE_REFINED_MODEL_DESTINATION_NOT_ALLOWED')
        target.write_bytes(pickle.dumps(improved,pickle.HIGHEST_PROTOCOL))
        report['private_refined_model_sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
    receipt.parent.mkdir(parents=True,exist_ok=True)
    receipt.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    print(json.dumps(report,sort_keys=True))


if __name__=='__main__':
    main()