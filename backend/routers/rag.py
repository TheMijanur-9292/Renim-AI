"""
Renim AI — Enterprise Workspace RAG (Cross-Workspace Semantic & Keyword Search + Citations)
"""

import os
import re
from typing import Optional, List, Dict, Any
import httpx
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import get_db_pool, track_ai_usage, log_audit, check_ai_credits, is_user_active
from auth_utils import resolve_user_email

router = APIRouter(prefix="/api/rag", tags=["Enterprise Knowledge RAG"])

AIM_BASE_URL = os.getenv("AIM_BASE_URL", "https://2c-aim-api.2coms.com").rstrip("/")
AIM_API_KEY = os.getenv("AIM_API_KEY", "")
AIM_MODEL = os.getenv("AIM_MODEL", "qwen2.5")


class RagQueryRequest(BaseModel):
    query: str
    user_email: Optional[str] = None
    top_k: int = 8
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


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


def _gather_workspace_hits(email: str, query: str, top_k: int = 8) -> List[Dict[str, Any]]:
    pool = get_db_pool()
    if not pool:
        return []
    tokens = [t for t in re.findall(r"[a-zA-Z0-9_]+", query.lower()) if len(t) >= 2]
    if not tokens:
        tokens = [query.strip().lower()]
    hits: List[Dict[str, Any]] = []
    with pool.connection() as conn:
        with conn.cursor() as cur:
            # 1. Documents
            cur.execute(
                """
                SELECT id::text, filename, file_type, summary, extracted_text, created_at
                FROM public.user_documents
                WHERE LOWER(user_email) = %s
                ORDER BY created_at DESC LIMIT 60
                """,
                (email,),
            )
            for r in cur.fetchall():
                body = f"{r.get('summary', '')}\n{r.get('extracted_text', '')[:6000]}"
                sc = _score_text(tokens, body, r.get("filename", ""))
                if sc > 0:
                    hits.append({
                        "source_type": "document",
                        "source_id": r["id"],
                        "title": r.get("filename", "Document"),
                        "score": sc,
                        "snippet": _snippet(body, tokens),
                        "created_at": str(r.get("created_at", "")),
                    })

            # 2. Notes
            cur.execute(
                """
                SELECT id::text, title, content, tags, created_at
                FROM public.notes
                WHERE LOWER(user_email) = %s
                ORDER BY created_at DESC LIMIT 80
                """,
                (email,),
            )
            for r in cur.fetchall():
                body = f"{r.get('content', '')} {r.get('tags', '')}"
                sc = _score_text(tokens, body, r.get("title", ""))
                if sc > 0:
                    hits.append({
                        "source_type": "note",
                        "source_id": r["id"],
                        "title": r.get("title", "Note"),
                        "score": sc,
                        "snippet": _snippet(body, tokens),
                        "created_at": str(r.get("created_at", "")),
                    })

            # 3. Meetings
            cur.execute(
                """
                SELECT id::text, title, summary, raw_transcript, created_at
                FROM public.meetings
                WHERE LOWER(user_email) = %s
                ORDER BY created_at DESC LIMIT 60
                """,
                (email,),
            )
            for r in cur.fetchall():
                body = f"{r.get('summary', '')}\n{(r.get('raw_transcript') or '')[:5000]}"
                sc = _score_text(tokens, body, r.get("title", ""))
                if sc > 0:
                    hits.append({
                        "source_type": "meeting",
                        "source_id": r["id"],
                        "title": r.get("title", "Meeting"),
                        "score": sc,
                        "snippet": _snippet(body, tokens),
                        "created_at": str(r.get("created_at", "")),
                    })

            # 4. Tasks
            cur.execute(
                """
                SELECT id::text, title, description, status, priority, created_at
                FROM public.tasks
                WHERE LOWER(user_email) = %s
                ORDER BY created_at DESC LIMIT 80
                """,
                (email,),
            )
            for r in cur.fetchall():
                body = f"{r.get('description', '')} [{r.get('status', '')} / {r.get('priority', '')}]"
                sc = _score_text(tokens, body, r.get("title", ""))
                if sc > 0:
                    hits.append({
                        "source_type": "task",
                        "source_id": r["id"],
                        "title": r.get("title", "Task"),
                        "score": sc,
                        "snippet": _snippet(body, tokens),
                        "created_at": str(r.get("created_at", "")),
                    })

    hits.sort(key=lambda x: x["score"], reverse=True)
    return hits[:top_k]


@router.post("/search")
async def rag_search(
    req: RagQueryRequest,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, req.user_email)
    if not req.query.strip():
        return {"hits": [], "query": req.query}
    try:
        hits = _gather_workspace_hits(email, req.query, req.top_k)
        return {"hits": hits, "total": len(hits), "query": req.query}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/ask")
async def rag_ask(
    req: RagQueryRequest,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, req.user_email)
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    allowed, used, limit = check_ai_credits(email)
    if not allowed:
        return JSONResponse(status_code=402, content={"error": f"AI credit limit reached ({used}/{limit}). Please upgrade your plan."})
    if not req.query.strip():
        return JSONResponse(status_code=400, content={"error": "Query is required"})
    try:
        hits = _gather_workspace_hits(email, req.query, req.top_k)
        context_blocks = []
        for idx, h in enumerate(hits, 1):
            context_blocks.append(
                f"[Source {idx} | {h['source_type'].upper()}: {h['title']}]\n{h['snippet']}"
            )
        context_text = "\n\n".join(context_blocks) if context_blocks else "No matching workspace records found."

        key = req.api_key or AIM_API_KEY
        model = req.model or AIM_MODEL
        base = (req.base_url or AIM_BASE_URL).rstrip("/")

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

        track_ai_usage(email, "enterprise_rag_ask", credits_used=2, tokens_est=len(context_text) // 4 + 300)
        log_audit(email, "rag.query", "knowledge_hub", "", {"query": req.query[:120], "hits": len(hits)})
        return {"answer": answer, "citations": hits, "query": req.query}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
