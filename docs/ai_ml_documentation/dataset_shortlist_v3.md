# Corrected Real-World Dataset Shortlist — v3
**Status:** Awaiting user approval before any downloads  
**Baseline:** 75/75 tests passing — no code changes in this document  
**Evaluation directory (proposed):** `real_world_evaluation/`  
**Prepared:** 2026-11-10

> [!IMPORTANT]
> Nothing is downloaded until you explicitly approve this shortlist.  
> Every figure in this document is sourced from verifiable metadata. Where figures are still uncertain, that uncertainty is explicitly stated.

---

## Changes from v2 (Applied Per User Instructions)

| # | Correction Applied |
|---|--------------------|
| 1 | **BIS:** Official government pages only; archive.org mirror removed; attribution requirements recorded; "automatically public domain" claim removed |
| 2 | **CORD v2:** Reclassified from RAG to OCR/document-understanding; download size corrected to **234 MB** (HuggingFace metadata); 100-image test split retained |
| 3 | **Mendeley:** Retained; limitation preserved |
| 4 | **FLEURS:** Exact split counts verified (350 per language); actual download sizes from HuggingFace Parquet metadata; WER/CER defined; jewellery-specific claim removed |
| 5 | **Kathbath:** Moved to optional future phase; not in Phase 1 download |
| 6 | **Hinglish:** Text-only parser tests retained; consent-based recording proposal added |
| 7 | **Deepset:** Count corrected to **662 total / 546 train / 116 test**; license corrected to **Apache-2.0** (not CC-BY-SA 4.0); kept conditional pending team verification; injection evaluation separated from RBAC/authorization tests |
| 8 | **Evaluation design:** General benchmarks separated from jewellery-specific validation; metrics and ground-truth requirements added per subsystem; production isolation requirement stated |
| 9 | **Total download estimate:** Recalculated from actual file sizes |

---

## SECTION 1 — RAG Datasets

### Dataset R1 — BIS Hallmarking Reference Content (Government Web Pages)

| Field | Value |
|-------|-------|
| Source URLs | [bis.gov.in — Hallmarking FAQs](https://www.bis.gov.in) · [consumerhelpline.gov.in — IS 1417 Summary](https://consumerhelpline.gov.in) |
| Actual contents | Fineness grades (958, 916, 875, 750, 585, 375), karat equivalents, mandatory hallmarking rules, consumer rights, assaying centre requirements |
| Sample count | Web pages — not a counted dataset; estimated 5,000–15,000 words of reference text after scraping |
| Data type | Official government reference text |
| Real vs synthetic | Real regulatory and informational content published by Government of India |
| Ground truth | N/A (reference text, not an annotated benchmark) |
| Subsystem fit | RAG — grounding hallmarking, karat, and purity queries against authoritative government information |
| Estimated ingestion size | ~0.5–1 MB extracted text |

> [!NOTE]
> **Attribution requirements:** Content on `bis.gov.in` and `consumerhelpline.gov.in` is owned by the Bureau of Indian Standards and the Department of Consumer Affairs, Government of India. Per the portal reuse policy, content may be reproduced free of charge provided it is:
> - Used accurately and not presented in a misleading context
> - Accompanied by clear acknowledgment: *"Source: Bureau of Indian Standards / National Consumer Helpline, Government of India"* with retrieval date
>
> Official logos (BIS Standard Mark, National Emblem) are protected under the *Emblems and Names (Prevention of Improper Use) Act, 1950* and **must not be reproduced**.
>
> These pages are **not released under CC0 or any Creative Commons licence**. They carry a government-controlled reuse policy, not automatic public domain status.
>
> **Action:** Record scraping date in `dataset_sources.md`. Store only extracted text, not logos or official marks. Include attribution string in every RAG source citation.

> [!CAUTION]
> **BIS IS 1417:2016 (the standard PDF) is NOT included.** It is a commercially sold document (₹500–₹1,500 from BIS e-sales). The unofficial archive.org mirror is NOT used. Only publicly accessible government web content is scraped.

---

### Dataset R2 — Jewellery Invoice Gap

> [!CAUTION]
> **Honest gap report:** No publicly available, openly licensed dataset of real Indian jewellery bills, karigar receipts, or goldsmith invoices with weight, karat, making charges, and GST fields was found on HuggingFace, Kaggle, Mendeley, or IEEE DataPort as of 2026-11-10.

**Proposed own-collection strategy:**
- Collect 5–10 sanitised real jewellery bills issued to team members
- Redact customer names, addresses, and phone numbers before storage
- Manually annotate fields: `item_name`, `weight_grams` (Decimal), `karat`, `making_charge`, `gst_percent`, `total_amount`, `karigar_name` (if present)
- Store as paired `{image, annotations.json}` in `real_world_evaluation/datasets/rag/jewellery_invoices/`
- Label clearly: *"team-collected, manually annotated, not from a public dataset"*
- **Ground truth:** Manual annotations — exact field values known
- **Metric:** Retrieval precision@1 for field-level queries against ingested invoice chunks

---

## SECTION 2 — OCR / Document-Understanding Datasets

### Dataset O1 — CORD v2 (Consolidated Receipt Dataset)

| Field | Value |
|-------|-------|
| Source URL | [huggingface.co/datasets/naver-clova-ix/cord-v2](https://huggingface.co/datasets/naver-clova-ix/cord-v2) |
| Actual contents | **General commercial receipts from Korea** — menu items, food bills, retail transactions. NOT jewellery invoices. NOT Indian bills. |
| Split used | Test split — **100 images** (`test-00000-of-00001-9c204eb3f4e11791.parquet`) |
| Actual download size | **234 MB** (HuggingFace Parquet metadata, verified) |
| License | CC-BY 4.0 ✓ (open; attribution required) |
| Real vs synthetic | Real receipt photographs |
| Ground truth | Yes — JSON field annotations with bounding boxes, item names, prices, quantities, totals |
| Subsystem fit | **OCR / document-understanding only.** Tests whether the pipeline can parse structured commercial documents. Fields do NOT map to gold weight, karat, karigar, or GST. Must not be described as jewellery invoices at any point. |
| Classification | General external benchmark — NOT jewellery-specific validation |

**Metrics for CORD v2:**

| Metric | Definition | Ground truth required |
|--------|-----------|----------------------|
| Field extraction accuracy | Exact string match on extracted `total`, `item_name`, `qty` fields vs JSON annotations | JSON annotations (included) |
| OCR character accuracy | CER on extracted text vs ground-truth transcripts | JSON annotations (included) |

> [!NOTE]
> CORD v2 results will be reported under the heading *"General document parsing — Korean commercial receipts"*. They are NOT evidence of jewellery-invoice parsing capability.

---

### Dataset O2 — Mendeley Seven-Segment Digital Display Dataset

| Field | Value |
|-------|-------|
| Source URL | [data.mendeley.com/datasets/fnn44p4mj8/1](https://data.mendeley.com/datasets/fnn44p4mj8/1) |
| Title | "Data for: Text detection and Recognition in Raw Image Dataset of Seven Segment Digital Energy Meter Display" — Karthick K. and Kavaskar S., 2019 |
| Actual contents | **169 real photographs of digital ENERGY METER displays** taken in Tamil Nadu, India. Device type is power/electricity meters — NOT jewellery weighing scales. |
| Sample count | 169 images |
| License | **CC0 1.0 Public Domain** ✓ — no attribution required |
| Real vs synthetic | Real photographs |
| Ground truth | Yes — Labelbox bounding-box annotations + COCO JSON digit labels |
| Subsystem fit | **Partial.** Same 7-segment LED/LCD font structure as jewellery scale displays. Useful for validating the core digit-recognition preprocessing pipeline. Does NOT cover: glare, reflection, tilt, dirty glass cover, or any jewellery-weighing-scale context. |
| Estimated size | ~50–80 MB for all 169 images |
| Planned subset | Use all 169 images |
| Classification | General external benchmark — NOT jewellery-specific validation |

**Metrics for Mendeley:**

| Metric | Definition | Ground truth required |
|--------|-----------|----------------------|
| Digit recognition accuracy | Exact digit-string match per image vs COCO label | COCO JSON (included) |
| Character error rate (CER) | Edit distance / ground-truth length | COCO JSON (included) |
| UNREADABLE rate | Fraction of images where system returns UNREADABLE vs fabricated value | Manual review for borderline cases |

> [!WARNING]
> Results will be reported under the heading *"7-segment OCR accuracy — energy meter photographs, Tamil Nadu"*. They are NOT equivalent to jewellery weighing scale performance and must not be presented as such.

---

### Dataset O3 — Jewellery Weighing Scale Gap

> [!CAUTION]
> **Honest gap report:** No publicly available, openly licensed dataset of real jewellery weighing scale display photographs with verified ground-truth weight readings and open licence was found as of 2026-11-10.

**Proposed own-collection (Option A — Recommended):**
- Collect 20–30 real smartphone photographs of jewellery weighing scales covering:
  - Lighting: bright overhead, dim fluorescent, direct sunlight, flash-on
  - Angle: straight-on, 15° tilt, 30° tilt
  - Glare: glass cover reflection present / absent
  - Weight values: sub-1 g, 1–10 g, 10–100 g (covering decimal precision range)
- Manually label each image with correct reading in `Decimal` format
- Store in `real_world_evaluation/datasets/ocr/scale_photos/` with `labels.json`
- Label: *"team-collected, manually labelled, not from a public dataset"*

---

## SECTION 3 — Voice / Speech Datasets

### Metric Definitions (Voice)

| Metric | Definition | Formula |
|--------|-----------|---------|
| **WER** (Word Error Rate) | Fraction of words in ground-truth transcript incorrectly recognised by STT | `(S + D + I) / N` where S=substitutions, D=deletions, I=insertions, N=total ground-truth words |
| **CER** (Character Error Rate) | Same as WER but at character level | `(S + D + I) / N` at character level |
| **Number extraction accuracy** | Exact match on numeric fields (weights, karats, quantities) parsed from transcript | `correct_extractions / total_numeric_references` |
| **Jewellery-term recall** | Fraction of jewellery vocabulary tokens correctly identified | `matched_tokens / total_jewellery_tokens` |

> [!IMPORTANT]
> FLEURS and Kathbath evaluate **general speech recognition quality**. They do NOT validate jewellery-specific voice command understanding. These are separated in the results report.

---

### Dataset V1 — Google FLEURS (hi_in + kn_in test splits)

| Field | Value |
|-------|-------|
| Source URL | [huggingface.co/datasets/google/fleurs](https://huggingface.co/datasets/google/fleurs) |
| Actual contents | Multilingual read speech — everyday sentences (Wikipedia/news-derived). 102 languages. We use Hindi (`hi_in`) and Kannada (`kn_in`) test splits only. |
| **Exact test split counts** | `hi_in` test: **350 clips** · `kn_in` test: **350 clips** (verified from HuggingFace dataset metadata) |
| **Actual download sizes** | `hi_in` test Parquet: **306 MB** · `kn_in` test Parquet: **731 MB** (verified from HuggingFace file metadata) |
| **Total for both** | **~1,037 MB (~1.0 GB)** |
| License | **CC-BY 4.0** ✓ (attribution required) |
| Access | Public, no gating, no login required |
| Format | 16 kHz mono `.wav` audio embedded in Parquet + verbatim transcript per clip |
| Real vs synthetic | Real human recordings |
| Ground truth | Yes — verbatim transcripts included |
| Subsystem fit | Tests STT transcription quality on natural Hindi and Kannada audio. NOT jewellery-domain — sentences are general everyday content. |
| Classification | General external benchmark — NOT jewellery-specific validation |

**Metrics applied to FLEURS:**

| Metric | Applied to | Notes |
|--------|-----------|-------|
| WER | Full transcript per clip | Lower is better; baseline for STT component |
| CER | Full transcript per clip | Supplementary to WER |
| Number extraction accuracy | Any numeric tokens in transcript | Secondary metric; depends on numeric content in sampled clips |

> [!NOTE]
> FLEURS contains no jewellery-specific vocabulary. Results are reported under *"General Hindi/Kannada STT quality — Google FLEURS test set"* and are NOT evidence of jewellery transaction command accuracy.

---

### Dataset V2 — AI4Bharat Kathbath (Optional — Future Phase Only)

| Field | Value |
|-------|-------|
| Source URL | [huggingface.co/datasets/ai4bharat/Kathbath](https://huggingface.co/datasets/ai4bharat/Kathbath) |
| Status | **NOT included in Phase 1 downloads** |
| Reason deferred | Gated access (HuggingFace login + terms acceptance required); full dataset ~174 GB; streaming subset requires network planning; adds complexity before simpler datasets are evaluated |
| Future action | If FLEURS results show STT gaps, Kathbath can be revisited for Phase 2 with a streaming subset of 50 clips per language (~750 MB) |

---

### Dataset V3 — Hinglish NLP Evaluation

**Phase 1 — Text-only parser test cases (approved, no audio needed):**
- Write 15–20 Hinglish gold transaction sentences covering:
  - Weight references: `"ek tola gold diya"`, `"dus gram ka cheque"`, `"paanch gram se zyada nahi"`
  - Karat references: `"twenty-two karat ka haar"`, `"baais karat ki ring"`
  - Conflict/ambiguity: `"ek piece aur ek tola"` (should trigger clarification)
  - Relative dates: `"aaj ki entry"`, `"kal wala payment"`
- Feed each sentence directly to `parse_entry()` in `ai_engine/voice/parse_rules.py`
- Metric: exact match on extracted `weight`, `karat`, `article`, and `date` fields
- Label: *"text-based Hinglish evaluation — no audio recordings used"*

**Phase 2 — Consent-based Hinglish recording collection (proposal for future):**
- Recruit 3–5 volunteer speakers who naturally code-switch between Hindi and English in business contexts
- Record 10–15 utterances per speaker covering gold transaction scenarios
- Obtain written informed consent before recording
- Transcribe manually, then run through STT + parser pipeline
- Label: *"team-collected consent-based recordings — not from a public dataset"*
- Store under `real_world_evaluation/datasets/voice/hinglish_recordings/` with consent log

---

## SECTION 4 — Agent Safety Dataset

### Dataset A1 — Deepset Prompt Injections (Conditional)

| Field | Value |
|-------|-------|
| Source URL | [huggingface.co/datasets/deepset/prompt-injections](https://huggingface.co/datasets/deepset/prompt-injections) |
| Actual contents | Adversarial text samples designed to manipulate LLM behaviour — instruction overrides, role hijacking, context leaking, jailbreak attempts |
| **Actual counts** | **662 total rows: 546 train / 116 test** (verified from HuggingFace metadata) |
| **License** | **Apache-2.0** (verified from HuggingFace repository card) |
| Previous v2 error | v2 incorrectly stated CC-BY-SA 4.0 — this was wrong. The confirmed licence is **Apache-2.0**. |
| Access | Public, no gating |
| Format | CSV / Parquet; binary label: injection=1, benign=0 |
| Real vs synthetic | Mix of researcher-authored adversarial samples and real collected examples |
| Ground truth | Yes — binary classification labels |
| Estimated size | ~2 MB |
| Planned subset | Test split (116 rows) for initial evaluation; full 662 for extended run |
| **Status** | **Conditional** — Apache-2.0 is permissive for this use; however, team should verify on the [HuggingFace repository page](https://huggingface.co/datasets/deepset/prompt-injections) directly before download, as licence metadata can occasionally differ from the card |

> [!IMPORTANT]
> **Scope: prompt injection in RAG/agent gateway only.**  
> This dataset evaluates `sanitize_and_check_injection()` in `ai_engine/rag/rag_engine.py` and agent input boundary conditions.  
>
> It does **NOT** evaluate backend authorisation, role-based access control (RBAC), JWT validation, or multi-tenant data isolation. Those are tested by the existing test suite (`tests/`) and are separate concerns requiring their own security-focused test cases, not this NLP dataset.

---

## SECTION 5 — Evaluation Design Principles

### 5.1 Separation: General Benchmarks vs Jewellery-Specific Validation

| Category | Datasets | Evaluation label |
|----------|---------|-----------------|
| **General external benchmarks** | CORD v2, Mendeley, FLEURS, Deepset | *"General [subsystem] quality — [dataset name]"* |
| **Jewellery-specific validation** | BIS web content (RAG), team-collected invoices, team-collected scale photos, Hinglish text cases | *"Jewellery-domain validation — team-collected / BIS reference"* |

Results in `real_world_report.md` must clearly distinguish these two categories. General benchmarks establish baseline capabilities. Jewellery-specific results are the primary evidence of real-world fitness.

### 5.2 Metrics and Ground-Truth Requirements Per Subsystem

| Subsystem | Dataset | Primary metric | Ground truth source |
|-----------|---------|---------------|-------------------|
| RAG retrieval | BIS web content | Precision@1, MRR | Manual relevance labels per query |
| RAG safety | Deepset A1 (test split) | Injection detection accuracy, false positive rate | Binary labels (included) |
| OCR — general docs | CORD v2 | Field extraction accuracy, CER | JSON annotations (included) |
| OCR — 7-segment | Mendeley O2 | Digit string accuracy, CER, UNREADABLE rate | COCO JSON (included) |
| OCR — scale (jewellery) | Team-collected O3 | Exact decimal match, UNREADABLE rate | Manual labels (team) |
| Voice STT — Hindi | FLEURS hi_in | WER, CER | Verbatim transcripts (included) |
| Voice STT — Kannada | FLEURS kn_in | WER, CER | Verbatim transcripts (included) |
| Voice NLP — Hinglish | Text cases V3 | Field extraction exact match | Manual annotations (team) |
| Agent safety (NLP) | Deepset A1 (test split) | Injection detection accuracy | Binary labels (included) |
| Backend auth / RBAC | Existing test suite | Pass/fail (75 baseline tests) | Test assertions |

### 5.3 Production Isolation Rules

> [!CAUTION]
> These rules are non-negotiable. Violation would corrupt the production system:
>
> 1. **No evaluation data enters `swarn.db`** (the production SQLite database) at any point.
> 2. **No evaluation data is used as training data** for any model.
> 3. **All evaluation data lives exclusively under `real_world_evaluation/datasets/`**.
> 4. **Evaluation runners in `real_world_evaluation/runners/` do not import production route handlers** — they call AI module functions directly and use a separate evaluation context.
> 5. **The existing 75-test baseline is not modified** — it remains the production regression suite.
> 6. **No production code is modified** as part of real-world evaluation setup.

---

## SECTION 6 — Proposed Directory Structure

```
real_world_evaluation/
├── datasets/
│   ├── rag/
│   │   ├── bis_summaries/              # BIS + consumerhelpline.gov.in scraped text
│   │   │   ├── raw/                    # Raw HTML or plain text, scraped with date stamp
│   │   │   └── chunked/                # Pre-chunked for RAG ingestion
│   │   └── jewellery_invoices/         # Team-collected; manually annotated
│   │       ├── images/
│   │       └── annotations.json
│   ├── ocr/
│   │   ├── cord_v2/                    # CORD v2 test split (100 imgs, 234 MB)
│   │   │   ├── images/
│   │   │   └── annotations/
│   │   ├── mendeley_energy_meter/      # 169 CC0 7-seg energy meter photos
│   │   │   ├── images/
│   │   │   └── coco_annotations.json
│   │   └── scale_photos/               # Team-collected weighing scale photos
│   │       ├── images/
│   │       └── labels.json
│   ├── voice/
│   │   ├── fleurs_hi_in_test/          # FLEURS Hindi test split (350 clips, 306 MB)
│   │   ├── fleurs_kn_in_test/          # FLEURS Kannada test split (350 clips, 731 MB)
│   │   ├── hinglish_text_cases/        # Text-only Hinglish NLP test cases
│   │   │   └── hinglish_cases.json
│   │   └── hinglish_recordings/        # Phase 2 (future) consent-based recordings
│   └── agent/
│       └── deepset_injections/         # 662 prompt injection samples (2 MB)
│           └── prompt_injections.csv
├── runners/
│   ├── eval_rag_real.py                # RAG retrieval + safety evaluation
│   ├── eval_ocr_real.py                # OCR evaluation (CORD v2 + Mendeley + scale)
│   ├── eval_voice_real.py              # Voice STT + NLP evaluation
│   └── eval_agent_safety_real.py       # Agent injection safety evaluation
├── results/
│   └── (auto-generated JSON + summary markdown, never committed to production)
├── dataset_sources.md                  # Per-dataset URLs, licences, retrieval dates, attributions
└── real_world_report.md                # Auto-generated after evaluation completes
```

---

## SECTION 7 — Corrected Download Size Estimate

| Dataset | Size source | Planned download |
|---------|------------|-----------------|
| BIS web scrape (R1) | Web text extraction | ~1 MB |
| CORD v2 test split (O1) | HuggingFace Parquet metadata, verified | **234 MB** |
| Mendeley 7-seg (O2) | Mendeley repository listing | **~70 MB** |
| FLEURS hi_in test (V1) | HuggingFace Parquet metadata, verified | **306 MB** |
| FLEURS kn_in test (V1) | HuggingFace Parquet metadata, verified | **731 MB** |
| Deepset injections (A1) | HuggingFace repository | **~2 MB** |
| Team-collected (R2, O3, V3) | Own collection | Negligible (text/JSON) |
| **Total Phase 1** | | **~1,344 MB (~1.3 GB)** |

> [!NOTE]
> The 1.3 GB figure is for Phase 1 downloads from public sources only.  
> Kathbath (~750 MB streaming subset) is explicitly deferred to a future optional phase.  
> Team-collected datasets require no network download — only local storage.

---

## SECTION 8 — Open Decision Required Before Download

| # | Item | Decision needed |
|---|------|----------------|
| **D1** | Deepset licence | Please verify Apache-2.0 on the [HuggingFace repository page](https://huggingface.co/datasets/deepset/prompt-injections) directly. If confirmed, approve download. If a different licence appears, report back before proceeding. |
| **D2** | Phase 1 approval | Approve the full Phase 1 download list (R1 scrape + O1 CORD v2 + O2 Mendeley + V1 FLEURS + A1 Deepset conditional) |
| **D3** | Own-collection timeline | Confirm whether the team will collect scale photos and jewellery invoices before or after the Phase 1 evaluation run |
| **D4** | Hinglish Phase 2 | Approve consent-based recording proposal for future Phase 2 |

---

> [!TIP]
> **Minimum viable Phase 1 (no gating, no own collection, Deepset conditional):**  
> BIS scrape + CORD v2 (234 MB) + Mendeley (70 MB) + FLEURS hi_in (306 MB) + FLEURS kn_in (731 MB)  
> **= ~1,342 MB (~1.3 GB)**, all CC/Apache open licence, no login required.  
> Add Deepset (2 MB) if Apache-2.0 is confirmed on the repository page.
