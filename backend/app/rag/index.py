"""Builds the vector index over content/ with Chroma's built-in ONNX MiniLM embeddings
(no torch, no paid embeddings). Rebuilt only when the content digest changes."""

import logging
import threading
import time
from functools import lru_cache

from ..config import get_settings
from ..content import Content, get_content
from ..db import kv_get, kv_set, ts

log = logging.getLogger("watson.rag")
COLLECTION = "portfolio"


def build_chunks(c: Content) -> list[tuple[str, str, dict]]:
    """Returns (id, text, metadata) tuples."""
    chunks: list[tuple[str, str, dict]] = []
    for title, body in c.profile_sections.items():
        if body:
            chunks.append((f"profile:{title}", f"{title}\n{body}", {"kind": "profile"}))
    for p in c.projects:
        text = (
            f"Project: {p['title']} (id: {p['id']}, status: {p['status']})\n{p['tagline']}\n{p['description']}\n"
            f"Highlights: {'; '.join(p['highlights'])}\nTechnologies: {', '.join(p['tech'])}\n"
            f"Skills demonstrated: {', '.join(p['skills'])}"
        )
        chunks.append((f"project:{p['id']}", text, {"kind": "project", "ref": p["id"]}))
    for e in c.experience:
        text = (
            f"Experience: {e['title']} at {e['company']} (id: {e['id']}), {e['location']}, "
            f"{e['start']} – {e['end']}\nAbout the company: {e['company_blurb']}\n"
            f"Role: {e['summary']}\nHighlights: {'; '.join(e['highlights'])}"
        )
        chunks.append((f"experience:{e['id']}", text, {"kind": "experience", "ref": e["id"]}))
    ct = c.contact
    chunks.append((
        "contact",
        f"Contact Bhavya: email {ct['email']}. " + ", ".join(f"{l['label']}: {l['url']}" for l in ct["links"]),
        {"kind": "contact"},
    ))
    return chunks


@lru_cache
def get_client():
    import chromadb

    return chromadb.PersistentClient(path=str(get_settings().data_dir / "chroma"))


_lock = threading.Lock()
_active: dict = {"name": None, "col": None}


def get_collection():
    """The collection currently serving queries (switched atomically on reindex)."""
    name = kv_get("rag_collection")
    if _active["col"] is not None and _active["name"] == name:
        return _active["col"]
    if not name:
        raise RuntimeError("vector index not built yet")
    col = get_client().get_collection(name)
    _active.update(name=name, col=col)
    return col


def ensure_index(force: bool = False) -> dict:
    """Bring the vector index in line with content/.

    Blue-green rebuild: every change goes into a brand-new collection which is then switched in.
    (Chroma's local mode doesn't surface upserts into a collection that has already been queried
    in this process, so we never mutate the live collection.) The previous collection is kept
    as a fallback; older ones are dropped."""
    with _lock:
        c = get_content()
        client = get_client()
        existing = {col.name for col in client.list_collections()}
        current = kv_get("rag_collection")
        if not force and current in existing and kv_get("rag_digest") == c.digest:
            col = get_collection()
            if col.count() > 0:
                log.info("RAG index up to date (%s chunks)", col.count())
                return index_status()

        chunks = build_chunks(c)
        name = f"{COLLECTION}_{c.digest}_{int(time.time())}"
        col = client.create_collection(name, metadata={"hnsw:space": "cosine"})
        col.add(
            ids=[cid for cid, _, _ in chunks],
            documents=[t for _, t, _ in chunks],
            metadatas=[m for _, _, m in chunks],
        )
        kv_set("rag_collection", name)
        kv_set("rag_digest", c.digest)
        kv_set("rag_indexed_at", ts())
        _active.update(name=name, col=col)

        for old in existing - {name, current}:
            if old.startswith(COLLECTION):
                client.delete_collection(old)
        log.info("RAG index rebuilt: %s chunks in %s", len(chunks), name)
        return index_status()


def index_status() -> dict:
    try:
        chunks = get_collection().count()
    except Exception:
        chunks = 0
    return {
        "chunks": chunks,
        "digest": kv_get("rag_digest"),
        "indexed_at": kv_get("rag_indexed_at"),
        "up_to_date": kv_get("rag_digest") == get_content().digest,
    }
