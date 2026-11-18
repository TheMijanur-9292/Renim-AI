"""
Renim AI — Enterprise Audit Logs & Compliance Center Router
"""

import csv
import io
from typing import Optional
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from db import get_db_pool, log_audit, get_effective_plan
from auth_utils import resolve_user_email, resolve_authenticated_email, server_error

router = APIRouter(prefix="/api/audit", tags=["Audit & Compliance"])


class SecuritySettingsReq(BaseModel):
    org_id: str = "personal"
    sso_domain: str = ""
    mfa_enforced: bool = False
    retention_days: int = 90
    user_email: Optional[str] = None


@router.get("/logs")
async def get_audit_logs(
    limit: int = 50,
    action_filter: str = "",
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"logs": []}
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                if action_filter.strip():
                    cur.execute(
                        """
                        SELECT id::text, user_email, org_id, action, resource_type, resource_id, details, ip_address, created_at
                        FROM public.audit_logs
                        WHERE user_email = %s AND action ILIKE %s
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (email, f"%{action_filter.strip()}%", min(limit, 200)),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id::text, user_email, org_id, action, resource_type, resource_id, details, ip_address, created_at
                        FROM public.audit_logs
                        WHERE user_email = %s
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (email, min(limit, 200)),
                    )
                return {"logs": cur.fetchall()}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.get("/export")
async def export_audit_logs_csv(
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
    x_org_id: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    plan = get_effective_plan(email, x_org_id or "")
    if plan["rank"] < 3:
        return JSONResponse(status_code=402, content={"error": "Audit log CSV export requires Team plan (₹599/mo) or higher."})
    pool = get_db_pool()
    if not pool:
        return Response(content="id,user_email,action,resource_type,ip_address,created_at\n", media_type="text/csv")
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id::text, user_email, action, resource_type, resource_id, ip_address, created_at
                    FROM public.audit_logs
                    WHERE user_email = %s
                    ORDER BY created_at DESC
                    LIMIT 500
                    """,
                    (email,),
                )
                rows = cur.fetchall()
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "user_email", "action", "resource_type", "resource_id", "ip_address", "created_at"])
        for r in rows:
            writer.writerow([r["id"], r["user_email"], r["action"], r["resource_type"], r["resource_id"], r["ip_address"], r["created_at"]])
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=renim-ai-audit-logs.csv"},
        )
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.get("/settings")
async def get_security_settings(
    org_id: str = "personal",
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
    x_org_id: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    effective_org = (x_org_id or org_id or "personal").strip()
    scope_id = effective_org if effective_org != "personal" else f"user:{email}"
    pool = get_db_pool()
    if not pool:
        return {"settings": {"org_id": scope_id, "sso_domain": "", "mfa_enforced": False, "retention_days": 90}}
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT org_id, sso_domain, mfa_enforced, retention_days, updated_by, updated_at FROM public.org_security_settings WHERE org_id = %s;",
                    (scope_id,),
                )
                row = cur.fetchone()
                if not row:
                    return {"settings": {"org_id": scope_id, "sso_domain": "", "mfa_enforced": False, "retention_days": 90}}
                return {"settings": dict(row)}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.put("/settings")
async def save_security_settings(
    req: SecuritySettingsReq,
    authorization: Optional[str] = Header(default=None),
    x_org_id: Optional[str] = Header(default=None),
):
    email = resolve_authenticated_email(authorization)
    if not email:
        return JSONResponse(status_code=401, content={"error": "Authentication required to update security settings."})
    effective_org = (x_org_id or req.org_id or "personal").strip()
    scope_id = effective_org if effective_org != "personal" else f"user:{email}"
    plan = get_effective_plan(email, effective_org)
    if req.sso_domain.strip() and plan["rank"] < 4:
        return JSONResponse(status_code=402, content={"error": "Custom SAML 2.0 SSO domain requires Enterprise plan (₹999/mo)."})
    retention = max(7, min(3650, int(req.retention_days or 90)))
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.org_security_settings (org_id, sso_domain, mfa_enforced, retention_days, updated_by, updated_at)
                    VALUES (%s, %s, %s, %s, %s, now())
                    ON CONFLICT (org_id) DO UPDATE SET
                        sso_domain = EXCLUDED.sso_domain,
                        mfa_enforced = EXCLUDED.mfa_enforced,
                        retention_days = EXCLUDED.retention_days,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = now()
                    RETURNING org_id, sso_domain, mfa_enforced, retention_days, updated_by, updated_at;
                    """,
                    (scope_id, req.sso_domain.strip(), bool(req.mfa_enforced), retention, email),
                )
                row = cur.fetchone()
        log_audit(email, "security.settings_updated", "security", scope_id, {"mfa_enforced": req.mfa_enforced, "retention_days": retention})
        return {"settings": dict(row)}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))
