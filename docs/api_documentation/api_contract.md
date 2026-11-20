# REST API Specification & Contract

## Overview
All endpoints (except `/auth/register` and `/auth/login`) require Bearer token authentication via HTTP header:
```
Authorization: Bearer <jwt_access_token>
```

### Roles
- `jeweller`: Shop owner / manager.
- `karigar`: Artisan goldsmith.
- `agent`: Automated service account for scheduled tasks, notifications, and drafting.

### Standard Error Responses
- `400 Bad Request`: Malformed payload or invalid state change.
- `401 Unauthorized`: Missing, expired, or invalid JWT token.
- `403 Forbidden`: Authenticated user lacks permission or access to requested resource.
- `404 Not Found`: Entity not found.
- `409 Conflict`: Business rule violation, stale draft, or duplicate action.
- `413 Payload Too Large`: Upload exceeds maximum size (5 MB default).
- `415 Unsupported Media Type`: Non-allowed MIME type for file upload.
- `422 Unprocessable Entity`: Validation failure on input schema or invalid Decimal value.

---

## 1. Authentication (`/auth`)

### 1.1 User Registration
- **Endpoint:** `POST /auth/register`
- **Access:** Public (jeweller or karigar registration only)
- **Request Body:**
```json
{
  "login": "ramesh_karigar",
  "name": "Ramesh Artisan",
  "password": "SecurePassword123!",
  "role": "karigar",
  "language": "hi"
}
```
- **Success Response (`201 Created`):**
```json
{
  "id": 2,
  "login": "ramesh_karigar",
  "role": "karigar"
}
```

### 1.2 User Login
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Request Body:**
```json
{
  "login": "ramesh_karigar",
  "password": "SecurePassword123!"
}
```
- **Success Response (`200 OK`):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "user": {
    "id": 2,
    "name": "Ramesh Artisan",
    "role": "karigar",
    "language": "hi"
  }
}
```

### 1.3 Identity Self-Lookup
- **Endpoint:** `GET /me`
- **Access:** Authenticated
- **Success Response (`200 OK`):**
```json
{
  "id": 2,
  "login": "ramesh_karigar",
  "name": "Ramesh Artisan",
  "role": "karigar",
  "language": "hi"
}
```

---

## 2. Orders (`/orders`)

### 2.1 Create Order
- **Endpoint:** `POST /orders`
- **Access:** `jeweller`
- **Request Body:**
```json
{
  "karigar_login": "ramesh_karigar",
  "description": "22K Bridal Necklace (Haar)",
  "due_date": "2026-11-20",
  "wastage_pct": "2.0"
}
```
- **Success Response (`201 Created`):**
```json
{
  "id": 1,
  "jeweller_id": 1,
  "karigar_id": 2,
  "description": "22K Bridal Necklace (Haar)",
  "due_date": "2026-11-20",
  "wastage_pct": "2.000",
  "status": "OPEN"
}
```

### 2.2 List Orders
- **Endpoint:** `GET /orders`
- **Access:** `jeweller`, `karigar`, `agent`
- **Notes:** Karigar only sees their own orders; Jeweller sees their shop's orders.
- **Success Response (`200 OK`):** List of Order objects.

### 2.3 Get Order Detail
- **Endpoint:** `GET /orders/{order_id}`
- **Access:** Associated parties or `agent`

### 2.4 Order Reconciliation Summary
- **Endpoint:** `GET /orders/{order_id}/summary`
- **Access:** Associated parties or `agent`
- **Response (`200 OK`):** Reconciled fine-gold breakdown via `core_engine/conservation.py`.

---

## 3. Transactions (`/transactions`)

### 3.1 Issue Gold
- **Endpoint:** `POST /transactions/issue`
- **Access:** `jeweller`
- **Request Body:**
```json
{
  "order_id": 1,
  "weight_g": "50.00",
  "karat": 22,
  "note": "Initial bullion issued for haar",
  "client_id": "uuid-v4-idempotency-key"
}
```
- **Success Response (`201 Created`):**
```json
{
  "id": 1,
  "order_id": 1,
  "kind": "issue",
  "state": "AWAITING_CONFIRMATION",
  "created_by": 1,
  "current_version": {
    "version_no": 1,
    "weight_g": "50.0000",
    "karat": 22,
    "fine_g": "45.8333",
    "scrap_g": "0.0000",
    "note": "Initial bullion issued for haar",
    "reason": "Original entry",
    "created_by": 1,
    "prev_hash": "0000000000000000000000000000000000000000000000000000000000000000",
    "version_hash": "a4f89d...",
    "created_at": "2026-11-10T09:30:00"
  },
  "open_dispute_id": null,
  "created_at": "2026-11-10T09:30:00"
}
```

### 3.2 Return Gold
- **Endpoint:** `POST /transactions/return`
- **Access:** `jeweller` or `karigar`
- **Request Body:**
```json
{
  "order_id": 1,
  "weight_g": "47.10",
  "karat": 22,
  "scrap_g": "1.45",
  "note": "Finished piece returned with scrap",
  "client_id": "uuid-v4-idempotency-key"
}
```

### 3.3 Confirm Transaction Version
- **Endpoint:** `POST /transactions/{tx_id}/confirm`
- **Access:** `jeweller` or `karigar` (Party only)
- **Request Body:**
```json
{
  "version_no": 1
}
```

### 3.4 Request Correction
- **Endpoint:** `POST /transactions/{tx_id}/correction-requests`
- **Access:** Party only
- **Request Body:**
```json
{
  "field": "weight_g",
  "proposed_value": "49.85",
  "reason": "Typo in entered weight"
}
```

### 3.5 Raise Dispute (Mandatory Scenario)
- **Endpoint:** `POST /transactions/{tx_id}/disputes`
- **Access:** Party only
- **Request Body:**
```json
{
  "field": "weight_g",
  "claimed_value": "49.85",
  "reason": "Scale reading shows 49.85 g",
  "client_id": "client-uuid",
  "evidence_refs": []
}
```
- **Success Response (`201 Created`):**
```json
{
  "id": 1,
  "transaction_id": 1,
  "version_no": 1,
  "field": "weight_g",
  "original_value": "50.00",
  "claimed_value": "49.85",
  "raised_by": 2,
  "reason": "Scale reading shows 49.85 g",
  "state": "OPEN",
  "held_g": "0.1500",
  "hold_released": false,
  "message": "The jeweller entered 50.00 g. The karigar reports 49.85 g. Entry marked disputed; reweighing requested.",
  "created": true,
  "transaction": { ... }
}
```

---

## 4. Disputes & Resolution (`/disputes`)

### 4.1 Add Dispute Note
- **Endpoint:** `POST /disputes/{dispute_id}/notes`
- **Request Body:** `{"text": "Re-weighed on calibrated scale"}`

### 4.2 Attach Dispute Evidence
- **Endpoint:** `POST /disputes/{dispute_id}/evidence`
- **Payload:** Multipart form (`file: binary`)

### 4.3 Request Reweighing
- **Endpoint:** `POST /disputes/{dispute_id}/reweighing-requests`
- **Request Body:** `{"note": "Please re-weigh at Shop B counter"}`

### 4.4 Record Reweighing Result
- **Endpoint:** `POST /reweighing-requests/{rid}/result`
- **Request Body:** `{"weight_g": "49.85"}`

### 4.5 Propose Dispute Resolution
- **Endpoint:** `POST /disputes/{dispute_id}/resolution-proposals`
- **Request Body:**
```json
{
  "outcome": "AGREED_VALUE",
  "agreed_value": "49.85",
  "note": "Parties agreed on calibrated scale measurement"
}
```

### 4.6 Decide Resolution Proposal
- **Endpoint:** `POST /resolution-proposals/{rid}/decide`
- **Request Body:**
```json
{
  "decision": "accept",
  "reason": "Confirmed agreement"
}
```

---

## 5. Passbook (`/passbook`)

### 5.1 Get Karigar Passbook
- **Endpoint:** `GET /passbook/{karigar_id}`
- **Access:** Respective `karigar` or associated `jeweller`
- **Success Response (`200 OK`):**
```json
{
  "karigar_id": 2,
  "totals": {
    "issued_fine_g": "45.8333",
    "returned_fine_g": "43.1750",
    "recovered_scrap_fine_g": "1.3292",
    "gold_in_hand_fine_g": "2.6583",
    "held_in_dispute_g": "0.1500"
  },
  "pending_confirmations": [],
  "disputed_entries": [1],
  "orders": [ ... ],
  "entries": [ ... ],
  "spoken_summary": "You hold 2.66 grams of fine gold. 0 entries are waiting for confirmation, 1 are disputed."
}
```

---

## 6. Settlements (`/settlements`)

### 6.1 Draft Settlement
- **Endpoint:** `POST /settlements`
- **Access:** `jeweller` or `agent` (Drafting only)
- **Request Body:** `{"order_id": 1}`
- **Response (`201 Created`):** Draft with unique calculation `fingerprint`.

### 6.2 Approve Settlement (Dual Approval)
- **Endpoint:** `POST /settlements/{sid}/approve`
- **Access:** `jeweller` and `karigar` (Party humans only; Agent gets `403 Forbidden`)
- **Request Body:** `{"accept_partial": false}`
- **Notes:** Returns `409 Conflict` if holds exist and `accept_partial` is false, or if draft is stale.

---

## 7. Scale-Photo Witness (`/scale-photos`)

### 7.1 Upload & Verify Scale Photo
- **Endpoint:** `POST /scale-photos`
- **Access:** Party only
- **Payload:** Multipart form (`transaction_id: int`, `entered_weight: str`, `file: UploadFile`)
- **Success Response (`201 Created`):**
```json
{
  "evidence_id": 1,
  "uploaded_at": "2026-11-10T09:40:00",
  "sha256": "8d3e...",
  "ocr_reading_g": "50.00",
  "entered_g": "50.00",
  "status": "MATCH",
  "needs_manual_confirm": false,
  "disclaimer": "SIMPLIFIED reading. It shows what the scale displayed, not the gold's purity."
}
```

---

## 8. Voice Khata (`/voice/parse`)

### 8.1 Parse Spoken/Typed Entry
- **Endpoint:** `POST /voice/parse`
- **Access:** `jeweller`
- **Request Body:**
```json
{
  "text": "Ramesh ko 50 gram, 22 carat, haar ke liye, Friday tak.",
  "language": "auto"
}
```
- **Response (`200 OK`):**
```json
{
  "kind": "issue",
  "fields": {
    "karigar": "Ramesh Artisan",
    "weight_g": "50",
    "karat": 22,
    "order_ref": "haar",
    "due_date": "2026-11-13"
  },
  "missing": [],
  "questions": [],
  "needs_confirmation": ["due_date", "kind", "order_ref"],
  "readback": "Issue 50.00 g of 22 karat gold to Ramesh Artisan for haar, due Friday 13 Nov 2026. Is this correct?",
  "note": "DRAFT only. Nothing is saved until the user reviews and confirms."
}
```

---

## 9. Offline Synchronization (`/sync`)

### 9.1 Replay Queued Offline Actions
- **Endpoint:** `POST /sync`
- **Access:** Party only
- **Request Body:**
```json
{
  "items": [
    {
      "idempotency_key": "unique-client-action-uuid-1",
      "kind": "dispute_create",
      "payload": {
        "transaction_id": 1,
        "field": "weight_g",
        "claimed_value": "49.85",
        "reason": "Offline scale reading"
      }
    }
  ]
}
```
- **Success Response (`200 OK`):** Array of replay results (accepted, duplicate, conflict, error).

---

## 10. Audit Verification (`/audit/verify`)

- **Endpoint:** `GET /audit/verify`
- **Access:** Authenticated
- **Success Response (`200 OK`):**
```json
{
  "ok": true,
  "first_bad_row": null,
  "rows_checked": 42
}
```
