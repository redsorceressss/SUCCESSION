"""Singleton RAG service for the SUCCESSION API.

Loads and indexes all project documentation once at first query, then keeps
the index in memory for subsequent requests. No paid external API calls are
made unless LLM_BASE_URL and LLM_API_KEY environment variables are set.

Tenant isolation: when a user's shop_id is known it is passed to the engine
so that only chunks with a matching shop_id (or no shop_id) are retrieved.
"""

from __future__ import annotations

import logging
from pathlib import Path
from threading import Lock

logger = logging.getLogger(__name__)

_lock = Lock()
_engine = None  # lazily initialised on first request


def _build_engine():
    """Build a RAGEngine backed by all markdown docs in the docs/ directory."""
    from ai_engine.rag.ingestion import ingest_document
    from ai_engine.rag.retrieval import LocalRetriever
    from ai_engine.rag.rag_engine import RAGEngine
    from ai_engine.llm import LLMClient

    docs_root = Path(__file__).resolve().parents[3] / "docs"
    all_chunks = []
    if docs_root.exists():
        for md_file in sorted(docs_root.rglob("*.md")):
            try:
                chunks = ingest_document(md_file, doc_id=md_file.stem, shop_id=None)
                all_chunks.extend(chunks)
            except Exception as exc:
                logger.warning("RAG: could not ingest %s: %s", md_file, exc)
        logger.info("RAG: indexed %d chunks from %s", len(all_chunks), docs_root)
    else:
        logger.warning("RAG: docs directory not found at %s — engine will have no context", docs_root)

    retriever = LocalRetriever(chunks=all_chunks)
    llm = LLMClient()  # honours LLM_BASE_URL / LLM_API_KEY env vars; no-op if unset
    return RAGEngine(retriever=retriever, llm=llm)


def get_engine():
    """Return the singleton RAGEngine, building it on first call."""
    global _engine
    if _engine is None:
        with _lock:
            if _engine is None:
                _engine = _build_engine()
    return _engine


def query(question: str, shop_id: str | None = None) -> dict:
    """
    Answer a user query using the RAG engine.

    Returns a dict with keys:
      answer          str   — grounded answer or fallback excerpt
      sources         list  — list of document source names cited
      citations       list  — list of {source, chunk_id, score, shop_id} dicts
      grounded        bool  — True if retrieved docs were used
      injection_detected bool — True if adversarial patterns were detected and neutralised
    """
    engine = get_engine()
    return engine.answer_question(question, shop_id=shop_id)
