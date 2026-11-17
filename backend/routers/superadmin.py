"""
Renim AI — Super Admin Control & Platform User Management Router
"""

from typing import Optional
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import get_db_pool, log_audit
from auth_utils import resolve_authenticated_email, hash_password

router = APIRouter(prefix="/api/superadmin", tags=["Super Admin"])


class AdminCreateUserReq(BaseModel):
    email: str
    full_name: str = ""
    password: str
    role: str = "user"
    job_title: str = ""
    department: str = ""


class AdminUpdateUserReq(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    job_title: Optional[str] = None
    department: Optional[str] = None


class AdminResetPasswordReq(BaseModel):
    new_password: str


def _verify_superadmin(authorization: Optional[str], fallback_email: Optional[str] = None) -> Optional[str]:
    email = resolve_authenticated_email(authorization)
    pool = get_db_pool()
    if not pool or not email:
        return None
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT email, role, is_superadmin, is_active FROM public.app_users WHERE email = %s;",
                    (email,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                if row.get("is_active") is False:
                    return None
                if row.get("is_superadmin") or row.get("role") == "superadmin":
                    return row["email"]
                return None
    except Exception:
        return None


def _safe_count(cur, sql: str, params: tuple = ()) -> int:
    try:
        cur.execute(sql, params)
        row = cur.fetchone()
        return int(row["cnt"]) if row and "cnt" in row else 0
    except Exception:
        return 0


@router.get("/overview")
def superadmin_overview(
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    admin_email = _verify_superadmin(authorization, user_email)
    if not admin_email:
        return JSONResponse(status_code=403, content={"error": "Super Admin privileges required."})

    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            total_users = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.app_users;")
            active_users = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.app_users WHERE is_active = true;")
            suspended_users = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.app_users WHERE is_active = false;")
            superadmin_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.app_users WHERE is_superadmin = true OR role = 'superadmin';")
            total_orgs = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.organizations;")
            total_notes = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.notes;")
            total_tasks = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.tasks;")
            total_meetings = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.meetings;")
            total_documents = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.user_documents;")
            total_ai_credits = _safe_count(cur, "SELECT COALESCE(SUM(ai_credits_used), 0) AS cnt FROM public.org_subscriptions;")

            return {
                "overview": {
                    "total_users": total_users,
                    "active_users": active_users,
                    "suspended_users": suspended_users,
                    "superadmin_count": superadmin_count,
                    "total_orgs": total_orgs,
                    "total_notes": total_notes,
                    "total_tasks": total_tasks,
                    "total_meetings": total_meetings,
                    "total_documents": total_documents,
                    "total_ai_credits": total_ai_credits,
                }
            }


@router.get("/users")
def superadmin_list_users(
    q: str = "",
    role: str = "all",
    status: str = "all",
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    admin_email = _verify_superadmin(authorization, user_email)
    if not admin_email:
        return JSONResponse(status_code=403, content={"error": "Super Admin privileges required."})

    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text, email, full_name, job_title, department, location,
                       avatar_url, role, is_superadmin, is_active, created_at, updated_at
                FROM public.app_users
                ORDER BY is_superadmin DESC, created_at DESC;
                """
            )
            rows = cur.fetchall()
            users = []
            search_q = q.strip().lower()
            for r in rows:
                u_email = r["email"]
                u_role = "superadmin" if (r.get("is_superadmin") or r.get("role") == "superadmin") else (r.get("role") or "user")
                u_active = r.get("is_active", True)

                if role != "all" and u_role != role:
                    continue
                if status == "active" and not u_active:
                    continue
                if status == "suspended" and u_active:
                    continue
                if search_q:
                    hay = f"{u_email} {r.get('full_name','')} {r.get('job_title','')} {r.get('department','')}".lower()
                    if search_q not in hay:
                        continue

                notes_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.notes WHERE user_email = %s;", (u_email,))
                tasks_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.tasks WHERE user_email = %s;", (u_email,))
                meetings_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.meetings WHERE user_email = %s;", (u_email,))
                docs_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.user_documents WHERE user_email = %s;", (u_email,))
                orgs_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.org_members WHERE user_email = %s;", (u_email,))

                users.append({
                    "id": r["id"],
                    "email": u_email,
                    "full_name": r.get("full_name") or u_email.split("@")[0],
                    "job_title": r.get("job_title") or "",
                    "department": r.get("department") or "",
                    "location": r.get("location") or "",
                    "avatar_url": r.get("avatar_url") or "",
                    "role": u_role,
                    "is_superadmin": bool(r.get("is_superadmin") or u_role == "superadmin"),
                    "is_active": bool(u_active),
                    "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                    "updated_at": r["updated_at"].isoformat() if r.get("updated_at") else None,
                    "stats": {
                        "notes_count": notes_count,
                        "tasks_count": tasks_count,
                        "meetings_count": meetings_count,
                        "docs_count": docs_count,
                        "orgs_count": orgs_count,
                    },
                })
            return {"users": users}


@router.get("/users/{user_id}")
def superadmin_user_details(
    user_id: str,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    admin_email = _verify_superadmin(authorization, user_email)
    if not admin_email:
        return JSONResponse(status_code=403, content={"error": "Super Admin privileges required."})

    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text, email, full_name, job_title, department, bio, phone,
                       location, timezone, avatar_url, ai_persona_preference,
                       working_hours, role, is_superadmin, is_active, created_at, updated_at
                FROM public.app_users
                WHERE id::text = %s OR email = %s
                LIMIT 1;
                """,
                (user_id, user_id),
            )
            r = cur.fetchone()
            if not r:
                return JSONResponse(status_code=404, content={"error": "User not found."})

            target_email = r["email"]
            is_sa = bool(r.get("is_superadmin") or r.get("role") == "superadmin")
            profile = {
                "id": r["id"],
                "email": target_email,
                "full_name": r.get("full_name") or target_email.split("@")[0],
                "job_title": r.get("job_title") or "",
                "department": r.get("department") or "",
                "bio": r.get("bio") or "",
                "phone": r.get("phone") or "",
                "location": r.get("location") or "",
                "timezone": r.get("timezone") or "Asia/Kolkata",
                "avatar_url": r.get("avatar_url") or "",
                "ai_persona_preference": r.get("ai_persona_preference") or "Workspace Copilot",
                "working_hours": r.get("working_hours") or "09:00 - 18:00",
                "role": "superadmin" if is_sa else (r.get("role") or "user"),
                "is_superadmin": is_sa,
                "is_active": r.get("is_active", True),
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                "updated_at": r["updated_at"].isoformat() if r.get("updated_at") else None,
            }

            notes_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.notes WHERE user_email = %s;", (target_email,))
            tasks_total = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.tasks WHERE user_email = %s;", (target_email,))
            tasks_completed = _safe_count(
                cur,
                "SELECT COUNT(*) AS cnt FROM public.tasks WHERE user_email = %s AND (completed = true OR status = 'done');",
                (target_email,),
            )
            meetings_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.meetings WHERE user_email = %s;", (target_email,))
            documents_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.user_documents WHERE user_email = %s;", (target_email,))
            habits_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.user_habits WHERE user_email = %s;", (target_email,))
            goals_count = _safe_count(cur, "SELECT COUNT(*) AS cnt FROM public.user_goals WHERE user_email = %s;", (target_email,))

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
                    (target_email,),
                )
                memberships = [dict(row) for row in cur.fetchall()]
            except Exception:
                pass

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
                    (target_email,),
                )
                sub = cur.fetchone()
                if sub:
                    plan_id = sub.get("plan_id") or "starter"
                    ai_credits_used = int(sub.get("ai_credits_used") or 0)
                    ai_credits_limit = int(sub.get("ai_credits_limit") or 500)
            except Exception:
                pass

            recent_notes = []
            try:
                cur.execute(
                    "SELECT id::text, title, created_at FROM public.notes WHERE user_email = %s ORDER BY created_at DESC LIMIT 5;",
                    (target_email,),
                )
                recent_notes = [
                    {"id": n["id"], "title": n.get("title") or "Untitled Note", "created_at": n["created_at"].isoformat() if n.get("created_at") else None}
                    for n in cur.fetchall()
                ]
            except Exception:
                pass

            recent_tasks = []
            try:
                cur.execute(
                    "SELECT id::text, title, status, priority, completed FROM public.tasks WHERE user_email = %s ORDER BY created_at DESC LIMIT 5;",
                    (target_email,),
                )
                recent_tasks = [dict(t) for t in cur.fetchall()]
            except Exception:
                pass

            recent_audit_logs = []
            try:
                cur.execute(
                    "SELECT id::text, action, resource_type, ip_address, created_at FROM public.audit_logs WHERE user_email = %s ORDER BY created_at DESC LIMIT 8;",
                    (target_email,),
                )
                recent_audit_logs = [
                    {
                        "id": a["id"],
                        "action": a["action"],
                        "resource_type": a["resource_type"],
                        "ip_address": a["ip_address"],
                        "created_at": a["created_at"].isoformat() if a.get("created_at") else None,
                    }
                    for a in cur.fetchall()
                ]
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
                "recent_notes": recent_notes,
                "recent_tasks": recent_tasks,
                "recent_audit_logs": recent_audit_logs,
            }


@router.post("/users", status_code=201)
def superadmin_create_user(
    payload: AdminCreateUserReq,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    admin_email = _verify_superadmin(authorization, user_email)
    if not admin_email:
        return JSONResponse(status_code=403, content={"error": "Super Admin privileges required."})

    email = payload.email.strip().lower()
    if not email or "@" not in email:
        return JSONResponse(status_code=400, content={"error": "Valid email address is required."})
    if len(payload.password.strip()) < 6:
        return JSONResponse(status_code=400, content={"error": "Password must be at least 6 characters."})

    role = payload.role.strip().lower()
    if role not in ("user", "admin", "superadmin"):
        role = "user"
    is_sa = role == "superadmin"

    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM public.app_users WHERE email = %s;", (email,))
            if cur.fetchone():
                return JSONResponse(status_code=400, content={"error": "User with this email already exists."})

            cur.execute(
                """
                INSERT INTO public.app_users (email, full_name, password_hash, role, is_superadmin, is_active, job_title, department)
                VALUES (%s, %s, %s, %s, %s, true, %s, %s)
                RETURNING id::text, email, full_name, role, is_superadmin, is_active, created_at;
                """,
                (
                    email,
                    payload.full_name.strip() or email.split("@")[0],
                    hash_password(payload.password.strip()),
                    role,
                    is_sa,
                    payload.job_title.strip(),
                    payload.department.strip(),
                ),
            )
            row = cur.fetchone()
            log_audit(admin_email, "superadmin.user_created", "user", row["id"], {"target_email": email, "role": role})
            return {"user": dict(row)}


@router.patch("/users/{user_id}")
def superadmin_update_user(
    user_id: str,
    payload: AdminUpdateUserReq,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    admin_email = _verify_superadmin(authorization, user_email)
    if not admin_email:
        return JSONResponse(status_code=403, content={"error": "Super Admin privileges required."})

    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, email, role, is_superadmin, is_active FROM public.app_users WHERE id::text = %s;", (user_id,))
            target = cur.fetchone()
            if not target:
                return JSONResponse(status_code=404, content={"error": "User not found."})

            if target["email"] == admin_email and payload.is_active is False:
                return JSONResponse(status_code=400, content={"error": "You cannot suspend your own Super Admin account."})

            updates = []
            params = []
            if payload.full_name is not None:
                updates.append("full_name = %s")
                params.append(payload.full_name.strip())
            if payload.job_title is not None:
                updates.append("job_title = %s")
                params.append(payload.job_title.strip())
            if payload.department is not None:
                updates.append("department = %s")
                params.append(payload.department.strip())
            if payload.is_active is not None:
                updates.append("is_active = %s")
                params.append(payload.is_active)
            if payload.role is not None:
                new_role = payload.role.strip().lower()
                if new_role in ("user", "admin", "superadmin"):
                    updates.append("role = %s")
                    params.append(new_role)
                    updates.append("is_superadmin = %s")
                    params.append(new_role == "superadmin")

            if not updates:
                return {"success": True}

            updates.append("updated_at = now()")
            params.append(user_id)
            cur.execute(
                f"UPDATE public.app_users SET {', '.join(updates)} WHERE id::text = %s RETURNING id::text, email, full_name, role, is_superadmin, is_active;",
                tuple(params),
            )
            updated = cur.fetchone()
            log_audit(admin_email, "superadmin.user_updated", "user", user_id, {"target_email": target["email"]})
            return {"user": dict(updated)}


@router.post("/users/{user_id}/reset-password")
def superadmin_reset_password(
    user_id: str,
    payload: AdminResetPasswordReq,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    admin_email = _verify_superadmin(authorization, user_email)
    if not admin_email:
        return JSONResponse(status_code=403, content={"error": "Super Admin privileges required."})
    if len(payload.new_password.strip()) < 6:
        return JSONResponse(status_code=400, content={"error": "Password must be at least 6 characters."})

    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE public.app_users SET password_hash = %s, updated_at = now() WHERE id::text = %s RETURNING email;",
                (hash_password(payload.new_password.strip()), user_id),
            )
            row = cur.fetchone()
            if not row:
                return JSONResponse(status_code=404, content={"error": "User not found."})
            log_audit(admin_email, "superadmin.password_reset", "user", user_id, {"target_email": row["email"]})
            return {"success": True, "message": f"Password reset for {row['email']}"}


@router.delete("/users/{user_id}")
def superadmin_delete_user(
    user_id: str,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    admin_email = _verify_superadmin(authorization, user_email)
    if not admin_email:
        return JSONResponse(status_code=403, content={"error": "Super Admin privileges required."})

    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT email FROM public.app_users WHERE id::text = %s;", (user_id,))
            target = cur.fetchone()
            if not target:
                return JSONResponse(status_code=404, content={"error": "User not found."})
            if target["email"] == admin_email:
                return JSONResponse(status_code=400, content={"error": "You cannot delete your own Super Admin account."})

            cur.execute("DELETE FROM public.app_users WHERE id::text = %s;", (user_id,))
            log_audit(admin_email, "superadmin.user_deleted", "user", user_id, {"target_email": target["email"]})
            return {"success": True, "deleted_email": target["email"]}


class AdminAssignPlanReq(BaseModel):
    plan_id: str
    billing_cycle: str = "monthly"


@router.put("/users/{user_id}/plan")
def superadmin_assign_user_plan(
    user_id: str,
    payload: AdminAssignPlanReq,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    admin_email = _verify_superadmin(authorization, user_email)
    if not admin_email:
        return JSONResponse(status_code=403, content={"error": "Super Admin privileges required."})
    pid = payload.plan_id.strip().lower()
    from db import PLAN_LIMITS
    if pid not in PLAN_LIMITS:
        return JSONResponse(status_code=400, content={"error": "Invalid plan_id. Must be starter, pro, team, or enterprise."})
    limits = PLAN_LIMITS[pid]
    prices = {"starter": 0, "pro": 199, "team": 599, "enterprise": 999}
    amount = prices[pid]

    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT email FROM public.app_users WHERE id::text = %s;", (user_id,))
            row = cur.fetchone()
            if not row:
                return JSONResponse(status_code=404, content={"error": "User not found."})
            target_email = row["email"]
            cur.execute(
                """
                INSERT INTO public.org_subscriptions
                    (org_id, user_email, plan_id, status, ai_credits_limit, storage_mb_limit, seats_limit, billing_cycle, amount_usd, updated_at)
                VALUES ('personal', %s, %s, 'active', %s, %s, %s, %s, %s, now())
                ON CONFLICT (user_email, org_id)
                DO UPDATE SET plan_id = EXCLUDED.plan_id,
                              ai_credits_limit = EXCLUDED.ai_credits_limit,
                              storage_mb_limit = EXCLUDED.storage_mb_limit,
                              seats_limit = EXCLUDED.seats_limit,
                              billing_cycle = EXCLUDED.billing_cycle,
                              amount_usd = EXCLUDED.amount_usd,
                              updated_at = now();
                """,
                (target_email, pid, limits["ai_credits_limit"], limits["storage_mb_limit"], limits["seats_limit"], payload.billing_cycle, amount),
            )
            log_audit(admin_email, "superadmin.plan_assigned", "subscription", target_email, {"plan_id": pid})
            return {"success": True, "plan_id": pid, "target_email": target_email}
