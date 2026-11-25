"""Bounded synthetic test of the existing engine's pinned Gaussian CUDA stack.

No private media, model weights, network requests, physical geometry or acceptance.
Invoke only through captured-reality-gpu-smoke.mjs with a fresh protected prepaid reservation.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import time


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(case_path, output):
    started = time.monotonic()
    os.environ.update({"WANDB_MODE": "disabled", "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1"})
    import torch
    from gsplat import rasterization
    versions = {name: importlib.metadata.version(name) for name in ["nerfstudio", "gsplat", "torch", "numpy"]}
    if versions["nerfstudio"] != "1.1.5" or versions["gsplat"] != "1.4.0":
        raise RuntimeError("REVIEWED_ENGINE_PACKAGE_VERSION_MISMATCH")
    if not torch.cuda.is_available() or torch.cuda.device_count() != 1:
        raise RuntimeError("EXACTLY_ONE_CUDA_GPU_REQUIRED")
    case = json.loads(case_path.read_text())
    if case["classification"] != "SYNTHETIC_DIAGNOSTIC" or case["privateFamilySource"] is not False:
        raise RuntimeError("SYNTHETIC_INPUT_REQUIRED")
    torch.manual_seed(case["seed"])
    device = torch.device("cuda:0")
    means = torch.tensor(case["means"], dtype=torch.float32, device=device)
    count = len(case["means"])
    quats = torch.zeros(count, 4, device=device); quats[:, 0] = 1
    scales = torch.full((count, 3), case["scale"], device=device)
    opacities = torch.full((count,), case["opacity"], device=device)
    viewmats = torch.eye(4, device=device)[None]
    width, height = case["width"], case["height"]
    ks = torch.tensor([[[case["focal"], 0, width / 2], [0, case["focal"], height / 2], [0, 0, 1]]], device=device)
    target_colors = torch.tensor(case["targetColors"], device=device)

    def render(colors):
        return rasterization(means, quats, scales, opacities, colors, viewmats, ks, width, height,
                             packed=False, render_mode="RGB", near_plane=0.01, far_plane=10)[0]

    # Both target and candidate are explicitly synthetic source-independent data.
    with torch.no_grad():
        target = render(target_colors)
    colors = torch.full((count, 3), 0.25, device=device, requires_grad=True)
    optimizer = torch.optim.Adam([colors], lr=0.06)
    losses, gradients = [], []
    for _ in range(case["optimizationSteps"]):
        optimizer.zero_grad(set_to_none=True)
        pixels = render(colors)
        loss = (pixels - target).square().mean()
        if not torch.isfinite(loss):
            raise RuntimeError("CUDA_NONFINITE_LOSS")
        loss.backward()
        if colors.grad is None or not torch.isfinite(colors.grad).all():
            raise RuntimeError("CUDA_INVALID_GRADIENT")
        losses.append(float(loss.detach().cpu()))
        gradients.append(float(colors.grad.norm().detach().cpu()))
        optimizer.step()
    torch.cuda.synchronize()
    if max(gradients) <= 0 or losses[-1] >= losses[0]:
        raise RuntimeError("CUDA_OPTIMIZATION_DID_NOT_IMPROVE_SYNTHETIC_OBJECTIVE")
    output.mkdir(mode=0o700, parents=True, exist_ok=True)
    checkpoint = output / "synthetic-kernel-checkpoint.pt"
    torch.save({"classification": "SYNTHETIC_DIAGNOSTIC", "means": means.cpu(), "colors": colors.detach().cpu(),
                "caseSha256": digest(case_path), "familyReconstruction": False}, checkpoint)
    # These bytes are an actual CUDA-rendered synthetic view, never family pixels.
    from PIL import Image
    image = output / "synthetic-cuda-view.png"
    with torch.no_grad():
        view = render(colors).detach().clamp(0, 1).cpu().numpy()[0]
    Image.fromarray((view * 255).astype("uint8")).save(image)
    prop = torch.cuda.get_device_properties(0)
    gpu_query = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"],
                               check=True, capture_output=True, text=True, timeout=10).stdout.strip()
    receipt = {"schemaVersion": "urai-synthetic-gaussian-gpu-smoke-v1", "classification": "SYNTHETIC_DIAGNOSTIC",
               "privateFamilySource": False, "familyReconstruction": False, "navigationAccepted": False,
               "runtimeAccepted": False, "publicReleaseAuthorized": False, "gpuKernelExecuted": True,
               "sourceCaseSha256": digest(case_path), "scriptSha256": digest(Path(__file__)), "versions": versions,
               "cudaVersion": torch.version.cuda, "gpuModel": prop.name, "gpuCount": 1,
               "vramBytes": prop.total_memory, "gpuQuery": gpu_query, "gaussianCount": count,
               "imageDimensions": [width, height], "optimizationSteps": len(losses),
               "initialSyntheticLoss": losses[0], "finalSyntheticLoss": losses[-1],
               "nonzeroFiniteGradient": True, "elapsedSeconds": time.monotonic() - started,
               "peakAllocatedCudaBytes": torch.cuda.max_memory_allocated(),
               "actualProviderCostUsd": None, "providerCostReceiptRequired": True,
               "providerTerminationVerified": False,
               "artifacts": [{"name": p.name, "sha256": digest(p), "byteSize": p.stat().st_size} for p in [checkpoint, image]]}
    (output / "synthetic-gpu-receipt.json").write_text(json.dumps(receipt, sort_keys=True, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    run(args.case, args.output)
