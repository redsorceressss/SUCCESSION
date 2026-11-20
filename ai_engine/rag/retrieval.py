"""Lightweight local retriever supporting BM25-style scoring, tenant isolation, stopword filtering, and stemming."""

import math
import re
from collections import Counter
from .ingestion import DocumentChunk

SUFFIXES = ("ation", "tion", "ment", "ness", "ing", "ies", "es", "ed", "ly", "able", "ible", "s", "e")

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "as", "at", "be", "because", "been", "before", "being", "below",
    "between", "both", "but", "by", "could", "did", "do", "does", "doing", "down",
    "during", "each", "few", "for", "from", "further", "had", "has", "have",
    "having", "he", "her", "here", "hers", "herself", "him", "himself", "his",
    "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me",
    "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on",
    "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over",
    "own", "same", "she", "should", "so", "some", "such", "than", "that", "the",
    "their", "theirs", "them", "themselves", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "very",
    "was", "we", "were", "what", "when", "where", "which", "while", "who",
    "whom", "why", "with", "would", "you", "your", "yours", "yourself",
}

def stem_token(word: str) -> str:
    """Lightweight suffix-stripping stemmer for common English word variants."""
    w = word.lower()
    for s in SUFFIXES:
        if len(w) > len(s) + 3 and w.endswith(s):
            return w[:-len(s)]
    return w

class LocalRetriever:
    def __init__(self, chunks: list[DocumentChunk] | None = None, k1: float = 1.2, b: float = 0.75):
        self.chunks: list[DocumentChunk] = chunks or []
        self.k1 = k1
        self.b = b
        self._build_index()

    def _tokenize(self, text: str, filter_stopwords: bool = True) -> list[str]:
        raw_words = re.findall(r"\b\w+\b", text.lower())
        words = [w for w in raw_words if (not filter_stopwords or w not in STOP_WORDS)]
        if not words and raw_words:
            # Fallback if entire query was stopwords (e.g. "what is it")
            words = raw_words
        stems = [stem_token(w) for w in words]
        return words + stems


    def _build_index(self):
        self.doc_freqs = Counter()
        self.doc_term_counts = []
        self.doc_lens = []
        for c in self.chunks:
            tokens = self._tokenize(c.content)
            self.doc_lens.append(len(tokens))
            term_cnt = Counter(tokens)
            self.doc_term_counts.append(term_cnt)
            for t in term_cnt.keys():
                self.doc_freqs[t] += 1
        self.n_docs = len(self.chunks)
        self.avg_doc_len = sum(self.doc_lens) / max(self.n_docs, 1)

    def retrieve(
        self,
        query: str,
        top_k: int = 3,
        shop_id: str | None = None,
        min_score: float = 0.1,
    ) -> list[tuple[DocumentChunk, float]]:
        """
        Retrieves top relevant chunks with strict multi-tenant isolation.
        If shop_id is provided, only chunks matching shop_id or global chunks (shop_id is None)
        are considered. Other shop chunks are strictly excluded.
        """
        q_tokens = self._tokenize(query)
        if not q_tokens or self.n_docs == 0:
            return []

        q_terms = Counter(q_tokens)
        scores = []

        for idx, chunk in enumerate(self.chunks):
            # Enforce multi-tenant isolation
            chunk_shop = chunk.shop_id or chunk.metadata.get("shop_id")
            if shop_id is not None and chunk_shop is not None and chunk_shop != shop_id:
                continue

            doc_len = self.doc_lens[idx]
            term_cnt = self.doc_term_counts[idx]
            score = 0.0

            for t, q_weight in q_terms.items():
                if t in term_cnt:
                    freq = term_cnt[t]
                    # Robertson-Spärck Jones IDF
                    n_t = self.doc_freqs[t]
                    idf = math.log((self.n_docs - n_t + 0.5) / (n_t + 0.5) + 1.0)
                    # BM25 TF component with document length normalization
                    denom = freq + self.k1 * (1.0 - self.b + self.b * (doc_len / max(self.avg_doc_len, 1e-6)))
                    tf = (freq * (self.k1 + 1.0)) / max(denom, 1e-6)
                    score += idf * tf * q_weight

            if score >= min_score:
                scores.append((chunk, round(score, 3)))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

