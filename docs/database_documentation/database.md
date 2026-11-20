# Database Architecture & Schema Specification

## 1. Design Overview
- **Storage Engine:** SQLite for local development (`swarn.db`); fully PostgreSQL-compatible via SQLAlchemy 2.0 ORM.
- **Precision:** Pure `DecimalString` type decorator to store exact text in SQLite while mapping to `decimal.Decimal` in Python. Prevents SQLite `NUMERIC` float coercion.
- **Audit Immutability:** SQLAlchemy event listeners (`before_update`, `before_delete`) strictly block updates or deletions on immutable tables.

---

## 2. Table Specifications (18 Relational Entities)

### 2.1 Identity & Master Data
1. `users`
   - `id`: `Integer`, Primary Key
   - `login`: `String(80)`, Unique, Indexed
   - `name`: `String(120)`
   - `password_hash`: `String(200)` (scrypt standard library hash: `scrypt$<salt>$<hash>`)
   - `role`: `String(20)` (`jeweller` | `karigar` | `agent`)
   - `language`: `String(10)` (default `"en"`)
   - `created_at`: `DateTime` (naive UTC)

2. `orders`
   - `id`: `Integer`, Primary Key
   - `jeweller_id`: `ForeignKey('users.id')`, Indexed
   - `karigar_id`: `ForeignKey('users.id')`, Indexed
   - `description`: `String(200)`
   - `due_date`: `Date`, Nullable
   - `wastage_pct`: `DecimalString`, default `"0"`
   - `status`: `String(20)`, default `"OPEN"` (`OPEN` | `CLOSED`)
   - `created_at`: `DateTime`

---

### 2.2 Ledger Core & Immutability
3. `transactions`
   - `id`: `Integer`, Primary Key
   - `order_id`: `ForeignKey('orders.id')`, Indexed
   - `kind`: `String(10)` (`issue` | `return`)
   - `created_by`: `ForeignKey('users.id')`
   - `current_version`: `Integer`, default `1`
   - `state`: `String(30)`, default `"AWAITING_CONFIRMATION"`, Indexed
   - `client_id`: `String(64)`, Unique, Nullable (Idempotency key)
   - `created_at`: `DateTime`

4. `transaction_versions` *(IMMUTABLE)*
   - `id`: `Integer`, Primary Key
   - `transaction_id`: `ForeignKey('transactions.id')`, Indexed
   - `version_no`: `Integer`
   - `weight_g`: `DecimalString`
   - `karat`: `Integer`
   - `fine_g`: `DecimalString` (Fine-gold equivalent: `weight * karat / 24`)
   - `scrap_g`: `DecimalString`, default `"0"`
   - `note`: `String(300)`
   - `reason`: `String(300)`
   - `created_by`: `ForeignKey('users.id')`
   - `prev_hash`: `String(64)` (SHA-256)
   - `version_hash`: `String(64)` (SHA-256)
   - `created_at`: `DateTime`
   - *Constraint:* `UniqueConstraint("transaction_id", "version_no")`

5. `confirmations` *(IMMUTABLE)*
   - `id`: `Integer`, Primary Key
   - `transaction_id`: `ForeignKey('transactions.id')`, Indexed
   - `version_no`: `Integer`
   - `user_id`: `ForeignKey('users.id')`
   - `version_hash`: `String(64)`
   - `created_at`: `DateTime`
   - *Constraint:* `UniqueConstraint("transaction_id", "version_no", "user_id")`

---

### 2.3 Corrections & Disputes
6. `correction_requests`
   - `id`: `Integer`, Primary Key
   - `transaction_id`: `ForeignKey('transactions.id')`, Indexed
   - `base_version_no`: `Integer`
   - `field`: `String(20)` (`weight_g`, `karat`, `scrap_g`, `note`)
   - `original_value`: `String(300)`
   - `proposed_value`: `String(300)`
   - `reason`: `String(300)`
   - `requested_by`: `ForeignKey('users.id')`
   - `status`: `String(12)` (`PENDING` | `ACCEPTED` | `REJECTED`)
   - `decided_by`: `ForeignKey('users.id')`, Nullable
   - `decided_at`: `DateTime`, Nullable
   - `decision_reason`: `String(300)`
   - `resulting_version_no`: `Integer`, Nullable
   - `created_at`: `DateTime`

7. `disputes`
   - `id`: `Integer`, Primary Key
   - `transaction_id`: `ForeignKey('transactions.id')`, Indexed
   - `version_no`: `Integer`
   - `field`: `String(20)`
   - `original_value`: `String(300)`
   - `claimed_value`: `String(300)`
   - `raised_by`: `ForeignKey('users.id')`
   - `reason`: `String(500)`
   - `state`: `String(20)`, default `"OPEN"` (`OPEN` | `RESOLVED`), Indexed
   - `evidence_refs`: `Text` (JSON list of references)
   - `client_id`: `String(64)`, Unique, Nullable
   - `created_at`: `DateTime`
   - `resolved_at`: `DateTime`, Nullable

8. `dispute_notes` *(IMMUTABLE)*
   - `id`: `Integer`, Primary Key
   - `dispute_id`: `ForeignKey('disputes.id')`, Indexed
   - `user_id`: `ForeignKey('users.id')`
   - `text`: `Text`
   - `created_at`: `DateTime`

9. `evidence_files` *(IMMUTABLE)*
   - `id`: `Integer`, Primary Key
   - `transaction_id`: `ForeignKey('transactions.id')`, Indexed
   - `dispute_id`: `ForeignKey('disputes.id')`, Nullable, Indexed
   - `uploader_id`: `ForeignKey('users.id')`
   - `path`: `String(300)`
   - `mime`: `String(60)`
   - `size_bytes`: `Integer`
   - `sha256`: `String(64)`
   - `kind`: `String(20)` (`evidence` | `scale_photo`)
   - `entered_weight`: `DecimalString`, Nullable
   - `ocr_reading`: `DecimalString`, Nullable
   - `ocr_status`: `String(20)` (`MATCH` | `MISMATCH` | `UNREADABLE`)
   - `created_at`: `DateTime`

10. `reweigh_requests`
    - `id`: `Integer`, Primary Key
    - `dispute_id`: `ForeignKey('disputes.id')`, Indexed
    - `requested_by`: `ForeignKey('users.id')`
    - `note`: `String(300)`
    - `status`: `String(12)` (`REQUESTED` | `DONE`)
    - `result_weight_g`: `DecimalString`, Nullable
    - `result_by`: `ForeignKey('users.id')`, Nullable
    - `created_at`: `DateTime`

11. `dispute_resolutions` *(IMMUTABLE)*
    - `id`: `Integer`, Primary Key
    - `dispute_id`: `ForeignKey('disputes.id')`, Indexed
    - `proposed_by`: `ForeignKey('users.id')`
    - `outcome`: `String(20)` (`AGREED_VALUE` | `ORIGINAL_STANDS`)
    - `agreed_value`: `String(300)`, Nullable
    - `note`: `String(500)`
    - `status`: `String(12)` (`PROPOSED` | `APPROVED` | `REJECTED`)
    - `decided_by`: `ForeignKey('users.id')`, Nullable
    - `decided_at`: `DateTime`, Nullable
    - `resulting_version_no`: `Integer`, Nullable
    - `created_at`: `DateTime`

---

### 2.4 Settlements, Holds & Auditing
12. `settlement_holds`
    - `id`: `Integer`, Primary Key
    - `dispute_id`: `ForeignKey('disputes.id')`, Indexed
    - `transaction_id`: `ForeignKey('transactions.id')`, Indexed
    - `order_id`: `ForeignKey('orders.id')`, Indexed
    - `held_g`: `DecimalString`
    - `created_at`: `DateTime`
    - `released_at`: `DateTime`, Nullable

13. `settlements`
    - `id`: `Integer`, Primary Key
    - `order_id`: `ForeignKey('orders.id')`, Indexed
    - `created_by`: `ForeignKey('users.id')`
    - `state`: `String(12)` (`DRAFT` | `APPROVED` | `REJECTED`)
    - `partial`: `Boolean`, default `False`
    - `draft_json`: `Text`
    - `fingerprint`: `String(64)` (SHA-256 state hash for stale draft detection)
    - `created_at`: `DateTime`

14. `settlement_approvals` *(IMMUTABLE)*
    - `id`: `Integer`, Primary Key
    - `settlement_id`: `ForeignKey('settlements.id')`, Indexed
    - `user_id`: `ForeignKey('users.id')`
    - `decision`: `String(10)` (`APPROVE` | `REJECT`)
    - `accept_partial`: `Boolean`, default `False`
    - `reason`: `String(300)`, default `""`
    - `created_at`: `DateTime`
    - *Constraint:* `UniqueConstraint("settlement_id", "user_id")`

15. `audit_events` *(IMMUTABLE, Append-Only)*
    - `id`: `Integer`, Primary Key
    - `payload`: `Text` (Canonical JSON)
    - `prev_hash`: `String(64)`
    - `hash`: `String(64)`

---

### 2.5 Offline Sync & Agent Background Tasks
16. `sync_records`
    - `id`: `Integer`, Primary Key
    - `idempotency_key`: `String(80)`, Unique
    - `user_id`: `ForeignKey('users.id')`
    - `kind`: `String(30)`
    - `result_json`: `Text`
    - `created_at`: `DateTime`

17. `notifications`
    - `id`: `Integer`, Primary Key
    - `user_id`: `ForeignKey('users.id')`, Indexed
    - `kind`: `String(30)`
    - `message`: `String(500)`
    - `dedupe_key`: `String(80)`, Nullable
    - `read`: `Boolean`, default `False`
    - `created_at`: `DateTime`
    - *Constraint:* `UniqueConstraint("user_id", "dedupe_key")`

18. `agent_tasks`
    - `id`: `Integer`, Primary Key
    - `kind`: `String(30)`
    - `order_id`: `ForeignKey('orders.id')`, Nullable
    - `summary`: `Text`
    - `created_at`: `DateTime`
