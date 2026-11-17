"""
Renim AI — Multi-Tenant Isolation, White-Label Branding, Public Share Links, AI Mind-Map & Follow-up Router
"""

import os
import re
import json
import secrets
from typing import Optional
import httpx
from fastapi import APIRouter, Header, Query
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel

from db import get_db_pool, log_audit, track_ai_usage, check_ai_credits, is_user_active
from auth_utils import resolve_user_email, ROLE_HIERARCHY

def require_org_role(user_role: str, min_role: str) -> bool:
    return ROLE_HIERARCHY.get((user_role or "").lower(), 0) >= ROLE_HIERARCHY.get(min_role.lower(), 99)

router = APIRouter(tags=["Multi-Tenant & Cool AI"])

AIM_BASE_URL = os.getenv("AIM_BASE_URL", "https://2c-aim-api.2coms.com").rstrip("/")
AIM_API_KEY = os.getenv("AIM_API_KEY", "")
AIM_MODEL = os.getenv("AIM_MODEL", "qwen2.5")


class BrandingUpdateReq(BaseModel):
    org_id: str
    name: Optional[str] = None
    brand_color: Optional[str] = None
    logo_url: Optional[str] = None
    user_email: Optional[str] = None


class InviteAcceptReq(BaseModel):
    org_id: str
    user_email: Optional[str] = None


class VisibilityReq(BaseModel):
    resource_type: str  # "note" | "task" | "meeting"
    resource_id: str
    org_id: str
    visibility: str  # "private" | "team"
    user_email: Optional[str] = None


class ShareCreateReq(BaseModel):
    resource_type: str  # "note" | "meeting"
    resource_id: str
    title: str
    content: str
    org_id: str = ""
    user_email: Optional[str] = None


class MindMapReq(BaseModel):
    title: str = "Topic"
    content: str
    user_email: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


class MeetingFollowupReq(BaseModel):
    title: str
    transcript: str
    attendees: str = ""
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


# --- 1. Multi-Tenant Context & Branding ---
@router.get("/api/tenant/context")
async def get_tenant_context(user_email: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"user_email": email, "organizations": [], "pending_invites": []}
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT o.id::text, o.name, o.slug, o.plan, o.brand_color, o.logo_url, m.role, m.status
                FROM public.organizations o
                JOIN public.org_members m ON m.org_id = o.id
                WHERE m.user_email = %s
                ORDER BY o.created_at ASC
                """,
                (email,),
            )
            rows = cur.fetchall()
    active_orgs = [r for r in rows if r.get("status") == "active"]
    pending = [r for r in rows if r.get("status") == "pending"]
    return {"user_email": email, "organizations": active_orgs, "pending_invites": pending}


@router.patch("/api/tenant/branding")
async def update_tenant_branding(req: BrandingUpdateReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s AND status = 'active'",
                (req.org_id, email),
            )
            member = cur.fetchone()
            if not member or not require_org_role(member["role"], "admin"):
                return JSONResponse(status_code=403, content={"error": "Admin or Owner role required to update branding"})
            cur.execute(
                """
                UPDATE public.organizations
                SET name = COALESCE(%s, name),
                    brand_color = COALESCE(%s, brand_color),
                    logo_url = COALESCE(%s, logo_url)
                WHERE id = %s::uuid
                RETURNING id::text, name, slug, plan, brand_color, logo_url
                """,
                (req.name.strip() if req.name else None, req.brand_color, req.logo_url, req.org_id),
            )
            org = cur.fetchone()
    log_audit(email, "tenant.branding_updated", "organization", req.org_id, {"brand_color": req.brand_color}, org_id=req.org_id)
    return {"organization": org}


@router.post("/api/tenant/invites/accept")
async def accept_org_invite(req: InviteAcceptReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.org_members
                SET status = 'active'
                WHERE org_id = %s::uuid AND user_email = %s
                RETURNING id::text, org_id::text, role, status
                """,
                (req.org_id, email),
            )
            row = cur.fetchone()
            if not row:
                return JSONResponse(status_code=404, content={"error": "Invite not found"})
    log_audit(email, "tenant.invite_accepted", "organization", req.org_id, org_id=req.org_id)
    return {"member": row}


# --- 2. Team Shared Feed & Visibility Toggle ---
@router.get("/api/tenant/feed")
async def get_team_shared_feed(
    org_id: str = Query(...),
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool or not org_id:
        return {"notes": [], "tasks": [], "meetings": []}
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s AND status = 'active'",
                (org_id, email),
            )
            member = cur.fetchone()
            if not member:
                return JSONResponse(status_code=403, content={"error": "Not a member of this workspace"})
            cur.execute(
                "SELECT id::text, title, content, tags, user_email, updated_at FROM public.notes WHERE org_id = %s AND visibility = 'team' ORDER BY updated_at DESC LIMIT 30",
                (org_id,),
            )
            notes = cur.fetchall()
            cur.execute(
                "SELECT id::text, title, priority, is_completed, status, user_email, created_at FROM public.tasks WHERE org_id = %s AND visibility = 'team' ORDER BY created_at DESC LIMIT 30",
                (org_id,),
            )
            tasks = cur.fetchall()
            cur.execute(
                "SELECT id::text, title, summary, user_email, created_at FROM public.meetings WHERE org_id = %s AND visibility = 'team' ORDER BY created_at DESC LIMIT 20",
                (org_id,),
            )
            meetings = cur.fetchall()
    return {"role": member["role"], "notes": notes, "tasks": tasks, "meetings": meetings}


@router.post("/api/tenant/visibility")
async def set_resource_visibility(req: VisibilityReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    table_map = {"note": "public.notes", "task": "public.tasks", "meeting": "public.meetings"}
    table = table_map.get(req.resource_type)
    if not table:
        return JSONResponse(status_code=400, content={"error": "Invalid resource_type"})
    vis = "team" if req.visibility == "team" else "private"
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s AND status = 'active'",
                (req.org_id, email),
            )
            member = cur.fetchone()
            if not member or not require_org_role(member["role"], "member"):
                return JSONResponse(status_code=403, content={"error": "Member role or higher required to share with team"})
            cur.execute(
                f"UPDATE {table} SET org_id = %s, visibility = %s WHERE id = %s::uuid AND user_email = %s RETURNING id::text, org_id, visibility",
                (req.org_id if vis == "team" else "", vis, req.resource_id, email),
            )
            updated = cur.fetchone()
            if not updated:
                return JSONResponse(status_code=404, content={"error": "Resource not found or not owned by you"})
    log_audit(email, "tenant.visibility_changed", req.resource_type, req.resource_id, {"visibility": vis}, org_id=req.org_id)
    return {"updated": updated}


# --- 3. Notion-Style Public Share Links ---
@router.post("/api/tenant/share", status_code=201)
async def create_public_share_link(req: ShareCreateReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    token = secrets.token_urlsafe(12)
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.shared_links (token, resource_type, resource_id, org_id, owner_email, title, content)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING token, resource_type, title, created_at
                """,
                (token, req.resource_type, req.resource_id, req.org_id, email, req.title or "Shared Document", req.content or ""),
            )
            row = cur.fetchone()
    log_audit(email, "share.link_created", req.resource_type, req.resource_id, {"token": token}, org_id=req.org_id)
    return {"share": row, "share_path": f"/share/{token}"}


@router.get("/api/tenant/share/{token}")
async def get_public_share_json(token: str):
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT token, resource_type, title, content, owner_email, views, created_at FROM public.shared_links WHERE token = %s",
                (token,),
            )
            row = cur.fetchone()
    if not row:
        return JSONResponse(status_code=404, content={"error": "Share link not found or expired"})
    return {"share": row}


@router.get("/share/{token}", response_class=HTMLResponse)
async def view_public_share_page(token: str):
    pool = get_db_pool()
    row = None
    if pool:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE public.shared_links SET views = views + 1 WHERE token = %s RETURNING token, resource_type, title, content, owner_email, views, created_at",
                    (token,),
                )
                row = cur.fetchone()
    if not row:
        return HTMLResponse(
            "<html><body style='font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh'><div><h2>404 — Share Link Not Found</h2><p>This Renim AI public link is invalid or removed.</p></div></body></html>",
            status_code=404,
        )
    safe_title = (row["title"] or "Shared Document").replace("<", "&lt;").replace(">", "&gt;")
    safe_content = (row["content"] or "").replace("<", "&lt;").replace(">", "&gt;")
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{safe_title} — Renim AI Shared</title>
  <style>
    body {{ margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#090d16; color:#e2e8f0; line-height:1.7; }}
    .wrap {{ max-width: 820px; margin: 40px auto; padding: 32px; background:#111827; border:1px solid #1e293b; border-radius:16px; box-shadow:0 20px 50px rgba(0,0,0,0.4); }}
    .badge {{ display:inline-block; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; background:rgba(8,145,178,0.18); color:#22d3ee; text-transform:uppercase; }}
    h1 {{ margin:14px 0 8px; font-size:28px; color:#f8fafc; }}
    .meta {{ font-size:13px; color:#94a3b8; margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid #1e293b; }}
    pre {{ white-space:pre-wrap; font-family:inherit; font-size:15px; color:#cbd5e1; }}
    .footer {{ margin-top:32px; padding-top:16px; border-top:1px solid #1e293b; font-size:12px; color:#64748b; display:flex; justify-content:space-between; }}
    a {{ color:#22d3ee; text-decoration:none; }}
  </style>
</head>
<body>
  <div class="wrap">
    <span class="badge">Renim AI · Public {row["resource_type"]}</span>
    <h1>{safe_title}</h1>
    <div class="meta">Shared by {row["owner_email"]} · {row["views"]} views</div>
    <pre>{safe_content}</pre>
    <div class="footer">
      <span>Powered by Renim AI Enterprise Workspace</span>
      <a href="/app">Open Workspace →</a>
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(html)


# --- 4. AI Mind-Map / Flowchart Generator ---
@router.post("/api/tenant/mindmap")
async def generate_mindmap(req: MindMapReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    allowed, used, limit = check_ai_credits(email)
    if not allowed:
        return JSONResponse(status_code=402, content={"error": f"AI credit limit reached ({used}/{limit}). Please upgrade your plan."})
    if len(req.content.strip()) < 15:
        return JSONResponse(status_code=400, content={"error": "Provide at least a sentence or note to generate a mind map"})
    raw = await _ask_llm(
        'Convert the input into a structured Mind Map JSON object: {"root": "Main Topic", "branches": [{"title": "Branch 1", "nodes": ["point a", "point b"]}], "mermaid": "mindmap\\n  root((Main Topic))\\n    Branch 1\\n      point a"}. Return ONLY valid JSON, no markdown fences.',
        f"Title: {req.title}\n\nContent:\n{req.content[:5000]}",
        req.api_key,
        req.model,
        req.base_url,
    )
    mindmap = {"root": req.title, "branches": [], "mermaid": ""}
    try:
        cleaned = re.sub(r"```json|```", "", raw).strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "branches" in parsed:
            mindmap = parsed
    except Exception:
        mindmap = {
            "root": req.title,
            "branches": [{"title": "Key Points", "nodes": [line.strip("-• ") for line in req.content.splitlines() if line.strip()][:6]}],
            "mermaid": "",
        }
    track_ai_usage(email, "mindmap_generator", credits_used=1, tokens_est=400)
    return {"mindmap": mindmap}


# --- 5. AI Meeting Follow-Up Email & Action Extractor ---
@router.post("/api/tenant/meeting-followup")
async def generate_meeting_followup(req: MeetingFollowupReq, authorization: Optional[str] = Header(default=None)):
    email = resolve_user_email(authorization, req.user_email)
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    allowed, used, limit = check_ai_credits(email)
    if not allowed:
        return JSONResponse(status_code=402, content={"error": f"AI credit limit reached ({used}/{limit}). Please upgrade your plan."})
    if len(req.transcript.strip()) < 20:
        return JSONResponse(status_code=400, content={"error": "Provide meeting notes or transcript first"})
    raw = await _ask_llm(
        'From the meeting notes, return ONLY valid JSON: {"subject": "email subject", "email_body": "polite concise follow-up email", "action_items": ["action 1", "action 2"]}. No markdown fences.',
        f"Meeting: {req.title}\nAttendees: {req.attendees}\n\nNotes/Transcript:\n{req.transcript[:6000]}",
        req.api_key,
        req.model,
        req.base_url,
    )
    result = {"subject": f"Follow-up: {req.title}", "email_body": raw, "action_items": []}
    try:
        cleaned = re.sub(r"```json|```", "", raw).strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "email_body" in parsed:
            result = parsed
    except Exception:
        pass
    track_ai_usage(email, "meeting_followup", credits_used=1, tokens_est=450)
    return result
