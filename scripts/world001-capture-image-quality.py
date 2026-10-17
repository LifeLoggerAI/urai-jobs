#!/usr/bin/env python3
"""Read-only World001 physical recapture image-quality companion.

This augments (NEVER replaces) world001-source-correction-preflight.py.
It must not certify geometry, holdout, a splat, legal rights, or paid training.
Frames and calibration remain owner-local; output contains aggregate metrics only.
Python stdlib kernel; optional Pillow is required only for actual PNG decoding.
"""
import argparse
import importlib.util
import json
import math
from pathlib import Path

PHYSICAL = 'CALIBRATED_PHYSICAL_CAPTURE'
SCREEN = 'URAI_WORLD001_CAPTURE_IMAGE_SCREEN_V1'
# Conservative *acquisition diagnostics*, not Gold Master release thresholds.
LIMITS = {'mean_min': 25.0, 'mean_max': 230.0,
          'max_clipped_fraction': 0.08, 'min_p90_minus_p10': 35.0,
          'min_laplacian_variance': 28.0, 'min_corner_fraction': 0.0009,
          'min_gradient_axis_ratio': 0.055}


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def inspect_luma_grid(rows):
    """Independent pixel-derived focus, clipping, contrast and texture metrics."""
    require(isinstance(rows, (list, tuple)) and len(rows) >= 32,
            'IMAGE_SAMPLE_GRID_TOO_SMALL')
    w = len(rows[0]) if isinstance(rows[0], (list, tuple)) else 0
    require(w >= 32 and all(isinstance(r, (list, tuple)) and len(r) == w for r in rows),
            'IMAGE_SAMPLE_GRID_INVALID')
    flat = []
    for r in rows:
        for v in r:
            require(type(v) is int and 0 <= v <= 255, 'IMAGE_LUMA_INVALID')
            flat.append(v)
    a = sorted(flat)
    n = len(flat)
    mean = sum(flat) / n
    clip_low = sum(v <= 4 for v in flat) / n
    clip_high = sum(v >= 251 for v in flat) / n
    contrast = a[int((n - 1) * 0.9)] - a[int((n - 1) * 0.1)]
    lap_n = 0
    lap_sum = lap_sq = gx_sum = gy_sum = 0.0
    corners = 0
    for y in range(1, len(rows) - 1):
        for x in range(1, w - 1):
            here = rows[y][x]
            lap = (rows[y - 1][x] + rows[y + 1][x] +
                   rows[y][x - 1] + rows[y][x + 1] - 4 * here)
            lap_sum += lap
            lap_sq += lap * lap
            gx = abs(rows[y][x + 1] - rows[y][x - 1])
            gy = abs(rows[y + 1][x] - rows[y - 1][x])
            gx_sum += gx
            gy_sum += gy
            if gx >= 38 and gy >= 38:
                corners += 1
            lap_n += 1
    lap_variance = max(0., lap_sq/lap_n - (lap_sum/lap_n)**2)
    orientation_ratio = min(gx_sum, gy_sum)/max(gx_sum, gy_sum) if max(gx_sum, gy_sum) else 0.
    corner_fraction = corners / lap_n
    metrics = {'mean_luma': round(mean, 3), 'clipped_black_fraction': round(clip_low, 5),
               'clipped_white_fraction': round(clip_high, 5),
               'p90_minus_p10': round(contrast, 3),
               'laplacian_variance': round(lap_variance, 3),
               'corner_fraction': round(corner_fraction, 6),
               'gradient_axis_ratio': round(orientation_ratio, 5)}
    failures = []
    if not LIMITS['mean_min'] <= mean <= LIMITS['mean_max']:
        failures.append('CAPTURE_EXPOSURE_MEAN_OUTSIDE_SCREEN')
    if max(clip_low, clip_high) > LIMITS['max_clipped_fraction']:
        failures.append('CAPTURE_EXPOSURE_CLIPPING_EXCESS')
    if contrast < LIMITS['min_p90_minus_p10']:
        failures.append('CAPTURE_LOW_CONTRAST')
    if lap_variance < LIMITS['min_laplacian_variance']:
        failures.append('CAPTURE_LOW_SHARPNESS_ESTIMATE')
    if corner_fraction < LIMITS['min_corner_fraction']:
        failures.append('CAPTURE_INSUFFICIENT_CORNER_TEXTURE')
    if orientation_ratio < LIMITS['min_gradient_axis_ratio']:
        failures.append('CAPTURE_DIRECTIONAL_DETAIL_IMBALANCE')
    return {'metrics': metrics, 'diagnostic_pass': not failures, 'flags': failures}


def verify_locked_capture_metadata(manifest):
    """Additional acquisition controls on top of source-correction preflight."""
    require(isinstance(manifest, dict) and manifest.get('schema') == 'urai-world001-source-correction-1',
            'CAPTURE_MANIFEST_SCHEMA_INVALID')
    require(manifest.get('scene_authority', {}).get('kind') == PHYSICAL and
            manifest.get('scene_authority', {}).get('source_truth') ==
            'CALIBRATED_PHOTOGRAPHIC_CAPTURE', 'CAPTURE_PHYSICAL_SOURCE_REQUIRED')
    require(manifest.get('paid_compute_authorized') is False and
            manifest.get('gaussian_training_permitted') is False, 'CAPTURE_NO_GPU_OR_PAID_ADMISSION')
    views = manifest.get('views')
    sessions = manifest.get('sessions')
    calibrations = manifest.get('calibrations')
    require(isinstance(views, list) and len(views) >= 8 and isinstance(sessions, list)
            and sessions and isinstance(calibrations, dict), 'CAPTURE_VIEWS_OR_SESSIONS_MISSING')
    by_session = {}
    for s in sessions:
        require(isinstance(s, dict), 'CAPTURE_SESSION_INVALID')
        name = s.get('id')
        controls = s.get('capture_controls', {})
        require(isinstance(name, str) and name and name not in by_session,
                'CAPTURE_SESSION_DUPLICATE')
        require(isinstance(controls, dict) and
                controls.get('focus') == 'MANUAL_LOCKED' and
                controls.get('exposure') == 'MANUAL_LOCKED' and
                controls.get('white_balance') == 'MANUAL_LOCKED' and
                isinstance(controls.get('camera_id'), str) and controls['camera_id'] and
                isinstance(controls.get('lens_id'), str) and controls['lens_id'],
                'CAPTURE_CAMERA_CONTROLS_NOT_LOCKED')
        by_session[name] = controls
    seen = set()
    for v in views:
        require(isinstance(v, dict) and v.get('split') == 'train',
                'CAPTURE_HOLDOUT_OR_UNKNOWN_VIEW_REFUSED')
        identifier = v.get('id')
        require(isinstance(identifier, str) and identifier not in seen,
                'CAPTURE_DUPLICATE_VIEW_ID')
        seen.add(identifier)
        controls = by_session.get(v.get('session_id'))
        calib = calibrations.get(v.get('calibration_id'))
        require(controls is not None and isinstance(calib, dict), 'CAPTURE_SESSION_CALIBRATION_MISSING')
        require(controls['camera_id'] == calib.get('camera_id') and
                controls['lens_id'] == calib.get('lens_id') and
                calib.get('distortion_status') == 'CALIBRATED_ZERO_OR_RECTIFIED',
                'CAPTURE_LENS_OR_CALIBRATION_DRIFT')
    ep = manifest.get('evaluation_plan', {})
    require(ep.get('source_disjoint_holdout') is True and
            ep.get('holdout_images_materialized') is False and
            isinstance(ep.get('reserved_future_session_id'), str) and
            ep['reserved_future_session_id'] not in by_session,
            'CAPTURE_HOLDOUT_NOT_FROZEN')
    return {'train_views': len(views), 'locked_sessions': len(sessions),
            'distinct_calibrations': len({v['calibration_id'] for v in views})}


def decode_owner_local_png(path):
    try:
        from PIL import Image
    except ImportError:
        raise ValueError('CAPTURE_PILLOW_REQUIRED_FOR_REAL_PIXELS') from None
    with Image.open(path) as image:
        require(image.format == 'PNG' and image.width >= 1280 and image.height >= 720 and
                image.width <= 8192 and image.height <= 8192, 'CAPTURE_PNG_SIZE_OR_TYPE_INVALID')
        # Thumbnail is a diagnostic only; never substituted for the source bytes.
        img = image.convert('L')
        img.thumbnail((384, 256))
        data = list(img.tobytes())
        return [data[i:i + img.width] for i in range(0, len(data), img.width)]


def verify_capture(root, manifest, original_lock):
    root = Path(root).resolve()
    metadata = verify_locked_capture_metadata(manifest)
    # Reuse original World001 safety and geometry prerequisites, not a new authority.
    module = Path(__file__).with_name('world001-source-correction-preflight.py')
    require(module.is_file(), 'CAPTURE_EXISTING_PREFLIGHT_REQUIRED')
    spec = importlib.util.spec_from_file_location('world001_source_correction', module)
    upstream = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(upstream)
    verified = upstream.preflight(root, manifest, original_lock)
    require(verified['status'] == 'TRAIN_SOURCE_PACKET_FORMAT_VERIFIED_GEOMETRY_NOT_ACCEPTED',
            'CAPTURE_UPSTREAM_PREFLIGHT_REJECTED')
    flags = {}
    summary = []
    rejected = 0
    for view in manifest['views']:
        f = upstream.checked_file(root, view['file'])
        # Upstream has already authenticated the source file bytes.
        review = inspect_luma_grid(decode_owner_local_png(f))
        summary.append(review['metrics'])
        rejected += int(not review['diagnostic_pass'])
        for flag in review['flags']:
            flags[flag] = flags.get(flag, 0) + 1
    return {'schema': SCREEN, 'train_source_sha_verified': verified['source_files_sha_verified'],
            'train_frames_screened': len(summary), **metadata,
            'frames_below_diagnostic_screen': rejected,
            'diagnostic_worst_metrics': {
                'min_sharpness_estimate': min(x['laplacian_variance'] for x in summary),
                'max_clipping_fraction': max(max(x['clipped_black_fraction'], x['clipped_white_fraction']) for x in summary),
                'min_contrast': min(x['p90_minus_p10'] for x in summary),
                'min_corner_fraction': min(x['corner_fraction'] for x in summary),
                'min_gradient_axis_ratio': min(x['gradient_axis_ratio'] for x in summary)},
            'quality_flag_counts': dict(sorted(flags.items())),
            'all_frames_pass_diagnostic_screen': not flags,
            'capture_candidate_ready_for_reconstruction': bool(summary) and not flags,
            'independent_holdout_inspected': False, 'geometry_admitted': False,
            'splat_admitted': False, 'paid_compute_authorized': False,
            'native_human_scene_acceptance': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--trusted-w4-lock', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    src = Path(args.manifest)
    lock = Path(args.trusted_w4_lock)
    report = verify_capture(args.root, json.loads(src.read_text()), json.loads(lock.read_text()))
    out = Path(args.output)
    require(not out.exists() and out.resolve() != src.resolve(), 'CAPTURE_OUTPUT_OVERWRITE_DENIED')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, sort_keys=True, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'schema': SCREEN, 'train_frames_screened': report['train_frames_screened'],
                      'quality_flags': report['quality_flag_counts'],
                      'release_admitted': False}, sort_keys=True))


if __name__ == '__main__':
    main()
