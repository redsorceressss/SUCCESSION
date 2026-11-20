"""POST /voice/parse: draft-only behavior, validation, and parsing robustness."""

from backend.app.models import Settlement, Transaction


def test_voice_parse_requires_jeweller_auth(client, world):
    r = client.post("/voice/parse", json={"text": "Ramesh ko 50 gram 22 karat do"})
    assert r.status_code == 401
    r2 = client.post("/voice/parse", headers=world["K"], json={"text": "Ramesh ko 50 gram 22 karat do"})
    assert r2.status_code == 403


def test_voice_parse_rejects_empty_text(client, world):
    r = client.post("/voice/parse", headers=world["J"], json={"text": "   "})
    assert r.status_code == 422


def test_voice_parse_returns_draft_and_never_persists_or_mutates(client, world, db_session):
    tx_count = db_session.query(Transaction).count()
    settlement_count = db_session.query(Settlement).count()
    r = client.post(
        "/voice/parse",
        headers=world["J"],
        json={"text": "Ramesh ko 50 gram 22 karat sona do kal tak", "language": "hi"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # Draft-only contract signals
    assert body.get("draft_only") is True
    assert body.get("requires_human_confirmation") is True
    assert "source_text" in body
    assert isinstance(body.get("fields", {}), dict)
    assert isinstance(body.get("missing", []), list)
    assert isinstance(body.get("questions", []), list)
    db_session.expire_all()
    assert db_session.query(Transaction).count() == tx_count
    assert db_session.query(Settlement).count() == settlement_count


def test_voice_parse_extracts_known_karigar_from_jeweller_context(client, world):
    # world has order for karigar1 (Ramesh Karigar) under jeweller1
    r = client.post(
        "/voice/parse",
        headers=world["J"],
        json={"text": "Ramesh ko 50 gram 22 karat issue karo"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    fields = body.get("fields", {})
    assert str(fields.get("weight_g")) in ("50", "50.0", "50.00", "50.0000")
    assert str(fields.get("karat")) == "22"
    # karigar name resolved from known karigars when possible
    karigar = (fields.get("karigar") or "").lower()
    assert "ramesh" in karigar or "karigar" in karigar or body.get("questions")


def test_voice_parse_missing_ambiguous_fields_require_human_review(client, world):
    r = client.post("/voice/parse", headers=world["J"], json={"text": "sona diya"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("draft_only") is True
    assert body.get("requires_human_confirmation") is True
    assert body.get("missing")  # required fields missing
    assert body.get("questions") or body.get("needs_confirmation")


def test_voice_parse_multilingual_hinglish_input_handled(client, world):
    r = client.post(
        "/voice/parse",
        headers=world["J"],
        json={"text": "Ramesh ko pacchas gram 22 karat wapas mila"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, dict)
    assert body.get("draft_only") is True
    # should not crash and should either parse or ask clarifying questions
    assert "fields" in body and "questions" in body


def test_voice_parse_internal_error_falls_back_to_safe_draft(client, world, monkeypatch):
    import ai_engine.voice.parse_rules as pr
    def boom(*args, **kwargs):
        raise ValueError("parser exploded")
    monkeypatch.setattr(pr, "parse_entry", boom)
    r = client.post("/voice/parse", headers=world["J"], json={"text": "Ramesh ko 50 gram do"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("draft_only") is True
    assert body.get("requires_human_confirmation") is True
    assert body.get("missing")
    assert body.get("questions")
