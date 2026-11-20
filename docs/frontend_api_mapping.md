# Frontend-to-Backend API Mapping Specification

| Screen | Route Path | HTTP Method | Endpoint | Request Body / Params | Response Fields | Role Guard |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| Login | `#/login` | `POST` | `/auth/login` | `{login, password}` | `access_token`, `user: {id, name, role}` | Public |
| Register | `#/register` | `POST` | `/auth/register` | `{login, name, password, role, language}` | `{id, login, role}` | Public |
| Dashboard | `#/dashboard` | `GET` | `/orders` | None | `[Order]` | Authenticated |
| Orders | `#/orders` | `GET` | `/orders` | None | `[Order]` | Authenticated |
| Create Order | Modal on `#/orders` | `POST` | `/orders` | `{karigar_login, description, due_date, wastage_pct}` | `Order` | Jeweller |
| Order Detail | `#/orders/:id` | `GET` | `/orders/{id}` | None | `Order` | Party |
| Order Summary | `#/orders/:id` | `GET` | `/orders/{id}/summary` | None | `ConservationDraft` | Party |
| Order Tx List | `#/orders/:id` | `GET` | `/transactions?order_id={id}` | Query: `order_id` | `[Transaction]` | Party |
| Issue Gold | `#/issue` | `POST` | `/transactions/issue` | `{order_id, weight_g, karat, note, client_id}` | `Transaction` | Jeweller |
| Return Gold | `#/return` | `POST` | `/transactions/return` | `{order_id, weight_g, karat, scrap_g, note, client_id}` | `Transaction` | Party |
| Tx Detail | `#/transactions/:id` | `GET` | `/transactions/{id}` | None | `Transaction` | Party |
| Tx History | `#/transactions/:id` | `GET` | `/transactions/{id}/history` | None | `{transaction, versions, confirmations, correction_requests, disputes}` | Party |
| Confirm Tx | `#/transactions/:id/confirm` | `POST` | `/transactions/{id}/confirm` | `{version_no}` | `Transaction` | Party |
| Request Correction | `#/transactions/:id/correction` | `POST` | `/transactions/{id}/correction-requests` | `{field, proposed_value, reason}` | `CorrectionRequest` | Party |
| Decide Correction | In Tx Detail | `POST` | `/correction-requests/{id}/decide` | `{decision: "accept"|"reject", reason}` | `CorrectionRequest` | Counterparty |
| Raise Dispute | `#/transactions/:id/dispute` | `POST` | `/transactions/{id}/disputes` | `{field, claimed_value, reason, client_id, evidence_refs}` | `Dispute` | Party |
| Dispute List | `#/disputes` | `GET` | `/disputes` | None | `[Dispute]` | Party |
| Dispute Detail | `#/disputes/:id` | `GET` | `/disputes/{id}` | None | `Dispute` (with notes & evidence) | Party |
| Add Note | `#/disputes/:id` | `POST` | `/disputes/{id}/notes` | `{text}` | `DisputeNote` | Party |
| Upload Evidence | `#/disputes/:id` | `POST` | `/disputes/{id}/evidence` | Multipart: `file` | `{id, dispute_id, sha256, mime, size_bytes}` | Party |
| Request Reweigh | `#/disputes/:id` | `POST` | `/disputes/{id}/reweighing-requests` | `{note}` | `ReweighRequest` | Party |
| Propose Resolution | `#/disputes/:id` | `POST` | `/disputes/{id}/resolution-proposals` | `{outcome, agreed_value, note}` | `DisputeResolution` | Party |
| Decide Resolution | `#/disputes/:id` | `POST` | `/resolution-proposals/{id}/decide` | `{decision: "accept"|"reject"}` | `DisputeResolution` | Counterparty |
| Passbook | `#/passbook` | `GET` | `/passbook/{karigar_id}` | Path: `karigar_id` | `{totals, orders, settlements}` | Party |
| Draft Settlement | `#/settlement` | `POST` | `/settlements` | `{order_id}` | `Settlement` | Jeweller / Agent |
| Settlement Detail | `#/settlement` | `GET` | `/settlements?order_id={id}` | Query: `order_id` | `[Settlement]` | Party |
| Approve Settlement | `#/settlement` | `POST` | `/settlements/{id}/approve` | `{accept_partial: boolean}` | `Settlement` | Party (Both) |
| Reject Settlement | `#/settlement` | `POST` | `/settlements/{id}/reject` | `{reason}` | `Settlement` | Party |
| Parse Voice | In Issue/Return | `POST` | `/voice/parse` | `{text, language}` | `VoiceDraft` | Jeweller |
| Scale Photo OCR | In Issue/Return | `POST` | `/scale-photos` | Multipart: `transaction_id, entered_weight, file` | `{evidence_id, ocr_reading_g, status, sha256}` | Party |
| Sync Ingest | Background | `POST` | `/sync/ingest` | `{items: [{idempotency_key, kind, payload}]}` | `{ingested, results}` | Authenticated |
| Health Ping | Background | `GET` | `/misc/ping` | None | `{"status": "ok"}` | Public |
