"""RAG knowledge assistant package."""

from .ingestion import ingest_document, chunk_text, DocumentChunk
from .retrieval import LocalRetriever
from .rag_engine import RAGEngine

__all__ = [
    "ingest_document",
    "chunk_text",
    "DocumentChunk",
    "LocalRetriever",
    "RAGEngine",
]
