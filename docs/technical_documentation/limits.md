# Honest Scope, Limits & Simulated Components

## 1. Scope & Capabilities
In compliance with the project guidelines, the system makes explicit, honest disclosures regarding what is verified and what is simulated:

1. **Scale-Photo Witness**:
   - **What it does:** Reads digital display readings from well-framed photographs using classic computer vision 7-segment segment illumination analysis. Compares OCR reading with the entered weight within `0.01 g`.
   - **What it does NOT do:** It does **not** certify gold purity, alloy composition, or karatage. It does not replace physical hallmarking or XRF spectrometer assay testing.
   - **Abstention Policy:** Returns `UNREADABLE` on blurry, tilted, or ambiguous displays, asking the human user to confirm or re-enter the weight.

2. **Refiner Assay Recovery**:
   - In manual workshop practices, workshop sweepings, polishing dust, and scrap are periodically batched and sent to a refiner.
   - In this prototype, refiner assay inputs are **simulated** and clearly flagged with `"Refiner assay values are simulated in the prototype."` in API responses and UI labels.

3. **Agentic AI Boundaries**:
   - The agent is an advisory workflow orchestrator and notifier.
   - It **never** decides who is right in a dispute, modifies transactions, releases holds, or approves settlements.
   - All settlements and dispute resolutions require explicit mutual human approval.

4. **Speech-to-Text & Vernacular NLP**:
   - Primary baseline is client-side Web Speech API / typed input with deterministic rule-based parsing.
   - Hinglish/English mixed expressions are supported for key vocabulary.
   - Unknown names or missing fields prompt explicit clarification questions rather than guessing.

5. **Offline Handshake**:
   - Provides hash-chained, client-signed, idempotent sync payloads.
   - QR payloads transfer transaction IDs, version hashes, and client signatures for offline mutual witness.
