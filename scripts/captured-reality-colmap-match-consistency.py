#!/usr/bin/env python3
"""Independent match-graph QA for an audited structural COLMAP derivative.

No original source bytes are copied to output. A passing structural report is
not a training or artistic admission. Direct SIFT inlier evidence is checked
separately from the reprojection heuristic that produced the derivative.
"""
import argparse
import collections
import importlib.util
import json
import math
import pathlib
import sqlite3
import struct
import statistics


def require(ok, message):
    if not ok:
        raise ValueError(message)


def percentile(values, p):
    if not values:
        return None
    v = sorted(values)
    ix = (len(v) - 1) * p / 100
    lo, hi = int(ix), min(int(ix) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (ix - lo)


def repair_module():
    file = pathlib.Path(__file__).with_name('captured-reality-colmap-track-repair.py')
    spec = importlib.util.spec_from_file_location('colmap_track_repair', file)
    require(spec is not None and spec.loader is not None, 'REPAIR_MODULE_MISSING')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def inspect(original_path, derivative_path, db_path):
    original_path, derivative_path, db_path = map(pathlib.Path, (original_path, derivative_path, db_path))
    repair = repair_module()
    required_files = ('cameras.bin', 'images.bin', 'points3D.bin')
    report = json.loads((derivative_path / 'track-disambiguation-audit.json').read_text())
    receipt = report['receipt']
    require(receipt['classification'] == 'AUDITED_STRUCTURAL_DERIVATIVE_NOT_VISUAL_OR_TRAINING_ADMISSION', 'DERIVATIVE_CLASSIFICATION_UNSAFE')
    for name in required_files:
        fixed = receipt['file_hashes'][name]
        require(repair.digest(original_path / name) == fixed['before_sha256'], 'SOURCE_HASH_CHANGED')
        require(repair.digest(derivative_path / name) == fixed['after_sha256'], 'DERIVATIVE_HASH_CHANGED')
    cameras = repair.cameras_from((original_path / 'cameras.bin').read_bytes())
    require((original_path / 'cameras.bin').read_bytes() == (derivative_path / 'cameras.bin').read_bytes(), 'CAMERAS_CHANGED')
    original_images = repair.images_from((original_path / 'images.bin').read_bytes(), cameras)
    derivative_images = repair.images_from((derivative_path / 'images.bin').read_bytes(), cameras)
    originals = {p['id']: p for p in repair.points_from((original_path / 'points3D.bin').read_bytes())}
    derivatives = {p['id']: p for p in repair.points_from((derivative_path / 'points3D.bin').read_bytes())}
    require(originals.keys() == derivatives.keys() and original_images.keys() == derivative_images.keys(), 'SOURCE_COVERAGE_CHANGED')
    ambiguity = collections.defaultdict(list)
    expected_detach = set()
    residuals = []
    for pid, old in originals.items():
        new = derivatives[pid]
        require(old['xyz'] == new['xyz'] and old['head'][:-8] == new['head'][:-8], 'SOURCE_POINT_GEOMETRY_CHANGED')
        groups = collections.defaultdict(list)
        for image_id, index in old['track']:
            require(image_id in original_images and index < len(original_images[image_id]['obs']), 'ORIGINAL_TRACK_INVALID')
            require(original_images[image_id]['obs'][index]['pid'] == pid, 'ORIGINAL_TRACK_NOT_RECIPROCAL')
            groups[image_id].append(index)
        expected_keep = set()
        for image_id, indexes in groups.items():
            new_here = [(i, idx) for i, idx in new['track'] if i == image_id]
            require(len(new_here) == 1 and new_here[0][1] in indexes, 'REPAIRED_TRACK_NOT_UNIQUE')
            kept_index = new_here[0][1]
            expected_keep.add((image_id, kept_index))
            if len(indexes) > 1:
                ambiguity[pid, image_id] = (indexes, kept_index)
            for idx in indexes:
                if idx != kept_index:
                    expected_detach.add((pid, image_id, idx, kept_index))
        require(set(new['track']) == expected_keep, 'TRACK_CHANGE_UNDOCUMENTED')
        for image_id, index in new['track']:
            obs = derivative_images[image_id]['obs'][index]
            require(obs['pid'] == pid, 'DERIVATIVE_TRACK_NOT_RECIPROCAL')
            width, height = derivative_images[image_id]['cam'][-2:]
            require(0 <= obs['xy'][0] < width and 0 <= obs['xy'][1] < height, 'REPAIRED_OBSERVATION_OUT_OF_BOUNDS')
            residuals.append(math.dist(repair.reproject(derivative_images[image_id], old['xyz']), obs['xy']))
    recorded_detach = {(int(c['point_id']), int(c['image_id']), int(c['detached_index']), int(c['retained_index'])) for c in report['changes']}
    require(len(recorded_detach) == len(report['changes']) and recorded_detach == expected_detach, 'AUDIT_INCOMPLETE')
    obs_total = 0
    recorded_detach_obs = {(pid, image_id, index) for pid, image_id, index, _ in recorded_detach}
    for image_id, before in original_images.items():
        after = derivative_images[image_id]
        require(before['q'] == after['q'] and before['t'] == after['t'] and before['cam'] == after['cam'] and before['name'] == after['name'], 'IMAGE_POSE_OR_CALIBRATION_CHANGED')
        require(len(before['obs']) == len(after['obs']), 'IMAGE_FEATURE_COUNT_CHANGED')
        for index, original in enumerate(before['obs']):
            obs_total += 1
            new = after['obs'][index]
            require(original['xy'] == new['xy'], 'IMAGE_FEATURE_POSITION_CHANGED')
            if original['pid'] != new['pid']:
                require((original['pid'], image_id, index) in recorded_detach_obs, 'UNRECORDED_IMAGE_ASSIGNMENT_CHANGE')
                require(new['pid'] == -1, 'REASSIGNED_IMAGE_FEATURE')

    scores = collections.Counter()
    inlier_pairs = 0
    inlier_edges = 0
    database_keypoints = 0
    focal_refinement_percent = []
    with sqlite3.connect(f'file:{db_path}?mode=ro', uri=True) as con:
        names = {int(i): (name, int(camera)) for i, name, camera in con.execute('SELECT image_id,name,camera_id FROM images')}
        db_cameras = {}
        for camera_id, model, width, height, params in con.execute('SELECT camera_id,model,width,height,params FROM cameras'):
            require(model == 2 and len(params) == 32, 'DATABASE_CAMERA_MODEL_INVALID')
            db_cameras[camera_id] = (*struct.unpack('<4d', params), width, height)
        require(set(original_images).issubset(names), 'ORIGINAL_IMAGES_MISSING_FROM_DATABASE')
        for image_id, name in original_images.items():
            require(names[image_id][0] == name['name'], 'DATABASE_IMAGE_NAME_MISMATCH')
            initial_calibration = db_cameras[names[image_id][1]]
            require(initial_calibration[-2:] == name['cam'][-2:], 'DATABASE_CAMERA_DIMENSIONS_MISMATCH')
            # Mapper/bundle adjustment may refine intrinsics relative to the
            # initial feature DB. Record drift rather than rejecting equality.
            focal_refinement_percent.append(100.0*(name['cam'][0]-initial_calibration[0])/initial_calibration[0])
            row = con.execute('SELECT rows,cols,data FROM keypoints WHERE image_id=?', (image_id,)).fetchone()
            require(row is not None, 'DATABASE_KEYPOINTS_MISSING')
            n, cols, data = row
            require(cols >= 2 and len(data) == n * cols * 4 and n == len(name['obs']), 'DATABASE_FEATURE_ARRAY_INVALID')
            for idx, point in enumerate(name['obs']):
                x, y = struct.unpack_from('<ff', data, idx * cols * 4)
                require(abs(point['xy'][0] - x) < 0.001 and abs(point['xy'][1] - y) < 0.001, 'DATABASE_FEATURE_IDENTITY_MISMATCH')
            database_keypoints += n
        max_id = 2147483647
        for pair_id, n, cols, data in con.execute('SELECT pair_id,rows,cols,data FROM two_view_geometries'):
            if not data or not n:
                continue
            require(cols == 2 and len(data) == n*8, 'DATABASE_MATCH_ARRAY_INVALID')
            i, j = divmod(int(pair_id), max_id)
            if i not in original_images or j not in original_images:
                continue
            inlier_pairs += 1
            image_i, image_j = original_images[i], original_images[j]
            for feat_i, feat_j in struct.iter_unpack('<II', data):
                require(feat_i < len(image_i['obs']) and feat_j < len(image_j['obs']), 'DATABASE_MATCH_OUT_OF_RANGE')
                pid = image_i['obs'][feat_i]['pid']
                if pid > 0 and pid == image_j['obs'][feat_j]['pid']:
                    if (pid, i) in ambiguity:
                        scores[pid, i, feat_i] += 1
                    if (pid, j) in ambiguity:
                        scores[pid, j, feat_j] += 1
                inlier_edges += 1
    more, equal, less, zero = 0, 0, 0, 0
    support_disagreements = []
    for (pid, image_id), (indexes, chosen) in ambiguity.items():
        s = scores[pid,image_id,chosen]
        rival = max(scores[pid,image_id,k] for k in indexes if k != chosen)
        if s > rival: more += 1
        elif s == rival: equal += 1
        else:
            less += 1
            support_disagreements.append(rival - s)
        if s == 0: zero += 1
    return {
        'schema': 'urai-colmap-independent-match-qa-1',
        'classification': 'STRUCTURAL_QA_NOT_GAUSSIAN_TRAINING_ADMISSION',
        'source_hashes_verified': len(required_files),
        'registered_cameras': len(original_images),
        'sparse_points': len(derivatives),
        'derivative_track_links': len(residuals),
        'source_keypoints_identity_verified': database_keypoints,
        'absolute_focal_refinement_percent_median': statistics.median(abs(v) for v in focal_refinement_percent),
        'absolute_focal_refinement_percent_max': max(abs(v) for v in focal_refinement_percent),
        'feature_coordinates_preserved': obs_total,
        'detached_associations_audited': len(recorded_detach),
        'original_inlier_graph_pairs': inlier_pairs,
        'original_inlier_graph_edges_scanned': inlier_edges,
        'reprojection_px': {'mean': statistics.mean(residuals), 'median': statistics.median(residuals), 'p95': percentile(residuals, 95), 'p99': percentile(residuals,99)},
        'selection_inlier_support': {'more_supported':more, 'equally_supported':equal, 'less_supported':less, 'without_support':zero,
                                      'greater_support_difference_median':statistics.median(support_disagreements) if support_disagreements else 0},
        'admission_status': 'BLOCKED_RETRIANGULATION_HELDOUT_QA_AND_INDEPENDENT_REVIEW',
        'training_permitted': False,
        'reason': 'A clean 3D track graph and nearest reprojection are not independent evidence for correct point association.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original-model', required=True)
    parser.add_argument('--derivative-model', required=True)
    parser.add_argument('--database', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    report = inspect(args.original_model, args.derivative_model, args.database)
    destination = pathlib.Path(args.report)
    if destination.exists():
        raise SystemExit('REFUSING_TO_OVERWRITE_FORENSIC_REPORT')
    destination.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('schema', 'classification', 'admission_status', 'training_permitted', 'selection_inlier_support')},indent=2))


if __name__ == '__main__':
    main()
