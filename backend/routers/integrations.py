"""
Renim AI — Enterprise Integrations, Webhooks & Developer API Keys Router
"""

import secrets
import hashlib
from typing import Optional, List
import httpx
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import get_db_pool, log_audit, get_effective_plan
from auth_utils import resolve_user_email, is_safe_public_url

router = APIRouter(tags=["Integrations & API Keys"])


class IntegrationSaveRequest(BaseModel):
    provider: str  # slack | teams | jira | github | webhook
    webhook_url: str = ""
    channel_or_project: str = ""
    is_enabled: bool = True
    events: List[str] = ["meeting.summarized", "task.created"]
    org_id: str = ""
    user_email: Optional[str] = None


class WebhookTestRequest(BaseModel):
    provider: str
    webhook_url: str
    user_email: Optional[str] = None


class ApiKeyCreateRequest(BaseModel):
    name: str
    org_id: str = ""
    user_email: Optional[str] = None


@router.get("/api/integrations")
async def list_integrations(
    org_id: str = "",
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"integrations": []}
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id::text, provider, webhook_url, channel_or_project, is_enabled, events, updated_at
                    FROM public.integration_configs
                    WHERE user_email = %s AND org_id = %s
                    ORDER BY provider ASC
                    """,
                    (email, org_id or ""),
                )
                return {"integrations": cur.fetchall()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/api/integrations/save")
async def save_integration(
    req: IntegrationSaveRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    provider = req.provider.strip().lower()
    if provider not in {"slack", "teams", "jira", "github", "webhook"}:
        return JSONResponse(status_code=400, content={"error": "Unsupported integration provider"})
    plan = get_effective_plan(email, req.org_id)
    if provider in {"slack", "teams", "webhook"} and plan["rank"] < 2:
        return JSONResponse(status_code=402, content={"error": f"{provider.title()} integration requires Pro plan (₹199/mo) or higher."})
    if provider in {"jira", "github"} and plan["rank"] < 3:
        return JSONResponse(status_code=402, content={"error": f"{provider.title()} integration requires Team plan (₹599/mo) or higher."})
    import json
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.integration_configs
                        (user_email, org_id, provider, webhook_url, channel_or_project, is_enabled, events, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, now())
                    ON CONFLICT (user_email, org_id, provider)
                    DO UPDATE SET webhook_url = EXCLUDED.webhook_url,
                                  channel_or_project = EXCLUDED.channel_or_project,
                                  is_enabled = EXCLUDED.is_enabled,
                                  events = EXCLUDED.events,
                                  updated_at = now()
                    RETURNING id::text, provider, webhook_url, channel_or_project, is_enabled, events, updated_at
                    """,
                    (
                        email,
                        req.org_id or "",
                        provider,
                        req.webhook_url.strip(),
                        req.channel_or_project.strip(),
                        req.is_enabled,
                        json.dumps(req.events),
                    ),
                )
                row = cur.fetchone()
        log_audit(
            email,
            "integration.configured",
            "integration",
            provider,
            {"is_enabled": req.is_enabled, "channel_or_project": req.channel_or_project},
            org_id=req.org_id,
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return {"integration": row}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/api/integrations/test-webhook")
async def test_webhook(
    req: WebhookTestRequest,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, req.user_email)
    url = req.webhook_url.strip()
    if not url.startswith(("http://", "https://")) or not is_safe_public_url(url):
        return JSONResponse(status_code=400, content={"error": "Valid public http(s) webhook URL is required"})
    payload = {
        "event": "renim.webhook.test",
        "provider": req.provider,
        "actor": email,
        "text": f"Renim AI Enterprise Connector ({req.provider.upper()}) connected successfully!",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
        log_audit(email, "webhook.tested", "integration", req.provider, {"status_code": resp.status_code})
        return {"delivered": resp.status_code < 400, "status_code": resp.status_code}
    except Exception as e:
        return JSONResponse(status_code=502, content={"delivered": False, "error": str(e)})


@router.get("/api/api-keys")
async def list_api_keys(
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"api_keys": []}
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id::text, name, key_prefix, last_used_at, created_at
                    FROM public.api_keys
                    WHERE user_email = %s
                    ORDER BY created_at DESC
                    """,
                    (email,),
                )
                return {"api_keys": cur.fetchall()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/api/api-keys", status_code=201)
async def create_api_key(
    req: ApiKeyCreateRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, req.user_email)
    plan = get_effective_plan(email, req.org_id)
    if plan["rank"] < 3:
        return JSONResponse(status_code=402, content={"error": "Developer API Keys require Team plan (₹599/mo) or higher."})
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    raw_key = f"sk_renim_{secrets.token_urlsafe(24)}"
    prefix = raw_key[:16] + "..."
    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.api_keys (user_email, org_id, name, key_prefix, key_hash)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id::text, name, key_prefix, created_at
                    """,
                    (email, req.org_id or "", req.name.strip() or "Production API Key", prefix, key_hash),
                )
                row = cur.fetchone()
        log_audit(
            email,
            "apikey.created",
            "api_key",
            row["id"],
            {"name": row["name"], "prefix": prefix},
            org_id=req.org_id,
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return {"api_key": {**row, "secret_key": raw_key}}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.delete("/api/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    request: Request,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM public.api_keys WHERE id = %s::uuid AND user_email = %s",
                    (key_id, email),
                )
        log_audit(
            email,
            "apikey.revoked",
            "api_key",
            key_id,
            {},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return {"status": "revoked", "id": key_id}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
