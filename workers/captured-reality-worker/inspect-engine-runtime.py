"""Record installed reconstruction tools without using media or credentials.

Build-time provenance only: it cannot attest a GPU, funding, source authority,
provider retention, training success, independent review or runtime acceptance.
"""
import argparse
import hashlib
import importlib.metadata
import json
import platform
import shutil
import subprocess
from pathlib import Path


def inspect_runtime():
    packages = {}
    for name in ["nerfstudio", "gsplat", "torch", "torchvision", "numpy", "opencv-python"]:
        try:
            dist = importlib.metadata.distribution(name)
        except importlib.metadata.PackageNotFoundError:
            if name == "opencv-python":
                dist = importlib.metadata.distribution("opencv-python-headless")
            else:
                raise RuntimeError("ENGINE_REQUIRED_PACKAGE_MISSING") from None
        packages[name] = {"version": dist.version,
                          "license": dist.metadata.get("License-Expression") or dist.metadata.get("License")}
    if packages["nerfstudio"]["version"] != "1.1.5":
        raise RuntimeError("ENGINE_REVIEWED_NERFSTUDIO_VERSION_MISMATCH")
    tools = {}
    for name, arguments in {
        "node": ["--version"], "python3": ["--version"], "ffmpeg": ["-version"],
        "colmap": ["-h"], "ns-process-data": ["--help"], "ns-train": ["--help"],
        "ns-export": ["--help"], "ns-eval": ["--help"]
    }.items():
        executable = shutil.which(name)
        if not executable:
            raise RuntimeError("ENGINE_REQUIRED_TOOL_MISSING")
        result = subprocess.run([executable, *arguments], stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                timeout=30, check=False, env={"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/tmp"})
        if result.returncode != 0 or len(result.stdout) > 1024 * 1024:
            raise RuntimeError("ENGINE_REQUIRED_TOOL_PROBE_FAILED")
        tools[name] = {"probe_sha256": hashlib.sha256(result.stdout).hexdigest(),
                       "version_line": result.stdout.decode("utf-8", errors="replace").splitlines()[0] if result.stdout else ""}
    import torch
    return {"schemaVersion": "urai-reconstruction-runtime-provenance-v1", "python": platform.python_version(),
            "os": platform.platform(), "packages": packages, "tools": tools,
            "torch_cuda_version": torch.version.cuda, "gpu_present_at_build": torch.cuda.is_available(),
            "gpu_training_executed": False, "provider_spend_authorized": False,
            "source_authority_verified": False, "candidateAcceptance": False,
            "publicReleaseAuthorized": False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        receipt = inspect_runtime()
    except Exception:
        raise SystemExit("ENGINE_RUNTIME_PROVENANCE_UNAVAILABLE") from None
    args.output.write_text(json.dumps(receipt, sort_keys=True, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
