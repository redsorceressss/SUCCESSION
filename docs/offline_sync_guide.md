# Offline Synchronization & Cryptographic Non-Repudiation Guide

## Offline Architecture
Indian jewellery workshops frequently operate in basements, rural manufacturing clusters, and secure vaults where cellular reception and internet connectivity are intermittent or unavailable.

SUCCESSION implements an **Offline-First PWA** architecture providing complete transactional continuity, local cryptographic signing, and automatic idempotency reconciliation.

### Local Storage Architecture (IndexedDB)
Database: `succession_offline_v1` (Version 1)

1. **`pending_ops` Store**:
   - Primary Key: `id` (Client UUID v4)
   - Indexes: `status`, `timestamp`, `endpoint`
   - Structure:
     ```json
     {
       "id": "c1f7a3b4-5219-4820-910a-e24bcf819021",
       "endpoint": "/transactions/issue",
       "method": "POST",
       "payload": {
         "order_id": 1,
         "weight_g": "50.0000",
         "karat": 22,
         "client_id": "c1f7a3b4-5219-4820-910a-e24bcf819021"
       },
       "hash": "e894e48e84b4b934e19a6494e83915f5ba7bf3067a96f68efe81d604261bf1e2",
       "status": "PENDING",
       "retries": 0,
       "timestamp": "2026-11-10T14:30:00.000Z"
     }
     ```

2. **`cached_transactions` Store**:
   - Stores locally confirmed transactions and device cryptographic signing keys (`user_signing_keypair_p256`).

3. **`sync_log` Store**:
   - Audit trail of all synced requests, status codes, and server confirmation timestamps.

### Synchronization & Conflict Resolution Protocol
1. **Connectivity Detection**:
   - `connectivity.js` listens to window `online`/`offline` events and performs a 30-second heartbeat GET to `/misc/ping`.
2. **Auto-Replay Trigger**:
   - Upon network restoration, `syncQueue(apiRequest)` wakes up automatically.
3. **Idempotency Guarantee**:
   - Every mutative operation carries a client UUID (`client_id` or `idempotency_key`).
   - If a request was previously processed by the server before network disconnection, the server detects the existing `client_id` and either returns the existing record or a `409 Conflict`.
   - The synchronizer treats idempotent `409 Conflict` as a success, marks the operation as confirmed, and records the resolution in `sync_log`.
4. **Dispute Isolation Invariant**:
   - Local operations representing open disputes or corrections are NEVER purged or dropped until explicitly acknowledged by a `2xx` or verified duplicate response from the central server.
5. **On-Device Cryptographic Signatures**:
   - Device keypairs are generated using Web Crypto API (`crypto.subtle`) with NIST ECDSA curve P-256 and SHA-256.
   - Every offline transaction is signed prior to QR display or synchronization.
