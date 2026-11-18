"""
Renim AI — Multi-Tenancy, Organizations & RBAC Router
"""

import re
from typing import Optional
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import get_db_pool, log_audit
from auth_utils import resolve_user_email, has_min_role, server_error

router = APIRouter(prefix="/api/orgs", tags=["Organizations & RBAC"])


class OrgCreateRequest(BaseModel):
    name: str
    plan: str = "pro"
    user_email: Optional[str] = None


class OrgInviteRequest(BaseModel):
    invite_email: str
    full_name: str = ""
    role: str = "member"
    user_email: Optional[str] = None


class MemberRoleUpdateRequest(BaseModel):
    role: str
    user_email: Optional[str] = None


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    return s or "workspace"


@router.get("")
async def list_organizations(
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"organizations": [], "active_email": email}
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT o.id::text, o.name, o.slug, o.owner_email, o.plan, o.created_at,
                           m.role AS my_role,
                           (SELECT COUNT(*) FROM public.org_members om WHERE om.org_id = o.id) AS member_count
                    FROM public.organizations o
                    JOIN public.org_members m ON m.org_id = o.id
                    WHERE m.user_email = %s AND COALESCE(m.status, 'active') = 'active'
                    ORDER BY o.created_at ASC
                    """,
                    (email,),
                )
                rows = cur.fetchall()
                if not rows:
                    # Auto-provision Personal Workspace for new user
                    cur.execute(
                        """
                        INSERT INTO public.organizations (name, slug, owner_email, plan)
                        VALUES (%s, %s, %s, 'starter')
                        RETURNING id::text, name, slug, owner_email, plan, created_at
                        """,
                        ("Personal Workspace", _slugify(f"{email.split('@')[0]}-hq"), email),
                    )
                    new_org = cur.fetchone()
                    cur.execute(
                        """
                        INSERT INTO public.org_members (org_id, user_email, full_name, role, status, invited_by)
                        VALUES (%s::uuid, %s, %s, 'owner', 'active', %s)
                        ON CONFLICT (org_id, user_email) DO NOTHING
                        """,
                        (new_org["id"], email, email.split("@")[0], email),
                    )
                    new_org["my_role"] = "owner"
                    new_org["member_count"] = 1
                    rows = [new_org]
                return {"organizations": rows, "active_email": email}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.post("", status_code=201)
async def create_organization(
    req: OrgCreateRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    if not req.name.strip():
        return JSONResponse(status_code=400, content={"error": "Organization name is required"})
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Always create new organizations on 'starter' unless upgraded via paid billing
                cur.execute(
                    """
                    INSERT INTO public.organizations (name, slug, owner_email, plan)
                    VALUES (%s, %s, %s, 'starter')
                    RETURNING id::text, name, slug, owner_email, plan, created_at
                    """,
                    (req.name.strip(), _slugify(req.name), email),
                )
                org = cur.fetchone()
                cur.execute(
                    """
                    INSERT INTO public.org_members (org_id, user_email, full_name, role, status, invited_by)
                    VALUES (%s::uuid, %s, %s, 'owner', 'active', %s)
                    """,
                    (org["id"], email, email.split("@")[0], email),
                )
                org["my_role"] = "owner"
                org["member_count"] = 1
        log_audit(
            email,
            "org.created",
            "organization",
            org["id"],
            {"name": org["name"], "plan": org["plan"]},
            org_id=org["id"],
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return {"organization": org}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.get("/{org_id}/members")
async def list_org_members(
    org_id: str,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"members": []}
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT role FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s AND COALESCE(status, 'active') = 'active'",
                    (org_id, email),
                )
                me = cur.fetchone()
                if not me:
                    return JSONResponse(status_code=403, content={"error": "Not a member of this organization"})
                cur.execute(
                    """
                    SELECT id::text, org_id::text, user_email, full_name, role, status, invited_by, created_at
                    FROM public.org_members
                    WHERE org_id = %s::uuid
                    ORDER BY created_at ASC
                    """,
                    (org_id,),
                )
                return {"members": cur.fetchall(), "my_role": me["role"]}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.post("/{org_id}/invite", status_code=201)
async def invite_org_member(
    org_id: str,
    req: OrgInviteRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    actor = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    invitee = req.invite_email.strip().lower()
    if "@" not in invitee:
        return JSONResponse(status_code=400, content={"error": "Valid email required"})
    role = req.role.lower() if req.role.lower() in {"admin", "editor", "member", "viewer"} else "member"
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT role FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s AND COALESCE(status, 'active') = 'active'",
                    (org_id, actor),
                )
                me = cur.fetchone()
                if not me or not has_min_role(me["role"], "admin"):
                    return JSONResponse(status_code=403, content={"error": "Admin or Owner role required to invite members"})
                if role == "admin" and me["role"] != "owner":
                    return JSONResponse(status_code=403, content={"error": "Only the owner can invite admins."})

                # Enforce Subscription Seat Limit for new members
                cur.execute("SELECT 1 FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s", (org_id, invitee))
                already_member = cur.fetchone() is not None
                if not already_member:
                    cur.execute("SELECT owner_email, plan FROM public.organizations WHERE id = %s::uuid", (org_id,))
                    org_row = cur.fetchone() or {}
                    owner_email = (org_row.get("owner_email") or actor).lower()
                    org_plan = (org_row.get("plan") or "starter").lower()
                    default_seats = {"starter": 3, "pro": 10, "team": 50, "enterprise": 999}.get(org_plan, 3)

                    cur.execute(
                        """
                        SELECT seats_limit FROM public.org_subscriptions
                        WHERE (org_id = %s OR (user_email = %s AND org_id = 'personal'))
                        ORDER BY CASE WHEN org_id = %s THEN 0 ELSE 1 END
                        LIMIT 1
                        """,
                        (org_id, owner_email, org_id),
                    )
                    sub_row = cur.fetchone()
                    seats_limit = int(sub_row["seats_limit"]) if sub_row and sub_row.get("seats_limit") else default_seats

                    cur.execute("SELECT COUNT(*) AS cnt FROM public.org_members WHERE org_id = %s::uuid", (org_id,))
                    current_count = int((cur.fetchone() or {}).get("cnt") or 0)
                    if current_count >= seats_limit:
                        return JSONResponse(
                            status_code=402,
                            content={
                                "error": f"Seat limit reached ({current_count}/{seats_limit}). Please upgrade your plan to invite more team members."
                            },
                        )

                cur.execute(
                    """
                    INSERT INTO public.org_members (org_id, user_email, full_name, role, status, invited_by)
                    VALUES (%s::uuid, %s, %s, %s, 'pending', %s)
                    ON CONFLICT (org_id, user_email)
                    DO UPDATE SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.org_members.full_name)
                    RETURNING id::text, org_id::text, user_email, full_name, role, status, invited_by, created_at
                    """,
                    (org_id, invitee, req.full_name.strip() or invitee.split("@")[0], role, actor),
                )
                member = cur.fetchone()
        log_audit(
            actor,
            "member.invited",
            "org_member",
            invitee,
            {"role": role},
            org_id=org_id,
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return {"member": member}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.patch("/{org_id}/members/{member_email}")
async def update_member_role(
    org_id: str,
    member_email: str,
    req: MemberRoleUpdateRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    actor = resolve_user_email(authorization, req.user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    new_role = req.role.lower()
    if new_role not in {"owner", "admin", "editor", "member", "viewer"}:
        return JSONResponse(status_code=400, content={"error": "Invalid role"})
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT role FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s AND COALESCE(status, 'active') = 'active'",
                    (org_id, actor),
                )
                me = cur.fetchone()
                if not me or not has_min_role(me["role"], "admin"):
                    return JSONResponse(status_code=403, content={"error": "Admin or Owner role required"})
                target_email = member_email.strip().lower()
                cur.execute(
                    "SELECT role FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s",
                    (org_id, target_email),
                )
                target = cur.fetchone()
                if not target:
                    return JSONResponse(status_code=404, content={"error": "Member not found"})
                is_owner = me["role"] == "owner"
                if not is_owner and (new_role in ("owner", "admin") or target["role"] in ("owner", "admin")):
                    return JSONResponse(status_code=403, content={"error": "Only the owner can grant or change admin/owner roles."})
                if target["role"] == "owner" and new_role != "owner":
                    cur.execute(
                        "SELECT COUNT(*) AS cnt FROM public.org_members WHERE org_id = %s::uuid AND role = 'owner' AND COALESCE(status, 'active') = 'active'",
                        (org_id,),
                    )
                    if int(cur.fetchone()["cnt"]) <= 1:
                        return JSONResponse(status_code=400, content={"error": "An organization must keep at least one owner."})
                cur.execute(
                    """
                    UPDATE public.org_members
                    SET role = %s
                    WHERE org_id = %s::uuid AND user_email = %s
                    RETURNING id::text, user_email, full_name, role, status
                    """,
                    (new_role, org_id, member_email.strip().lower()),
                )
                updated = cur.fetchone()
                if not updated:
                    return JSONResponse(status_code=404, content={"error": "Member not found"})
        log_audit(
            actor,
            "member.role_updated",
            "org_member",
            member_email,
            {"new_role": new_role},
            org_id=org_id,
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return {"member": updated}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.delete("/{org_id}/members/{member_email}")
async def remove_org_member(
    org_id: str,
    member_email: str,
    request: Request,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    actor = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    target = member_email.strip().lower()
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT role FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s AND COALESCE(status, 'active') = 'active'",
                    (org_id, actor),
                )
                me = cur.fetchone()
                if not me or not has_min_role(me["role"], "admin"):
                    return JSONResponse(status_code=403, content={"error": "Admin or Owner role required"})
                if target == actor:
                    return JSONResponse(status_code=400, content={"error": "Cannot remove yourself"})
                cur.execute(
                    "SELECT role FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s",
                    (org_id, target),
                )
                target_row = cur.fetchone()
                if not target_row:
                    return JSONResponse(status_code=404, content={"error": "Member not found"})
                if target_row["role"] in ("owner", "admin") and me["role"] != "owner":
                    return JSONResponse(status_code=403, content={"error": "Only the owner can remove admins or owners."})
                if target_row["role"] == "owner":
                    return JSONResponse(status_code=400, content={"error": "Transfer ownership before removing an owner."})
                cur.execute(
                    "DELETE FROM public.org_members WHERE org_id = %s::uuid AND user_email = %s",
                    (org_id, target),
                )
        log_audit(
            actor,
            "member.removed",
            "org_member",
            target,
            {},
            org_id=org_id,
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return {"status": "removed", "email": target}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))
