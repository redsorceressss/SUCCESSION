# SUCCESSION Core Systems & Engine Guide

## Core Engine Architecture
The `core_engine/` package contains pure Python, zero-network, high-precision domain logic for gold transactions, conservation laws, cryptographic hash-chaining, dispute math, and offline QR handshakes.

### Modules Breakdown
1. **`purity.py`**:
   - `fine_gold(weight_g, karat) -> Decimal`: Converts gross weight to pure 24K fine-gold equivalent:
     $$\text{Fine Gold} = \text{quantize}\left(\text{weight} \times \frac{\text{karat}}{24}\right)$$
   - Internal precision: 4 decimal places (`0.0001` g = 0.1 mg).
   - Strict range validation ($1 \le \text{karat} \le 24$).

2. **`conservation.py`**:
   - Implements mass conservation across jeweller and karigar handovers:
     $$\text{Gap to explain} = \text{Issued Fine} - \text{Returned Fine}$$
     $$\text{Unexplained Gap} = \text{Gap to explain} - \text{Agreed Wastage} - \text{Recovered Scrap}$$
   - Status categorization:
     - `BALANCED`: Unexplained gap is zero.
     - `WITHIN_TOLERANCE`: Gap is within physical tolerance threshold ($\le 0.20$ g).
     - `REVIEW`: Loss exceeds agreed tolerance, requiring joint shop-floor audit.
     - `NEGATIVE_GAP`: More gold returned than issued (assay discrepancy or metal contamination).

3. **`disputes.py`**:
   - `split_disputed(original, claimed) -> (undisputed, held)`:
     $$\text{Held} = |\text{original} - \text{claimed}|$$
     $$\text{Undisputed} = \min(\text{original}, \text{claimed})$$
   - `settleable(original, claimed, partial_approved) -> (settleable_amount, held)`:
     - If in dispute and partial settlement is NOT approved, settleable amount is strictly `0.0000`.
     - If partial settlement IS approved by both parties, undisputed quantity may settle while the held quantity remains frozen.

4. **`integrity.py`**:
   - Canonical JSON serialization (sorted keys, no whitespace, ensure_ascii=False).
   - SHA-256 hash chaining:
     $$H_i = \text{SHA256}(H_{i-1} \parallel \text{canonical}(E_i))$$
   - `verify_chain(entries) -> (ok, break_index)`: Tamper detection algorithm.

5. **`qr_payload.py`**:
   - Version 1 compact QR handshake:
     `{"v": 1, "tx": tx_id, "ver": version_no, "vh": version_hash, "u": user_id, "r": role, "sig": signature, "ts": timestamp}`
   - Guarantees zero sensitive secrets or bearer tokens in barcode payloads.

6. **`sync_rules.py`**:
   - Validates client-generated UUID idempotency keys and detects out-of-order version conflicts.
