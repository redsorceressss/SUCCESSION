# Phase 9.2 Dataset Specification — Jewellery Scale-Photo Dataset

**Dataset root:** `succession/real_world_evaluation/datasets/ocr/scale_photos/`  
**Domain:** Genuine photographs of jewellery weighing-scale displays (in-domain).  
**Purpose:** Dataset engineering, validation, and deterministic OCR baseline/evaluation foundation.  
**Out of scope:** Model training, pretrained weight downloads, new ML dependencies/services (Phase 9.2).

## 1. Directory structure (distinguished categories)

| Category | Path | Purpose |
|---|---|---|
| Raw images | `raw/` | Original, unmodified source images (never edited/overwritten). |
| Annotated images / annotation records | `annotated/` | Annotation manifests/files (JSON) and any derived annotation artifacts (e.g. future visualization exports) kept separate from raw originals. |
| Training candidates | `splits/train_candidates/` | Split manifests/lists identifying training-candidate samples. |
| Validation candidates | `splits/val_candidates/` | Split manifests/lists identifying validation-candidate samples. |
| Test candidates | `splits/test_candidates/` | Split manifests/lists identifying test-candidate samples (independent holdout). |
| Dataset documentation | `docs/` and `README.md` | Schema, templates, collection instructions, spec, validation/eval guidance. |
| Evaluation results | `results/` (dataset-local) and `real_world_evaluation/results/` (repo-level runners) | Machine-readable outputs and evaluation reports. |

Legacy/template files retained: `README.md`, `labels.schema.json` (previous protocol). Phase 9.2 canonical annotation contract: `docs/annotation_schema.json`.

## 2. Annotation specification

Each annotation record **must** include the following required fields:

| Field | Description | Type / allowed values | Missing-value handling |
|---|---|---|---|
| `image_id` | Unique image identifier | non-empty string (stable, filename-safe) | Not allowed to be missing/empty |
| `display_bounding_box` | Coordinates of the scale display | object `{x_min,y_min,x_max,y_max}` in absolute pixels, or `null` only if display region cannot be localized (must be justified in notes; generally required for usable samples) | Prefer explicit box; `null` allowed by schema but validator flags as warning/error depending on context |
| `display_text` | Exact visible display text | string or `null` | `null` only when unreadable/untranscribable |
| `weight_value` | Numeric weight, if readable | decimal string matching `^-?[0-9]+(\.[0-9]+)?$` or `null` | `null` when unreadable/partially unreadable without reliable parse |
| `unit` | Visible/known unit | `g`, `kg`, `mg`, `ct`, `oz`, `dwt`, `other`, or `null` | `null` if not visible/determinable |
| `readability` | Readability label | `readable`, `partially_readable`, `unreadable` | Required |
| `scale_type` | Scale model/type if known | string or `null` (e.g. `green_led`, `red_led`, `lcd`, `seven_segment`) | `null` if unknown |
| `lighting_condition` | Lighting condition | `normal`, `low_light`, `bright`, `glare`, `shadow`, `mixed`, `other`, `null` | `null` if unknown |
| `camera_angle` | Camera angle | `front`, `tilted`, `side`, `top_down`, `steep`, `other`, `null` | `null` if unknown |
| `device_id` | Scale/device identifier where available | string or `null` | `null` if unavailable (reduces leakage-control confidence) |
| `capture_session_id` | Capture session identifier | string or `null` | `null` if unavailable |
| `annotation_status` | Annotation state | `pending`, `verified`, `rejected` | Required |

**Recommended fields:** `image_file` (relative path from dataset root), `image_width`, `image_height`, `notes`, `annotator_id`.

## 3. Coordinate conventions and dimensions
- **Coordinate system:** origin at image top-left `(0,0)`, x increases right, y increases down.
- **Bounding box format:** absolute pixel coordinates `{ "x_min": <number>, "y_min": <number>, "x_max": <number>, "y_max": <number> }` in the **original raw image** dimensions.
- **Validity rules:** `0 <= x_min < x_max <= image_width`, `0 <= y_min < y_max <= image_height`; box must have positive area.
- **Dimensions:** `image_width`/`image_height` should be recorded in annotations when available; validator may also read actual image dimensions to verify consistency.

## 4. Value and label rules
- **`weight_value`:** exact decimal string, no fabricated values. Preserve precision as displayed/verified (e.g. `0.250`, `49.85`). Negative values allowed by pattern only if genuinely displayed; otherwise treat as annotation error.
- **`display_text`:** transcribe exactly what is visible (digits, decimal separator, sign, unit tokens/spaces if visible). For unreadable images, `null` is acceptable.
- **Consistency:** `readable` records should have non-null `display_text` and parseable `weight_value` (and typically non-null `unit`); `unreadable` records must not contain fabricated `weight_value`.
- **Units:** supported canonical units `g, kg, mg, ct, oz, dwt`; use `other` for uncommon units and explain in notes.
- **Image formats:** validator accepts common readable formats (e.g. `.jpg/.jpeg/.png/.bmp/.webp/.tif/.tiff`) and reports unreadable/corrupt files.

## 5. Split and leakage policy
- **No duplicates across train/val/test candidates.**
- **Split by `device_id` and/or `capture_session_id` whenever possible** (all samples from same device/session assigned to one split).
- **Independent test set:** reserve unseen devices/sessions/conditions where feasible.
- Split manifests (`docs/splits_manifest.schema.json`, templates in `splits/*_candidates/` or `docs/`) declare membership; validator checks overlap and leakage risks.

## 6. Validation and non-destructive handling
- Validator checks existence/readability, schema/correctness, bbox/dimensions, numeric/unit validity, readability consistency, duplicates, missing annotations, split leakage, and distribution/counts.
- Validator outputs machine-readable and/or human-readable report with errors/warnings/summary statistics.
- **Validator must not silently repair or overwrite original annotations or raw images.**

## 7. Data quality and provenance
- Genuine jewellery-scale photographs only. Raw images remain unchanged.
- Never use Mendeley energy-meter dataset as jewellery-scale ground truth.
- If in-domain images are unavailable, maintain pipeline/schema/docs/checklists without inventing data.

## 8. References
- `docs/annotation_schema.json` — canonical JSON schema
- `docs/annotation_template.json` — example records
- `docs/splits_manifest.schema.json` — split manifest schema
- `docs/collection_instructions.md` — collection protocol
- `real_world_evaluation/runners/validate_scale_photos_dataset.py` — validator
- `real_world_evaluation/runners/eval_scale_photos_baseline.py` — baseline evaluation runner
