"""Native source/mask parser and COLMAP invocation boundary, synthetic only."""
import hashlib
import importlib.util
import json
import os
import tempfile
import unittest
import struct
import zlib
from pathlib import Path
from unittest.mock import patch

from PIL import Image

MODULE = Path(__file__).resolve().parents[1] / "workers/captured-reality-worker/masked-colmap.py"
spec = importlib.util.spec_from_file_location("masked_colmap", MODULE)
masked_colmap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(masked_colmap)


class NativeMaskBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp.name)
        self.previous_cwd = Path.cwd()
        os.chdir(self.workspace)
        for relative in ["04_frames_accepted", "05_colmap_processed/images", "05_colmap_processed/sfm-masks"]:
            (self.workspace / relative).mkdir(parents=True)
        self.entries = []
        # Every input, including a reserved validation/test view, needs its own
        # admitted native mask. No camera solve or training takes place here.
        for index, extension in enumerate(["png", "jpg", "png"], start=1):
            source_name, image_name = f"{index:06d}.{extension}", f"frame_{index:05d}.{extension}"
            source = self.workspace / "04_frames_accepted" / source_name
            processed = self.workspace / "05_colmap_processed/images" / image_name
            Image.new("RGB", (16, 24), color=(index * 30, 80, 140)).save(source)
            processed.write_bytes(source.read_bytes())
            mask = self.workspace / "05_colmap_processed/sfm-masks" / (image_name + ".png")
            Image.new("L", (16, 24), color=0 if index == 3 else 255).save(mask)
            self.entries.append({"sourceFilename": source_name, "imageName": image_name,
                                 "sourceSha256": self.digest(source), "sourceByteSize": source.stat().st_size,
                                 "maskSha256": self.digest(mask), "maskByteSize": mask.stat().st_size,
                                 "width": 16, "height": 24})
        self.save_authority()

    def tearDown(self):
        os.chdir(self.previous_cwd)
        self.temp.cleanup()

    def digest(self, path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def save_authority(self):
        self.authority = self.workspace / "sfm-mask-authority.json"
        self.authority.write_text(json.dumps({"schemaVersion": "urai-source-bound-sfm-mask-v1", "entries": self.entries}))

    def args(self):
        return ["--authority-sha256", self.digest(self.authority), "feature_extractor", "--image_path", str(self.workspace / "05_colmap_processed/images"),
                "--database_path", str(self.workspace / "05_colmap_processed/colmap/database.db")]

    def denied_before_native(self):
        with patch.object(masked_colmap.shutil, "which", return_value="/native/colmap"), patch.object(masked_colmap.subprocess, "call") as native:
            with self.assertRaises(Exception):
                masked_colmap.main(self.args())
            native.assert_not_called()
            self.assertFalse((self.workspace / "sfm-mask-application.json").exists())

    def test_all_images_have_correct_double_extension_mask_before_feature_command(self):
        self.assertEqual(masked_colmap.main(["--authority-sha256", self.digest(self.authority), "--validate-source"]), 0)
        with patch.object(masked_colmap.shutil, "which", return_value="/native/colmap"), patch.object(masked_colmap.subprocess, "call", return_value=0) as native:
            self.assertEqual(masked_colmap.main(self.args()), 0)
            arguments = native.call_args.args[0]
            self.assertEqual(arguments[-2:], ["--ImageReader.mask_path", str(self.workspace / "05_colmap_processed/sfm-masks")])
        receipt = json.loads((self.workspace / "sfm-mask-application.json").read_text())
        self.assertEqual(receipt["maskedInputViews"], 3)
        self.assertEqual(receipt["manifestSha256"], self.digest(self.authority))
        self.assertTrue(receipt["featureExtractionSucceeded"])
        self.assertFalse(receipt["candidateAcceptance"])

    def test_missing_reserved_view_mask(self):
        (self.workspace / "05_colmap_processed/sfm-masks/frame_00003.png.png").unlink()
        self.denied_before_native()

    def test_malformed_png_with_matching_admitted_hash(self):
        mask = self.workspace / "05_colmap_processed/sfm-masks/frame_00001.png.png"
        mask.write_bytes(b"\x89PNG\r\n\x1a\n" + b"bad-native-png-header" * 3)
        self.entries[0].update(maskSha256=self.digest(mask), maskByteSize=mask.stat().st_size)
        self.save_authority()
        self.denied_before_native()

    def test_valid_png_with_wrong_native_dimensions(self):
        mask = self.workspace / "05_colmap_processed/sfm-masks/frame_00001.png.png"
        Image.new("L", (24, 16), 255).save(mask)
        self.entries[0].update(maskSha256=self.digest(mask), maskByteSize=mask.stat().st_size, width=24, height=16)
        self.save_authority()
        self.denied_before_native()

    def test_truncated_idat_with_valid_png_header_and_chunk_crcs(self):
        def chunk(kind, data):
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
        mask = self.workspace / "05_colmap_processed/sfm-masks/frame_00001.png.png"
        mask.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 16, 24, 8, 0, 0, 0, 0))
                         + chunk(b"IDAT", zlib.compress(b"\x00\xff")) + chunk(b"IEND", b""))
        with Image.open(mask) as png:
            png.verify()  # This intentionally passes: IDAT needs actual decode.
        self.entries[0].update(maskSha256=self.digest(mask), maskByteSize=mask.stat().st_size)
        self.save_authority()
        self.denied_before_native()

    def test_tampered_source(self):
        (self.workspace / "04_frames_accepted/000001.png").write_bytes(b"tampered-source")
        self.denied_before_native()

    def test_tampered_mask(self):
        mask = self.workspace / "05_colmap_processed/sfm-masks/frame_00001.png.png"
        Image.new("L", (16, 24), 0).save(mask)
        self.denied_before_native()

    def test_resized_processed_image(self):
        Image.new("RGB", (8, 12)).save(self.workspace / "05_colmap_processed/images/frame_00001.png")
        self.denied_before_native()

    def test_symlink_mask(self):
        mask = self.workspace / "05_colmap_processed/sfm-masks/frame_00001.png.png"
        original = self.workspace / "original-mask.png"
        mask.rename(original)
        mask.symlink_to(original)
        self.denied_before_native()

    def test_mask_flag_override(self):
        with patch.object(masked_colmap.shutil, "which", return_value="/native/colmap"), patch.object(masked_colmap.subprocess, "call") as native:
            with self.assertRaises(Exception):
                masked_colmap.main([*self.args(), "--ImageReader.mask_path=/unverified"])
            native.assert_not_called()

    def test_native_extraction_failure_creates_no_success_receipt(self):
        with patch.object(masked_colmap.shutil, "which", return_value="/native/colmap"), patch.object(masked_colmap.subprocess, "call", return_value=1):
            self.assertEqual(masked_colmap.main(self.args()), 1)
            self.assertFalse((self.workspace / "sfm-mask-application.json").exists())

    def test_changed_authority_cannot_use_earlier_binding(self):
        args = self.args()
        self.entries[0]["maskSha256"] = "a" * 64
        self.save_authority()
        with patch.object(masked_colmap.shutil, "which", return_value="/native/colmap"), patch.object(masked_colmap.subprocess, "call") as native:
            with self.assertRaises(Exception):
                masked_colmap.main(args)
            native.assert_not_called()


if __name__ == "__main__":
    unittest.main()
