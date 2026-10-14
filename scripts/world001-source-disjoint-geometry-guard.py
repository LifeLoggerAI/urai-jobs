#!/usr/bin/env python3
"""Fail-closed, zero-provider World001 source-disjoint camera evaluation admission guard.

This is an INTERPRETIVE world, never personal captured reality. The guard
verifies original-frame identity and whole-survey isolation, the frozen train
model and subsequent training-only robust bundle adjustment, then independently
recomputes unfit-view statistical criteria. It never turns a camera/geometry
pass into training/photoreal/runtime/human release admission.

Does not load pickle, pixels into a model, private credentials, or any provider.
Source images are only read in bounded chunks for SHA-256 identity attestation.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from statistics import median

THRESHOLDS = {
    'heldout_registered_images': 5,
    'heldout_median_unfitted_reproj_px': 4.0,
    'heldout_p90_unfitted_reproj_px': 8.0,
    'heldout_unfitted_inlier_rate_at_5px': 0.45,
    'training_3D_points': 800,
    'training_registered_images': 30,
}


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def load_json(path):
    with Path(path).open('r', encoding='utf-8') as stream:
        return json.load(stream)


def inside(root, relative):
    require(isinstance(relative, str) and relative and not relative.startswith('/')
            and '\\' not in relative, 'UNSAFE_SOURCE_PATH')
    parts = Path(relative).parts
    require(all(part not in ('.', '..', '') for part in parts), 'UNSAFE_SOURCE_PATH')
    path = Path(root).joinpath(*parts)
    require(path.is_file() and not path.is_symlink()
            and path.resolve().is_relative_to(Path(root).resolve()), 'SOURCE_FILE_MISSING_OR_LINKED')
    return path


def reciprocal_ratio_pairs(forward, reverse, ratio=0.75):
    """Deterministic mutual KNN best/second-best results, independently testable.

    Each row is (query_idx, train_idx, best_distance, next_best_distance).
    For reverse rows the query/train indices are in the reversed image order.
    """
    require(0.0 < ratio < 1.0, 'MATCH_RATIO_INVALID')
    def good(rows):
        pairs = {}
        for query, train, distance, next_distance in rows:
            require(all(isinstance(i, int) and i >= 0 for i in (query, train)),
                    'NEGATIVE_FEATURE_INDEX')
            require(all(math.isfinite(d) and d >= 0 for d in (distance, next_distance)),
                    'MATCH_DISTANCE_NONFINITE')
            if next_distance <= 0 or distance >= ratio * next_distance:
                continue
            key = (query, train)
            if key not in pairs or distance < pairs[key]:
                pairs[key] = distance
        return pairs
    a = good(forward)
    b = good(reverse)
    candidates = sorted(((i, j, dist) for (i, j), dist in a.items() if (j, i) in b),
                        key=lambda x: (x[2], x[0], x[1]))
    out = []
    used_a, used_b = set(), set()
    for i, j, dist in candidates:
        if i not in used_a and j not in used_b:
            used_a.add(i)
            used_b.add(j)
            out.append((i, j, dist))
    return out


def max_ray_parallax_deg(rays):
    """Maximum angular separation between distinct normalized camera-to-point rays."""
    require(len(rays) >= 2, 'INSUFFICIENT_PARALLAX_RAYS')
    unit = []
    for v in rays:
        require(len(v) == 3 and all(math.isfinite(float(x)) for x in v), 'RAY_NONFINITE')
        norm = math.sqrt(sum(float(x) ** 2 for x in v))
        require(norm > 1e-8, 'ZERO_RAY')
        unit.append([float(x) / norm for x in v])
    return max(math.degrees(math.acos(max(-1, min(1, sum(a*b for a, b in zip(unit[i], unit[j]))))))
               for i in range(len(unit)) for j in range(i+1, len(unit)))


def robust_training_track(rows, heldout_survey, min_views=3, min_surveys=2,
                          min_parallax_deg=3.0, max_train_reproj_px=8.0):
    """Train-only strict track selection, never a final human source-frame admission."""
    require(rows and all(r['survey'] != heldout_survey for r in rows), 'HELDOUT_TRACK_LEAK')
    require(len({r['frame'] for r in rows}) >= min_views, 'TRACK_TOO_SHORT')
    require(len({r['survey'] for r in rows}) >= min_surveys, 'TRACK_ONE_SURVEY')
    require(all(math.isfinite(float(r['reprojection_px'])) and
                0 <= float(r['reprojection_px']) <= max_train_reproj_px and
                math.isfinite(float(r['depth'])) and float(r['depth']) > 0.05
                for r in rows), 'TRACK_REPROJECTION_OR_DEPTH_INVALID')
    angle = max_ray_parallax_deg([r['camera_to_landmark_ray'] for r in rows])
    require(angle >= min_parallax_deg, 'TRACK_WEAK_TRIANGULATION')
    return {'observations': len(rows), 'source_surveys': len({r['survey'] for r in rows}),
            'max_parallax_deg': angle, 'status': 'TRAIN_ONLY_GEOMETRY_SUPPORT'}


def review(root, protocol_path, original_train_path, refined_train_path,
           ba_report_path, evaluation_path, check_frame_bytes=True):
    root = Path(root)
    protocol_path = Path(protocol_path)
    p = load_json(protocol_path)
    require(p['world'] == 'URAI-IW-001-QUIET-RESET' and
            p['truth_class'].upper().startswith('INTERPRETIVE'), 'WORLD_TRUTH_CLASS_INVALID')
    excluded = p['excluded_survey']
    require(p.get('source_authority') and p.get('no_paid_generation') is True,
            'SOURCE_OR_COST_PROTECTION_MISSING')
    require(p['frozen_thresholds_unchanged'] == THRESHOLDS, 'FROZEN_THRESHOLD_CHANGED')
    require(p.get('virgin_external_capture', False) is False, 'UNTOUCHED_EXTERNAL_CLAIM_UNSUPPORTED')
    require(excluded not in p['training_surveys'], 'HELDOUT_IN_TRAINING_SURVEYS')
    seen, t, v = set(), set(), set()
    for r in p['frames']:
        rel = r['frame_file']
        require(rel not in seen and r['frame_sha256'] and len(r['frame_sha256']) == 64,
                'SOURCE_IDENTITY_OR_DUPLICATE')
        seen.add(rel)
        if r['split'] == 'train':
            require(rel.startswith('train/') and r['survey'] != excluded and
                    r['survey'] in p['training_surveys'], 'HELDOUT_FRAME_LEAK')
            t.add(rel)
        else:
            require(r['split'] == 'holdout' and rel.startswith('holdout/') and
                    r['survey'] == excluded, 'HOLDOUT_SCOPE_INVALID')
            v.add(rel)
        if check_frame_bytes:
            require(digest(inside(root, rel)) == r['frame_sha256'], 'FRAME_SHA256_INVALID')
    require(len(t) == p['train_count'] == 44 and len(v) == p['holdout_count'] == 6,
            'SOURCE_COUNT_INCOMPLETE')
    require(len(set(p['training_surveys'])) == 7, 'TRAIN_SURVEY_COUNT_INVALID')
    protocol_hash = digest(protocol_path)
    train_hash = digest(original_train_path)
    refined_hash = digest(refined_train_path)
    ba = load_json(ba_report_path)
    evaluation = load_json(evaluation_path)
    require(ba['inputs']['frozen_original_protocol_sha256'] == protocol_hash and
            ba['inputs']['frozen_W1_training_model_sha256'] == train_hash and
            ba.get('no_holdout_images_loaded') is True and
            set(ba['inputs']['registered_train_only_frames']) == t,
            'BA_TRAIN_SOURCE_OR_ISOLATION_INVALID')
    require(ba['optimization']['output_npz_sha256'] == refined_hash and
            ba['optimization']['cpu_only'] is True and
            ba['optimization']['gpu_used'] is False,
            'BA_RESULT_OR_COMPUTE_AUTHORITY_INVALID')
    require(ba['filter']['min_track_views'] >= 3 and
            ba['filter']['min_source_surveys'] >= 2 and
            ba['filter']['min_max_triangulation_angle_deg'] >= 3.0,
            'BA_WEAK_TRACK_POLICY')
    require(evaluation['frozen_protocol_sha256'] == protocol_hash and
            evaluation['frozen_training_state_sha256'] == train_hash and
            evaluation['frozen_train_side_BA_sha256'] == refined_hash and
            evaluation['heldout_survey'] == excluded and
            evaluation['thresholds_unchanged'] == THRESHOLDS and
            evaluation['original_W1_S08_failure_unchanged'] is True and
            evaluation['provider_spend'] == 0 and
            evaluation['production_gaussian_trained'] is False and
            evaluation['accepted_frames'] == 0,
            'EVALUATION_BINDINGS_INVALID')
    by_frame = {r['frame_file']: r for r in p['frames'] if r['split'] == 'holdout'}
    require(len(evaluation['per_view']) == len(by_frame), 'HELDOUT_VIEW_COUNT_INVALID')
    medians, p90s, rates, localized = [], [], [], 0
    accounted = set()
    for r in evaluation['per_view']:
        name = r['frame']
        require(name in by_frame and name not in accounted and
                r['image_sha256'] == by_frame[name]['frame_sha256'],
                'HELDOUT_PER_VIEW_IDENTITY_INVALID')
        accounted.add(name)
        if r['status'] == 'S04_LOCALIZED_FROZEN_TRAIN_BA':
            require(r['pose_inliers'] >= 30 and r['test_correspondences'] >= 15,
                    'HELDOUT_POSITIVE_RESULT_UNSUPPORTED')
            for key in ('unfitted_median_px', 'unfitted_p90_px', 'unfitted_inlier_rate_5px'):
                require(math.isfinite(float(r[key])), 'HELDOUT_NAN')
            medians.append(float(r['unfitted_median_px']))
            p90s.append(float(r['unfitted_p90_px']))
            rates.append(float(r['unfitted_inlier_rate_5px']))
            localized += 1
    mm, p90, rate = (median(medians), median(p90s), median(rates)) if medians else (None,None,None)
    computed_pass = bool(localized >= THRESHOLDS['heldout_registered_images'] and
                         mm <= THRESHOLDS['heldout_median_unfitted_reproj_px'] and
                         p90 <= THRESHOLDS['heldout_p90_unfitted_reproj_px'] and
                         rate >= THRESHOLDS['heldout_unfitted_inlier_rate_at_5px']) if medians else False
    require(evaluation['heldout_views_localized'] == localized and
            evaluation['geometric_screen_pass'] == computed_pass, 'RESULT_MISREPRESENTED')
    require(all(abs(a-b) <= 1e-8 for a,b in [
        (mm,evaluation['median_of_per_view_unfitted_medians_px']),
        (p90,evaluation['median_of_per_view_unfitted_p90_px']),
        (rate,evaluation['median_of_per_view_unfitted_rate_5px'])]) if medians else True,
        'AGGREGATE_MISCOMPUTED')
    # No in-band environment or software status promotes production. Separate
    # genuine human/privacy/art/legal and paid-compute permissions are required.
    return {'world': p['world'], 'classification': 'INTERPRETIVE_NOT_AUTOBIOGRAPHICAL',
            'source_disjoint': True, 'pristine_external_evaluation': False,
            'protocol_sha256': protocol_hash,
            'frozen_train_sha256': train_hash,
            'frozen_BA_sha256': refined_hash,
            'source_frames_verified': bool(check_frame_bytes),
            'training_frames': len(t), 'withheld_views': len(v),
            'localized_views': localized, 'heldout_median_of_medians_px': mm,
            'heldout_median_of_p90_px': p90,
            'heldout_median_of_fraction_under_5px': rate,
            'geometric_screen_pass': computed_pass,
            'training_permitted': False, 'gpu_spend_permitted': False,
            'production_gaussian_trained': False, 'frames_admitted': 0,
            'photoreal_art_accepted': False,
            'status': 'GEOMETRY_SCREEN_PASSED_BUT_NOT_ADMITTED' if computed_pass else 'GEOMETRY_SCREEN_FAILED_NO_TRAINING'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--protocol', required=True)
    parser.add_argument('--frozen-train', required=True)
    parser.add_argument('--frozen-ba', required=True)
    parser.add_argument('--ba-report', required=True)
    parser.add_argument('--heldout-evaluation', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--skip-frame-byte-verification', action='store_true',
                        help='Diagnostics only: does not grant a source-verified result')
    args = parser.parse_args()
    result = review(args.root,args.protocol,args.frozen_train,args.frozen_ba,
                    args.ba_report,args.heldout_evaluation,
                    check_frame_bytes=not args.skip_frame_byte_verification)
    out = Path(args.output)
    if out.exists():
        raise ValueError('REFUSE_OVERWRITE_EXISTING_RECEIPT')
    out.write_text(json.dumps(result,sort_keys=True,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':result['status'],'source_sha256':digest(out),
                      'p90_px':result['heldout_median_of_p90_px'],'training_permitted':False}))

if __name__ == '__main__':
    main()
