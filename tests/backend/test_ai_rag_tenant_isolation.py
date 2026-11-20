"""AI policy assistant (/ai/query): auth, server-side tenant scoping, and isolation."""

import backend.app.services.rag_service as rag_service
from ai_engine.rag.ingestion import DocumentChunk
from ai_engine.rag.rag_engine import RAGEngine
from ai_engine.rag.retrieval import LocalRetriever


def test_ai_query_requires_auth(client):
    r = client.post("/ai/query", json={"question": "What is a dispute?"})
    assert r.status_code == 401


def test_ai_query_ignores_client_shop_id_and_uses_server_tenant_scope(client, world, monkeypatch):
    captured = {}

    def fake_query(question: str, shop_id: str | None = None):
        captured["question"] = question
        captured["shop_id"] = shop_id
        return {
            "answer": "Grounded policy answer.",
            "sources": ["docs/policy.md"],
            "citations": [{"source": "docs/policy.md", "chunk_id": 0, "score": 1.0, "shop_id": None}],
            "grounded": True,
            "injection_detected": False,
        }

    monkeypatch.setattr(rag_service, "query", fake_query)
    r = client.post(
        "/ai/query",
        headers=world["J"],
        json={"question": "What is the dispute process?", "shop_id": "tenant:evil"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["grounded"] is True
    assert body["note"].startswith("This assistant explains policies")
    # Server derives tenant scope from authenticated user; client value must not be used.
    assert captured["question"] == "What is the dispute process?"
    assert isinstance(captured["shop_id"], str)
    assert captured["shop_id"].startswith("tenant:")
    assert captured["shop_id"] != "tenant:evil"


def test_ai_query_never_retrieves_other_tenants_private_data(world, monkeypatch):
    # Prove isolation with tenant-scoped private chunks and public chunks.
    c_global = DocumentChunk("global", 0, "Public policy: disputes require evidence and review.", shop_id=None)
    c_tenant = DocumentChunk("t1", 1, "Tenant secret: internal margin note for tenant 1.", shop_id="tenant:1")
    c_other = DocumentChunk("t2", 2, "Tenant secret: internal margin note for tenant 2.", shop_id="tenant:2")
    engine = RAGEngine(LocalRetriever([c_global, c_tenant, c_other]), llm=None)
    monkeypatch.setattr(rag_service, "get_engine", lambda: engine)

    res_1 = rag_service.query("internal margin note", shop_id="tenant:1")
    assert "tenant 1" in res_1["answer"].lower()
    assert "tenant 2" not in res_1["answer"].lower()
    assert all(c.get("shop_id") in ("tenant:1", None) for c in res_1["citations"])

    res_2 = rag_service.query("internal margin note", shop_id="tenant:2")
    assert "tenant 2" in res_2["answer"].lower()
    assert "tenant 1" not in res_2["answer"].lower()
    assert all(c.get("shop_id") in ("tenant:2", None) for c in res_2["citations"])

    # Public/global retrieval remains available to authenticated tenant scopes.
    res_public = rag_service.query("disputes require evidence", shop_id="tenant:999")
    assert res_public["grounded"] is True
    assert "public policy" in res_public["answer"].lower()


def test_ai_query_returns_safe_503_on_backend_failure(client, world, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("LLM_BASE_URL=https://secret.example/api key=SECRET")

    monkeypatch.setattr(rag_service, "query", boom)
    r = client.post("/ai/query", headers=world["J"], json={"question": "What is settlement?"})
    assert r.status_code == 503
    body = r.json()
    assert body["detail"] == "Policy assistant temporarily unavailable."
    assert "SECRET" not in body["detail"]
    assert "secret.example" not in body["detail"]
