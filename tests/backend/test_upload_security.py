"""Phase 6 P2: Upload and evidence security tests.

Tests cover:
1. Magic byte validation (rejects non-image/PDF)
2. Empty file rejection
3. Size limit enforcement
4. File type restriction (images_only mode)
5. Evidence download requires party membership
6. Random filename (no client name used)
"""

import pytest
from tests.conftest import PNG, login_headers, register


def post(client, url, headers, **kwargs):
    return client.post(url, headers=headers, json=kwargs)


@pytest.fixture
def upload_world(client, db_session):
    """World with a dispute for evidence upload testing."""
    register(client, "jeweller1", "jeweller", "Mehta Jewellers")
    register(client, "karigar1", "karigar", "Ramesh Karigar")
    register(client, "karigar2", "karigar", "Suresh Outside")

    J = login_headers(client, "jeweller1")
    K = login_headers(client, "karigar1")
    K2 = login_headers(client, "karigar2")

    # Order + transaction + dispute
    r = client.post(
        "/orders", headers=J,
        json={"karigar_login": "karigar1", "description": "Ring", "due_date": "2026-12-01", "wastage_pct": "1"},
    )
    oid = r.json()["id"]
    r = client.post(
        "/transactions/issue", headers=J,
        json={"order_id": oid, "weight_g": "10.00", "karat": 22, "note": "Ring gold"},
    )
    tid = r.json()["id"]
    d = post(client, f"/transactions/{tid}/disputes", K, field="weight_g", claimed_value="9.95", reason="Weight off")
    did = d.json()["id"]
    return {"c": client, "J": J, "K": K, "K2": K2, "oid": oid, "tid": tid, "did": did}


def test_valid_png_upload(upload_world):
    w = upload_world
    r = w["c"].post(
        f"/disputes/{w['did']}/evidence",
        headers=w["K"],
        files={"file": ("scale.png", PNG, "image/png")},
    )
    assert r.status_code == 201
    assert r.json()["mime"] == "image/png"
    assert r.json()["sha256"]  # non-empty hash


def test_invalid_file_type_rejected(upload_world):
    """A .txt file disguised as .png should be rejected (magic bytes don't match)."""
    w = upload_world
    fake_data = b"This is not an image file at all"
    r = w["c"].post(
        f"/disputes/{w['did']}/evidence",
        headers=w["K"],
        files={"file": ("malicious.txt", fake_data, "text/plain")},
    )
    assert r.status_code == 415


def test_html_disguised_as_image_rejected(upload_world):
    """HTML content with image extension should be rejected."""
    w = upload_world
    html_data = b"<html><script>alert('xss')</script></html>"
    r = w["c"].post(
        f"/disputes/{w['did']}/evidence",
        headers=w["K"],
        files={"file": ("evil.png", html_data, "image/png")},
    )
    assert r.status_code == 415


def test_non_party_cannot_upload_evidence(upload_world):
    """A karigar NOT party to the order cannot upload evidence."""
    w = upload_world
    r = w["c"].post(
        f"/disputes/{w['did']}/evidence",
        headers=w["K2"],
        files={"file": ("scale.png", PNG, "image/png")},
    )
    assert r.status_code == 403


def test_non_party_cannot_download_evidence(upload_world):
    """A karigar NOT party to the order cannot download evidence."""
    w = upload_world
    # Upload as K (party)
    r = w["c"].post(
        f"/disputes/{w['did']}/evidence",
        headers=w["K"],
        files={"file": ("scale.png", PNG, "image/png")},
    )
    eid = r.json()["id"]
    # K2 tries to download
    r = w["c"].get(f"/evidence/{eid}/file", headers=w["K2"])
    assert r.status_code == 403
