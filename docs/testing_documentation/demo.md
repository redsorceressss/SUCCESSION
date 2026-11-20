# Hackathon 3-Minute Live Demonstration Script

## Overview
This script guides the presenter through the 12-scene live demonstration of the shared gold ledger for **Tech4Bharat 2026 (Problem Statement 2.2: Agentic AI)**.

### Demo Credentials (Created via `python -m scripts.seed_demo`):
- **Jeweller:** `jeweller_demo` / `JewellerPass123!` (Shree Jewellers)
- **Karigar:** `ramesh_karigar` / `KarigarPass123!` (Ramesh Artisan)
- **Agent:** `agent1` / `AgentPass123!` (Background advisory agent)

---

## Scene-by-Scene Walkthrough

### Scene 1: Dual Login & Account Isolation
- **Action:** Open two browser windows (or tabs) side by side.
  - Window 1: Login as `jeweller_demo`
  - Window 2: Login as `ramesh_karigar`
- **What Audience Sees:** Jeweller sees overview of orders and karigars. Karigar sees only his personal passbook and assigned orders.
- **Explain:** *"Each karigar has complete, unmediated access to their own ledger account, eliminating information asymmetry."*

### Scene 2: Order Creation with Agreed Wastage Band
- **Action:** Jeweller creates a new order: `POST /orders`
  - Karigar: `ramesh_karigar`
  - Item: `22K Bridal Haar`
  - Due Date: 3 days from today
  - Wastage band: `2.0%`
- **Explain:** *"Wastage is not negotiated retrospectively at month-end; it is codified before any raw gold changes hands."*

### Scene 3: Voice Khata Entry & Spoken Confirmation
- **Action:** Jeweller speaks or submits natural voice string to `POST /voice/parse`:
  > *"Ramesh ko 50 gram, 22 carat, haar ke liye, Friday tak."*
- **What Audience Sees:** Rule parser instantly extracts structured JSON (`karigar: Ramesh`, `weight_g: 50.00`, `karat: 22`, `due_date: Friday`).
- **Read-back Prompt:** System responds:
  > *"Issue 50.00 g of 22 karat gold to Ramesh for haar, due Friday... Is this correct?"*
- **Action:** Jeweller clicks Confirm to submit `POST /transactions/issue`. Entry enters state `AWAITING_CONFIRMATION`.

### Scene 4: Karigar Independent Inspection & Dispute
- **Action:** In Window 2, Karigar views the new entry on their phone.
- **Action:** Karigar checks their counter scale, which shows `49.85` g.
- **Action:** Karigar clicks **Dispute** (`POST /transactions/{id}/disputes`, `claimed_value: 49.85`).
- **System Message Displayed:**
  > *"The jeweller entered 50.00 g. The karigar reports 49.85 g. Entry marked disputed; reweighing requested."*
- **Explain:** *"Notice: The original 50.00 g entry was NOT overwritten. History is immutable. The 0.15 g difference is isolated as a settlement hold."*

### Scene 5: Evidence & Calibrated Reweighing
- **Action:** Both parties attach scale photos and notes.
- **Action:** Jeweller triggers a reweigh request at a calibrated neutral shop counter (`POST /disputes/{id}/reweighing-requests`).
- **Action:** Karigar records the neutral scale result: `49.85` g.

### Scene 6: Advisory Agent Boundary Demonstration
- **Action:** Trigger the background agent pass (`python -m ai_engine.agent.run_once` or `/agent/workflows/execute`).
- **What Audience Sees:** The agent identifies the open dispute, creates a neutral fact summary, and prepares a settlement draft.
- **Crucial Boundary Test:** The agent **cannot** approve the settlement or decide who is right. It gets `403 Forbidden` if it attempts to execute approval.

### Scene 7: Mutual Resolution & Version 2 Creation
- **Action:** Jeweller proposes resolution (`POST /disputes/{id}/resolution-proposals`) accepting `49.85` g.
- **Action:** Karigar accepts the proposal (`POST /resolution-proposals/{rid}/decide`).
- **What Happens Atomically:**
  1. Dispute is marked `RESOLVED`.
  2. The `0.15` g settlement hold is released.
  3. `TransactionVersion #2` (`49.8500` g) is appended with audit hash link.
  4. Both parties are recorded as confirmed, moving state to `CONFIRMED_BY_BOTH`.

### Scene 8: Gold Conservation Equation & Reconciled Passbook
- **Action:** Karigar views updated Passbook (`GET /passbook/{karigar_id}`).
- **What Audience Sees:** Balance updates to exact fine gold:
  $$49.85 \text{ g} \times \frac{22}{24} = 45.6958 \text{ g}$$
- **Action:** When finished piece is returned, Conservation Engine verifies:
  $$\text{Issued} = \text{Returned} + \text{Agreed Wastage} + \text{Scrap} + \text{Unexplained Gap}$$

### Scene 9: Dual Settlement Approval & Tamper-Evident Audit
- **Action:** Jeweller and Karigar both approve final settlement draft.
- **Action:** Run `/audit/verify` -> returns `ok: true`.

---

## Spoken Disclaimers to Mention Aloud:
1. *"The scale photo proves what was displayed on the scale; it does not test chemical purity."*
2. *"Refiner recovery values are simulated for the prototype."*
3. *"The AI agent assists with chores and calculations, but never makes decisions for human artisans."*
