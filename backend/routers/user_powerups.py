"""
Renim AI — End-User Powerups Router (Habits, Goals/OKRs, Daily Journal, URL Summarizer & AI Flashcards)
"""

import os
import re
import json
from datetime import datetime, timezone
from typing import Optional
import httpx
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import get_db_pool, track_ai_usage, log_audit, check_ai_credits, is_user_active
from auth_utils import resolve_user_email, is_safe_public_url

router = APIRouter(prefix="/api/powerups", tags=["User Powerups"])

AIM_BASE_URL = os.getenv("AIM_BASE_URL", "https://2c-aim-api.2coms.com").rstrip("/")
AIM_API_KEY = os.getenv("AIM_API_KEY", "")
AIM_MODEL = os.getenv("AIM_MODEL", "qwen2.5")


class HabitCreateReq(BaseModel):
    title: str
    target_per_week: int = 5
    user_email: Optional[str] = None


class HabitToggleReq(BaseModel):
    date_str: Optional[str] = None
    user_email: Optional[str] = None


class GoalCreateReq(BaseModel):
    title: str
    category: str = "Work"
    target_date: str = ""
    progress: int = 0
    user_email: Optional[str] = None


class GoalUpdateReq(BaseModel):
    progress: int
    user_email: Optional[str] = None


class JournalCreateReq(BaseModel):
    entry_date: Optional[str] = None
    mood: str = "😊"
    win_text: str = ""
    blocker_text: str = ""
    user_email: Optional[str] = None


class WeeklyReportReq(BaseModel):
    user_email: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


class UrlSummarizeReq(BaseModel):
    url: str
    user_email: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


class FlashcardsReq(BaseModel):
    title: str = "Study Material"
    content: str
    count: int = 6
    user_email: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


async def _ask_llm(system_prompt: str, user_prompt: str, api_key: Optional[str] = None, model: Optional[str] = None, base_url: Optional[str] = None) -> str:
    key = api_key or AIM_API_KEY
    mdl = model or AIM_MODEL
    base = (base_url or AIM_BASE_URL).rstrip("/")
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{base}/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": mdl,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
            },
        )
        data = resp.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "")


# --- 1. Habits ---
@router.get("/habits")
async def list_habits(user_email: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"habits": []}
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id::text, title, target_per_week, completed_dates, created_at FROM public.user_habits WHERE user_email = %s ORDER BY created_at ASC",
                (email,),
            )
            return {"habits": cur.fetchall()}


@router.post("/habits", status_code=201)
async def create_habit(req: HabitCreateReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public.user_habits (user_email, title, target_per_week) VALUES (%s, %s, %s) RETURNING id::text, title, target_per_week, completed_dates, created_at",
                (email, req.title.strip() or "Daily Focus", max(1, min(7, req.target_per_week))),
            )
            return {"habit": cur.fetchone()}


@router.post("/habits/{habit_id}/toggle")
async def toggle_habit(habit_id: str, req: HabitToggleReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    today_str = req.date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT completed_dates FROM public.user_habits WHERE id = %s::uuid AND user_email = %s",
                (habit_id, email),
            )
            row = cur.fetchone()
            if not row:
                return JSONResponse(status_code=404, content={"error": "Habit not found"})
            dates = list(row.get("completed_dates") or [])
            if today_str in dates:
                dates.remove(today_str)
            else:
                dates.append(today_str)
            cur.execute(
                "UPDATE public.user_habits SET completed_dates = %s::jsonb WHERE id = %s::uuid AND user_email = %s RETURNING id::text, title, target_per_week, completed_dates",
                (json.dumps(dates), habit_id, email),
            )
            return {"habit": cur.fetchone()}


@router.delete("/habits/{habit_id}")
async def delete_habit(habit_id: str, user_email: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM public.user_habits WHERE id = %s::uuid AND user_email = %s", (habit_id, email))
    return {"deleted": True}


# --- 2. Goals & OKRs ---
@router.get("/goals")
async def list_goals(user_email: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"goals": []}
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id::text, title, category, target_date, progress, created_at FROM public.user_goals WHERE user_email = %s ORDER BY created_at DESC",
                (email,),
            )
            return {"goals": cur.fetchall()}


@router.post("/goals", status_code=201)
async def create_goal(req: GoalCreateReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public.user_goals (user_email, title, category, target_date, progress) VALUES (%s, %s, %s, %s, %s) RETURNING id::text, title, category, target_date, progress, created_at",
                (email, req.title.strip() or "New Goal", req.category, req.target_date, max(0, min(100, req.progress))),
            )
            return {"goal": cur.fetchone()}


@router.patch("/goals/{goal_id}")
async def update_goal(goal_id: str, req: GoalUpdateReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE public.user_goals SET progress = %s WHERE id = %s::uuid AND user_email = %s RETURNING id::text, title, category, target_date, progress",
                (max(0, min(100, req.progress)), goal_id, email),
            )
            row = cur.fetchone()
            if not row:
                return JSONResponse(status_code=404, content={"error": "Goal not found"})
            return {"goal": row}


@router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, user_email: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM public.user_goals WHERE id = %s::uuid AND user_email = %s", (goal_id, email))
    return {"deleted": True}


# --- 3. Daily Journal & AI Weekly Win Report ---
@router.get("/journals")
async def list_journals(user_email: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"journals": []}
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id::text, entry_date, mood, win_text, blocker_text, created_at FROM public.user_journals WHERE user_email = %s ORDER BY created_at DESC LIMIT 30",
                (email,),
            )
            return {"journals": cur.fetchall()}


@router.post("/journals", status_code=201)
async def create_journal(req: JournalCreateReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    d = req.entry_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public.user_journals (user_email, entry_date, mood, win_text, blocker_text) VALUES (%s, %s, %s, %s, %s) RETURNING id::text, entry_date, mood, win_text, blocker_text, created_at",
                (email, d, req.mood, req.win_text.strip(), req.blocker_text.strip()),
            )
            return {"journal": cur.fetchone()}


@router.post("/journals/weekly-report")
async def generate_weekly_report(req: WeeklyReportReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    allowed, used, limit = check_ai_credits(email)
    if not allowed:
        return JSONResponse(status_code=402, content={"error": f"AI credit limit reached ({used}/{limit}). Please upgrade your plan."})
    pool = get_db_pool()
    journals = []
    done_tasks = []
    if pool:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT entry_date, mood, win_text, blocker_text FROM public.user_journals WHERE user_email = %s ORDER BY created_at DESC LIMIT 7",
                    (email,),
                )
                journals = cur.fetchall()
                cur.execute(
                    "SELECT title FROM public.tasks WHERE LOWER(user_email) = %s AND status = 'done' ORDER BY created_at DESC LIMIT 15",
                    (email,),
                )
                done_tasks = [r["title"] for r in cur.fetchall()]
    context = f"Completed Tasks: {done_tasks}\nJournal Entries: {journals}"
    report = await _ask_llm(
        "You are an encouraging executive productivity coach. Write a crisp Markdown Weekly Win Report with: 1) Top Wins, 2) Patterns & Blockers, 3) Recommended Focus for Next Week.",
        context,
        req.api_key,
        req.model,
        req.base_url,
    )
    track_ai_usage(email, "weekly_win_report", credits_used=1, tokens_est=400)
    return {"report": report or "Keep logging daily wins to generate your Weekly Win Report!"}


# --- 4. Web URL AI Summarizer ---
@router.post("/summarize-url")
async def summarize_web_url(req: UrlSummarizeReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    allowed, used, limit = check_ai_credits(email)
    if not allowed:
        return JSONResponse(status_code=402, content={"error": f"AI credit limit reached ({used}/{limit}). Please upgrade your plan."})
    url = req.url.strip()
    if not url.startswith(("http://", "https://")) or not is_safe_public_url(url):
        return JSONResponse(status_code=400, content={"error": "Please enter a valid, publicly reachable http:// or https:// URL"})
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 RenimAI-Reader/2.0"})
            html = resp.text
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        page_title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else url
        cleaned = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"<[^>]+>", " ", cleaned)
        text = re.sub(r"\s+", " ", text).strip()[:8000]
        if len(text) < 40:
            return JSONResponse(status_code=400, content={"error": "Could not extract readable text from this URL"})
        summary = await _ask_llm(
            "You are a concise research assistant. Summarize the webpage in Markdown with: ## Executive Summary, ## Key Takeaways (bullets), and ## Actionable Next Steps.",
            f"URL: {url}\nTitle: {page_title}\n\nContent:\n{text}",
            req.api_key,
            req.model,
            req.base_url,
        )
        track_ai_usage(email, "url_summarizer", credits_used=2, tokens_est=len(text) // 4 + 300)
        log_audit(email, "powerup.url_summarized", "url", url[:120])
        return {"title": page_title, "url": url, "summary": summary}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch or summarize URL: {str(e)}"})


# --- 5. AI Flashcards & Quiz Generator ---
@router.post("/flashcards")
async def generate_flashcards(req: FlashcardsReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    allowed, used, limit = check_ai_credits(email)
    if not allowed:
        return JSONResponse(status_code=402, content={"error": f"AI credit limit reached ({used}/{limit}). Please upgrade your plan."})
    if len(req.content.strip()) < 20:
        return JSONResponse(status_code=400, content={"error": "Provide at least a paragraph of text to generate flashcards"})
    raw = await _ask_llm(
        f"Generate exactly {min(10, max(3, req.count))} study flashcards as a pure JSON array of objects: "
        '[{"q": "question", "a": "concise answer"}]. Return ONLY valid JSON, no markdown fences.',
        f"Title: {req.title}\n\nContent:\n{req.content[:6000]}",
        req.api_key,
        req.model,
        req.base_url,
    )
    cards = []
    try:
        cleaned = re.sub(r"```json|```", "", raw).strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            cards = [c for c in parsed if isinstance(c, dict) and "q" in c and "a" in c]
    except Exception:
        cards = [{"q": f"Key concept from {req.title}", "a": raw[:300] or "Review your source note."}]
    track_ai_usage(email, "flashcards_generator", credits_used=1, tokens_est=450)
    return {"flashcards": cards}
