# Genuine Jewellery-Scale Image Collection Instructions (Phase 9.2)

**Purpose:** Collect real, in-domain photographs of jewellery weighing scales for dataset engineering and baseline evaluation.  
**Policy:** No synthetic/fabricated images or labels. Do not use energy-meter datasets as jewellery-scale ground truth.

## 1. Capture protocol
- **Subjects:** Real digital precision scales used in jewellery workshops/retail counters (various models/display types).
- **Target diversity:** multiple scale models, display layouts (7-segment LED/LCD/dot-matrix if present), lighting (normal, low light, bright, glare, shadow), camera angles (front, tilted, side/top-down/steep), distances, and weight magnitudes (sub-gram, typical ornaments, heavier items).
- **Conditions to include:** clean displays, slight blur, reflections/glare, partial occlusion, dust/scratches on covers (when naturally occurring), different backgrounds.
- **Capture sessions:** record `capture_session_id` per setup/session/burst; record `device_id` per physical scale/device.

## 2. Ground truth recording (at capture time)
- Record the **exact visible display text** (`display_text`) and **exact numeric weight** (`weight_value`) as a decimal string (preserve precision, e.g. `0.250`, `12.34`, `100.000`).
- Record **unit** shown/used (`g`, `kg`, `mg`, `ct`, `oz`, `dwt`, or `other`).
- If unreadable or uncertain, mark `readability` as `unreadable` or `partially_readable` and set `weight_value` to `null` when not reliably parseable. **Never guess.**
- Capture/display verification should be performed by a human observer at time of photo; record verifier in `annotator_id`/notes when available.

## 3. File handling and privacy
- Store originals in `raw/` and **never modify raw images**.
- Use stable, unique filenames/IDs (`image_id`, `image_file`).
- Remove or avoid capturing sensitive personal/business information in frame when possible; if present, handle per project privacy/anonymization policy before sharing.

## 4. Annotation requirements
- Create annotation records conforming to `docs/annotation_schema.json` (see `docs/annotation_template.json`).
- **Required fields:** `image_id`, `display_bounding_box`, `display_text`, `weight_value`, `unit`, `readability`, `scale_type`, `lighting_condition`, `camera_angle`, `device_id`, `capture_session_id`, `annotation_status`.
- **Bounding box:** pixel coordinates in original image space `{x_min,y_min,x_max,y_max}` tightly around the readable display region.
- **Status workflow:** `pending` → `verified` (or `rejected` with reason in notes). Do not silently repair original annotations.

## 5. Splitting and leakage prevention
- Maintain `splits/train_candidates`, `splits/val_candidates`, `splits/test_candidates` manifests.
- **No duplicate images across splits.**
- **Prefer split by `device_id` and/or `capture_session_id`** to avoid leakage (same device/session must not appear in different splits).
- Reserve a genuinely independent **test** set (ideally unseen devices/sessions/conditions).

## 6. Validation and evaluation
- Run dataset validation before use:
  - `python -m real_world_evaluation.runners.validate_scale_photos_dataset --dataset real_world_evaluation/datasets/ocr/scale_photos --annotations <path> --splits <path>`
- Run baseline evaluation only on eligible in-domain annotated data:
  - `python -m real_world_evaluation.runners.eval_scale_photos_baseline --dataset real_world_evaluation/datasets/ocr/scale_photos --annotations <path> --output real_world_evaluation/datasets/ocr/scale_photos/results/<output>.json`

## 7. Minimum pilot guidance (not a guarantee of training readiness)
- A useful initial collection target is approximately **300–500 properly labeled images** with diversity across devices/sessions/conditions and high-quality verified annotations.
- Training/model introduction remains out of Phase 9.2 and requires separate approval after ML readiness assessment.
