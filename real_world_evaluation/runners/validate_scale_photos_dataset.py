"""Dataset validation for Phase 9.2 jewellery scale-photo annotations.

Reproducible, read-only validator: checks images/annotations/schema/bboxes/values/duplicates/splits
and produces human-readable + machine-readable reports without modifying source datasets or annotations.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

try:
    import cv2  # type: ignore
except Exception:  # pragma: no cover
    cv2 = None

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
ALLOWED_UNITS = {"g", "kg", "mg", "ct", "oz", "dwt", "other", None}
ALLOWED_READABILITY = {"readable", "partially_readable", "unreadable"}
ALLOWED_STATUS = {"pending", "verified", "rejected"}
ALLOWED_LIGHTING = {"normal", "low_light", "bright", "glare", "shadow", "mixed", "other", None}
ALLOWED_ANGLE = {"front", "tilted", "side", "top_down", "steep", "other", None}
WEIGHT_RE = re.compile(r"^-?[0-9]+(\.[0-9]+)?$")


@dataclass
class Issue:
    severity: str  # error|warning
    code: str
    message: str
    image_id: str | None = None
    field: str | None = None


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def _resolve_image_path(dataset_root: Path, record: dict[str, Any]) -> Path | None:
    image_file = record.get("image_file")
    image_id = record.get("image_id")
    if isinstance(image_file, str) and image_file.strip():
        p = Path(image_file)
        return p if p.is_absolute() else (dataset_root / p)
    # fallback common locations
    if isinstance(image_id, str) and image_id.strip():
        raw_dir = dataset_root / "raw"
        if raw_dir.exists():
            for ext in IMAGE_EXTS:
                cand = raw_dir / f"{image_id}{ext}"
                if cand.exists():
                    return cand
                cand = raw_dir / f"{image_id}{ext.upper()}"
                if cand.exists():
                    return cand
    return None


def _sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_image_dims(path: Path) -> tuple[int, int] | None:
    if cv2 is None:
        return None
    try:
        img = cv2.imread(str(path))
        if img is None:
            return None
        h, w = img.shape[:2]
        return int(w), int(h)
    except Exception:
        return None


def validate_annotations(
    dataset_root: Path,
    annotations_path: Path | None,
    splits_path: Path | None = None,
    compute_hashes: bool = False,
) -> dict[str, Any]:
    issues: list[Issue] = []
    records: list[dict[str, Any]] = []
    split_manifest: dict[str, Any] | None = None

    if annotations_path is None:
        issues.append(Issue("warning", "annotations_missing", "No annotations file provided; dataset treated as empty/unannotated."))
    elif not annotations_path.exists():
        issues.append(Issue("error", "annotations_not_found", f"Annotations file not found: {annotations_path}"))
    else:
        try:
            data = _load_json(annotations_path)
        except Exception as e:
            issues.append(Issue("error", "annotations_invalid_json", f"Failed to parse annotations JSON: {e}"))
            data = None
        if data is not None:
            if isinstance(data, dict) and isinstance(data.get("annotations"), list):
                records = data["annotations"]
            elif isinstance(data, list):
                records = data
            else:
                issues.append(Issue("error", "annotations_invalid_format", "Annotations must be a JSON array of records or an object with 'annotations' array."))

    if splits_path is not None:
        if not splits_path.exists():
            issues.append(Issue("error", "splits_not_found", f"Splits manifest not found: {splits_path}"))
        else:
            try:
                split_manifest = _load_json(splits_path)
            except Exception as e:
                issues.append(Issue("error", "splits_invalid_json", f"Failed to parse splits manifest JSON: {e}"))
                split_manifest = None

    required = [
        "image_id", "display_bounding_box", "display_text", "weight_value", "unit",
        "readability", "scale_type", "lighting_condition", "camera_angle", "device_id",
        "capture_session_id", "annotation_status",
    ]

    seen_image_ids: set[str] = set()
    duplicate_image_ids: set[str] = set()
    hash_to_ids: dict[str, list[str]] = defaultdict(list)
    missing_images = 0
    unreadable_images = 0
    valid_records = 0
    bbox_ok = 0
    bbox_bad = 0
    class_counts = {
        "readability": Counter(),
        "annotation_status": Counter(),
        "unit": Counter(),
        "lighting_condition": Counter(),
        "camera_angle": Counter(),
        "scale_type": Counter(),
    }

    for idx, rec in enumerate(records):
        if not isinstance(rec, dict):
            issues.append(Issue("error", "record_not_object", f"Record at index {idx} is not an object."))
            continue
        image_id = rec.get("image_id")
        if not isinstance(image_id, str) or not image_id.strip():
            issues.append(Issue("error", "missing_image_id", f"Record at index {idx} has missing/invalid image_id.", field="image_id"))
            image_id = f"<index:{idx}>"
        else:
            if image_id in seen_image_ids:
                duplicate_image_ids.add(image_id)
                issues.append(Issue("error", "duplicate_image_id", f"Duplicate image_id '{image_id}'.", image_id=image_id, field="image_id"))
            seen_image_ids.add(image_id)

        for field in required:
            if field not in rec:
                issues.append(Issue("error", "missing_required_field", f"Missing required field '{field}'.", image_id=image_id, field=field))

        # enums/basic types
        readability = rec.get("readability")
        if readability not in ALLOWED_READABILITY:
            issues.append(Issue("error", "invalid_readability", f"Invalid readability '{readability}'.", image_id=image_id, field="readability"))
        else:
            class_counts["readability"][readability] += 1

        status = rec.get("annotation_status")
        if status not in ALLOWED_STATUS:
            issues.append(Issue("error", "invalid_annotation_status", f"Invalid annotation_status '{status}'.", image_id=image_id, field="annotation_status"))
        else:
            class_counts["annotation_status"][status] += 1

        unit = rec.get("unit")
        if unit not in ALLOWED_UNITS:
            issues.append(Issue("error", "invalid_unit", f"Invalid unit '{unit}'.", image_id=image_id, field="unit"))
        class_counts["unit"][str(unit)] += 1

        lighting = rec.get("lighting_condition")
        if lighting not in ALLOWED_LIGHTING:
            issues.append(Issue("error", "invalid_lighting_condition", f"Invalid lighting_condition '{lighting}'.", image_id=image_id, field="lighting_condition"))
        class_counts["lighting_condition"][str(lighting)] += 1

        angle = rec.get("camera_angle")
        if angle not in ALLOWED_ANGLE:
            issues.append(Issue("error", "invalid_camera_angle", f"Invalid camera_angle '{angle}'.", image_id=image_id, field="camera_angle"))
        class_counts["camera_angle"][str(angle)] += 1

        stype = rec.get("scale_type")
        if stype is not None and not isinstance(stype, str):
            issues.append(Issue("error", "invalid_scale_type", "scale_type must be a string or null.", image_id=image_id, field="scale_type"))
        class_counts["scale_type"][str(stype)] += 1

        # weight/display_text consistency
        display_text = rec.get("display_text")
        weight_value = rec.get("weight_value")
        if display_text is not None and not isinstance(display_text, str):
            issues.append(Issue("error", "invalid_display_text", "display_text must be a string or null.", image_id=image_id, field="display_text"))
        if weight_value is not None:
            if not isinstance(weight_value, str) or not WEIGHT_RE.match(weight_value):
                issues.append(Issue("error", "invalid_weight_value", "weight_value must be an exact decimal string or null.", image_id=image_id, field="weight_value"))
            else:
                try:
                    Decimal(weight_value)
                except (InvalidOperation, ValueError):
                    issues.append(Issue("error", "invalid_weight_value_decimal", "weight_value is not a valid decimal.", image_id=image_id, field="weight_value"))
        if readability == "readable":
            if not isinstance(display_text, str) or not display_text.strip():
                issues.append(Issue("error", "readable_missing_display_text", "Readable record must have non-empty display_text.", image_id=image_id, field="display_text"))
            if not (isinstance(weight_value, str) and WEIGHT_RE.match(weight_value)):
                issues.append(Issue("error", "readable_missing_weight_value", "Readable record must have parseable weight_value.", image_id=image_id, field="weight_value"))
        elif readability == "unreadable":
            if weight_value is not None:
                issues.append(Issue("error", "unreadable_has_weight_value", "Unreadable record must not fabricate weight_value (expected null).", image_id=image_id, field="weight_value"))

        # image existence/readability
        img_path = _resolve_image_path(dataset_root, rec)
        img_dims = None
        if img_path is None:
            issues.append(Issue("error", "image_path_unresolved", "Could not resolve image_file path (and no fallback image found).", image_id=image_id, field="image_file"))
            missing_images += 1
        elif not img_path.exists():
            issues.append(Issue("error", "image_missing", f"Image file does not exist: {img_path}", image_id=image_id, field="image_file"))
            missing_images += 1
        else:
            if img_path.suffix.lower() not in IMAGE_EXTS:
                issues.append(Issue("warning", "image_unusual_extension", f"Image has unusual/unsupported extension: {img_path.suffix}", image_id=image_id, field="image_file"))
            img_dims = _read_image_dims(img_path)
            if img_dims is None and cv2 is not None:
                issues.append(Issue("error", "image_unreadable", f"Image file could not be read/decoded: {img_path}", image_id=image_id, field="image_file"))
                unreadable_images += 1
            elif cv2 is None:
                issues.append(Issue("warning", "opencv_unavailable", "OpenCV unavailable; image decode/dimension checks limited.", image_id=image_id))
            if compute_hashes and img_path.exists():
                try:
                    hash_to_ids[_sha256_file(img_path)].append(str(image_id))
                except Exception as e:
                    issues.append(Issue("warning", "image_hash_failed", f"Failed to hash image: {e}", image_id=image_id))

        # bbox validation
        bbox = rec.get("display_bounding_box")
        ann_w = rec.get("image_width")
        ann_h = rec.get("image_height")
        dims = None
        if isinstance(ann_w, int) and isinstance(ann_h, int) and ann_w > 0 and ann_h > 0:
            dims = (ann_w, ann_h)
            if img_dims and img_dims != dims:
                issues.append(Issue("warning", "image_dimension_mismatch", f"Annotated dimensions {dims} differ from actual image dimensions {img_dims}.", image_id=image_id, field="image_width"))
        elif img_dims:
            dims = img_dims
        if bbox is None:
            issues.append(Issue("warning", "bbox_missing", "display_bounding_box is null; ROI-based evaluation/localization will be limited.", image_id=image_id, field="display_bounding_box"))
        elif isinstance(bbox, dict):
            keys = {"x_min", "y_min", "x_max", "y_max"}
            if set(bbox.keys()) != keys:
                issues.append(Issue("error", "bbox_invalid_keys", "display_bounding_box must contain exactly x_min,y_min,x_max,y_max.", image_id=image_id, field="display_bounding_box"))
                bbox_bad += 1
            else:
                try:
                    x_min = float(bbox["x_min"]); y_min = float(bbox["y_min"])
                    x_max = float(bbox["x_max"]); y_max = float(bbox["y_max"])
                    ok = (x_min >= 0 and y_min >= 0 and x_max > x_min and y_max > y_min)
                    if dims:
                        w, h = dims
                        ok = ok and (x_max <= w and y_max <= h)
                    if ok:
                        bbox_ok += 1
                    else:
                        bbox_bad += 1
                        issues.append(Issue("error", "bbox_out_of_bounds", f"Bounding box invalid/out of bounds for dims {dims}: {bbox}", image_id=image_id, field="display_bounding_box"))
                except Exception:
                    bbox_bad += 1
                    issues.append(Issue("error", "bbox_invalid_values", "Bounding box coordinates must be numeric.", image_id=image_id, field="display_bounding_box"))
        else:
            bbox_bad += 1
            issues.append(Issue("error", "bbox_invalid_type", "display_bounding_box must be an object or null.", image_id=image_id, field="display_bounding_box"))

        record_has_required = all(k in rec for k in required)
        if record_has_required and not any(i.severity == "error" and i.image_id == image_id for i in issues):
            valid_records += 1

    duplicate_content_groups = {h: ids for h, ids in hash_to_ids.items() if len(ids) > 1}
    for h, ids in duplicate_content_groups.items():
        issues.append(Issue("warning", "duplicate_image_content", f"Identical image content hash detected for image_ids: {ids} (sha256={h[:12]}...)."))

    # split checks
    split_summary = None
    if split_manifest and isinstance(split_manifest, dict):
        splits = split_manifest.get("splits", {}) if isinstance(split_manifest.get("splits"), dict) else {}
        split_ids: dict[str, list[str]] = {}
        for name in ("train", "val", "test"):
            part = splits.get(name, {}) if isinstance(splits, dict) else {}
            ids = part.get("image_ids", []) if isinstance(part, dict) else []
            if not isinstance(ids, list) or not all(isinstance(x, str) for x in ids):
                issues.append(Issue("error", "split_invalid_ids", f"Split '{name}' must contain image_ids list[str]."))
                ids = []
            split_ids[name] = ids
        all_split_ids = [*split_ids.get("train", []), *split_ids.get("val", []), *split_ids.get("test", [])]
        dup_split = [iid for iid, c in Counter(all_split_ids).items() if c > 1]
        if dup_split:
            issues.append(Issue("error", "split_overlap", f"Image IDs appear in multiple splits: {sorted(dup_split)[:20]}{'...' if len(dup_split)>20 else ''}"))
        ann_ids = {r.get("image_id") for r in records if isinstance(r.get("image_id"), str)}
        unknown_split_ids = sorted([iid for iid in set(all_split_ids) if iid not in ann_ids])
        if unknown_split_ids:
            issues.append(Issue("warning", "split_unknown_image_ids", f"Split references image_ids not present in annotations: {unknown_split_ids[:20]}{'...' if len(unknown_split_ids)>20 else ''}"))
        # leakage by device/session
        rec_by_id = {r.get("image_id"): r for r in records if isinstance(r, dict) and isinstance(r.get("image_id"), str)}
        for key in ("device_id", "capture_session_id"):
            owner: dict[str, set[str]] = defaultdict(set)
            for sname, ids in split_ids.items():
                for iid in ids:
                    rec = rec_by_id.get(iid, {})
                    val = rec.get(key)
                    if isinstance(val, str) and val.strip():
                        owner[val].add(sname)
            leaks = {v: sorted(ss) for v, ss in owner.items() if len(ss) > 1}
            if leaks:
                sample = list(leaks.items())[:10]
                issues.append(Issue("error", "split_leakage", f"Leakage detected: same {key} appears in multiple splits (sample): {sample}", field=key))
        split_summary = {k: len(v) for k, v in split_ids.items()}

    errors = [i for i in issues if i.severity == "error"]
    warnings = [i for i in issues if i.severity == "warning"]

    summary = {
        "dataset_root": str(dataset_root),
        "annotations_file": str(annotations_path) if annotations_path else None,
        "splits_file": str(splits_path) if splits_path else None,
        "total_records": len(records),
        "unique_image_ids": len(seen_image_ids),
        "duplicate_image_id_count": len(duplicate_image_ids),
        "missing_image_files": missing_images,
        "unreadable_image_files": unreadable_images,
        "duplicate_content_groups": len(duplicate_content_groups),
        "bounding_boxes_valid": bbox_ok,
        "bounding_boxes_invalid": bbox_bad,
        "records_without_errors_estimate": valid_records,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "opencv_available": cv2 is not None,
        "class_distribution": {k: dict(v) for k, v in class_counts.items()},
        "splits": split_summary,
    }

    report = {
        "report_type": "SUCCESSION_PHASE_9_2_SCALE_PHOTO_DATASET_VALIDATION",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "issues": [asdict(i) for i in issues],
    }
    return report


def _format_text_report(report: dict[str, Any]) -> str:
    s = report["summary"]
    lines = []
    lines.append("SUCCESSION Phase 9.2 Dataset Validation Report")
    lines.append(f"Timestamp: {report['timestamp']}")
    lines.append(f"Dataset root: {s['dataset_root']}")
    lines.append(f"Annotations: {s['annotations_file']}")
    lines.append(f"Splits: {s['splits_file']}")
    lines.append("")
    lines.append("Summary:")
    for k in [
        "total_records", "unique_image_ids", "duplicate_image_id_count", "missing_image_files",
        "unreadable_image_files", "duplicate_content_groups", "bounding_boxes_valid", "bounding_boxes_invalid",
        "records_without_errors_estimate", "error_count", "warning_count", "opencv_available", "splits",
    ]:
        lines.append(f"- {k}: {s.get(k)}")
    lines.append("")
    lines.append("Class distribution:")
    for k, v in (s.get("class_distribution") or {}).items():
        lines.append(f"- {k}: {v}")
    lines.append("")
    lines.append("Issues:")
    if not report["issues"]:
        lines.append("- None")
    else:
        for i in report["issues"]:
            loc = f" image_id={i['image_id']}" if i.get("image_id") else ""
            fld = f" field={i['field']}" if i.get("field") else ""
            lines.append(f"- [{i['severity'].upper()}:{i['code']}]{loc}{fld} {i['message']}")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate Phase 9.2 jewellery scale-photo dataset (read-only).")
    ap.add_argument("--dataset", required=True, help="Dataset root path (e.g. real_world_evaluation/datasets/ocr/scale_photos)")
    ap.add_argument("--annotations", default=None, help="Path to annotations JSON (array or {annotations:[...]})")
    ap.add_argument("--splits", default=None, help="Optional splits manifest JSON path")
    ap.add_argument("--output-json", default=None, help="Optional path to write machine-readable JSON report")
    ap.add_argument("--output-txt", default=None, help="Optional path to write human-readable text report")
    ap.add_argument("--compute-hashes", action="store_true", help="Compute SHA256 hashes to detect duplicate image content (slower)")
    args = ap.parse_args()

    dataset_root = Path(args.dataset)
    annotations_path = Path(args.annotations) if args.annotations else None
    splits_path = Path(args.splits) if args.splits else None

    report = validate_annotations(dataset_root, annotations_path, splits_path, compute_hashes=args.compute_hashes)
    text = _format_text_report(report)
    print(text)

    if args.output_json:
        out = Path(args.output_json)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if args.output_txt:
        out = Path(args.output_txt)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")

    return 1 if report["summary"]["error_count"] > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
