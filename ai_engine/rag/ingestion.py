"""Document loader and chunker for operational guidelines and documentation."""

from dataclasses import dataclass, field
from pathlib import Path
import re

@dataclass
class DocumentChunk:
    doc_id: str
    chunk_id: int
    content: str
    metadata: dict = field(default_factory=dict)
    shop_id: str | None = None

    def __post_init__(self):
        if self.shop_id and "shop_id" not in self.metadata:
            self.metadata["shop_id"] = self.shop_id
        elif "shop_id" in self.metadata and not self.shop_id:
            self.shop_id = self.metadata["shop_id"]

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Header and paragraph-aware sliding-window chunker."""
    # Split on headers (# Header) or double newlines
    sections = re.split(r"\n(?=#{1,4}\s+)", text)
    chunks = []

    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
        if len(sec) <= chunk_size:
            chunks.append(sec)
        else:
            paragraphs = re.split(r"\n\s*\n", sec)
            current_chunk = []
            current_len = 0

            for para in paragraphs:
                p_len = len(para)
                if current_len + p_len > chunk_size and current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    current_chunk = [para]
                    current_len = p_len
                else:
                    current_chunk.append(para)
                    current_len += p_len

            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
    return chunks

def ingest_text(
    text: str,
    doc_id: str = "custom_doc",
    shop_id: str | None = None,
    metadata: dict | None = None,
) -> list[DocumentChunk]:
    """Ingests raw text with optional shop scoping."""
    meta = metadata.copy() if metadata else {}
    if shop_id:
        meta["shop_id"] = shop_id
    raw_chunks = chunk_text(text)
    return [
        DocumentChunk(
            doc_id=doc_id,
            chunk_id=idx,
            content=chunk,
            metadata={**meta, "chunk_index": idx},
            shop_id=shop_id,
        )
        for idx, chunk in enumerate(raw_chunks)
    ]

def ingest_document(
    path: Path,
    doc_id: str | None = None,
    shop_id: str | None = None,
) -> list[DocumentChunk]:
    """Ingests a text or markdown file and returns typed chunks."""
    doc_id = doc_id or path.name
    content = path.read_text(encoding="utf-8")
    meta = {"source": str(path)}
    if shop_id:
        meta["shop_id"] = shop_id
    return ingest_text(content, doc_id=doc_id, shop_id=shop_id, metadata=meta)

