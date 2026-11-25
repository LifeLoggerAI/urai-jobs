#!/usr/bin/env python3
"""Deterministic, source-pinned World001 train-only cross-view track reconstruction.

Research diagnostics, NOT proof of independent calibration, quality admission, or
Gaussian readiness. S08 heldout material must never be read, scored or tuned.
The CI-testable kernel imports only Python stdlib; OpenCV/NumPy/PIL are used in
an explicitly opted-in trusted owner-local CLI after checking source hashes.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path

DESC_MAX_L2 = 100.0  # do not relax original descriptor limit
RATIO_MAX = 0.75
EPIPOLAR_MAX_PX = 2.5  # research consistency filter (not release admission)
REPROJECTION_MAX_PX = 2.5
MIN_VIEWS = 4  # two anchors + two independent training views
FROZEN_MIN_LANDMARKS = 800
SURVEYS = ('S01_PUSH','S02_PULLBACK','S03_LEFT','S04_RIGHT',
           'S05_CW_ARC','S06_CCW_ARC','S07_ELEVATION')


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as fh:
        for chunk in iter(lambda: fh.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()


def strict_hash(path, expected):
    if type(expected) is not str or len(expected) != 64 or any(c not in '0123456789abcdef' for c in expected):
        raise ValueError('EXPLICIT_SHA256_REQUIRED')
    if sha256(path) != expected:
        raise ValueError('SOURCE_SHA256_MISMATCH')


def assert_train_frame(frame):
    if not isinstance(frame,str) or len(frame.split('/'))!=3 or frame.split('/')[0]!='train' or frame.split('/')[1] not in SURVEYS:
        raise ValueError('HELDOUT_OR_UNTRUSTED_TRAIN_FRAME')
    if '..' in frame.split('/') or '\\' in frame:
        raise ValueError('TRAIN_FRAME_PATH_ESCAPE')
    return frame


def source_pairs(frames):
    """Frozen matching schedule: 1-2 frame steps intra-survey and aligned cross-survey.

    No holdout material, adaptive pair selection or tuning on S08 permitted.
    """
    groups = defaultdict(list)
    for f in sorted(frames):
        assert_train_frame(f)
        groups[f.split('/')[1]].append(f)
    if set(groups)!=set(SURVEYS):
        raise ValueError('TRAIN_SURVEY_SET_MISMATCH')
    pairs = []
    for name in SURVEYS:
        fs=groups[name]
        for gap in (1,2):
            pairs.extend((fs[i],fs[i+gap]) for i in range(len(fs)-gap))
    for ia,a in enumerate(SURVEYS):
        for b in SURVEYS[ia+1:]:
            pairs.extend((x,y) for x,y in zip(groups[a],groups[b]))
    return pairs


def strong_mutual_matches(forward, backward):
    """fwd/back rows: (query-id, closest-index, closest-L2, second-L2).

    Requiring reciprocal Lowe ratio and strict absolute SIFT L2 avoids
    broad/ambiguous cross-frame assignments of similarly textured features.
    """
    def one_direction(rows):
        out={}
        for q,t,d,second in rows:
            if (type(q) is not int or type(t) is not int or q<0 or t<0
                or not all(math.isfinite(float(x)) for x in (d,second))
                or d<0 or second<=0):
                raise ValueError('INVALID_MATCH_DESCRIPTOR')
            if q in out:
                raise ValueError('DUPLICATE_MATCH_QUERY')
            if d <= DESC_MAX_L2 and d < RATIO_MAX*second:
                out[q]=(t,float(d))
        return out
    fwd=one_direction(forward);rev=one_direction(backward)
    return [(q,t,d) for q,(t,d) in sorted(fwd.items())
            if t in rev and rev[t][0] == q]


def epipolar_error(point_a,point_b,Fn):
    """Sampson pixel distance for normalized fundamental matrix geometry."""
    if len(Fn)!=3 or any(len(row)!=3 for row in Fn):
        raise ValueError('INVALID_FUNDAMENTAL_MATRIX')
    a=(float(point_a[0]),float(point_a[1]),1.)
    b=(float(point_b[0]),float(point_b[1]),1.)
    if not all(math.isfinite(x) for x in a+b):
        raise ValueError('NONFINITE_PIXEL')
    Fa=tuple(sum(float(Fn[j][k])*a[k] for k in range(3)) for j in range(3))
    Ftb=tuple(sum(float(Fn[k][j])*b[k] for k in range(3)) for j in range(3))
    if not all(math.isfinite(x) for x in Fa+Ftb):
        raise ValueError('NONFINITE_EPIPOLAR_GEOMETRY')
    den=Fa[0]**2+Fa[1]**2+Ftb[0]**2+Ftb[1]**2
    if den <= 1e-20:
        raise ValueError('DEGENERATE_EPIPOLAR_GEOMETRY')
    return abs(sum(b[k]*Fa[k] for k in range(3)))/math.sqrt(den)


def _root(par,v):
    while par[v] != v:
        par[v] = par[par[v]]
        v=par[v]
    return v


def build_disjoint_tracks(edges, assignment):
    """Make globally unique tracks with immutable prior ownership.

    Each edge = (frameA,featureA,frameB,featureB). Component merges reject:
    conflicting 3D owners, two keypoints of one frame, or reused feature IDs.
    Existing assignments are never silently transferred between landmarks.
    """
    par={};frames={};owners={};members={};stats=Counter()
    def initialize(node):
        f,index=node
        assert_train_frame(f)
        if type(index) is not int or index<0:
            raise ValueError('INVALID_FEATURE_INDEX')
        if f not in assignment:
            raise ValueError('MISSING_FRAME_OWNERSHIP')
        own=assignment[f].get(index)
        if own is not None and (type(own) is not int or own<0):
            raise ValueError('INVALID_LANDMARK_OWNER')
        if node not in par:
            par[node]=node;frames[node]={f};owners[node]=set() if own is None else {own};members[node]={node}
    for fa,ia,fb,ib in sorted(edges):
        a,b=(fa,ia),(fb,ib)
        if fa==fb:
            raise ValueError('SAME_FRAME_EDGE')
        initialize(a);initialize(b)
        ra,rb=_root(par,a),_root(par,b)
        if ra==rb:
            stats['redundant_cycle']+=1
            continue
        if owners[ra] and owners[rb] and owners[ra]!=owners[rb]:
            stats['foreign_owner_conflicts_rejected']+=1
            continue
        if frames[ra] & frames[rb]:
            stats['same_frame_duplicates_rejected']+=1
            continue
        # Stable component selection regardless of insertion order.
        if (len(members[ra]),ra)<(len(members[rb]),rb):
            ra,rb=rb,ra
        par[rb]=ra
        frames[ra].update(frames[rb]);owners[ra].update(owners[rb]);members[ra].update(members[rb])
        stats['safe_merges']+=1
    components=[]
    for node in sorted(par):
        if _root(par,node)==node:
            obs=sorted(members[node]); own=sorted(owners[node])
            if len({f for f,i in obs})!=len(obs) or len(own)>1:
                raise AssertionError('IMPOSSIBLE_TRACK_OWNERSHIP')
            components.append({'observations':obs,'source_owner':own[0] if own else None})
    components.sort(key=lambda x:x['observations'][0])
    stats['total_components']=len(components)
    stats['components_four_views']=sum(len(x['observations'])>=MIN_VIEWS for x in components)
    stats['owned_four_view_components']=sum(len(x['observations'])>=MIN_VIEWS and x['source_owner'] is not None for x in components)
    stats['unowned_four_view_components']=sum(len(x['observations'])>=MIN_VIEWS and x['source_owner'] is None for x in components)
    return components,dict(sorted(stats.items()))


def _cross(v):
    x,y,z=v
    return [[0.,-z,y],[z,0.,-x],[-y,x,0.]]


def _pose_fundamental(pose_a,pose_b,cal,np):
    Ra,ta=pose_a;Rb,tb=pose_b
    K=np.array([[cal['fx'],0,cal['cx']],[0,cal['fy'],cal['cy']],[0,0,1]],float)
    if not np.isfinite(K).all() or min(cal['fx'],cal['fy']) <= 0:
        raise ValueError('INVALID_INTRINSICS')
    R=Rb@Ra.T; t=(tb-R@ta).ravel()
    return np.linalg.inv(K).T@np.array(_cross(t),float)@R@np.linalg.inv(K)


def _knn_rows(knn):
    if len(knn)<1:
        return []
    return [(int(m.queryIdx),int(m.trainIdx),float(m.distance),float(n.distance))
            for row in knn if len(row)>=2 for m,n in [row[:2]]]


def verified_train_local(root, pins, output_path):
    """Trusted, SHA-pinned local SfM source diagnostic; never writes a new model."""
    # Optional dependencies stay outside the pure CI regression kernel.
    import cv2
    import numpy as np
    import pickle
    from PIL import Image
    root=Path(root).resolve()
    paths={'protocol':root/'whole_survey_holdout_PROTOCOL_FROZEN.json',
           'features':root/'features_train.pkl',
           'geometry':root/'W109_refined_train_private_RESEARCH_NOT_ADMITTED.pkl'}
    if set(pins)!=set(paths):
        raise ValueError('TRUSTED_OWNER_LOCAL_SHA_PINS_REQUIRED')
    for key,path in paths.items():
        if not path.is_file():
            raise ValueError('MISSING_PINNED_TRAIN_SOURCE')
        strict_hash(path,pins[key])
    manifest=json.loads(paths['protocol'].read_text(encoding='utf8'))
    train={row['frame_file']:row for row in manifest['frames'] if row['split']=='train'}
    if len(train)!=44 or sum(r['split']=='holdout' for r in manifest['frames'])!=6:
        raise ValueError('FROZEN_TRAIN_HOLDOUT_SPLIT_CHANGED')
    for f in train: assert_train_frame(f)
    # Validate all original training image bytes before touching trusted pickles.
    sizes=set()
    for f,row in train.items():
        src=(root/f).resolve()
        if not src.is_relative_to(root):
            raise ValueError('FRAME_PATH_ESCAPE')
        strict_hash(src,row['frame_sha256'])
        with Image.open(src) as image:
            sizes.add(image.size)
    if len(sizes)!=1:
        raise ValueError('FRAME_SIZE_DISAGREEMENT')
    model=pickle.loads(paths['geometry'].read_bytes())
    feat=pickle.loads(paths['features'].read_bytes())
    if set(train)!=set(model['poses']) or set(train)!=set(model['assign']) or set(train)!=set(feat):
        raise ValueError('SOURCE_IDENTITY_MISMATCH')
    width,height=next(iter(sizes))
    cal=dict(manifest['intrinsic_prior'],width=width,height=height)
    pairs=source_pairs(train)
    matcher=cv2.FlannBasedMatcher(dict(algorithm=1,trees=4),dict(checks=64))
    cv2.setRNGSeed(23);cv2.setNumThreads(3)
    edge=[];rejection=Counter()
    started=__import__('time').monotonic()
    for a,b in pairs:
        forward=_knn_rows(matcher.knnMatch(feat[a]['des'],feat[b]['des'],k=2))
        backward=_knn_rows(matcher.knnMatch(feat[b]['des'],feat[a]['des'],k=2))
        match=strong_mutual_matches(forward,backward)
        rejection['strong_reciprocal']+=len(match)
        Fn=_pose_fundamental(model['poses'][a],model['poses'][b],cal,np).tolist()
        good_pairs=0
        for ia,ib,dist in match:
            score=epipolar_error(feat[a]['pts'][ia],feat[b]['pts'][ib],Fn)
            if score>EPIPOLAR_MAX_PX:
                rejection['epipolar_outliers']+=1
                continue
            edge.append((a,ia,b,ib))
            good_pairs+=1
        rejection['pose_consistent_matches']+=good_pairs
    components,counts=build_disjoint_tracks(edge,model['assign'])
    out={'schema':'URAI_WORLD001_TRUSTED_TRAIN_TRACK_REBUILD_V1',
         'classification':'RESEARCH_TRAIN_ONLY_NOT_ADMITTED',
         'trusted_source_pins':pins,
         'verified_train_frames':len(train),
         'pair_count':len(pairs),
         'candidate_landmarks':len(model['landmarks']),
         'strict_landmark_threshold_unchanged':FROZEN_MIN_LANDMARKS,
         'match_policy':{'reciprocal_ratio':RATIO_MAX,'descriptor_max_l2':DESC_MAX_L2,
                         'sampson_max_px':EPIPOLAR_MAX_PX,'min_views':MIN_VIEWS},
         'pairwise':dict(rejection),
         'globally_disjoint_components':counts,
         'rebuild_validated_new_landmarks':0,  # no provisional 3D point admitted by a graph-only diagnostic
         'camera_intrinsics_independently_calibrated':False,
         'independent_holdout_tested':False,
         'heldout_frames_read':0,
         'source_quality_accepted':False,
         'gaussian_training_allowed':False,
         'production_release_allowed':False,
         'elapsed_seconds':round(__import__('time').monotonic()-started,2)}
    output=Path(output_path)
    if output.exists():
        raise ValueError('IMMUTABLE_RESEARCH_RECEIPT_EXISTS')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(out,sort_keys=True,indent=2)+'\n')
    return out


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--trusted-owner-local-root',required=True)
    ap.add_argument('--protocol-sha256',required=True)
    ap.add_argument('--features-sha256',required=True)
    ap.add_argument('--geometry-sha256',required=True)
    ap.add_argument('--receipt-path',required=True)
    a=ap.parse_args()
    result=verified_train_local(a.trusted_owner_local_root,{'protocol':a.protocol_sha256,
            'features':a.features_sha256,'geometry':a.geometry_sha256},a.receipt_path)
    print(json.dumps(result,sort_keys=True))

if __name__=='__main__':
    main()
