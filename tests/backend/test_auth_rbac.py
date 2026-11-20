"""Tests for authentication and role-based access control (RBAC)."""

import pytest
from tests.conftest import register, login_headers

def test_registration_and_login(client):
    reg = register(client, "new_jeweller", "jeweller", "New Jeweller")
    assert reg["login"] == "new_jeweller"
    assert reg["role"] == "jeweller"

    headers = login_headers(client, "new_jeweller")
    me = client.get("/me", headers=headers).json()
    assert me["login"] == "new_jeweller"
    assert me["role"] == "jeweller"

def test_duplicate_registration_rejected(client):
    register(client, "dup_user", "karigar")
    r = client.post(
        "/auth/register",
        json={"login": "dup_user", "name": "Dup", "password": "TestPass123!", "role": "karigar"},
    )
    assert r.status_code == 409

def test_invalid_login(client):
    r = client.post("/auth/login", json={"login": "nonexistent", "password": "WrongPassword"})
    assert r.status_code == 401

def test_agent_cannot_self_register(client):
    # Registration schema literals: Literal["jeweller", "karigar"] -> "agent" is rejected with 422
    r = client.post(
        "/auth/register",
        json={"login": "self_agent", "name": "Rogue Agent", "password": "TestPass123!", "role": "agent"},
    )
    assert r.status_code == 422

def test_karigar_passbook_isolation(world):
    c, K1, K2 = world["c"], world["K1"], world["K2"]
    me1 = c.get("/me", headers=K1).json()
    me2 = c.get("/me", headers=K2).json()

    # Karigar 1 can open own passbook
    r1 = c.get(f"/passbook/{me1['id']}", headers=K1)
    assert r1.status_code == 200

    # Karigar 2 CANNOT open Karigar 1's passbook -> 403 Forbidden
    r2 = c.get(f"/passbook/{me1['id']}", headers=K2)
    assert r2.status_code == 403

def test_order_access_isolation(world):
    c, K2, oid = world["c"], world["K2"], world["oid"]
    # Karigar 2 is not a party to oid -> 403 Forbidden
    r = c.get(f"/orders/{oid}", headers=K2)
    assert r.status_code == 403
