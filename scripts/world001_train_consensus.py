#!/usr/bin/env python3
"""World001 private, training-only geometry/descriptor QA (NEVER release admission).

No network, GPU, provider calls, holdout reads, frame promotions or unbounded spend.
The small pure-Python scoring kernel is dependency-free and can run in Jobs CI.
The CLI reads owner-controlled local SfM snapshots ONLY after explicit SHA-256
pinning. Snapshot pickle files must never be accepted from untrusted uploaders.
"""
import argparse
import hashlib
import json
import math
import pickle
from collections import defaultdict
from pathlib import Path

REPROJECTION_RADIUS_PX = 2.5
DESCRIPTOR_MAX_L2 = 100.0
MIN_OTHER_TRAIN_FRAMES = 2
TRAIN_GEOMETRY_MIN_LANDMARKS = 800  # frozen source screening requirement


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def sha_guard(path, expected):
    if not isinstance(expected, str) or len(expected) != 64 or any(c not in '0123456789abcdef' for c in expected):
        raise ValueError('EXPLICIT_VALID_SHA256_REQUIRED')
    if digest(path) != expected:
        raise ValueError('SOURCE_SHA256_MISMATCH')


def survey_id(frame_name):
    pieces = frame_name.split('/')
    if len(pieces) != 3 or pieces[0] != 'train' or not pieces[1].startswith('S'):
        raise ValueError('TRAIN_FRAME_ID_REQUIRED')
    return pieces[1]


def feature_grid(xy, radius):
    out = defaultdict(list)
    for i, item in enumerate(xy):
        if len(item) != 2 or not all(math.isfinite(float(v)) for v in item):
            raise ValueError('NONFINITE_FEATURE_POINT')
        out[(math.floor(float(item[0]) / radius), math.floor(float(item[1]) / radius))].append(i)
    return out


def project(point, pose, calibration):
    R, t = pose
    xyz = [float(x) for x in point]
    if len(xyz) != 3 or not all(map(math.isfinite, xyz)):
        raise ValueError('NONFINITE_LANDMARK')
    c = [sum(float(R[j][k]) * xyz[k] for k in range(3)) + float(t[j][0]) for j in range(3)]
    if not all(map(math.isfinite, c)):
        raise ValueError('NONFINITE_CAMERA')
    if c[2] <= 0.1:
        return None
    fx, fy, cx, cy, width, height = [float(calibration[k]) for k in ('fx', 'fy', 'cx', 'cy', 'width', 'height')]
    if min(fx, fy, width, height) <= 0:
        raise ValueError('INVALID_INTRINSICS')
    u, v = fx * c[0] / c[2] + cx, fy * c[1] / c[2] + cy
    return (u, v) if 0 < u < width and 0 < v < height else None


def anchor_prototypes(features, assignments, total_points):
    observations = [[] for _ in range(total_points)]
    for frame in sorted(assignments):
        for index, point in sorted(assignments[frame].items()):
            if not isinstance(point, int) or not 0 <= point < total_points:
                raise ValueError('BAD_LANDMARK_ID')
            if not 0 <= index < len(features[frame]['des']):
                raise ValueError('BAD_FEATURE_INDEX')
            observations[point].append((frame, index))
    if any(len(v) < 2 for v in observations):
        raise ValueError('UNTRIANGULATED_LANDMARK')
    proto = []
    for rows in observations:
        one, two = (features[frame]['des'][index] for frame, index in rows[:2])
        if len(one) != len(two) or len(one) != 128:
            raise ValueError('INCONSISTENT_SIFT_DIMENSIONS')
        v = [(float(a) + float(b)) * 0.5 for a, b in zip(one, two)]
        if not all(map(math.isfinite, v)):
            raise ValueError('NONFINITE_DESCRIPTOR')
        proto.append(v)
    return proto, observations


def squared_distance(a, b, limit):
    if len(a) != len(b):
        raise ValueError('INCONSISTENT_SIFT_DIMENSIONS')
    acc = 0.0
    for x, y in zip(a, b):
        delta = float(x) - float(y)
        acc += delta * delta
        if acc > limit:
            break
    return acc


def score_training_only(model, features, calibration, policy=None):
    """Research diagnostics; NEVER signal release/training admission."""
    required = {'reprojection_radius_px': REPROJECTION_RADIUS_PX,
                'descriptor_max_l2': DESCRIPTOR_MAX_L2,
                'min_other_train_frames': MIN_OTHER_TRAIN_FRAMES}
    if policy is not None and policy != required:
        raise ValueError('TRAINING_CONSENSUS_POLICY_MODIFIED')
    poses, assignments, landmarks = model['poses'], model['assign'], model['landmarks']
    frames = sorted(poses)
    if len(frames) < 4 or set(frames) != set(features) or set(frames) != set(assignments):
        raise ValueError('UNBOUND_TRAIN_FRAME')
    if any('S08_DIAGONAL' in f or not f.startswith('train/') for f in frames):
        raise ValueError('HELDOUT_OR_UNTRUSTED_TRAIN_FRAME')
    for f in frames:
        survey_id(f)
    prototypes, observations = anchor_prototypes(features, assignments, len(landmarks))
    grids = {frame: feature_grid(features[frame]['pts'], REPROJECTION_RADIUS_PX) for frame in frames}
    seeds = [set(f for f, _ in v[:2]) for v in observations]
    counts = [0] * len(landmarks)
    pixel_counts = [0] * len(landmarks)
    extra_surveys = [set() for _ in landmarks]
    # Never borrow a 2D keypoint that already belongs to another 3D track.
    # Such reuse creates false independent multi-view corroboration.
    foreign_owned_candidates = 0
    foreign_owned_descriptor_matches = 0
    foreign_owned_landmarks = set()
    pxlimit = REPROJECTION_RADIUS_PX ** 2
    dlimit = DESCRIPTOR_MAX_L2 ** 2
    for f in frames:
        pts, desc = features[f]['pts'], features[f]['des']
        if len(pts) != len(desc):
            raise ValueError('FEATURE_DESCRIPTOR_LENGTH_MISMATCH')
        for i, xyz in enumerate(landmarks):
            if f in seeds[i]:
                continue
            projected = project(xyz, poses[f], calibration)
            if projected is None:
                continue
            u, v = projected
            ix, iy = math.floor(u / REPROJECTION_RADIUS_PX), math.floor(v / REPROJECTION_RADIUS_PX)
            neighbors = []
            for x in (ix - 1, ix, ix + 1):
                for y in (iy - 1, iy, iy + 1):
                    for index in grids[f].get((x, y), ()):
                        p = pts[index]
                        if (float(p[0]) - u)**2 + (float(p[1]) - v)**2 <= pxlimit:
                            owner = assignments[f].get(index)
                            if owner is not None and owner != i:
                                foreign_owned_candidates += 1
                                if squared_distance(desc[index], prototypes[i], dlimit) <= dlimit:
                                    foreign_owned_descriptor_matches += 1
                                    foreign_owned_landmarks.add(i)
                                continue
                            neighbors.append(index)
            if not neighbors:
                continue
            pixel_counts[i] += 1
            if any(squared_distance(desc[j], prototypes[i], dlimit) <= dlimit for j in neighbors):
                counts[i] += 1
                extra_surveys[i].add(survey_id(f))
    retained = [i for i, value in enumerate(counts) if value >= MIN_OTHER_TRAIN_FRAMES]
    return {'schema': 'URAI_WORLD001_TRAIN_ONLY_CONSENSUS_V3',
            'classification': 'RESEARCH_TRAIN_ONLY_NOT_ACCEPTED',
            'candidate_landmarks': len(landmarks),
            'training_frames': len(frames),
            'supported_in_two_other_training_frames': len(retained),
            'pixels_supported_in_two_other_training_frames': sum(v >= 2 for v in pixel_counts),
            'foreign_owned_keypoint_candidates_excluded': foreign_owned_candidates,
            'foreign_owned_descriptor_matches_excluded': foreign_owned_descriptor_matches,
            'landmarks_with_foreign_owned_descriptor_matches': len(foreign_owned_landmarks),
            'retained_landmark_indices': retained,
            'retained_multiple_extra_surveys': sum(len(extra_surveys[i]) >= 2 for i in retained),
            'support_histogram': {str(i): sum(v == i for v in counts) for i in range(0, 5)},
            'source_quality_threshold_landmarks': TRAIN_GEOMETRY_MIN_LANDMARKS,
            'source_quality_threshold_passed': len(retained) >= TRAIN_GEOMETRY_MIN_LANDMARKS,
            'independent_holdout_passed': False,
            'holdout_images_read': 0,
            'frames_admitted': 0,
            'gaussian_training_permitted': False,
            'release_permitted': False,
            'policy': required}


def run_local_snapshot(root, protocol_sha256, training_sha256, features_sha256):
    """Read only known trusted, explicitly pinned owner-local pickle bytes."""
    root = Path(root).resolve()
    proto_path = root / 'whole_survey_holdout_PROTOCOL_FROZEN.json'
    state_path = root / 'training_ONLY_S08_EXCLUDED_frozen.pkl'
    feature_path = root / 'features_train.pkl'
    for path, digest_value in ((proto_path, protocol_sha256), (state_path, training_sha256),
                               (feature_path, features_sha256)):
        sha_guard(path, digest_value)  # check before deserializing any pickle
    protocol = json.loads(proto_path.read_text(encoding='utf-8'))
    rows = {r['frame_file']: r for r in protocol['frames'] if r['split'] == 'train'}
    if len(rows) != 44 or sum(r['split'] == 'holdout' for r in protocol['frames']) != 6:
        raise ValueError('FROZEN_TRAIN_HOLDOUT_SPLIT_MISMATCH')
    if any(survey_id(f) == 'S08_DIAGONAL' for f in rows):
        raise ValueError('HELDOUT_SOURCE_LEAK')
    # Image dimensions are read from the hashed training JPEGs: the frozen
    # PINHOLE prior specifies principal point but not a width/height field.
    from PIL import Image  # used only by owner-local CLI, never imported in CI tests
    dimensions = set()
    for frame, row in rows.items():
        frame_path = (root / frame).resolve()
        if not frame_path.is_relative_to(root):
            raise ValueError('TRAIN_SOURCE_PATH_ESCAPE')
        sha_guard(frame_path, row['frame_sha256'])
        with Image.open(frame_path) as image:
            dimensions.add(image.size)
    if len(dimensions) != 1:
        raise ValueError('TRAIN_FRAME_DIMENSIONS_MISMATCH')
    width, height = next(iter(dimensions))
    calibration = dict(protocol['intrinsic_prior'], width=width, height=height)
    # Historical trusted local pickle format, never passed through network/API:
    model = pickle.loads(state_path.read_bytes())
    features = pickle.loads(feature_path.read_bytes())
    if not (set(rows) == set(model['poses']) == set(model['assign']) == set(features)):
        raise ValueError('TRAIN_SOURCE_IDENTITY_MISMATCH')
    result = score_training_only(model, features, calibration)
    result.update({'protocol_sha256': protocol_sha256,
                   'training_state_sha256': training_sha256,
                   'training_features_sha256': features_sha256,
                   'verified_original_training_frame_hashes': len(rows)})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--trusted-owner-local-root', required=True)
    parser.add_argument('--protocol-sha256', required=True)
    parser.add_argument('--training-sha256', required=True)
    parser.add_argument('--features-sha256', required=True)
    parser.add_argument('--receipt-path', required=True)
    args = parser.parse_args()
    out = Path(args.receipt_path)
    if out.exists():
        raise ValueError('IMMUTABLE_RECEIPT_ALREADY_EXISTS')
    result = run_local_snapshot(args.trusted_owner_local_root, args.protocol_sha256,
                                args.training_sha256, args.features_sha256)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Keep a private owner-controlled receipt, never emit private 3D geometry.
    out.write_text(json.dumps(result, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'retained_landmark_indices'}, sort_keys=True))


if __name__ == '__main__':
    main()