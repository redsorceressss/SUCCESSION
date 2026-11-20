# Team-Collected Weighing Scale Photographs Protocol

This directory is designated for real smartphone photographs of digital precision scales commonly used in Indian jewellery workshops and retail counters.

## Collection Protocol
1. **Target:** 20–30 real photos across diverse realistic shop conditions:
   * **Lighting:** Bright indoor LED, dim workshop, direct window sunlight, smartphone flash-on.
   * **Viewing Angles:** Straight-on ($0^\circ$), slight tilt ($15^\circ$), steep angle ($30^\circ$).
   * **Optical Challenges:** Reflections on glass draft shields, dusty display windows, scratched covers.
   * **Weight Magnitudes:** Sub-1g weights (e.g. 0.250g), typical small ornaments (1–10g), heavy bars (10–100g).
2. **Ground Truth:**
   * Every photo must have the true reading verified at the moment of photography and stored as an exact `Decimal` string with explicit 2 or 3 decimal place precision.
3. **Storage:**
   * Photographs placed in `images/<photo_id>.jpg`.
   * Metadata recorded in `labels.json` conforming to `labels.schema.json`.

> **Status:** Empty. Per user instructions, no synthetic images or stock images are placed here. Real photos will be populated by the team.


---

## Phase 9.2 Dataset Engineering Structure (additive)

This dataset now includes a Phase 9.2-compliant structure for in-domain jewellery scale-photo engineering and baseline evaluation:

- `raw/` — raw, unmodified source images
- `annotated/` — annotation manifests/records and derived annotation artifacts (kept separate from raw originals)
- `splits/train_candidates/`, `splits/val_candidates/`, `splits/test_candidates/` — split manifests/lists (leakage-aware)
- `docs/` — canonical Phase 9.2 documentation and schemas
  - `docs/annotation_schema.json` (canonical required-field schema)
  - `docs/annotation_template.json`
  - `docs/dataset_spec.md`
  - `docs/collection_instructions.md`
  - `docs/splits_manifest.schema.json`, `docs/splits_manifest.template.json`
- `results/` — dataset-local evaluation outputs

**Canonical annotation fields (Phase 9.2):** `image_id`, `display_bounding_box`, `display_text`, `weight_value`, `unit`, `readability`, `scale_type`, `lighting_condition`, `camera_angle`, `device_id`, `capture_session_id`, `annotation_status`.

**Legacy compatibility:** `labels.schema.json` and the original protocol above are retained for reference/backward compatibility; Phase 9.2 validation/evaluation uses the canonical schema in `docs/`.

**Validation:** `python -m real_world_evaluation.runners.validate_scale_photos_dataset --dataset real_world_evaluation/datasets/ocr/scale_photos --annotations <annotations.json> [--splits <splits_manifest.json>]`  
**Baseline evaluation:** `python -m real_world_evaluation.runners.eval_scale_photos_baseline --dataset real_world_evaluation/datasets/ocr/scale_photos --annotations <annotations.json> [--split test|val|train|all] [--splits <splits_manifest.json>]`  
**Important:** Raw images remain unchanged. Validators/runners must not silently repair or overwrite original annotations. Never use the Mendeley energy-meter dataset as jewellery-scale ground truth. No synthetic/fabricated dataset images or labels may be created.
