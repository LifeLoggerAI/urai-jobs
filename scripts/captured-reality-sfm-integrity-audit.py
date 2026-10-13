#!/usr/bin/env python3
"""Audit a private camera-solve handoff without releasing source media.

Source integrity and camera geometry are necessary but never sufficient for
Gaussian training, navigable Replay, metric scale, or Gold Master approval.
No filesystem paths, source filenames, images or person details enter stdout.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import sys

# A pixel-exact mask check needs Pillow. Absence blocks validation; it never
# converts an unverifiable frame into an approved training input.

SHA = re.compile(r"^[a-f0-9]{64}$")
FRAME = re.compile(r"^(candidate|holdout)_[0-9]{3}\.png$")
MAX_JSON = 4 * 1024 * 1024
MAX_FILE = 256 * 1024 * 1024
MAX_BINARY = 128 * 1024 * 1024


class AuditFailure(Exception):
    pass


def require(ok, code):
    if not ok:
        raise AuditFailure(code)


def private_file(root, rel, max_bytes=MAX_FILE):
    require(isinstance(rel, str) and 0 < len(rel) <= 160
            and not rel.startswith(("/", "\\")) and "\\" not in rel
            and all(p not in ("", ".", "..") for p in rel.split("/")), "SOURCE_PATH_INVALID")
    p = root / rel
    current = root
    for name in rel.split("/"):
        current /= name
        require(not current.is_symlink(), "SOURCE_SYMLINK_DENIED")
    require(p.is_file() and p.resolve().is_relative_to(root), "SOURCE_FILE_MISSING")
    require(0 < p.stat().st_size <= max_bytes, "SOURCE_FILE_BUDGET_INVALID")
    return p


def read_json(root, rel):
    p = private_file(root, rel, MAX_JSON)
    try:
        result = json.loads(p.read_bytes())
    except (ValueError, UnicodeError):
        raise AuditFailure("SOURCE_JSON_INVALID") from None
    require(isinstance(result, dict), "SOURCE_JSON_OBJECT_REQUIRED")
    return result


def digest(p):
    with p.open("rb") as file:
        h = hashlib.sha256()
        while block := file.read(1024 * 1024):
            h.update(block)
        return h.hexdigest()


def png_size(p):
    with p.open("rb") as file:
        data = file.read(24)
    require(len(data) == 24 and data[:8] == b"\x89PNG\r\n\x1a\n"
            and data[12:16] == b"IHDR", "SOURCE_PNG_INVALID")
    w, h = struct.unpack_from(">II", data, 16)
    require(1 <= w <= 8192 and 1 <= h <= 8192, "SOURCE_PNG_DIMENSIONS_INVALID")
    return (w, h)


def verify_mask_derivative(source_path, mask_path, derivative_path):
    """Prove the SfM image contains exactly the mask-admitted source pixels.

    File hashes alone do not prove a processing receipt's privacy assertion:
    an attacker could hash unrelated images and put those hashes in a receipt.
    This deliberately checks pixels independently of the receipt issuer.
    """
    try:
        from PIL import Image, ImageChops
    except ImportError:
        raise AuditFailure("MASK_PIXEL_VALIDATOR_UNAVAILABLE") from None
    try:
        with Image.open(source_path) as src, Image.open(mask_path) as raw_mask, Image.open(derivative_path) as out:
            require(src.size == raw_mask.size == out.size, "MASK_PIXEL_DIMENSIONS_INVALID")
            require(src.size[0] * src.size[1] <= 8192 * 8192, "MASK_PIXEL_BUDGET_INVALID")
            source, mask, actual = src.convert("RGB"), raw_mask.convert("L"), out.convert("RGB")
            mn, mx = mask.getextrema()
            require(mn == 0 and mx == 255, "MASK_NOT_CONSERVATIVE")
            counts = mask.histogram()
            require(sum(counts[1:255]) == 0, "MASK_NOT_BINARY")
            expected = Image.new("RGB", source.size, "black")
            expected.paste(source, mask=mask)
            require(ImageChops.difference(expected, actual).getbbox() is None, "MASK_PIXEL_DERIVATION_INVALID")
    except (OSError, ValueError) as exc:
        raise AuditFailure("MASK_PIXEL_DECODE_INVALID") from exc


def model_cameras(p):
    data = p.read_bytes()
    require(8 <= len(data) <= MAX_BINARY, "CAMERA_INTRINSICS_BUDGET_INVALID")
    total = struct.unpack_from("<Q", data, 0)[0]
    require(1 <= total <= 3000, "CAMERA_INTRINSICS_COUNT_INVALID")
    # COLMAP camera model id to intrinsic parameter count.
    param_count = {0: 3, 1: 4, 2: 4, 3: 5, 4: 8, 5: 8, 6: 12, 7: 5, 8: 4, 9: 5, 10: 12}
    off, cams, sizes = 8, set(), set()
    for _ in range(total):
        require(off + 24 <= len(data), "CAMERA_INTRINSICS_TRUNCATED")
        cam_id, model_id, width, height = struct.unpack_from("<iiQQ", data, off)
        off += 24
        require(cam_id > 0 and cam_id not in cams and model_id in param_count,
                "CAMERA_INTRINSICS_INVALID")
        require(1 <= width <= 8192 and 1 <= height <= 8192, "CAMERA_INTRINSICS_DIMENSIONS_INVALID")
        count = param_count[model_id]
        require(off + 8 * count <= len(data), "CAMERA_INTRINSICS_TRUNCATED")
        params = struct.unpack_from("<" + "d" * count, data, off)
        off += 8 * count
        require(all(math.isfinite(v) and abs(v) <= 1e7 for v in params)
                and params[0] > 0 and .05 < params[0] / max(width, height) < 20,
                "CAMERA_INTRINSICS_INVALID")
        cams.add(cam_id)
        sizes.add((width, height))
    require(off == len(data), "CAMERA_INTRINSICS_TRAILING_DATA")
    return {"ids": cams, "sizes": sizes}


def model_images(p):
    data = p.read_bytes()
    require(len(data) <= MAX_BINARY and len(data) >= 8, "CAMERA_MODEL_BUDGET_INVALID")
    count = struct.unpack_from("<Q", data, 0)[0]
    require(1 <= count <= 3000, "CAMERA_COUNT_INVALID")
    off = 8
    names = set()
    ids = set()
    camera_ids = set()
    centers = []
    observations = 0
    linked_observations = 0
    observation_point_ids = {}
    for _ in range(count):
        require(off + 64 <= len(data), "CAMERA_MODEL_TRUNCATED")
        v = struct.unpack_from("<i4d3di", data, off)
        off += 64
        end = data.find(b"\x00", off, min(len(data), off + 160))
        require(end >= 0, "CAMERA_NAME_INVALID")
        try:
            name = data[off:end].decode("ascii")
        except UnicodeError:
            raise AuditFailure("CAMERA_NAME_INVALID") from None
        off = end + 1
        require(bool(FRAME.fullmatch(name)) and name.startswith("candidate_")
                and name not in names, "CAMERA_NAME_INVALID")
        names.add(name)
        require(v[0] > 0 and v[0] not in ids and v[8] > 0, "CAMERA_IDENTITY_INVALID")
        ids.add(v[0]); camera_ids.add(v[8])
        require(off + 8 <= len(data), "CAMERA_MODEL_TRUNCATED")
        pts = struct.unpack_from("<Q", data, off)[0]
        off += 8
        require(pts <= 1000000 and observations + pts <= 2000000
                and off + pts * 24 <= len(data), "CAMERA_OBSERVATIONS_INVALID")
        point_ids = []
        linked_in_image = set()
        for obs_index in range(pts):
            px, py, point_id = struct.unpack_from("<ddq", data, off + obs_index * 24)
            require(math.isfinite(px) and math.isfinite(py)
                    and abs(px) <= 1e7 and abs(py) <= 1e7
                    and (point_id == -1 or point_id > 0), "CAMERA_OBSERVATIONS_INVALID")
            if point_id > 0:
                require(point_id not in linked_in_image, "CAMERA_POINT_DUPLICATE_OBSERVATION")
                linked_in_image.add(point_id)
                linked_observations += 1
            point_ids.append(point_id)
        observation_point_ids[v[0]] = point_ids
        off += pts * 24
        observations += pts
        q = v[1:5]
        t = v[5:8]
        require(all(math.isfinite(x) for x in q + t)
                and abs(sum(x * x for x in q) - 1.0) < 0.001, "CAMERA_POSE_INVALID")
        w, x, y, z = q
        rot = ((1 - 2*(y*y + z*z), 2*(x*y-z*w), 2*(x*z+y*w)),
               (2*(x*y+z*w), 1 - 2*(x*x + z*z), 2*(y*z-x*w)),
               (2*(x*z-y*w), 2*(y*z+x*w), 1 - 2*(x*x+y*y)))
        center = tuple(-sum(rot[j][i] * t[j] for j in range(3)) for i in range(3))
        require(all(math.isfinite(a) for a in center), "CAMERA_POSE_INVALID")
        centers.append(center)
    require(off == len(data), "CAMERA_MODEL_TRAILING_DATA")
    spans = [max(c[i] for c in centers) - min(c[i] for c in centers) for i in range(3)]
    require(sum(v * v for v in spans) > 1e-12, "CAMERA_BASELINE_DEGENERATE")
    return {"count": count, "names": names, "ids": ids, "camera_ids": camera_ids,
            "observations": observations, "linked_observations": linked_observations,
            "observation_point_ids": observation_point_ids, "spans": spans}


def model_points(p, observation_point_ids):
    data = p.read_bytes()
    require(8 <= len(data) <= MAX_BINARY, "POINT_MODEL_BUDGET_INVALID")
    count = struct.unpack_from("<Q", data, 0)[0]
    require(1 <= count <= 2000000, "POINT_COUNT_INVALID")
    off = 8
    errors = []
    track_images = set()
    point_ids = set()
    validated_backrefs = 0
    for _ in range(count):
        require(off + 51 <= len(data), "POINT_MODEL_TRUNCATED")
        row = struct.unpack_from("<QdddBBBdQ", data, off)
        off += 51
        err, track = row[7], row[8]
        require(row[0] > 0 and row[0] not in point_ids, "POINT_IDENTITY_INVALID")
        point_ids.add(row[0])
        require(all(math.isfinite(x) for x in row[1:4])
                and math.isfinite(err) and err >= 0 and 2 <= track <= 3000
                and off + track*8 <= len(data), "POINT_MODEL_INVALID")
        images_for_point = set()
        for index in range(track):
            image_id, point2d_id = struct.unpack_from("<ii", data, off + index*8)
            require(image_id > 0 and point2d_id >= 0 and image_id not in images_for_point,
                    "POINT_TRACK_INVALID")
            image_observations = observation_point_ids.get(image_id)
            require(image_observations is not None and point2d_id < len(image_observations)
                    and image_observations[point2d_id] == row[0], "POINT_TRACK_BACKREF_INVALID")
            validated_backrefs += 1
            images_for_point.add(image_id)
            track_images.add(image_id)
        off += track * 8
        errors.append(err)
    require(off == len(data), "POINT_MODEL_TRAILING_DATA")
    return {"count": count, "mean_error": sum(errors) / count,
            "track_images": track_images, "validated_backrefs": validated_backrefs}


def audit(root):
    root = Path(root).resolve(strict=True)
    require(root.is_dir(), "SOURCE_ROOT_INVALID")
    manifest = read_json(root, "frame-manifest.json")
    indexed = read_json(root, "sfm-input-receipt.json")
    require(indexed.get("input_manifest_sha256") == digest(private_file(root,"frame-manifest.json")),
            "SFM_SOURCE_MANIFEST_BINDING_INVALID")
    quality = read_json(root, "camera-solve-pycolmap-4.2.0/camera-solve-quality.json")
    solve = read_json(root, "camera-solve-pycolmap-4.2.0/camera-solve-receipt.json")
    require(manifest.get("schema") == "urai-private-static-subset-v1"
            and manifest.get("classification") == "PRIVATE_TRAINING_INPUT_NOT_RUNTIME_ASSET",
            "SOURCE_CLASSIFICATION_INVALID")
    require(indexed.get("schema") == "urai-private-masked-sfm-input-v1"
            and indexed.get("classification") == "PRIVATE_CAMERA_SOLVE_DERIVATIVE"
            and solve.get("classification") == "CAMERA_SOLVE_NOT_GAUSSIAN_RECONSTRUCTION",
            "SOLVE_CLASSIFICATION_INVALID")
    frames = manifest.get("frames")
    require(isinstance(frames, list) and 5 <= len(frames) <= 3000, "SOURCE_FRAME_SET_INVALID")
    by_name = {}
    seen_fixes = set()
    split_times = {"candidate": [], "holdout": []}
    parts = manifest.get("source_parts")
    require(isinstance(parts, list) and 1 <= len(parts) <= 3000
            and all(isinstance(p, dict) and isinstance(p.get("name"), str) and p["name"] for p in parts),
            "SOURCE_PART_MANIFEST_INVALID")
    source_part_names = {p["name"] for p in parts}
    require(len(source_part_names) == len(parts), "SOURCE_PART_MANIFEST_INVALID")
    candidates = 0
    holdouts = 0
    for f in frames:
        require(isinstance(f, dict) and f.get("split") in ("candidate", "holdout")
                and isinstance(f.get("id"), str) and f["id"] + ".png" == Path(str(f.get("frame", ""))).name,
                "SOURCE_FRAME_IDENTITY_INVALID")
        name = f["id"] + ".png"
        require(FRAME.fullmatch(name) and name not in by_name and name.startswith(f["split"] + "_"),
                "SOURCE_FRAME_IDENTITY_INVALID")
        by_name[name] = f
        seconds = f.get("source_timestamp_seconds")
        require(type(seconds) in (int, float) and math.isfinite(seconds) and 0 <= seconds <= 86400
                and f.get("source_part") in source_part_names, "SOURCE_TIME_PROVENANCE_INVALID")
        split_times[f["split"]].append((f["source_part"],float(seconds)))
        for field, key in (("frame", "frame_sha256"), ("mask", "mask_sha256")):
            ref = f.get(field)
            expected = f.get(key)
            require(isinstance(expected, str) and SHA.fullmatch(expected) and isinstance(ref, str),
                    "SOURCE_FIXITY_MISSING")
            fn = private_file(root, ref)
            require(digest(fn) == expected, "SOURCE_FIXITY_MISMATCH")
        frame = private_file(root, f["frame"])
        mask = private_file(root, f["mask"])
        require(png_size(frame) == png_size(mask), "MASK_DIMENSIONS_MISMATCH")
        require(f["frame_sha256"] not in seen_fixes, "SOURCE_DUPLICATE_FRAME")
        seen_fixes.add(f["frame_sha256"])
        if f["split"] == "candidate": candidates += 1
        else: holdouts += 1
    require(candidates == manifest.get("candidate_count") and holdouts == manifest.get("holdout_count")
            and candidates >= 5 and holdouts >= 1, "SOURCE_SPLIT_INVALID")
    ins = indexed.get("inputs")
    require(isinstance(ins, list) and len(ins) == candidates, "SFM_INPUT_COVERAGE_INVALID")
    processed = set()
    for f in ins:
        require(isinstance(f, dict) and isinstance(f.get("file"), str)
                and f["file"] in by_name and f["file"] not in processed
                and f["file"].startswith("candidate_") and f.get("id") + ".png" == f["file"],
                "SFM_INPUT_IDENTITY_INVALID")
        processed.add(f["file"])
        require(isinstance(f.get("sha256"), str) and SHA.fullmatch(f["sha256"]), "SFM_INPUT_FIXITY_MISSING")
        fn = private_file(root, "sfm-images/" + f["file"])
        require(digest(fn) == f["sha256"] and png_size(fn) == png_size(private_file(root,by_name[f["file"]]["frame"])),
                "SFM_INPUT_FIXITY_MISMATCH")
        frame = by_name[f["file"]]
        verify_mask_derivative(private_file(root,frame["frame"]), private_file(root,frame["mask"]),fn)
    require(processed == {x for x in by_name if x.startswith("candidate_")}, "SFM_INPUT_COVERAGE_INVALID")
    model_base = "camera-solve-pycolmap-4.2.0/models/0/"
    cameras = model_cameras(private_file(root, model_base + "cameras.bin", MAX_BINARY))
    images = model_images(private_file(root, model_base + "images.bin", MAX_BINARY))
    points = model_points(private_file(root, model_base + "points3D.bin", MAX_BINARY),
                          images["observation_point_ids"])
    require(points["validated_backrefs"] == images["linked_observations"],
            "POINT_TRACK_BACKREF_INCOMPLETE")
    require(images["names"].issubset(processed), "CAMERA_SOURCE_UNRECOGNIZED")
    require(images["camera_ids"].issubset(cameras["ids"]) and points["track_images"].issubset(images["ids"]),
            "CAMERA_POINT_TRACK_LINK_INVALID")
    candidate_dimensions = {png_size(private_file(root, by_name[name]["frame"])) for name in processed}
    require(cameras["sizes"].issubset(candidate_dimensions), "CAMERA_INTRINSICS_DIMENSIONS_MISMATCH")
    require(images["count"] / candidates >= 0.85, "CAMERA_REGISTRATION_BELOW_FLOOR")
    require(solve.get("models") and solve["models"][0].get("registered_images") == images["count"]
            and solve["models"][0].get("points3d") == points["count"], "CAMERA_RECEIPT_MISMATCH")
    require(quality.get("registered_images") == images["count"]
            and quality.get("points3d") == points["count"], "CAMERA_QUALITY_MISMATCH")
    mean = quality.get("reprojection_error_px", {}).get("mean")
    require(isinstance(mean, (int, float)) and math.isfinite(mean)
            and mean <= 1.5 and abs(mean - points["mean_error"]) <= 0.0001,
            "CAMERA_REPROJECTION_INVALID")
    require(quality.get("scale_note") and "unscaled" in quality["scale_note"].lower(),
            "METRIC_SCALE_MISREPRESENTED")
    distances = [abs(candidate_t - holdout_t) for source_a,candidate_t in split_times["candidate"]
                 for source_b,holdout_t in split_times["holdout"] if source_a == source_b]
    min_holdout_sep = min(distances) if distances else None
    # Separate part *names* cannot prove separate original captures or sessions.
    # When no same-part comparison exists, provenance is insufficient: fail closed.
    temporal_isolation = min_holdout_sep is not None and min_holdout_sep >= 1.0
    return {"schemaVersion": "urai-private-sfm-integrity-audit-v2",
            "classification": "REAL_SOURCE_SPARSE_CAMERA_SOLVE_ONLY",
            "technicalInputIntegrityVerified": True,
            "candidateViews": candidates, "holdoutViews": holdouts,
            "registeredViews": images["count"], "sparsePoints": points["count"],
            "reprojectionMeanPx": round(points["mean_error"], 6),
            "maskFileFixityVerified": True, "maskedSfmPixelDerivationVerified": True,
            "maskPixelsIndependentlyInspected": False, "cameraIntrinsicsVerified": True,
            "sourceManifestBindingVerified": True,
            "minSamePartHoldoutSeparationSeconds": None if min_holdout_sep is None else round(min_holdout_sep,6),
            "temporalHoldoutIsolationVerified": temporal_isolation,
            "independentCaptureSessionVerified": False,
            "heldoutRadianceMetricsAccepted": False,
            "holdoutSeparationFromSfmInputVerified": True,
            "metricScaleVerified": False, "trainingExecuted": False,
            "gaussianAssetProduced": False, "navigationAccepted": False,
            "literalVisualAccepted": False, "familyIdentityAccepted": False,
            "privateRuntimeIntegrated": False, "publicReleaseAuthorized": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_root", help="unpacked private camera-solve package root")
    parser.add_argument("--receipt", help="write minimized result with mode 0600")
    parser.add_argument("--require-temporal-holdout", action="store_true",
                        help="block evaluation on same-source frames closer than 1 second")
    args = parser.parse_args(argv)
    try:
        result = audit(args.source_root)
        if args.require_temporal_holdout and not result["temporalHoldoutIsolationVerified"]:
            raise AuditFailure("TEMPORAL_HOLDOUT_LEAKAGE")
    except (AuditFailure, FileNotFoundError, OSError, ValueError, struct.error, TypeError, KeyError) as e:
        code = str(e) if isinstance(e, AuditFailure) else "SFM_SOURCE_INVALID"
        print(json.dumps({"status": "BLOCKED", "code": code, "candidateAcceptance": False}), file=sys.stdout)
        return 1
    if args.receipt:
        target = Path(args.receipt)
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        fd = os.open(target, flags, 0o600)
        with os.fdopen(fd, "w") as file:
            json.dump(result, file, indent=2)
            file.write("\n")
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())