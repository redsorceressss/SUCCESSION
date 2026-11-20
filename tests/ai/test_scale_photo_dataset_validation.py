"""Phase 9.2 dataset validation tests (read-only, uses temporary fixtures)."""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

from real_world_evaluation.runners.validate_scale_photos_dataset import validate_annotations


def _write_img(path: Path, color=(255, 255, 255)) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = np.full((40, 120, 3), color, dtype=np.uint8)
    assert cv2.imwrite(str(path), img)


def _base_record(dataset_root: Path, image_id: str = "img1", fname: str = "img1.jpg") -> dict:
    return {
        "image_id": image_id,
        "image_file": f"raw/{fname}",
        "image_width": 120,
        "image_height": 40,
        "display_bounding_box": {"x_min": 10, "y_min": 5, "x_max": 110, "y_max": 35},
        "display_text": "12.34 g",
        "weight_value": "12.34",
        "unit": "g",
        "readability": "readable",
        "scale_type": "green_led",
        "lighting_condition": "normal",
        "camera_angle": "front",
        "device_id": "devA",
        "capture_session_id": "sess1",
        "annotation_status": "verified",
    }


def _write_annotations(path: Path, records) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(records), encoding="utf-8")


def test_valid_record_passes(tmp_path: Path):
    ds = tmp_path / "scale_photos"
    _write_img(ds / "raw/img1.jpg")
    ann = ds / "annotated/annotations.json"
    _write_annotations(ann, [_base_record(ds)])
    report = validate_annotations(ds, ann)
    assert report["summary"]["error_count"] == 0
    assert report["summary"]["total_records"] == 1
    assert report["summary"]["missing_image_files"] == 0


def test_malformed_record_missing_required_field(tmp_path: Path):
    ds = tmp_path / "scale_photos"
    _write_img(ds / "raw/img1.jpg")
    ann = ds / "annotated/annotations.json"
    rec = _base_record(ds)
    del rec["readability"]
    _write_annotations(ann, [rec])
    report = validate_annotations(ds, ann)
    assert report["summary"]["error_count"] > 0
    codes = {i["code"] for i in report["issues"]}
    assert "missing_required_field" in codes


def test_missing_image_detected(tmp_path: Path):
    ds = tmp_path / "scale_photos"
    ann = ds / "annotated/annotations.json"
    _write_annotations(ann, [_base_record(ds, "missing1", "missing1.jpg")])
    report = validate_annotations(ds, ann)
    assert report["summary"]["missing_image_files"] == 1
    codes = {i["code"] for i in report["issues"]}
    assert "image_missing" in codes or "image_path_unresolved" in codes


def test_invalid_bounding_box_detected(tmp_path: Path):
    ds = tmp_path / "scale_photos"
    _write_img(ds / "raw/img1.jpg")
    ann = ds / "annotated/annotations.json"
    rec = _base_record(ds)
    rec["display_bounding_box"] = {"x_min": 100, "y_min": 5, "x_max": 50, "y_max": 35}  # x_max < x_min
    _write_annotations(ann, [rec])
    report = validate_annotations(ds, ann)
    codes = {i["code"] for i in report["issues"]}
    assert "bbox_out_of_bounds" in codes or "bbox_invalid_keys" in codes or "bbox_invalid_values" in codes


def test_duplicate_images_detected_by_id_and_content(tmp_path: Path):
    ds = tmp_path / "scale_photos"
    _write_img(ds / "raw/img1.jpg", color=(200, 200, 200))
    _write_img(ds / "raw/img2.jpg", color=(200, 200, 200))  # identical content
    ann = ds / "annotated/annotations.json"
    rec1 = _base_record(ds, "dup1", "img1.jpg")
    rec2 = _base_record(ds, "dup1", "img2.jpg")  # duplicate image_id
    rec3 = _base_record(ds, "dup2", "img2.jpg")
    _write_annotations(ann, [rec1, rec2, rec3])
    report = validate_annotations(ds, ann, compute_hashes=True)
    codes = {i["code"] for i in report["issues"]}
    assert "duplicate_image_id" in codes
    assert "duplicate_image_content" in codes


def test_split_leakage_detected(tmp_path: Path):
    ds = tmp_path / "scale_photos"
    _write_img(ds / "raw/img1.jpg")
    _write_img(ds / "raw/img2.jpg")
    ann = ds / "annotated/annotations.json"
    r1 = _base_record(ds, "img1", "img1.jpg")
    r2 = _base_record(ds, "img2", "img2.jpg")
    r2["device_id"] = "devA"  # same device as img1 -> leakage if split across
    r2["capture_session_id"] = "sess2"
    _write_annotations(ann, [r1, r2])
    splits = ds / "docs/splits.json"
    splits.parent.mkdir(parents=True, exist_ok=True)
    splits.write_text(json.dumps({
        "dataset": "scale_photos",
        "version": "test",
        "splits": {
            "train": {"image_ids": ["img1"]},
            "val": {"image_ids": []},
            "test": {"image_ids": ["img2"]}
        }
    }), encoding="utf-8")
    report = validate_annotations(ds, ann, splits)
    codes = {i["code"] for i in report["issues"]}
    assert "split_leakage" in codes
