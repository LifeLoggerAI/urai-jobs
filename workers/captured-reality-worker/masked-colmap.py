#!/usr/bin/env python3
"""Pass admitted native per-image masks to COLMAP before feature extraction.

Nerfstudio 1.1.5 invokes this file through its supported --colmap-cmd option.
This wrapper grants no source, compute, release or acceptance authority.
"""
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

NAME = re.compile(r"^\d{6}\.(png|jpg)$")
IMAGE_NAME = re.compile(r"^frame_\d{5}\.(png|jpg)$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
COMMANDS = {"feature_extractor", "exhaustive_matcher", "sequential_matcher",
            "vocab_tree_matcher", "mapper", "bundle_adjuster"}


def checked_file(path, maximum):
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= maximum:
        raise ValueError("MASK_SFM_FILE_INVALID")
    return path.read_bytes()


def load_authority(workspace, processed=False, expected_sha256=None):
    raw = checked_file(workspace / "sfm-mask-authority.json", 1024 * 1024)
    if expected_sha256 is not None and hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise ValueError("MASK_SFM_AUTHORITY_FIXITY_MISMATCH")
    manifest = json.loads(raw)
    entries = manifest.get("entries")
    if manifest.get("schemaVersion") != "urai-source-bound-sfm-mask-v1" or not isinstance(entries, list) or not 3 <= len(entries) <= 3000:
        raise ValueError("MASK_SFM_AUTHORITY_INVALID")
    mask_root = workspace / "05_colmap_processed" / "sfm-masks"
    expected_images = set()
    expected_sources = set()
    for index, item in enumerate(entries, start=1):
        source = item.get("sourceFilename", "")
        image_name = item.get("imageName", "")
        if not NAME.fullmatch(source) or not IMAGE_NAME.fullmatch(image_name) or image_name != f"frame_{index:05d}.{source.rsplit('.', 1)[1]}":
            raise ValueError("MASK_SFM_NAME_INVALID")
        if source in expected_sources or image_name in expected_images:
            raise ValueError("MASK_SFM_DUPLICATE_IMAGE")
        expected_sources.add(source)
        expected_images.add(image_name)
        if not SHA256.fullmatch(str(item.get("maskSha256", ""))) or not SHA256.fullmatch(str(item.get("sourceSha256", ""))):
            raise ValueError("MASK_SFM_HASH_INVALID")
        source_path = workspace / "04_frames_accepted" / source
        source_bytes = checked_file(source_path, 256 * 1024 * 1024)
        if len(source_bytes) != item.get("sourceByteSize") or hashlib.sha256(source_bytes).hexdigest() != item["sourceSha256"]:
            raise ValueError("MASK_SFM_SOURCE_FIXITY_MISMATCH")
        mask_path = mask_root / (image_name + ".png")
        mask_bytes = checked_file(mask_path, 64 * 1024 * 1024)
        if len(mask_bytes) != item.get("maskByteSize") or hashlib.sha256(mask_bytes).hexdigest() != item["maskSha256"]:
            raise ValueError("MASK_SFM_FIXITY_MISMATCH")
        with Image.open(mask_path) as mask:
            if mask.format != "PNG" or mask.mode not in {"1", "L"}:
                raise ValueError("MASK_SFM_GRAYSCALE_PNG_REQUIRED")
            dimensions = mask.size
            mask.verify()  # Validate PNG chunk CRCs; this does not decode IDAT.
        with Image.open(mask_path) as mask:
            mask.load()  # A valid header/CRC can still contain truncated pixels.
        if dimensions != (item.get("width"), item.get("height")) or not 0 < dimensions[0] <= 16384 or not 0 < dimensions[1] <= 16384 or dimensions[0] * dimensions[1] > 64 * 1024 * 1024:
            raise ValueError("MASK_SFM_DIMENSIONS_INVALID")
        with Image.open(source_path) as image:
            image.load()
            if image.size != dimensions:
                raise ValueError("MASK_SFM_SOURCE_DIMENSIONS_MISMATCH")
        if processed:
            image_path = workspace / "05_colmap_processed" / "images" / image_name
            checked_file(image_path, 256 * 1024 * 1024)
            with Image.open(image_path) as image:
                image.load()
                if image.size != dimensions:
                    raise ValueError("MASK_SFM_PROCESSED_DIMENSIONS_MISMATCH")
    if {p.name for p in (workspace / "04_frames_accepted").iterdir()} != expected_sources or {p.name for p in mask_root.iterdir()} != {name + ".png" for name in expected_images}:
        raise ValueError("MASK_SFM_COVERAGE_MISMATCH")
    if processed and {p.name for p in (workspace / "05_colmap_processed" / "images").iterdir()} != expected_images:
        raise ValueError("MASK_SFM_PROCESSED_COVERAGE_MISMATCH")
    return {"schemaVersion": "urai-native-colmap-mask-application-v1",
            "manifestSha256": hashlib.sha256(raw).hexdigest(), "maskedInputViews": len(entries),
            "maskFlag": "--ImageReader.mask_path", "nativeDimensionsVerified": True,
            "featureExtractionSucceeded": False, "candidateAcceptance": False,
            "publicReleaseAuthorized": False}


def argument_path(args, key):
    occurrences = [i for i, value in enumerate(args) if value == key or value.startswith(key + "=")]
    if len(occurrences) != 1:
        raise ValueError("MASK_SFM_COMMAND_PATH_INVALID")
    at = occurrences[0]
    value = args[at].split("=", 1)[1] if "=" in args[at] else args[at + 1]
    return Path(value).resolve()


def main(args):
    expected_sha256 = None
    if len(args) >= 2 and args[0] == "--authority-sha256":
        expected_sha256, args = args[1], args[2:]
        if not SHA256.fullmatch(expected_sha256):
            raise ValueError("MASK_SFM_AUTHORITY_HASH_INVALID")
    executable = shutil.which("colmap")
    if args == ["--validate-source"]:
        if expected_sha256 is None:
            raise ValueError("MASK_SFM_AUTHORITY_REQUIRED")
        receipt = load_authority(Path.cwd(), expected_sha256=expected_sha256)
        target = Path.cwd() / "sfm-mask-validation.json"
        with target.open("x") as output:
            json.dump(receipt, output)
        target.chmod(0o600)
        return 0
    if not executable:
        raise ValueError("MASK_SFM_COLMAP_UNAVAILABLE")
    if args == ["--check-support"]:
        result = subprocess.run([executable, "feature_extractor", "-h"], capture_output=True, timeout=30, check=False)
        if result.returncode or b"ImageReader.mask_path" not in result.stdout + result.stderr:
            raise ValueError("MASK_SFM_NATIVE_OPTION_UNAVAILABLE")
        return 0
    if args in (["-h"], ["--help"]):
        return subprocess.call([executable, *args])
    if not args or args[0] not in COMMANDS:
        raise ValueError("MASK_SFM_COMMAND_DENIED")
    receipt = None
    if args[0] == "feature_extractor":
        if expected_sha256 is None:
            raise ValueError("MASK_SFM_AUTHORITY_REQUIRED")
        if any(value.startswith(("--ImageReader.mask_path", "--ImageReader.camera_mask_path")) for value in args):
            raise ValueError("MASK_SFM_MASK_OVERRIDE_DENIED")
        workspace = Path.cwd()
        if argument_path(args, "--image_path") != workspace / "05_colmap_processed" / "images" or argument_path(args, "--database_path") != workspace / "05_colmap_processed" / "colmap" / "database.db":
            raise ValueError("MASK_SFM_COMMAND_PATH_INVALID")
        receipt = load_authority(workspace, processed=True, expected_sha256=expected_sha256)
        args = [*args, "--ImageReader.mask_path", str(workspace / "05_colmap_processed" / "sfm-masks")]
    result = subprocess.call([executable, *args])
    if result == 0 and receipt:
        receipt["featureExtractionSucceeded"] = True
        target = Path.cwd() / "sfm-mask-application.json"
        with target.open("x") as output:
            json.dump(receipt, output)
        target.chmod(0o600)
    return result


if __name__ == "__main__":
    try:
        code = main(sys.argv[1:])
    except Exception:
        sys.stderr.write("SOURCE_BOUND_SFM_MASK_DENIED\n")
        code = 1
    raise SystemExit(code)
