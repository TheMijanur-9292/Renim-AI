"""
Renim AI — Enterprise Workspace RAG (Hybrid Semantic + Keyword Search + Citations)

Semantic search uses an OpenAI-compatible /v1/embeddings endpoint. If embeddings are disabled
or the gateway call fails, search silently falls back to keyword scoring only.
"""

import os
import re
import math
import time
import hashlib
from typing import Optional, List, Dict, Any, Tuple
import httpx
from fastapi import APIRouter, Header, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import get_db_pool, track_ai_usage, log_audit, check_ai_credits, is_user_active, resolve_org_access
from auth_utils import resolve_user_email, server_error, resolve_llm_target

router = APIRouter(prefix="/api/rag", tags=["Enterprise Knowledge RAG"])

AIM_BASE_URL = os.getenv("AIM_BASE_URL", "https://2c-aim-api.2coms.com").rstrip("/")
AIM_API_KEY = os.getenv("AIM_API_KEY", "")
AIM_MODEL = os.getenv("AIM_MODEL", "qwen2.5")

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_BASE_URL = (os.getenv("EMBEDDING_BASE_URL", "") or AIM_BASE_URL).rstrip("/")
EMBEDDING_API_KEY = os.getenv("EMBEDDING_API_KEY", "") or AIM_API_KEY

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
LAZY_INDEX_CHUNK_CAP = 40
MAX_BODY_CHARS = 6000
MIN_SEMANTIC_SIM = 0.3


class RagQueryRequest(BaseModel):
    query: str
    user_email: Optional[str] = None
    top_k: int = 8
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


class RagReindexRequest(BaseModel):
    user_email: Optional[str] = None


def _score_text(query_tokens: List[str], text: str, title: str = "") -> float:
    if not text and not title:
        return 0.0
    haystack = f"{title} {text}".lower()
    title_low = title.lower()
    score = 0.0
    for tok in query_tokens:
        if len(tok) < 2:
            continue
        if tok in title_low:
            score += 3.0
        occurrences = haystack.count(tok)
        if occurrences > 0:
            score += min(occurrences, 5) * 1.2
    return round(score, 2)


def _snippet(text: str, query_tokens: List[str], max_len: int = 260) -> str:
    clean = re.sub(r"\s+", " ", (text or "").strip())
    if len(clean) <= max_len:
        return clean
    low = clean.lower()
    for tok in query_tokens:
        idx = low.find(tok)
        if idx != -1:
            start = max(0, idx - 80)
            end = min(len(clean), start + max_len)
            prefix = "..." if start > 0 else ""
            suffix = "..." if end < len(clean) else ""
            return f"{prefix}{clean[start:end]}{suffix}"
    return clean[:max_len] + "..."


# ---------------------------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------------------------

def embeddings_enabled() -> bool:
    flag = os.getenv("EMBEDDINGS_ENABLED", "true").strip().lower()
    if flag in ("0", "false", "no", "off"):
        return False
    return bool(EMBEDDING_API_KEY and EMBEDDING_BASE_URL)


_embed_backoff: Dict[str, float] = {"until": 0.0}


def _embed_texts(texts: List[str]) -> Optional[List[List[float]]]:
    """Returns one vector per text, or None on any failure (then pauses retries for a few minutes)."""
    if not texts or not embeddings_enabled() or time.time() < _embed_backoff["until"]:
        return None
    result = _embed_texts_raw(texts)
    if result is None:
        _embed_backoff["until"] = time.time() + 300
    return result


def _embed_texts_raw(texts: List[str]) -> Optional[List[List[float]]]:
    try:
        out: List[List[float]] = []
        with httpx.Client(timeout=15.0) as client:
            for i in range(0, len(texts), 64):
                batch = texts[i:i + 64]
                resp = client.post(
                    f"{EMBEDDING_BASE_URL}/v1/embeddings",
                    headers={"Authorization": f"Bearer {EMBEDDING_API_KEY}", "Content-Type": "application/json"},
                    json={"model": EMBEDDING_MODEL, "input": batch},
                )
                if resp.status_code >= 400:
                    return None
                data = resp.json().get("data") or []
                data = sorted(data, key=lambda d: d.get("index", 0))
                if len(data) != len(batch):
                    return None
                out.extend([[float(x) for x in d.get("embedding") or []] for d in data])
        if any(not v for v in out):
            return None
        return out
    except Exception:
        return None


def _strip_html(text: str) -> str:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text or "", flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\s+", " ", text).strip()


def _chunk_text(text: str) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= CHUNK_SIZE:
        return [text]
    chunks = []
    step = CHUNK_SIZE - CHUNK_OVERLAP
    for start in range(0, len(text), step):
        piece = text[start:start + CHUNK_SIZE]
        if piece.strip():
            chunks.append(piece)
        if start + CHUNK_SIZE >= len(text):
            break
    return chunks


def _hash(text: str) -> str:
    return hashlib.sha256((EMBEDDING_MODEL + "|" + text).encode("utf-8", "ignore")).hexdigest()


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _vec_literal(v: List[float]) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in v) + "]"


_storage_mode_cache: Dict[str, str] = {}


def _storage_mode(cur) -> str:
    """'vector', 'array' or 'none' depending on how workspace_embeddings was created."""
    if "mode" in _storage_mode_cache:
        return _storage_mode_cache["mode"]
    try:
        cur.execute(
            """
            SELECT udt_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'workspace_embeddings' AND column_name = 'embedding'
            """
        )
        row = cur.fetchone()
        if not row:
            return "none"
        mode = "vector" if row.get("udt_name") == "vector" else "array"
        _storage_mode_cache["mode"] = mode
        return mode
    except Exception:
        return "none"


# ---------------------------------------------------------------------------
# Record gathering (same scoping as before)
# ---------------------------------------------------------------------------

def _scope_org(org_id: str) -> str:
    return "" if (org_id or "").strip() in ("", "personal") else org_id.strip()


def _load_records(cur, email: str, oid: str) -> List[Dict[str, Any]]:
    """Loads the user's own records plus, when an org is active, records shared in that org."""
    records: List[Dict[str, Any]] = []
    scope = "WHERE LOWER(user_email) = %s OR (%s <> '' AND org_id = %s)"

    cur.execute(
        f"""
        SELECT id::text, user_email, org_id, filename, file_type, summary, extracted_text, created_at
        FROM public.user_documents {scope}
        ORDER BY created_at DESC LIMIT 60
        """,
        (email, oid, oid),
    )
    for r in cur.fetchall():
        body = f"{r.get('summary') or ''}\n{(r.get('extracted_text') or '')[:MAX_BODY_CHARS]}"
        records.append({"source_type": "document", "source_id": r["id"], "title": r.get("filename") or "Document",
                        "body": body, "created_at": r.get("created_at"), "user_email": r.get("user_email") or email,
                        "org_id": r.get("org_id") or ""})

    cur.execute(
        f"""
        SELECT id::text, user_email, org_id, title, content, tags, created_at
        FROM public.notes {scope}
        ORDER BY created_at DESC LIMIT 80
        """,
        (email, oid, oid),
    )
    for r in cur.fetchall():
        body = f"{r.get('content') or ''} {r.get('tags') or ''}"
        records.append({"source_type": "note", "source_id": r["id"], "title": r.get("title") or "Note",
                        "body": body, "created_at": r.get("created_at"), "user_email": r.get("user_email") or email,
                        "org_id": r.get("org_id") or ""})

    cur.execute(
        f"""
        SELECT id::text, user_email, org_id, title, summary, raw_transcript, created_at
        FROM public.meetings {scope}
        ORDER BY created_at DESC LIMIT 60
        """,
        (email, oid, oid),
    )
    for r in cur.fetchall():
        body = f"{r.get('summary') or ''}\n{(r.get('raw_transcript') or '')[:5000]}"
        records.append({"source_type": "meeting", "source_id": r["id"], "title": r.get("title") or "Meeting",
                        "body": body, "created_at": r.get("created_at"), "user_email": r.get("user_email") or email,
                        "org_id": r.get("org_id") or ""})

    cur.execute(
        f"""
        SELECT id::text, user_email, org_id, title, description, status, priority, created_at
        FROM public.tasks {scope}
        ORDER BY created_at DESC LIMIT 80
        """,
        (email, oid, oid),
    )
    for r in cur.fetchall():
        body = f"{r.get('description') or ''} [{r.get('status') or ''} / {r.get('priority') or ''}]"
        records.append({"source_type": "task", "source_id": r["id"], "title": r.get("title") or "Task",
                        "body": body, "created_at": r.get("created_at"), "user_email": r.get("user_email") or email,
                        "org_id": r.get("org_id") or ""})
    return records


def _embed_text_for(rec: Dict[str, Any]) -> str:
    return f"{rec['title']}\n{_strip_html(rec['body'])}"[:MAX_BODY_CHARS]


def _index_records(cur, records: List[Dict[str, Any]], chunk_cap: Optional[int], force: bool = False) -> int:
    """Embeds records whose content changed. Returns the number of chunks written (or -1 on failure)."""
    mode = _storage_mode(cur)
    if mode == "none" or not records:
        return 0
    existing: Dict[Tuple[str, str], str] = {}
    if not force:
        cur.execute(
            "SELECT source_type, source_id, content_hash FROM public.workspace_embeddings "
            "WHERE chunk_index = 0 AND source_id = ANY(%s)",
            ([r["source_id"] for r in records],),
        )
        for row in cur.fetchall():
            existing[(row["source_type"], row["source_id"])] = row["content_hash"]

    pending: List[Tuple[Dict[str, Any], str, List[str]]] = []
    budget = chunk_cap if chunk_cap is not None else 10 ** 9
    for rec in records:
        text = _embed_text_for(rec)
        h = _hash(text)
        if not force and existing.get((rec["source_type"], rec["source_id"])) == h:
            continue
        chunks = _chunk_text(text)
        if not chunks:
            continue
        if len(chunks) > budget:
            break
        budget -= len(chunks)
        pending.append((rec, h, chunks))
    if not pending:
        return 0

    flat = [c for _, _, chunks in pending for c in chunks]
    vectors = _embed_texts(flat)
    if vectors is None:
        return -1
    written = 0
    pos = 0
    for rec, h, chunks in pending:
        for idx, chunk in enumerate(chunks):
            vec = vectors[pos]
            pos += 1
            emb_sql, emb_val = ("%s::vector", _vec_literal(vec)) if mode == "vector" else ("%s::real[]", vec)
            cur.execute(
                f"""
                INSERT INTO public.workspace_embeddings
                    (user_email, org_id, source_type, source_id, chunk_index, content_hash, chunk_text, embedding, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, {emb_sql}, NOW())
                ON CONFLICT (source_type, source_id, chunk_index) DO UPDATE SET
                    user_email = EXCLUDED.user_email, org_id = EXCLUDED.org_id,
                    content_hash = EXCLUDED.content_hash, chunk_text = EXCLUDED.chunk_text,
                    embedding = EXCLUDED.embedding, updated_at = NOW()
                """,
                (str(rec["user_email"]).lower(), rec["org_id"], rec["source_type"], rec["source_id"],
                 idx, h, chunk, emb_val),
            )
            written += 1
        cur.execute(
            "DELETE FROM public.workspace_embeddings WHERE source_type = %s AND source_id = %s AND chunk_index >= %s",
            (rec["source_type"], rec["source_id"], len(chunks)),
        )
    return written


def _semantic_scores(cur, query: str, records: List[Dict[str, Any]]) -> Dict[Tuple[str, str], Tuple[float, str]]:
    """Best cosine similarity and matching chunk per record. Empty dict when unavailable."""
    mode = _storage_mode(cur)
    if mode == "none" or not records:
        return {}
    qv = _embed_texts([query])
    if not qv:
        return {}
    qvec = qv[0]
    allowed = {(r["source_type"], r["source_id"]) for r in records}
    ids = list({r["source_id"] for r in records})
    best: Dict[Tuple[str, str], Tuple[float, str]] = {}
    if mode == "vector":
        cur.execute(
            """
            SELECT source_type, source_id, chunk_text, 1 - (embedding <=> %s::vector) AS sim
            FROM public.workspace_embeddings
            WHERE source_id = ANY(%s) AND embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT 300
            """,
            (_vec_literal(qvec), ids, _vec_literal(qvec)),
        )
        rows = [(r["source_type"], r["source_id"], r["chunk_text"], float(r["sim"] or 0)) for r in cur.fetchall()]
    else:
        cur.execute(
            "SELECT source_type, source_id, chunk_text, embedding FROM public.workspace_embeddings "
            "WHERE source_id = ANY(%s) AND embedding IS NOT NULL LIMIT 3000",
            (ids,),
        )
        rows = [(r["source_type"], r["source_id"], r["chunk_text"], _cosine(qvec, list(r["embedding"] or [])))
                for r in cur.fetchall()]
    for st, sid, chunk, sim in rows:
        key = (st, sid)
        if key not in allowed:
            continue
        if key not in best or sim > best[key][0]:
            best[key] = (sim, chunk)
    return best


def _gather_workspace_hits(email: str, query: str, top_k: int = 8, org_id: str = "") -> List[Dict[str, Any]]:
    """Hybrid search over the user's own records plus records shared in the active org."""
    pool = get_db_pool()
    if not pool:
        return []
    tokens = [t for t in re.findall(r"[a-zA-Z0-9_]+", query.lower()) if len(t) >= 2]
    if not tokens:
        tokens = [query.strip().lower()]
    oid = _scope_org(org_id)
    top_k = max(1, min(int(top_k or 8), 20))
    hits: List[Dict[str, Any]] = []
    with pool.connection() as conn:
        with conn.cursor() as cur:
            records = _load_records(cur, email, oid)
            semantic: Dict[Tuple[str, str], Tuple[float, str]] = {}
            if embeddings_enabled():
                try:
                    _index_records(cur, records, LAZY_INDEX_CHUNK_CAP)
                    semantic = _semantic_scores(cur, query, records)
                except Exception as e:
                    print("Info: semantic search unavailable, using keyword search:", e)
                    semantic = {}

    for rec in records:
        kw = _score_text(tokens, rec["body"], rec["title"])
        sim, chunk = semantic.get((rec["source_type"], rec["source_id"]), (0.0, ""))
        sem_ok = sim >= MIN_SEMANTIC_SIM
        if kw <= 0 and not sem_ok:
            continue
        score = kw + (sim * 10.0 if sem_ok else 0.0)
        snippet = _snippet(rec["body"], tokens)
        if kw <= 0 and chunk:
            snippet = _snippet(chunk, tokens)
        hits.append({
            "source_type": rec["source_type"],
            "source_id": rec["source_id"],
            "title": rec["title"],
            "score": round(score, 2),
            "snippet": snippet,
            "created_at": str(rec.get("created_at") or ""),
        })

    hits.sort(key=lambda x: x["score"], reverse=True)
    return hits[:top_k]


def _reindex_scope(email: str, org_id: str) -> None:
    pool = get_db_pool()
    if not pool or not embeddings_enabled():
        return
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                records = _load_records(cur, email, _scope_org(org_id))
                # Batches keep each gateway call bounded.
                for i in range(0, len(records), 20):
                    if _index_records(cur, records[i:i + 20], None, force=True) < 0:
                        break
    except Exception as e:
        print("Warning: reindex failed:", e)


def _check_access(email: str, org_id: str) -> Optional[JSONResponse]:
    if not resolve_org_access(email, org_id)[0]:
        return JSONResponse(status_code=403, content={"error": "Access denied to this organization."})
    return None


@router.get("/status")
def rag_status(
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
    x_org_id: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    org_id = (x_org_id or "").strip()
    denied = _check_access(email, org_id)
    if denied:
        return denied
    enabled = embeddings_enabled()
    storage = "none"
    indexed = 0
    pool = get_db_pool()
    if pool:
        try:
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    storage = _storage_mode(cur)
                    if storage != "none":
                        oid = _scope_org(org_id)
                        cur.execute(
                            "SELECT COUNT(*) AS n FROM public.workspace_embeddings "
                            "WHERE LOWER(user_email) = %s OR (%s <> '' AND org_id = %s)",
                            (email, oid, oid),
                        )
                        indexed = int((cur.fetchone() or {}).get("n") or 0)
        except Exception:
            pass
    return {
        "semantic_enabled": bool(enabled and storage != "none"),
        "storage": storage,
        "model": EMBEDDING_MODEL if enabled else None,
        "indexed_chunks": indexed,
    }


@router.post("/reindex")
async def rag_reindex(
    background_tasks: BackgroundTasks,
    req: Optional[RagReindexRequest] = None,
    authorization: Optional[str] = Header(default=None),
    x_org_id: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, req.user_email if req else None)
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    org_id = (x_org_id or "").strip()
    denied = _check_access(email, org_id)
    if denied:
        return denied
    if not embeddings_enabled():
        return {"started": False, "reason": "Smart search is turned off."}
    background_tasks.add_task(_reindex_scope, email, org_id)
    log_audit(email, "rag.reindex", "knowledge_hub", "", {"org_id": org_id})
    return {"started": True}


@router.post("/search")
async def rag_search(
    req: RagQueryRequest,
    authorization: Optional[str] = Header(default=None),
    x_org_id: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, req.user_email)
    org_id = (x_org_id or "").strip()
    if not resolve_org_access(email, org_id)[0]:
        return JSONResponse(status_code=403, content={"error": "Access denied to this organization."})
    if not req.query.strip():
        return {"hits": [], "query": req.query}
    try:
        hits = await run_in_threadpool(_gather_workspace_hits, email, req.query, req.top_k, org_id)
        return {"hits": hits, "total": len(hits), "query": req.query}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.post("/ask")
async def rag_ask(
    req: RagQueryRequest,
    authorization: Optional[str] = Header(default=None),
    x_org_id: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, req.user_email)
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    org_id = (x_org_id or "").strip()
    if not resolve_org_access(email, org_id)[0]:
        return JSONResponse(status_code=403, content={"error": "Access denied to this organization."})
    allowed, used, limit = check_ai_credits(email, org_id)
    if not allowed:
        return JSONResponse(status_code=402, content={"error": f"AI credit limit reached ({used}/{limit}). Please upgrade your plan."})
    if not req.query.strip():
        return JSONResponse(status_code=400, content={"error": "Query is required"})
    try:
        hits = await run_in_threadpool(_gather_workspace_hits, email, req.query, req.top_k, org_id)
        context_blocks = []
        for idx, h in enumerate(hits, 1):
            context_blocks.append(
                f"[Source {idx} | {h['source_type'].upper()}: {h['title']}]\n{h['snippet']}"
            )
        context_text = "\n\n".join(context_blocks) if context_blocks else "No matching workspace records found."

        key, model, base = resolve_llm_target(req.api_key, req.model, req.base_url, AIM_API_KEY, AIM_MODEL, AIM_BASE_URL)

        system_prompt = (
            "You are Renim AI Enterprise Knowledge Copilot. Answer the user's question strictly using "
            "the retrieved workspace sources below (Documents, Notes, Meetings, Tasks). "
            "Always cite sources inline like [Source 1], [Source 2]. If the answer is not in the sources, say so clearly."
        )
        user_prompt = f"Question: {req.query}\n\nRetrieved Workspace Context:\n{context_text}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{base}/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.25,
                },
            )
            data = resp.json()
            answer = (
                data.get("choices", [{}])[0].get("message", {}).get("content")
                or "Unable to synthesize answer from AI gateway."
            )

        track_ai_usage(email, "enterprise_rag_ask", credits_used=2, tokens_est=len(context_text) // 4 + 300, org_id=org_id)
        log_audit(email, "rag.query", "knowledge_hub", "", {"query": req.query[:120], "hits": len(hits)})
        return {"answer": answer, "citations": hits, "query": req.query}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))
