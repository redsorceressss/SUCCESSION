# Dispute & Correction Workflow (The Mandatory Scenario)

## 1. Guiding Principle
**"Every gram accounted for. Every important entry witnessed by both parties. No forced acceptance."**

When an artisan goldsmith (*karigar*) or a jeweller disagrees with an entry, the disagreement is treated as a **first-class workflow**, not an error condition. 

The original recorded entry is **never overwritten** or deleted. The system isolates the disputed difference, places that delta on a settlement hold, and provides a structured audit trail with notes, photo evidence, and reweighing requests until both parties mutually agree on a resolution.

---

## 2. Mandatory Demonstration Scenario: 50.00 g vs 49.85 g

### Step 1: Jeweller Records Issue Entry
- Jeweller enters or speaks: `50.00` g of 22K gold.
- System creates `Transaction #1` in state `AWAITING_CONFIRMATION` with `TransactionVersion #1` (`50.0000` g).
- The jeweller confirms version 1.

### Step 2: Karigar Inspects and Disagrees
- Karigar checks the entry on their mobile device. Their scale indicates `49.85` g.
- Karigar raises a dispute: `POST /transactions/1/disputes` with `field="weight_g"`, `claimed_value="49.85"`, `reason="Scale shows 49.85"`.
- The system returns the **exact neutral message**:
  > *"The jeweller entered 50.00 g. The karigar reports 49.85 g. Entry marked disputed; reweighing requested."*

### Step 3: Isolation of Disputed Quantity and Settlement Hold
- The core engine computes:
  - Original value: `50.00` g
  - Claimed value: `49.85` g
  - Undisputed portion: `min(50.00, 49.85) = 49.85` g
  - Disputed quantity: `|50.00 - 49.85| = 0.15` g
- A `SettlementHold` row is created for `0.1500` g on Order #1.
- `Transaction #1` state transitions to `DISPUTED`.
- Version 1 (`50.0000` g) remains completely intact in `transaction_versions`.
- A `ReweighRequest` is automatically initiated.

### Step 4: Evidence & Reweighing
- Karigar adds a note: *"Weighed twice on my scale"*.
- Jeweller adds a note: *"Mine showed 50.00"*.
- Both parties upload scale display photographs as evidence (`POST /disputes/{id}/evidence`).
- Parties perform a reweigh at a neutral counter: Karigar submits reweigh result `49.85` g.

### Step 5: Draft Settlement Isolation
- If a settlement draft is generated while the dispute is open:
  - The disputed transaction is excluded from automatic inclusion.
  - The `0.1500` g is displayed under `held_g_total`.
  - The agent **cannot** approve the settlement.
  - A partial settlement can only be approved if both humans explicitly pass `accept_partial=True`.

### Step 6: Mutual Resolution Proposal & Acceptance
- Jeweller proposes resolution: `POST /disputes/{id}/resolution-proposals` with `outcome="AGREED_VALUE"`, `agreed_value="49.85"`.
- The proposal status is `PROPOSED`.
- Karigar reviews the proposal and accepts: `POST /resolution-proposals/{rid}/decide` with `decision="accept"`.
- Backend executes atomic resolution:
  1. `Dispute #1` state becomes `RESOLVED`.
  2. `SettlementHold` on `0.1500` g is marked `released_at = utcnow()`.
  3. `TransactionVersion #2` is appended with `weight_g="49.8500"`, reason: *"Dispute #1 resolved: weight_g agreed as 49.85"*.
  4. Both jeweller and karigar are recorded as having confirmed Version #2.
  5. `Transaction #1` state moves to `CONFIRMED_BY_BOTH`.
  6. Audit chain is updated with immutable SHA-256 event hashes.

---

## 3. Correction Request vs Dispute

| Feature | Correction Request | Dispute |
| :--- | :--- | :--- |
| **Intent** | Minor typo or friendly adjustment | Substantive disagreement requiring reweigh or formal review |
| **State Transition** | Moves to `CORRECTION_REQUESTED` | Moves to `DISPUTED` |
| **Settlement Hold** | No hold created | **Automatic settlement hold** created for disputed delta |
| **Reweighing** | Not triggered | **Reweighing request** automatically initiated |
| **Resolution** | Other party accepts or rejects | Other party must approve proposal (or mutual agreement) |
