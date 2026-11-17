"""
Renim AI — User Profile, Account Stats & Security Router
"""

import json
from typing import Optional
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from db import get_db_pool, log_audit
from auth_utils import resolve_user_email, resolve_authenticated_email, verify_password, hash_password

router = APIRouter(prefix="/api/profile", tags=["User Profile"])


class ProfileUpdateRequest(BaseModel):
    user_email: Optional[str] = None
    full_name: str = ""
    job_title: str = ""
    department: str = ""
    bio: str = ""
    phone: str = ""
    location: str = ""
    timezone: str = "Asia/Kolkata"
    avatar_url: str = ""
    ai_persona_preference: str = "Workspace Copilot"
    working_hours: str = "09:00 - 18:00"


class ChangePasswordRequest(BaseModel):
    user_email: Optional[str] = None
    current_password: str = ""
    new_password: str


def _safe_count(cur, sql: str, params: tuple) -> int:
    try:
        cur.execute(sql, params)
        row = cur.fetchone()
        return int(row["cnt"]) if row and "cnt" in row else 0
    except Exception:
        return 0


@router.get("")
def get_user_profile(
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database pool not ready"})

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, email, full_name, job_title, department, bio, phone,
                           location, timezone, avatar_url, ai_persona_preference,
                           working_hours, created_at, updated_at, role, is_superadmin, is_active,
                           (password_hash <> '') AS has_password
                    FROM public.app_users
                    WHERE email = %s;
                    """,
                    (email,),
                )
                row = cur.fetchone()
                if row:
                    is_sa = bool(row.get("is_superadmin") or row.get("role") == "superadmin")
                    profile = {
                        "id": str(row["id"]),
                        "email": row["email"],
                        "full_name": row.get("full_name") or email.split("@")[0],
                        "job_title": row.get("job_title") or "",
                        "department": row.get("department") or "",
                        "bio": row.get("bio") or "",
                        "phone": row.get("phone") or "",
                        "location": row.get("location") or "",
                        "timezone": row.get("timezone") or "Asia/Kolkata",
                        "avatar_url": row.get("avatar_url") or "",
                        "ai_persona_preference": row.get("ai_persona_preference") or "Workspace Copilot",
                        "working_hours": row.get("working_hours") or "09:00 - 18:00",
                        "role": "superadmin" if is_sa else (row.get("role") or "user"),
                        "is_superadmin": is_sa,
                        "is_active": row.get("is_active", True),
                        "has_password": bool(row.get("has_password")),
                        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
                    }
                else:
                    profile = {
                        "id": "",
                        "email": email,
                        "full_name": "Renim AI User" if email == "guest@renimai.com" else email.split("@")[0],
                        "job_title": "",
                        "department": "",
                        "bio": "",
                        "phone": "",
                        "location": "",
                        "timezone": "Asia/Kolkata",
                        "avatar_url": "",
                        "ai_persona_preference": "Workspace Copilot",
                        "working_hours": "09:00 - 18:00",
                        "has_password": False,
                        "created_at": None,
                        "updated_at": None,
                    }

                notes_count = _safe_count(
                    cur, "SELECT COUNT(*) AS cnt FROM public.notes WHERE user_email = %s;", (email,)
                )
                tasks_total = _safe_count(
                    cur, "SELECT COUNT(*) AS cnt FROM public.tasks WHERE user_email = %s;", (email,)
                )
                tasks_completed = _safe_count(
                    cur,
                    "SELECT COUNT(*) AS cnt FROM public.tasks WHERE user_email = %s AND (completed = true OR status = 'done');",
                    (email,),
                )
                meetings_count = _safe_count(
                    cur, "SELECT COUNT(*) AS cnt FROM public.meetings WHERE user_email = %s;", (email,)
                )
                documents_count = _safe_count(
                    cur, "SELECT COUNT(*) AS cnt FROM public.user_documents WHERE user_email = %s;", (email,)
                )
                habits_count = _safe_count(
                    cur, "SELECT COUNT(*) AS cnt FROM public.user_habits WHERE user_email = %s;", (email,)
                )
                goals_count = _safe_count(
                    cur, "SELECT COUNT(*) AS cnt FROM public.user_goals WHERE user_email = %s;", (email,)
                )

                # Organizations & Roles
                memberships = []
                try:
                    cur.execute(
                        """
                        SELECT o.id::text AS org_id, o.name AS org_name, o.plan, m.role, m.status
                        FROM public.org_members m
                        JOIN public.organizations o ON o.id = m.org_id
                        WHERE m.user_email = %s
                        ORDER BY o.created_at DESC;
                        """,
                        (email,),
                    )
                    memberships = [dict(r) for r in cur.fetchall()]
                except Exception:
                    memberships = []

                # AI Credits Usage
                ai_credits_used = 0
                ai_credits_limit = 500
                plan_id = "starter"
                try:
                    cur.execute(
                        """
                        SELECT plan_id, ai_credits_used, ai_credits_limit
                        FROM public.org_subscriptions
                        WHERE user_email = %s
                        ORDER BY updated_at DESC
                        LIMIT 1;
                        """,
                        (email,),
                    )
                    sub = cur.fetchone()
                    if sub:
                        plan_id = sub.get("plan_id") or "starter"
                        ai_credits_used = int(sub.get("ai_credits_used") or 0)
                        ai_credits_limit = int(sub.get("ai_credits_limit") or 500)
                except Exception:
                    pass

                return {
                    "profile": profile,
                    "stats": {
                        "notes_count": notes_count,
                        "tasks_total": tasks_total,
                        "tasks_completed": tasks_completed,
                        "meetings_count": meetings_count,
                        "documents_count": documents_count,
                        "habits_count": habits_count,
                        "goals_count": goals_count,
                        "orgs_count": len(memberships),
                        "ai_credits_used": ai_credits_used,
                        "ai_credits_limit": ai_credits_limit,
                        "plan_id": plan_id,
                    },
                    "memberships": memberships,
                }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.put("")
def update_user_profile(
    payload: ProfileUpdateRequest,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, payload.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database pool not ready"})

    full_name = payload.full_name.strip() or email.split("@")[0]
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.app_users (
                        email, full_name, job_title, department, bio, phone,
                        location, timezone, avatar_url, ai_persona_preference,
                        working_hours, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (email) DO UPDATE SET
                        full_name = EXCLUDED.full_name,
                        job_title = EXCLUDED.job_title,
                        department = EXCLUDED.department,
                        bio = EXCLUDED.bio,
                        phone = EXCLUDED.phone,
                        location = EXCLUDED.location,
                        timezone = EXCLUDED.timezone,
                        avatar_url = EXCLUDED.avatar_url,
                        ai_persona_preference = EXCLUDED.ai_persona_preference,
                        working_hours = EXCLUDED.working_hours,
                        updated_at = now()
                    RETURNING id, email, full_name, job_title, department, bio, phone,
                              location, timezone, avatar_url, ai_persona_preference,
                              working_hours, created_at, updated_at;
                    """,
                    (
                        email,
                        full_name,
                        payload.job_title.strip(),
                        payload.department.strip(),
                        payload.bio.strip(),
                        payload.phone.strip(),
                        payload.location.strip(),
                        payload.timezone.strip() or "Asia/Kolkata",
                        payload.avatar_url.strip(),
                        payload.ai_persona_preference.strip() or "Workspace Copilot",
                        payload.working_hours.strip() or "09:00 - 18:00",
                    ),
                )
                row = cur.fetchone()
                log_audit(email, "profile.updated", "user", str(row["id"]))
                return {
                    "profile": {
                        "id": str(row["id"]),
                        "email": row["email"],
                        "full_name": row["full_name"],
                        "job_title": row["job_title"],
                        "department": row["department"],
                        "bio": row["bio"],
                        "phone": row["phone"],
                        "location": row["location"],
                        "timezone": row["timezone"],
                        "avatar_url": row["avatar_url"],
                        "ai_persona_preference": row["ai_persona_preference"],
                        "working_hours": row["working_hours"],
                        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
                    }
                }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.post("/change-password")
def change_user_password(
    payload: ChangePasswordRequest,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, payload.user_email)
    if email == "guest@renimai.com":
        return JSONResponse(
            status_code=400,
            content={"error": "Guest accounts cannot set a password. Please Sign Up for an account first."},
        )
    if len(payload.new_password.strip()) < 6:
        return JSONResponse(
            status_code=400,
            content={"error": "New password must be at least 6 characters long."},
        )

    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database pool not ready"})

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, password_hash FROM public.app_users WHERE email = %s;",
                    (email,),
                )
                row = cur.fetchone()
                if not row:
                    return JSONResponse(status_code=404, content={"error": "User account not found."})

                if row.get("password_hash") and not verify_password(payload.current_password, row["password_hash"]):
                    return JSONResponse(status_code=401, content={"error": "Current password is incorrect."})

                cur.execute(
                    "UPDATE public.app_users SET password_hash = %s, token_version = COALESCE(token_version, 1) + 1, updated_at = now() WHERE email = %s;",
                    (hash_password(payload.new_password.strip()), email),
                )
                log_audit(email, "profile.password_changed", "user", str(row["id"]))
                return {"success": True, "message": "Password updated successfully."}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/export-data")
def gdpr_export_user_data(authorization: Optional[str] = Header(default=None)):
    """GDPR Data Portability: Export all personal workspace data as JSON."""
    email = resolve_authenticated_email(authorization)
    if not email:
        return JSONResponse(status_code=401, content={"error": "Authentication required to export personal data."})
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database pool not ready"})
    try:
        export_bundle: dict = {"exported_for": email}
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id::text, email, full_name, job_title, department, bio, phone, location, timezone, working_hours, created_at FROM public.app_users WHERE email = %s;",
                    (email,),
                )
                export_bundle["profile"] = cur.fetchone()
                for tbl in ("notes", "tasks", "calendar_events", "meetings", "user_documents", "org_members"):
                    try:
                        cur.execute(f"SELECT * FROM public.{tbl} WHERE LOWER(user_email) = %s;", (email,))
                        export_bundle[tbl] = cur.fetchall()
                    except Exception:
                        export_bundle[tbl] = []
        log_audit(email, "gdpr.data_exported", "user", email)
        return Response(
            content=json.dumps(export_bundle, default=str, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=renim-ai-gdpr-export.json"},
        )
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.delete("/account")
def gdpr_delete_account(authorization: Optional[str] = Header(default=None)):
    """GDPR Right to Erasure: Permanently delete user account & personal workspace records."""
    email = resolve_authenticated_email(authorization)
    if not email:
        return JSONResponse(status_code=401, content={"error": "Authentication required to delete account."})
    if email == "mijanur@renim.ai":
        return JSONResponse(status_code=403, content={"error": "Primary Super Admin account cannot be self-deleted."})
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database pool not ready"})
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                for tbl in ("notes", "tasks", "calendar_events", "meetings", "user_documents", "chat_sessions", "org_members"):
                    try:
                        cur.execute(f"DELETE FROM public.{tbl} WHERE LOWER(user_email) = %s;", (email,))
                    except Exception:
                        pass
                cur.execute("DELETE FROM public.app_users WHERE email = %s RETURNING id;", (email,))
                deleted = cur.fetchone()
        log_audit(email, "gdpr.account_deleted", "user", email)
        return {"deleted": bool(deleted), "message": "Account and personal workspace data permanently deleted."}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
