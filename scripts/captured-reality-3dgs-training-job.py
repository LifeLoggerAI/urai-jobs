#!/usr/bin/env python3
"""Owner-private COLMAP v3 -> Nerfstudio 3DGS preparation, fail closed.

No network provisioning, payment, upload, or inferred human approval.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import subprocess

MIN_TEMPORAL_HOLDOUT_S = 2.0  # diagnostic floor, NOT sufficient for novel-view QA


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def private_file(root, rel):
    require(isinstance(rel, str) and rel and '\\' not in rel and not rel.startswith('/'), 'UNSAFE_PRIVATE_PATH')
    parts = Path(rel).parts
    require(all(part not in ('.', '..') for part in parts), 'UNSAFE_PRIVATE_PATH')
    file = root.joinpath(*parts)
    require(file.is_file() and not file.is_symlink() and file.resolve().is_relative_to(root.resolve()), 'SOURCE_FILE_UNAVAILABLE')
    return file


def model_reader():
    path = Path(__file__).with_name('captured-reality-colmap-track-repair.py')
    require(path.is_file(), 'COLMAP_MODEL_READER_REQUIRED')
    spec = importlib.util.spec_from_file_location('urai_colmap_reader', path)
    reader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reader)
    return reader


def inspect(source_root, model_root, admission=None):
    source_root, model_root = Path(source_root), Path(model_root)
    manifest_path = private_file(source_root, 'frame-manifest.json')
    manifest = json.loads(manifest_path.read_text())
    sfm = json.loads(private_file(source_root, 'sfm-input-receipt.json').read_text())
    require(sfm['input_manifest_sha256'] == sha(manifest_path), 'FRAME_MANIFEST_CHANGED')
    require(manifest['classification'] == 'PRIVATE_TRAINING_INPUT_NOT_RUNTIME_ASSET', 'FRAME_CLASSIFICATION_INVALID')
    require(sfm['classification'] == 'PRIVATE_CAMERA_SOLVE_DERIVATIVE', 'SFM_CLASSIFICATION_INVALID')
    by_id, candidates, holdouts = {}, [], []
    for frame in manifest['frames']:
        require(frame['id'] not in by_id and frame['split'] in ('candidate', 'holdout'), 'FRAME_ID_OR_SPLIT_INVALID')
        for field, checksum in (('frame', 'frame_sha256'), ('mask', 'mask_sha256')):
            require(sha(private_file(source_root, frame[field])) == frame[checksum], 'SOURCE_FRAME_OR_MASK_HASH_INVALID')
        by_id[frame['id']] = frame
        (candidates if frame['split'] == 'candidate' else holdouts).append(frame)
    require(len(candidates) == manifest['candidate_count'] and len(holdouts) == manifest['holdout_count']
            and candidates and holdouts, 'SOURCE_SPLIT_COUNT_INVALID')
    masked = {}
    for item in sfm['inputs']:
        require(item['id'] in by_id and by_id[item['id']]['split'] == 'candidate', 'MASKED_INPUT_SPLIT_LEAK')
        require(item['id'] not in masked, 'MASKED_INPUT_DUPLICATED')
        file = private_file(source_root, 'sfm-images/' + item['file'])
        require(sha(file) == item['sha256'], 'MASKED_INPUT_HASH_INVALID')
        masked[item['id']] = file
    require(len(masked) == len(candidates), 'MASKED_CANDIDATE_MISSING')
    reader = model_reader()
    hashes = {name: sha(private_file(model_root, name)) for name in ('cameras.bin', 'images.bin', 'points3D.bin')}
    cameras = reader.cameras_from((model_root / 'cameras.bin').read_bytes())
    images = reader.images_from((model_root / 'images.bin').read_bytes(), cameras)
    points = reader.points_from((model_root / 'points3D.bin').read_bytes())
    registered = {row['name'] for row in images.values()}
    require(len(registered) == len(images) and registered.issubset({f.name for f in masked.values()}), 'CAMERA_IMAGE_BINDING_INVALID')
    unregistered_ids = sorted(set(masked) - {Path(name).stem for name in registered})
    minimum = min((abs(float(a['source_timestamp_seconds']) - float(b['source_timestamp_seconds']))
                   for a in candidates for b in holdouts if a['source_part'] == b['source_part']), default=math.inf)
    require(math.isfinite(minimum), 'HOLDOUT_COMPARISON_UNAVAILABLE')
    admitted = False
    if admission is not None:
        reviewed = json.loads(Path(admission).read_text())
        admitted = reviewed.get('schema') == 'urai-private-3dgs-admission-1' and reviewed.get('training_permitted') is True \
            and reviewed.get('independent_geometry_review') is True \
            and reviewed.get('independent_novel_view_review') is True \
            and reviewed.get('source_manifest_sha256') == sha(manifest_path) \
            and reviewed.get('model_sha256') == hashes \
            and reviewed.get('acknowledged_excluded_training_ids') == unregistered_ids \
            and isinstance(reviewed.get('reviewer_id'), str) and len(reviewed['reviewer_id'].strip()) >= 3
    blockers = []
    if minimum < MIN_TEMPORAL_HOLDOUT_S:
        blockers.append('HOLDOUT_TEMPORAL_LEAKAGE')
    if len(registered) < math.ceil(len(candidates) * .9):
        blockers.append('INSUFFICIENT_REGISTERED_VIEWS')
    if not admitted:
        blockers.append('INDEPENDENT_ADMISSION_MISSING')
    return {
        'schema': 'urai-private-3dgs-preflight-1',
        'classification': 'PRIVATE_TRAINING_PREFLIGHT_NOT_PRODUCTION_ADMISSION',
        'source_manifest_sha256': sha(manifest_path),
        'v3_camera_hashes': hashes,
        'candidate_frames': len(candidates),
        'heldout_frames': len(holdouts),
        'registered_views': len(registered),
        'excluded_unregistered_ids': unregistered_ids,
        'sparse_points': len(points),
        'masked_training_inputs_verified': len(masked),
        'minimum_same_source_holdout_seconds': round(minimum, 4),
        'holdout_temporal_diagnostic_floor_seconds': MIN_TEMPORAL_HOLDOUT_S,
        'gpu_floor_vram_gb': 6,
        'runnable_commands': {
            'train': ['ns-train', 'splatfacto', '--data', '<PRIVATE_PREPARED_DATASET>'],
            'evaluate': ['ns-eval', '--load-config', '<TRAINED_CONFIG>', '--output-path', '<PRIVATE_EVALUATION_REPORT>'],
            'export': ['ns-export', 'gaussian-splat', '--load-config', '<TRAINED_CONFIG>', '--output-dir', '<PRIVATE_EXPORT_DIR>'],
        },
        'training_permitted': not blockers,
        'blockers': blockers,
    }, images, masked


def camera_transform(image):
    w, x, y, z = image['q']
    rotation = (
        (1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)),
        (2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)),
        (2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)),
    )
    center = [-sum(rotation[j][i]*image['t'][j] for j in range(3)) for i in range(3)]
    return [[rotation[j][i] * (1 if j == 0 else -1) for j in range(3)] + [center[i]] for i in range(3)] + [[0, 0, 0, 1]]


def prepare(source_root, model_root, destination, admission):
    receipt, images, masked = inspect(source_root, model_root, admission)
    require(receipt['training_permitted'], 'TRAINING_ADMISSION_BLOCKED:' + ','.join(receipt['blockers']))
    target = Path(destination)
    require(not target.exists(), 'REFUSE_OVERWRITE_PRIVATE_TRAINING_PACKAGE')
    target.mkdir(parents=True, mode=0o700)
    os.chmod(target, 0o700)
    (target / 'images').mkdir(mode=0o700)
    frames = []
    for img in images.values():
        image_name = img['name']
        shutil.copyfile(masked[Path(image_name).stem], target / 'images' / image_name)
        f, cx, cy, k, width, height = img['cam']
        frames.append({
            'file_path': 'images/' + image_name,
            'transform_matrix': camera_transform(img),
            'fl_x': f, 'fl_y': f, 'cx': cx, 'cy': cy, 'w': width, 'h': height,
            'k1': k, 'k2': 0, 'p1': 0, 'p2': 0,
        })
    (target / 'transforms.json').write_text(json.dumps({'camera_model':'OPENCV','frames':frames}, indent=2) + '\n')
    (target / 'input-fixity.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return target


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-root', required=True)
    p.add_argument('--model', required=True)
    p.add_argument('--admission')
    p.add_argument('--report', required=True)
    p.add_argument('--prepare-private-dir')
    p.add_argument('--execute', action='store_true')
    args = p.parse_args()
    receipt, _, _ = inspect(args.source_root, args.model, args.admission)
    report = Path(args.report)
    require(not report.exists(), 'REFUSE_OVERWRITE_RECEIPT')
    report.write_text(json.dumps(receipt, indent=2) + '\n')
    if args.prepare_private_dir:
        target = prepare(args.source_root, args.model, args.prepare_private_dir, args.admission)
        if args.execute:
            require(shutil.which('ns-train') is not None, 'NERFSTUDIO_NOT_INSTALLED')
            import torch
            require(torch.cuda.is_available(), 'CUDA_GPU_UNAVAILABLE')
            require(os.environ.get('URAI_APPROVED_PRIVATE_GPU_SESSION') == 'yes', 'EXPLICIT_GPU_SESSION_APPROVAL_REQUIRED')
            require(args.admission and os.environ.get('URAI_APPROVED_TRAINING_ADMISSION_SHA256') == sha(Path(args.admission)), 'INDEPENDENT_ADMISSION_FIXITY_APPROVAL_REQUIRED')
            subprocess.run(['ns-train', 'splatfacto', '--data', str(target)], check=True)
    elif args.execute:
        raise ValueError('EXECUTION_REQUIRES_PRIVATE_PREPARED_DATA')
    print(json.dumps({'training_permitted': receipt['training_permitted'], 'blockers': receipt['blockers']}, indent=2))


if __name__ == '__main__':
    main()
