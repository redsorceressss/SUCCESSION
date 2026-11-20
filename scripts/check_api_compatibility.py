"""Compares frontend/js/api.js endpoints directly with backend FastAPI OpenAPI routes."""

import json
import re
from pathlib import Path
from backend.app.main import app

openapi = app.openapi()
routes = openapi.get("paths", {})

backend_endpoints = set()
for path, methods in routes.items():
    for method in methods.keys():
        if method.lower() in ("get", "post", "put", "delete", "patch"):
            backend_endpoints.add((method.upper(), path))

print(f"Total FastAPI Backend Endpoints: {len(backend_endpoints)}")

frontend_api_path = Path("frontend/js/api.js")
content = frontend_api_path.read_text(encoding="utf-8")

# Pattern: request('METHOD', '/path/...' or `/path/${var}/...`)
pattern = r"request\(\s*['\"](GET|POST|PUT|DELETE)['\"]\s*,\s*[`'\"]([^`'\"]+)[`'\"]"
matches = re.findall(pattern, content)

mismatches = []
verified = []

for method, raw_path in matches:
    # Convert JS template literals like `/orders/${orderId}/summary` to OpenAPI format `/orders/{order_id}/summary`
    # Also strip query parameters like `?order_id=${orderId}`
    path_without_query = raw_path.split("?")[0]
    
    # Normalize variable names
    norm_path = re.sub(r"\$\{orderId\}", "{order_id}", path_without_query)
    norm_path = re.sub(r"\$\{txId\}", "{tx_id}", norm_path)
    norm_path = re.sub(r"\$\{crId\}", "{cr_id}", norm_path)
    norm_path = re.sub(r"\$\{disputeId\}", "{dispute_id}", norm_path)
    norm_path = re.sub(r"\$\{requestId\}", "{rid}", norm_path)
    norm_path = re.sub(r"\$\{proposalId\}", "{rid}", norm_path)
    norm_path = re.sub(r"\$\{karigarId\}", "{karigar_id}", norm_path)
    norm_path = re.sub(r"\$\{sid\}", "{sid}", norm_path)

    key = (method, norm_path)
    if key in backend_endpoints:
        verified.append((method, raw_path, norm_path))
    else:
        mismatches.append((method, raw_path, norm_path))

print("\n--- VERIFIED FRONTEND ENDPOINTS ---")
for m, r, n in verified:
    print(f"  [OK] {m.padEnd if hasattr(m, 'padEnd') else m:<6} {r} -> {n}")

print("\n--- MISMATCHES ---")
if not mismatches:
    print("  NONE! All frontend API calls match FastAPI routes exactly.")
else:
    for m, r, n in mismatches:
        print(f"  [MISMATCH] {m:<6} Raw: {r}  Normalized: {n}")
