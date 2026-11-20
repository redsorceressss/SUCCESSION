"""Reproducible deterministic OCR baseline evaluation for Phase 9.2 jewellery scale photos.

Evaluates existing ai_engine.ocr.read_display against annotated in-domain scale photos (if available).
Read-only: does not modify datasets, annotations, or production code. Produces machine-readable JSON
and can print a human-readable summary.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from ai_engine.ocr.read_display import read_display

WEIGHT_RE = re.compile(r"^-?[0-9]+(?:\.[0-9]+)?$")


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def _load_records(annotations_path: Path) -> list[dict[str, Any]]:
    data = _load_json(annotations_path)
    if isinstance(data, dict) and isinstance(data.get("annotations"), list):
        return [r for r in data["annotations"] if isinstance(r, dict)]
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    raise ValueError("Annotations must be a JSON array or an object with 'annotations' array.")


def _resolve_image_path(dataset_root: Path, rec: dict[str, Any]) -> Path | None:
    image_file = rec.get("image_file")
    image_id = rec.get("image_id")
    if isinstance(image_file, str) and image_file.strip():
        p = Path(image_file)
        return p if p.is_absolute() else (dataset_root / p)
    if isinstance(image_id, str) and image_id.strip():
        raw = dataset_root / "raw"
        if raw.exists():
            for ext in (".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"):
                c = raw / f"{image_id}{ext}"
                if c.exists():
                    return c
                c = raw / f"{image_id}{ext.upper()}"
                if c.exists():
                    return c
    return None


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            ins = cur[j - 1] + 1
            dele = prev[j] + 1
            sub = prev[j - 1] + (0 if ca == cb else 1)
            cur.append(min(ins, dele, sub))
        prev = cur
    return prev[-1]


def _normalize_text(s: str | None) -> str | None:
    if s is None:
        return None
    if not isinstance(s, str):
        return None
    t = s.strip()
    return t if t != "" else None


def _normalize_weight(val: str | None) -> str | None:
    if val is None or not isinstance(val, str):
        return None
    v = val.strip()
    if not WEIGHT_RE.match(v):
        return None
    try:
        d = Decimal(v)
    except (InvalidOperation, ValueError):
        return None
    # normalize without exponent, trim insignificant trailing zeros except keep at least integer part
    s = format(d.normalize(), "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s if s else "0"


def _eligible_for_weight_eval(rec: dict[str, Any]) -> bool:
    # evaluate against readable/partially readable records with a parseable ground-truth weight
    if rec.get("annotation_status") == "rejected":
        return False
    if rec.get("readability") not in {"readable", "partially_readable"}:
        return False
    return _normalize_weight(rec.get("weight_value")) is not None


def _eligible_for_text_eval(rec: dict[str, Any]) -> bool:
    if rec.get("annotation_status") == "rejected":
        return False
    if rec.get("readability") not in {"readable", "partially_readable"}:
        return False
    return _normalize_text(rec.get("display_text")) is not None


def _select_split_ids(splits_path: Path | None, split: str) -> set[str] | None:
    if not splits_path:
        return None
    data = _load_json(splits_path)
    splits = data.get("splits", {}) if isinstance(data, dict) else {}
    if split == "all":
        ids: set[str] = set()
        for name in ("train", "val", "test"):
            part = splits.get(name, {}) if isinstance(splits, dict) else {}
            for iid in (part.get("image_ids") or []):
                if isinstance(iid, str):
                    ids.add(iid)
        return ids
    part = splits.get(split, {}) if isinstance(splits, dict) else {}
    ids = part.get("image_ids", []) if isinstance(part, dict) else []
    return {i for i in ids if isinstance(i, str)} if isinstance(ids, list) else set()


def evaluate(
    dataset_root: Path,
    annotations_path: Path,
    split: str = "all",
    splits_path: Path | None = None,
    confidence_threshold: float = 0.70,
) -> dict[str, Any]:
    records = _load_records(annotations_path)
    split_ids = _select_split_ids(splits_path, split)
    if split_ids is not None:
        records = [r for r in records if r.get("image_id") in split_ids]

    per_image: list[dict[str, Any]] = []
    breakdown = defaultdict(lambda: defaultdict(lambda: {
        "count": 0, "weight_eval_count": 0, "text_eval_count": 0,
        "exact_weight_correct": 0, "exact_text_correct": 0,
        "readable_pred": 0, "unreadable_pred": 0,
        "correct_abstentions": 0, "incorrect_abstentions": 0,
        "false_high_confidence": 0, "cer_num": 0, "cer_den": 0,
    }))

    totals = {
        "total_images_evaluated": 0,
        "weight_eval_count": 0,
        "text_eval_count": 0,
        "exact_weight_correct": 0,
        "exact_text_correct": 0,
        "readable_predictions": 0,
        "unreadable_predictions": 0,
        "correct_readings": 0,
        "incorrect_readings": 0,
        "correct_abstentions": 0,
        "incorrect_abstentions": 0,
        "false_high_confidence_readings": 0,
        "cer_num": 0,
        "cer_den": 0,
    }

    def _bump(bucket: dict[str, Any], key: str, n: int = 1) -> None:
        bucket[key] = int(bucket.get(key, 0)) + n

    for rec in records:
        image_id = rec.get("image_id")
        img_path = _resolve_image_path(dataset_root, rec)
        gt_weight = _normalize_weight(rec.get("weight_value"))
        gt_text = _normalize_text(rec.get("display_text"))
        gt_readability = rec.get("readability")
        eligible_w = _eligible_for_weight_eval(rec)
        eligible_t = _eligible_for_text_eval(rec)

        pred_weight_norm = None
        pred_text = None
        pred_status = "MISSING_IMAGE"
        pred_conf = 0.0
        pred_raw = ""

        if img_path and img_path.exists():
            reading = read_display(str(img_path))
            pred_status = reading.status
            pred_conf = float(getattr(reading, "confidence", 0.0) or 0.0)
            pred_raw = getattr(reading, "raw", "") or ""
            pred_text = _normalize_text(pred_raw) or (str(reading.value) if reading.value is not None else None)
            pred_weight_norm = _normalize_weight(str(reading.value)) if reading.value is not None else None
        else:
            pred_status = "IMAGE_NOT_FOUND"

        totals["total_images_evaluated"] += 1
        if pred_status == "READABLE":
            totals["readable_predictions"] += 1
        else:
            totals["unreadable_predictions"] += 1

        exact_w = bool(eligible_w and pred_weight_norm is not None and pred_weight_norm == gt_weight)
        exact_t = bool(eligible_t and pred_text is not None and gt_text is not None and pred_text == gt_text)

        if eligible_w:
            totals["weight_eval_count"] += 1
            if exact_w:
                totals["exact_weight_correct"] += 1
                totals["correct_readings"] += 1
            else:
                if pred_status == "READABLE" and pred_weight_norm is not None:
                    totals["incorrect_readings"] += 1
                    if pred_conf >= confidence_threshold:
                        totals["false_high_confidence_readings"] += 1
                elif pred_status != "READABLE":
                    totals["incorrect_abstentions"] += 1
        else:
            # for unreadable/unground-truth cases, abstention is safe
            if gt_readability == "unreadable" and pred_status != "READABLE":
                totals["correct_abstentions"] += 1
            elif gt_readability == "unreadable" and pred_status == "READABLE" and pred_conf >= confidence_threshold:
                totals["false_high_confidence_readings"] += 1

        if eligible_t:
            totals["text_eval_count"] += 1
            if exact_t:
                totals["exact_text_correct"] += 1
            # CER components
            gt_s = gt_text or ""
            pr_s = pred_text or ""
            totals["cer_num"] += _levenshtein(pr_s, gt_s)
            totals["cer_den"] += max(len(gt_s), 1)

        # breakdowns
        for dim in ("lighting_condition", "camera_angle", "scale_type", "device_id"):
            key = rec.get(dim)
            key = key if isinstance(key, str) and key.strip() else "unknown"
            b = breakdown[dim][key]
            _bump(b, "count")
            if eligible_w:
                _bump(b, "weight_eval_count")
                if exact_w:
                    _bump(b, "exact_weight_correct")
                elif pred_status != "READABLE":
                    _bump(b, "incorrect_abstentions")
                elif pred_conf >= confidence_threshold and pred_weight_norm != gt_weight:
                    _bump(b, "false_high_confidence")
            if eligible_t:
                _bump(b, "text_eval_count")
                if exact_t:
                    _bump(b, "exact_text_correct")
                gt_s = gt_text or ""
                pr_s = pred_text or ""
                b["cer_num"] += _levenshtein(pr_s, gt_s)
                b["cer_den"] += max(len(gt_s), 1)
            if pred_status == "READABLE":
                _bump(b, "readable_pred")
            else:
                _bump(b, "unreadable_pred")
            if gt_readability == "unreadable" and pred_status != "READABLE":
                _bump(b, "correct_abstentions")

        per_image.append({
            "image_id": image_id,
            "image_file": str(img_path) if img_path else rec.get("image_file"),
            "ground_truth": {
                "display_text": rec.get("display_text"),
                "weight_value": rec.get("weight_value"),
                "unit": rec.get("unit"),
                "readability": rec.get("readability"),
            },
            "prediction": {
                "status": pred_status,
                "confidence": round(pred_conf, 4),
                "raw": pred_raw,
                "value": str(reading.value) if (img_path and img_path.exists() and pred_status != "IMAGE_NOT_FOUND" and 'reading' in locals() and reading.value is not None) else None,
            },
            "evaluation": {
                "eligible_weight_eval": eligible_w,
                "eligible_text_eval": eligible_t,
                "exact_weight_match": exact_w,
                "exact_display_text_match": exact_t,
                "is_false_high_confidence": bool((pred_conf >= confidence_threshold) and (pred_status == "READABLE") and ((eligible_w and not exact_w) or (gt_readability == "unreadable"))),
            },
            "metadata": {
                "lighting_condition": rec.get("lighting_condition"),
                "camera_angle": rec.get("camera_angle"),
                "scale_type": rec.get("scale_type"),
                "device_id": rec.get("device_id"),
                "capture_session_id": rec.get("capture_session_id"),
                "annotation_status": rec.get("annotation_status"),
            },
        })

    weight_acc = (totals["exact_weight_correct"] / totals["weight_eval_count"]) if totals["weight_eval_count"] else None
    text_acc = (totals["exact_text_correct"] / totals["text_eval_count"]) if totals["text_eval_count"] else None
    cer = (totals["cer_num"] / totals["cer_den"]) if totals["cer_den"] else None
    unreadable_rate = (totals["unreadable_predictions"] / totals["total_images_evaluated"]) if totals["total_images_evaluated"] else None
    false_hc_rate = (totals["false_high_confidence_readings"] / totals["readable_predictions"]) if totals["readable_predictions"] else 0.0

    # calibration bins (simple)
    bins = [{"range": [i / 10, (i + 1) / 10], "count": 0, "correct": 0} for i in range(10)]
    calib_samples = 0
    for r in per_image:
        if not r["evaluation"]["eligible_weight_eval"]:
            continue
        conf = r["prediction"]["confidence"] or 0.0
        idx = min(9, max(0, int(conf * 10) if conf < 1.0 else 9))
        bins[idx]["count"] += 1
        calib_samples += 1
        if r["evaluation"]["exact_weight_match"]:
            bins[idx]["correct"] += 1
    for b in bins:
        b["accuracy"] = (b["correct"] / b["count"]) if b["count"] else None

    def _finalize_breakdown(d: dict[str, Any]) -> dict[str, Any]:
        out = {}
        for dim, groups in d.items():
            out[dim] = {}
            for g, v in groups.items():
                wden = v["weight_eval_count"] or 0
                tden = v["text_eval_count"] or 0
                out[dim][g] = {
                    **v,
                    "exact_weight_accuracy": (v["exact_weight_correct"] / wden) if wden else None,
                    "exact_display_text_accuracy": (v["exact_text_correct"] / tden) if tden else None,
                    "character_error_rate_cer": (v["cer_num"] / v["cer_den"]) if v["cer_den"] else None,
                }
        return out

    report = {
        "benchmark": "SUCCESSION Phase 9.2 Deterministic OCR Baseline (Jewellery Scale Photos)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dataset_root": str(dataset_root),
        "annotations_file": str(annotations_path),
        "splits_file": str(splits_path) if splits_path else None,
        "split_evaluated": split,
        "confidence_threshold_high_risk": confidence_threshold,
        "totals": totals,
        "metrics": {
            "exact_weight_reading_accuracy": weight_acc,
            "exact_display_text_accuracy": text_acc,
            "character_error_rate_cer": cer,
            "unreadable_image_rate": unreadable_rate,
            "false_high_confidence_reading_rate": false_hc_rate,
            "correct_readings": totals["correct_readings"],
            "incorrect_readings": totals["incorrect_readings"],
            "correct_abstentions": totals["correct_abstentions"],
            "incorrect_abstentions": totals["incorrect_abstentions"],
        },
        "confidence_calibration": {
            "available": calib_samples > 0,
            "sample_count": calib_samples,
            "bins": bins,
            "note": "Calibration is approximate and only meaningful with sufficient labeled in-domain samples across confidence ranges."
        },
        "breakdowns": _finalize_breakdown(breakdown),
        "per_image": per_image,
        "notes": [
            "Read-only evaluation. No datasets/annotations/source OCR implementation modified.",
            "Energy-meter datasets must never be used as jewellery-scale ground truth.",
            "A confident but incorrect reading is treated as high-risk; safe abstention is preferred.",
        ],
    }
    return report


def main() -> int:
    ap = argparse.ArgumentParser(description="Evaluate deterministic OCR baseline on Phase 9.2 scale-photo annotations.")
    ap.add_argument("--dataset", required=True, help="Dataset root path")
    ap.add_argument("--annotations", required=True, help="Annotations JSON path")
    ap.add_argument("--split", default="all", choices=["all", "train", "val", "test"], help="Split to evaluate (requires --splits for specific split)")
    ap.add_argument("--splits", default=None, help="Splits manifest JSON path")
    ap.add_argument("--output", default=None, help="Machine-readable JSON output path")
    ap.add_argument("--confidence-threshold", type=float, default=0.70, help="Threshold for high-confidence/fabrication risk metric")
    args = ap.parse_args()

    dataset_root = Path(args.dataset)
    annotations_path = Path(args.annotations)
    splits_path = Path(args.splits) if args.splits else None

    if not annotations_path.exists():
        print(f"ERROR: annotations file not found: {annotations_path}")
        return 2

    report = evaluate(dataset_root, annotations_path, split=args.split, splits_path=splits_path, confidence_threshold=args.confidence_threshold)
    m = report["metrics"]
    t = report["totals"]
    print("SUCCESSION Phase 9.2 Deterministic OCR Baseline Evaluation")
    print(f"Dataset: {dataset_root}")
    print(f"Annotations: {annotations_path}")
    print(f"Split: {args.split}")
    print(f"Total images evaluated: {t['total_images_evaluated']}")
    print(f"Exact weight-reading accuracy: {m['exact_weight_reading_accuracy']}")
    print(f"Exact display-text accuracy: {m['exact_display_text_accuracy']}")
    print(f"Character error rate (CER): {m['character_error_rate_cer']}")
    print(f"Unreadable-image rate: {m['unreadable_image_rate']}")
    print(f"False high-confidence reading rate (of readable preds): {m['false_high_confidence_reading_rate']}")
    print(f"Correct readings: {m['correct_readings']} | Incorrect readings: {m['incorrect_readings']}")
    print(f"Correct abstentions: {m['correct_abstentions']} | Incorrect abstentions: {m['incorrect_abstentions']}")

    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Machine-readable output written: {out}")

    if t["total_images_evaluated"] == 0:
        print("WARNING: No eligible/selected images evaluated. If in-domain images are unavailable, this is an expected limitation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
