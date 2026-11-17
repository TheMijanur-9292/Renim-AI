"""
Renim AI — Database Pool & Enterprise Schema Management
"""

import os
import json
from typing import Optional, Any
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from auth_utils import hash_password

NEON_CONN_STRING = os.getenv("DATABASE_URL", "")

db_pool: Optional[ConnectionPool] = None


def init_db_pool() -> ConnectionPool:
    global db_pool
    conn_str = os.getenv("DATABASE_URL", NEON_CONN_STRING)
    if not conn_str:
        raise RuntimeError("DATABASE_URL environment variable is required.")
    db_pool = ConnectionPool(
        conninfo=conn_str,
        min_size=1,
        max_size=10,
        max_idle=30.0,
        check=ConnectionPool.check_connection,
        open=True,
        kwargs={"row_factory": dict_row, "autocommit": True},
    )
    return db_pool


def get_db_pool() -> Optional[ConnectionPool]:
    return db_pool


def close_db_pool() -> None:
    global db_pool
    if db_pool:
        db_pool.close()
        db_pool = None


def ensure_tables(pool: ConnectionPool) -> None:
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.chat_sessions (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email text NOT NULL DEFAULT 'guest@renimai.com',
                        title text NOT NULL DEFAULT 'New Conversation',
                        messages jsonb NOT NULL DEFAULT '[]'::jsonb,
                        created_at timestamptz DEFAULT now(),
                        updated_at timestamptz DEFAULT now()
                    );
                    CREATE TABLE IF NOT EXISTS public.app_users (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        email text UNIQUE NOT NULL,
                        full_name text NOT NULL DEFAULT '',
                        password_hash text NOT NULL DEFAULT '',
                        created_at timestamptz DEFAULT now()
                    );
                    CREATE TABLE IF NOT EXISTS public.user_documents (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email text NOT NULL DEFAULT 'guest@renimai.com',
                        filename text NOT NULL,
                        file_type text NOT NULL DEFAULT 'pdf',
                        file_size int NOT NULL DEFAULT 0,
                        extracted_text text NOT NULL DEFAULT '',
                        summary text NOT NULL DEFAULT '',
                        created_at timestamptz DEFAULT now()
                    );

                    -- Core tables backward-compatible columns
                    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_email text NOT NULL DEFAULT 'guest@renimai.com';
                    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS subtasks jsonb NOT NULL DEFAULT '[]'::jsonb;
                    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';
                    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to text NOT NULL DEFAULT '';

                    ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS user_email text NOT NULL DEFAULT 'guest@renimai.com';
                    ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';

                    ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS user_email text NOT NULL DEFAULT 'guest@renimai.com';
                    ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';

                    ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS user_email text NOT NULL DEFAULT 'guest@renimai.com';
                    ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';

                    ALTER TABLE public.user_documents ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';

                    -- Enterprise Multi-Tenancy: Organizations & Members
                    CREATE TABLE IF NOT EXISTS public.organizations (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        name text NOT NULL,
                        slug text NOT NULL DEFAULT '',
                        owner_email text NOT NULL,
                        plan text NOT NULL DEFAULT 'pro',
                        created_at timestamptz DEFAULT now()
                    );
                    CREATE TABLE IF NOT EXISTS public.org_members (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        org_id uuid NOT NULL,
                        user_email text NOT NULL,
                        full_name text NOT NULL DEFAULT '',
                        role text NOT NULL DEFAULT 'member',
                        status text NOT NULL DEFAULT 'active',
                        invited_by text NOT NULL DEFAULT '',
                        created_at timestamptz DEFAULT now(),
                        UNIQUE(org_id, user_email)
                    );

                    -- Enterprise Billing & Usage Metering
                    CREATE TABLE IF NOT EXISTS public.org_subscriptions (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        org_id text NOT NULL DEFAULT 'personal',
                        user_email text NOT NULL,
                        plan_id text NOT NULL DEFAULT 'starter',
                        status text NOT NULL DEFAULT 'active',
                        ai_credits_limit int NOT NULL DEFAULT 500,
                        ai_credits_used int NOT NULL DEFAULT 0,
                        storage_mb_limit int NOT NULL DEFAULT 500,
                        seats_limit int NOT NULL DEFAULT 3,
                        billing_cycle text NOT NULL DEFAULT 'monthly',
                        amount_usd int NOT NULL DEFAULT 0,
                        updated_at timestamptz DEFAULT now(),
                        UNIQUE(user_email, org_id)
                    );
                    CREATE TABLE IF NOT EXISTS public.usage_logs (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email text NOT NULL,
                        org_id text NOT NULL DEFAULT '',
                        feature text NOT NULL,
                        credits_used int NOT NULL DEFAULT 1,
                        tokens_est int NOT NULL DEFAULT 0,
                        created_at timestamptz DEFAULT now()
                    );

                    -- Enterprise Integrations, Webhooks & API Keys
                    CREATE TABLE IF NOT EXISTS public.api_keys (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email text NOT NULL,
                        org_id text NOT NULL DEFAULT '',
                        name text NOT NULL,
                        key_prefix text NOT NULL,
                        key_hash text NOT NULL,
                        last_used_at timestamptz,
                        created_at timestamptz DEFAULT now()
                    );
                    CREATE TABLE IF NOT EXISTS public.integration_configs (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email text NOT NULL,
                        org_id text NOT NULL DEFAULT '',
                        provider text NOT NULL,
                        webhook_url text NOT NULL DEFAULT '',
                        channel_or_project text NOT NULL DEFAULT '',
                        is_enabled boolean NOT NULL DEFAULT false,
                        events jsonb NOT NULL DEFAULT '["meeting.summarized","task.created"]'::jsonb,
                        updated_at timestamptz DEFAULT now(),
                        UNIQUE(user_email, org_id, provider)
                    );

                    -- Enterprise Audit Logs & Compliance
                    CREATE TABLE IF NOT EXISTS public.audit_logs (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email text NOT NULL,
                        org_id text NOT NULL DEFAULT '',
                        action text NOT NULL,
                        resource_type text NOT NULL DEFAULT 'workspace',
                        resource_id text NOT NULL DEFAULT '',
                        details jsonb NOT NULL DEFAULT '{}'::jsonb,
                        ip_address text NOT NULL DEFAULT '127.0.0.1',
                        created_at timestamptz DEFAULT now()
                    );

                    -- End-User Powerups: Habits, Goals/OKRs & Daily Journals
                    CREATE TABLE IF NOT EXISTS public.user_habits (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email text NOT NULL,
                        title text NOT NULL,
                        target_per_week int NOT NULL DEFAULT 5,
                        completed_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
                        created_at timestamptz DEFAULT now()
                    );
                    CREATE TABLE IF NOT EXISTS public.user_goals (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email text NOT NULL,
                        title text NOT NULL,
                        category text NOT NULL DEFAULT 'Work',
                        target_date text NOT NULL DEFAULT '',
                        progress int NOT NULL DEFAULT 0,
                        created_at timestamptz DEFAULT now()
                    );
                    CREATE TABLE IF NOT EXISTS public.user_journals (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_email text NOT NULL,
                        entry_date text NOT NULL,
                        mood text NOT NULL DEFAULT '😊',
                        win_text text NOT NULL DEFAULT '',
                        blocker_text text NOT NULL DEFAULT '',
                        created_at timestamptz DEFAULT now()
                    );

                    -- Multi-Tenant Isolation & White-Label Branding + Public Share Links
                    ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS brand_color text NOT NULL DEFAULT '#0891b2';
                    ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '';

                    ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';
                    ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo';

                    ALTER TABLE IF EXISTS public.notes ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.notes ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

                    ALTER TABLE IF EXISTS public.meetings ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.meetings ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

                    ALTER TABLE IF EXISTS public.calendar_events ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.user_documents ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.chat_sessions ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT '';

                    CREATE TABLE IF NOT EXISTS public.shared_links (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        token text UNIQUE NOT NULL,
                        resource_type text NOT NULL,
                        resource_id text NOT NULL,
                        org_id text NOT NULL DEFAULT '',
                        owner_email text NOT NULL,
                        title text NOT NULL,
                        content text NOT NULL DEFAULT '',
                        views int NOT NULL DEFAULT 0,
                        created_at timestamptz DEFAULT now()
                    );

                    CREATE TABLE IF NOT EXISTS public.org_security_settings (
                        org_id text PRIMARY KEY,
                        sso_domain text NOT NULL DEFAULT '',
                        mfa_enforced boolean NOT NULL DEFAULT false,
                        retention_days int NOT NULL DEFAULT 90,
                        updated_by text NOT NULL DEFAULT '',
                        updated_at timestamptz DEFAULT now()
                    );

                    -- Extended User Profile Columns
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS job_title text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS avatar_url text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS ai_persona_preference text NOT NULL DEFAULT 'Workspace Copilot';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS working_hours text NOT NULL DEFAULT '09:00 - 18:00';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS is_superadmin boolean NOT NULL DEFAULT false;
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS totp_secret text NOT NULL DEFAULT '';
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;
                    ALTER TABLE IF EXISTS public.app_users ADD COLUMN IF NOT EXISTS token_version int NOT NULL DEFAULT 1;

                    -- Multi-Tenant Org Isolation Columns
                    ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'personal';
                    ALTER TABLE IF EXISTS public.notes ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'personal';
                    ALTER TABLE IF EXISTS public.calendar_events ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'personal';
                    ALTER TABLE IF EXISTS public.meetings ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'personal';
                    ALTER TABLE IF EXISTS public.documents ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'personal';
                    ALTER TABLE IF EXISTS public.user_documents ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'personal';

                    -- Billing Invoices Table
                    CREATE TABLE IF NOT EXISTS public.billing_invoices (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        invoice_number text NOT NULL,
                        user_email text NOT NULL,
                        org_id text NOT NULL DEFAULT 'personal',
                        plan_id text NOT NULL,
                        billing_cycle text NOT NULL DEFAULT 'monthly',
                        amount_usd numeric NOT NULL DEFAULT 0,
                        provider text NOT NULL DEFAULT 'sandbox',
                        provider_session_id text NOT NULL DEFAULT '',
                        status text NOT NULL DEFAULT 'paid',
                        created_at timestamptz DEFAULT now()
                    );
                    """
                )
                cur.execute(
                    """
                    -- Seed Super Admin Account (hashed password)
                    INSERT INTO public.app_users (email, full_name, password_hash, role, is_superadmin, is_active, job_title, department)
                    VALUES ('mijanur@renim.ai', 'Mijanur (Super Admin)', %s, 'superadmin', true, true, 'Platform Super Admin', 'Executive')
                    ON CONFLICT (email) DO UPDATE SET
                        password_hash = CASE
                            WHEN public.app_users.password_hash IS NULL OR public.app_users.password_hash = '' OR public.app_users.password_hash NOT LIKE 'pbkdf2_sha256$%%'
                            THEN EXCLUDED.password_hash
                            ELSE public.app_users.password_hash
                        END,
                        role = 'superadmin',
                        is_superadmin = true,
                        is_active = true;
                    """,
                    (hash_password("1234567890"),),
                )
    except Exception as e:
        print("Warning ensuring database tables:", e)


def log_audit(
    user_email: str,
    action: str,
    resource_type: str = "workspace",
    resource_id: str = "",
    details: Optional[dict[str, Any]] = None,
    org_id: str = "",
    ip_address: str = "127.0.0.1",
) -> None:
    if not db_pool:
        return
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.audit_logs (user_email, org_id, action, resource_type, resource_id, details, ip_address)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)
                    """,
                    (
                        user_email or "guest@renimai.com",
                        org_id or "",
                        action,
                        resource_type,
                        str(resource_id or ""),
                        json.dumps(details or {}),
                        ip_address or "127.0.0.1",
                    ),
                )
    except Exception as e:
        print("Audit log warning:", e)


def track_ai_usage(
    user_email: str,
    feature: str,
    credits_used: int = 1,
    tokens_est: int = 350,
    org_id: str = "",
) -> None:
    if not db_pool:
        return
    email = user_email or "guest@renimai.com"
    oid = org_id or "personal"
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.usage_logs (user_email, org_id, feature, credits_used, tokens_est)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (email, oid, feature, credits_used, tokens_est),
                )
                cur.execute(
                    """
                    INSERT INTO public.org_subscriptions (org_id, user_email, plan_id, ai_credits_limit, ai_credits_used)
                    VALUES (%s, %s, 'starter', 500, %s)
                    ON CONFLICT (user_email, org_id)
                    DO UPDATE SET ai_credits_used = public.org_subscriptions.ai_credits_used + EXCLUDED.ai_credits_used,
                                  updated_at = now()
                    """,
                    (oid, email, credits_used),
                )
    except Exception as e:
        print("Usage tracking warning:", e)


def is_user_active(email: str) -> bool:
    if not email or email == "guest@renimai.com":
        return True
    if not db_pool:
        return True
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT is_active FROM public.app_users WHERE email = %s;",
                    (email.strip().lower(),),
                )
                row = cur.fetchone()
                if row is not None and row.get("is_active") is False:
                    return False
                return True
    except Exception:
        return True


def is_token_version_valid(email: str, token_version: int) -> bool:
    if not db_pool or not email:
        return True
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT token_version FROM public.app_users WHERE email = %s;",
                    (email.strip().lower(),),
                )
                row = cur.fetchone()
                if row is not None and row.get("token_version") is not None:
                    return int(row["token_version"]) == int(token_version)
                return True
    except Exception:
        return True


PLAN_RANK = {"starter": 1, "pro": 2, "team": 3, "enterprise": 4}
PLAN_LIMITS = {
    "starter": {"ai_credits_limit": 500, "storage_mb_limit": 500, "seats_limit": 3},
    "pro": {"ai_credits_limit": 5000, "storage_mb_limit": 5000, "seats_limit": 10},
    "team": {"ai_credits_limit": 25000, "storage_mb_limit": 25000, "seats_limit": 50},
    "enterprise": {"ai_credits_limit": 250000, "storage_mb_limit": 250000, "seats_limit": 999},
}


def get_effective_plan(user_email: str, org_id: str = "") -> dict[str, Any]:
    """Returns active plan tier, rank, limits, and is_superadmin flag."""
    email = (user_email or "guest@renimai.com").strip().lower()
    oid = (org_id or "").strip() or "personal"
    default_out = {
        "plan_id": "starter",
        "rank": 1,
        "is_superadmin": False,
        **PLAN_LIMITS["starter"],
    }
    if not db_pool or email == "guest@renimai.com":
        return default_out
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT role, is_superadmin FROM public.app_users WHERE email = %s;",
                    (email,),
                )
                u = cur.fetchone()
                is_sa = bool(u and (u.get("is_superadmin") or u.get("role") == "superadmin"))
                cur.execute(
                    """
                    SELECT plan_id, ai_credits_limit, storage_mb_limit, seats_limit
                    FROM public.org_subscriptions
                    WHERE (
                        (%s <> 'personal' AND org_id = %s)
                        OR (LOWER(user_email) = %s AND org_id = 'personal')
                    )
                    ORDER BY CASE WHEN (%s <> 'personal' AND org_id = %s) THEN 0 ELSE 1 END
                    LIMIT 1;
                    """,
                    (oid, oid, email, oid, oid),
                )
                sub = cur.fetchone()
                plan_id = str(sub.get("plan_id") or "starter").lower() if sub else "starter"
                if plan_id not in PLAN_RANK:
                    plan_id = "starter"
                limits = PLAN_LIMITS[plan_id]
                return {
                    "plan_id": plan_id,
                    "rank": 4 if is_sa else PLAN_RANK[plan_id],
                    "is_superadmin": is_sa,
                    "ai_credits_limit": int((sub or {}).get("ai_credits_limit") or limits["ai_credits_limit"]),
                    "storage_mb_limit": int((sub or {}).get("storage_mb_limit") or limits["storage_mb_limit"]),
                    "seats_limit": int((sub or {}).get("seats_limit") or limits["seats_limit"]),
                }
    except Exception:
        return default_out


def check_storage_quota(user_email: str, new_bytes: int, org_id: str = "") -> tuple[bool, float, int]:
    """Returns (allowed, used_mb_after, limit_mb)."""
    plan = get_effective_plan(user_email, org_id)
    limit_mb = int(plan["storage_mb_limit"])
    if not db_pool:
        return (True, 0.0, limit_mb)
    email = (user_email or "guest@renimai.com").strip().lower()
    oid = (org_id or "").strip()
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                if oid and oid != "personal":
                    cur.execute("SELECT COALESCE(SUM(file_size), 0) AS total_bytes FROM public.user_documents WHERE org_id = %s;", (oid,))
                else:
                    cur.execute("SELECT COALESCE(SUM(file_size), 0) AS total_bytes FROM public.user_documents WHERE LOWER(user_email) = %s;", (email,))
                row = cur.fetchone()
                used_bytes = int((row or {}).get("total_bytes") or 0) + int(new_bytes or 0)
                used_mb = round(used_bytes / (1024 * 1024), 2)
                return (used_mb <= limit_mb, used_mb, limit_mb)
    except Exception:
        return (True, 0.0, limit_mb)


def check_ai_credits(user_email: str, org_id: str = "") -> tuple[bool, int, int]:
    """Returns (allowed, credits_used, credits_limit)."""
    if not db_pool:
        return (True, 0, 500)
    email = (user_email or "guest@renimai.com").strip().lower()
    oid = (org_id or "").strip() or "personal"
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT ai_credits_used, ai_credits_limit
                    FROM public.org_subscriptions
                    WHERE (
                        (%s <> 'personal' AND org_id = %s)
                        OR (LOWER(user_email) = %s AND org_id = 'personal')
                    )
                    ORDER BY CASE WHEN (%s <> 'personal' AND org_id = %s) THEN 0 ELSE 1 END
                    LIMIT 1;
                    """,
                    (oid, oid, email, oid, oid),
                )
                row = cur.fetchone()
                if not row:
                    return (True, 0, 500)
                used = int(row.get("ai_credits_used") or 0)
                limit = int(row.get("ai_credits_limit") or 500)
                return (used < limit, used, limit)
    except Exception:
        return (True, 0, 500)


def resolve_org_access(user_email: str, org_id: Optional[str]) -> tuple[bool, str]:
    """
    Verifies whether `user_email` has access to `org_id` and returns `(allowed, role)`.
    For personal workspace (`''` or `'personal'`), always returns `(True, 'owner')`.
    """
    oid = (org_id or "").strip()
    if not oid or oid == "personal":
        return (True, "owner")
    if not db_pool:
        return (True, "owner")
    email = (user_email or "guest@renimai.com").strip().lower()
    if email == "guest@renimai.com":
        return (False, "none")
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT role, status
                    FROM public.org_members
                    WHERE org_id::text = %s AND LOWER(user_email) = %s
                    LIMIT 1;
                    """,
                    (oid, email),
                )
                row = cur.fetchone()
                if not row or (row.get("status") and row.get("status") != "active"):
                    return (False, "none")
                return (True, str(row.get("role") or "member").lower())
    except Exception:
        return (False, "none")
