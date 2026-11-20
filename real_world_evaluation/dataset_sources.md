# Real-World Dataset Sources & Provenance Register

This document registers all external sources, licences, attributions, hashes, and download dates used in the real-world evaluation environment.

---

## 1. R1: BIS Official Hallmarking & Consumer Reference Content
* **Publisher:** Bureau of Indian Standards (BIS) & Department of Consumer Affairs, Government of India
* **Source URLs:**
  * BIS Hallmarking FAQs: `https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/hallmarking-faq/?lang=en`
  * BIS Common Consumer FAQs: `https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/common-consumer-faq/?lang=en`
  * BIS Jewellers Obligations: `https://www.bis.gov.in/hallmarking-jewellers/?lang=en`
* **Retrieval Date:** 2026-11-10
* **Licence / Terms:** Government of India Portal Reuse Policy. Material can be reproduced free of charge provided it is used accurately, not in a misleading context, and accompanied by acknowledgment of source. Official logos and marks are protected under the *Emblems and Names (Prevention of Improper Use) Act, 1950* and are excluded.
* **Attribution Statement:** *"Source: Bureau of Indian Standards / National Consumer Helpline, Government of India (Retrieved November 2026)."*
* **Storage Location:** `real_world_evaluation/datasets/rag/bis_summaries/`
* **Real vs Synthetic:** Genuine regulatory information published by the national standards body.

---

## 2. O1: Mendeley Seven-Segment Digital Display Dataset
* **Authors:** Karthick K., Kavaskar S. (2019)
* **Title:** "Data for: Text detection and Recognition in Raw Image Dataset of Seven Segment Digital Energy Meter Display"
* **Source URL:** `https://data.mendeley.com/datasets/fnn44p4mj8/1` (DOI: 10.17632/fnn44p4mj8.1)
* **Licence:** CC0 1.0 Public Domain Dedication.
* **Contents:** 169 real photographs of digital energy meter displays taken in Tamil Nadu, India, with COCO bounding box annotations.
* **Domain Limitation:** Energy meters, not jewellery weighing scales. Captured under stable ambient light without extreme specular glare or steep viewing angles.
* **Attribution Statement:** *"Karthick K, Kavaskar S, Data for: Text detection and Recognition in Raw Image Dataset of Seven Segment Digital Energy Meter Display, Mendeley Data, V1, 2019."*
* **Storage Location:** `real_world_evaluation/datasets/ocr/mendeley_energy_meter/`
* **Real vs Synthetic:** Real camera photographs.

---

## 3. V1: Google FLEURS Multilingual Speech (Selective Pilot)
* **Authors:** Conneau et al. (Google Research, 2022)
* **Source URL:** `https://huggingface.co/datasets/google/fleurs`
* **Licence:** CC-BY 4.0.
* **Subsets:** Hindi (`hi_in`) test split and Kannada (`kn_in`) test split.
* **Pilot Retrieval:** Selective sample of 25 Hindi audio clips and 25 Kannada audio clips retrieved via streaming / targeted API without full Parquet transfer (~15–25 MB total).
* **Domain Limitation:** Read speech of general sentences. Does not evaluate jewellery-specific voice transactions or colloquial trading vocabulary.
* **Attribution Statement:** *"Google FLEURS speech dataset, licensed under CC-BY 4.0 (Conneau et al., 2022)."*
* **Storage Location:** `real_world_evaluation/datasets/voice/fleurs_hi_in_pilot/` & `fleurs_kn_in_pilot/`
* **Real vs Synthetic:** Real human voice recordings.

---

## 4. V2: Hinglish Gold Transaction NLP Cases
* **Authors:** Internal Hackathon Team
* **Contents:** 18 challenging spoken/typed gold transaction sentences reflecting real Indian jewellery workshop dialogues (code-switching Hindi-English, regional numbers, fractional weights, ambiguity, karigar collisions).
* **Licence:** Dedicated to project repository.
* **Storage Location:** `real_world_evaluation/datasets/voice/hinglish_text_cases/hinglish_cases.json`
* **Real vs Synthetic:** Authored realistic scenarios; evaluated strictly as a deterministic text parser benchmark without synthetic ASR audio.

---

## 5. A1: Deepset Prompt Injections (ON HOLD)
* **Publisher:** Deepset (`deepset/prompt-injections` on Hugging Face)
* **Current Status:** **ON HOLD by user directive.**
* **Licensing Discrepancy:** The Hugging Face repository metadata declares `Apache-2.0`, while the README dataset card references `CC-BY-4.0`.
* **Action:** Excluded from download until licensing is officially confirmed and approved.

---

## 6. Team-Collected Datasets (Pending Real Collection)
* **R2: Jewellery Invoices:** Template established in `real_world_evaluation/datasets/rag/jewellery_invoices/`. Zero fabricated invoices included.
* **O2: Scale Display Photos:** Template established in `real_world_evaluation/datasets/ocr/scale_photos/`. Zero fabricated photos included.
