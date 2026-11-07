import logging

from ..config import get_settings
from ..logging_setup import log_event
from .index import get_collection

log = logging.getLogger("watson.rag")


def _query(text: str, n: int) -> list[tuple[str, str, float]]:
    res = get_collection().query(query_texts=[text[:1500]], n_results=n)
    if not res.get("ids") or not res["ids"][0]:
        return []
    return list(zip(res["ids"][0], res["documents"][0], res["distances"][0]))


def retrieve(query: str, previous_user_messages: str = "") -> list[str]:
    """Top-k chunks for the visitor's message.

    The message is searched on its own first (so a fresh question isn't diluted by earlier chat),
    then a small second search blends in the visitor's previous message so follow-ups like
    "tell me more about it" still land on the right project."""
    k = get_settings().rag_top_k
    try:
        hits = _query(query, k)
        if previous_user_messages:
            hits += _query(f"{previous_user_messages}\n{query}", 2)
    except Exception:
        log.exception("RAG retrieval failed")
        return []

    seen: set[str] = set()
    picked: list[tuple[str, str, float]] = []
    for cid, doc, dist in hits:
        if cid not in seen:
            seen.add(cid)
            picked.append((cid, doc, dist))
    picked = picked[: k + 1]
    log_event("rag", "retrieved", query=query[:120], chunks=[f"{c}:{d:.3f}" for c, _, d in picked])
    return [doc for _, doc, _ in picked]
