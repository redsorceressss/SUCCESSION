"""Pytest configuration and shared test fixtures."""

import os
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure test DB is used
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.models import User
from backend.app.security import hash_password

# 1x1 transparent PNG bytes for evidence upload tests
PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    b"\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
)

@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def register(client: TestClient, login: str, role: str, name: str = "", password: str = "TestPass123!"):
    name = name or login.title()
    r = client.post(
        "/auth/register",
        json={"login": login, "name": name, "password": password, "role": role, "language": "en"},
    )
    assert r.status_code == 201, r.text
    return r.json()

def login_headers(client: TestClient, login: str, password: str = "TestPass123!") -> dict:
    r = client.post("/auth/login", json={"login": login, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def make_agent(client: TestClient, db_session) -> dict:
    user = User(
        login="test_agent",
        name="Test Agent",
        password_hash=hash_password("AgentSecret123!"),
        role="agent",
    )
    db_session.add(user)
    db_session.commit()
    return login_headers(client, "test_agent", "AgentSecret123!")

@pytest.fixture
def world(client, db_session):
    """World fixture:
    Jeweller J, Karigars K1 and K2, Order O1, and initial Issue Transaction of 50.00g (tid).
    """
    register(client, "jeweller1", "jeweller", "Mehta Jewellers")
    register(client, "karigar1", "karigar", "Ramesh Karigar")
    register(client, "karigar2", "karigar", "Suresh Karigar")

    J = login_headers(client, "jeweller1")
    K1 = login_headers(client, "karigar1")
    K2 = login_headers(client, "karigar2")

    # Create Order
    r_order = client.post(
        "/orders",
        headers=J,
        json={
            "karigar_login": "karigar1",
            "description": "22K Haar",
            "due_date": "2026-11-20",
            "wastage_pct": "2.0",
        },
    )
    assert r_order.status_code == 201, r_order.text
    oid = r_order.json()["id"]

    # Issue 50.00g
    r_issue = client.post(
        "/transactions/issue",
        headers=J,
        json={"order_id": oid, "weight_g": "50.00", "karat": 22, "note": "Initial issue"},
    )
    assert r_issue.status_code == 201, r_issue.text
    tid = r_issue.json()["id"]

    return {
        "c": client,
        "db": db_session,
        "J": J,
        "K": K1,
        "K1": K1,
        "K2": K2,
        "oid": oid,
        "tid": tid,
    }
