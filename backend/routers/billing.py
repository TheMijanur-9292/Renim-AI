"""
Renim AI — SaaS Subscription, Billing & AI Usage Metering Router
"""

import os
import hmac
import json
import time
import hashlib
import uuid
import httpx
from typing import Optional
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import get_db_pool, log_audit, is_user_active
from auth_utils import resolve_user_email, resolve_authenticated_email

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:3057").strip().rstrip("/")

router = APIRouter(prefix="/api/billing", tags=["Billing & Usage Metering"])

SAAS_PLANS = [
    {
        "id": "starter",
        "name": "Starter",
        "currency": "INR",
        "price_monthly": 0,
        "price_yearly": 0,
        "ai_credits_limit": 500,
        "storage_mb_limit": 500,
        "seats_limit": 3,
        "features": [
            "500 AI Assistant Credits / mo",
            "Up to 3 Team Members",
            "500 MB Notes & Meeting Vault",
            "Smart Notes, Tasks & Calendar Alerts",
        ],
    },
    {
        "id": "pro",
        "name": "Pro",
        "currency": "INR",
        "price_monthly": 199,
        "price_yearly": 1910,
        "ai_credits_limit": 5000,
        "storage_mb_limit": 5000,
        "seats_limit": 10,
        "features": [
            "5,000 AI Assistant Credits / mo",
            "Up to 10 Team Members + Role Controls",
            "5 GB Searchable Company Knowledge",
            "Automated Morning Briefs & Slack/Teams Alerts",
        ],
    },
    {
        "id": "team",
        "name": "Team",
        "currency": "INR",
        "price_monthly": 599,
        "price_yearly": 5750,
        "ai_credits_limit": 25000,
        "storage_mb_limit": 25000,
        "seats_limit": 50,
        "features": [
            "25,000 AI Assistant Credits / mo",
            "Up to 50 Team Members + Activity Logs",
            "25 GB Shared Document & Meeting Hub",
            "Jira, GitHub & Custom Workflow Integrations",
        ],
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "currency": "INR",
        "price_monthly": 999,
        "price_yearly": 9590,
        "ai_credits_limit": 250000,
        "storage_mb_limit": 250000,
        "seats_limit": 999,
        "features": [
            "2,50,000+ AI Credits / mo for Large Teams",
            "Unlimited Seats + Company SSO & 2FA",
            "250 GB Encrypted Vault & Priority Speed",
            "Compliance Audit Export & 99.99% Uptime SLA",
        ],
    },
]


class UpgradePlanRequest(BaseModel):
    plan_id: str
    billing_cycle: str = "monthly"
    org_id: str = "personal"
    user_email: Optional[str] = None


@router.get("/plans")
async def get_plans():
    return {"plans": SAAS_PLANS}


@router.get("/status")
async def get_billing_status(
    org_id: str = "personal",
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {
            "subscription": {
                "plan_id": "starter",
                "status": "active",
                "ai_credits_limit": 500,
                "ai_credits_used": 0,
                "storage_mb_limit": 500,
                "seats_limit": 3,
                "billing_cycle": "monthly",
                "amount_usd": 0,
            },
            "recent_usage": [],
        }
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.org_subscriptions (org_id, user_email, plan_id)
                    VALUES (%s, %s, 'starter')
                    ON CONFLICT (user_email, org_id) DO NOTHING
                    """,
                    (org_id or "personal", email),
                )
                cur.execute(
                    """
                    SELECT id::text, org_id, user_email, plan_id, status, ai_credits_limit,
                           ai_credits_used, storage_mb_limit, seats_limit, billing_cycle, amount_usd, updated_at
                    FROM public.org_subscriptions
                    WHERE user_email = %s AND org_id = %s
                    """,
                    (email, org_id or "personal"),
                )
                sub = dict(cur.fetchone() or {})
                cur.execute(
                    """
                    SELECT feature, SUM(credits_used) AS credits, SUM(tokens_est) AS tokens, COUNT(*) AS calls
                    FROM public.usage_logs
                    WHERE user_email = %s
                    GROUP BY feature
                    ORDER BY credits DESC
                    """,
                    (email,),
                )
                breakdown = cur.fetchall()
                logs_total = sum(int(b.get("credits") or 0) for b in breakdown)
                if sub:
                    sub["ai_credits_used"] = max(int(sub.get("ai_credits_used") or 0), logs_total)
                    sub["currency"] = "INR"
                return {"subscription": sub, "usage_breakdown": breakdown}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


def _activate_subscription_plan(
    email: str,
    org_id: str,
    plan: dict,
    billing_cycle: str,
    amount: float,
    provider: str,
    provider_session_id: str = "",
    ip_address: str = "127.0.0.1",
) -> tuple[dict, str]:
    pool = get_db_pool()
    inv_num = f"INV-{uuid.uuid4().hex[:8].upper()}"
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.org_subscriptions
                    (org_id, user_email, plan_id, status, ai_credits_limit, storage_mb_limit, seats_limit, billing_cycle, amount_usd, updated_at)
                VALUES (%s, %s, %s, 'active', %s, %s, %s, %s, %s, now())
                ON CONFLICT (user_email, org_id)
                DO UPDATE SET plan_id = EXCLUDED.plan_id,
                              ai_credits_limit = EXCLUDED.ai_credits_limit,
                              storage_mb_limit = EXCLUDED.storage_mb_limit,
                              seats_limit = EXCLUDED.seats_limit,
                              billing_cycle = EXCLUDED.billing_cycle,
                              amount_usd = EXCLUDED.amount_usd,
                              updated_at = now()
                RETURNING id::text, org_id, user_email, plan_id, status, ai_credits_limit,
                          ai_credits_used, storage_mb_limit, seats_limit, billing_cycle, amount_usd, updated_at
                """,
                (
                    org_id or "personal",
                    email,
                    plan["id"],
                    plan["ai_credits_limit"],
                    plan["storage_mb_limit"],
                    plan["seats_limit"],
                    billing_cycle,
                    amount,
                ),
            )
            sub = dict(cur.fetchone() or {})
            sub["currency"] = "INR"
            if amount > 0:
                cur.execute(
                    """
                    INSERT INTO public.billing_invoices
                        (invoice_number, user_email, org_id, plan_id, billing_cycle, amount_usd, provider, provider_session_id, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'paid')
                    """,
                    (inv_num, email, org_id or "personal", plan["id"], billing_cycle, amount, provider, provider_session_id),
                )
    log_audit(
        email,
        "billing.plan_upgraded",
        "subscription",
        plan["id"],
        {"billing_cycle": billing_cycle, "amount_inr": amount, "provider": provider},
        org_id=org_id,
        ip_address=ip_address,
    )
    return sub, inv_num


@router.post("/upgrade")
async def upgrade_plan(
    req: UpgradePlanRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_authenticated_email(authorization)
    if not email:
        return JSONResponse(status_code=401, content={"error": "Please sign in to manage your subscription plan."})
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    plan = next((p for p in SAAS_PLANS if p["id"] == req.plan_id.lower()), None)
    if not plan:
        return JSONResponse(status_code=400, content={"error": "Invalid plan_id"})
    amount = plan["price_yearly"] if req.billing_cycle == "yearly" else plan["price_monthly"]
    if amount > 0:
        return JSONResponse(
            status_code=402,
            content={
                "error": f"Payment required (₹{amount:,}). Paid plans cannot be activated without completing checkout."
            },
        )
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable"})
    try:
        sub, inv_num = _activate_subscription_plan(
            email=email,
            org_id=req.org_id or "personal",
            plan=plan,
            billing_cycle=req.billing_cycle,
            amount=0,
            provider="free_tier",
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return {"subscription": sub, "message": f"Switched to {plan['name']} plan"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str
    billing_cycle: str = "monthly"
    org_id: str = "personal"


@router.post("/create-checkout-session")
async def create_checkout_session(
    req: UpgradePlanRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """Creates a Razorpay (INR) or Stripe (INR) checkout session. Rejects free switching on paid plans."""
    email = resolve_authenticated_email(authorization)
    if not email:
        return JSONResponse(status_code=401, content={"error": "Please sign in to start checkout."})
    if not is_user_active(email):
        return JSONResponse(status_code=403, content={"error": "Account is suspended."})
    plan = next((p for p in SAAS_PLANS if p["id"] == req.plan_id.lower()), None)
    if not plan:
        return JSONResponse(status_code=400, content={"error": "Invalid plan_id"})

    amount = plan["price_yearly"] if req.billing_cycle == "yearly" else plan["price_monthly"]
    if amount == 0:
        sub, _ = _activate_subscription_plan(
            email=email,
            org_id=req.org_id or "personal",
            plan=plan,
            billing_cycle=req.billing_cycle,
            amount=0,
            provider="free_tier",
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return {"mode": "free", "subscription": sub, "message": f"Switched to {plan['name']} plan"}

    # 1. Razorpay (Indian Payment Gateway — INR)
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                rzp_res = await client.post(
                    "https://api.razorpay.com/v1/orders",
                    auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
                    json={
                        "amount": int(amount * 100),  # paise
                        "currency": "INR",
                        "receipt": f"rcpt_{uuid.uuid4().hex[:10]}",
                        "notes": {
                            "user_email": email,
                            "org_id": req.org_id or "personal",
                            "plan_id": plan["id"],
                            "billing_cycle": req.billing_cycle,
                        },
                    },
                )
                order_data = rzp_res.json()
                if rzp_res.status_code >= 400:
                    return JSONResponse(status_code=502, content={"error": order_data.get("error", {}).get("description", "Razorpay error")})
                return {
                    "mode": "razorpay",
                    "key_id": RAZORPAY_KEY_ID,
                    "order_id": order_data["id"],
                    "amount_paise": order_data["amount"],
                    "currency": "INR",
                    "plan_id": plan["id"],
                    "plan_name": plan["name"],
                    "billing_cycle": req.billing_cycle,
                }
        except Exception as e:
            return JSONResponse(status_code=502, content={"error": f"Razorpay checkout failed: {str(e)}"})

    # 2. Stripe Checkout (INR)
    if STRIPE_SECRET_KEY:
        try:
            interval = "year" if req.billing_cycle == "yearly" else "month"
            form_data = {
                "mode": "subscription",
                "customer_email": email,
                "success_url": f"{APP_BASE_URL}/app?billing=success&plan={plan['id']}",
                "cancel_url": f"{APP_BASE_URL}/app?billing=cancelled",
                "line_items[0][quantity]": "1",
                "line_items[0][price_data][currency]": "inr",
                "line_items[0][price_data][unit_amount]": str(int(amount * 100)),
                "line_items[0][price_data][recurring][interval]": interval,
                "line_items[0][price_data][product_data][name]": f"Renim AI {plan['name']} Plan",
                "metadata[user_email]": email,
                "metadata[org_id]": req.org_id or "personal",
                "metadata[plan_id]": plan["id"],
                "metadata[billing_cycle]": req.billing_cycle,
            }
            async with httpx.AsyncClient(timeout=20.0) as client:
                stripe_res = await client.post(
                    "https://api.stripe.com/v1/checkout/sessions",
                    data=form_data,
                    headers={"Authorization": f"Bearer {STRIPE_SECRET_KEY}"},
                )
                data = stripe_res.json()
                if stripe_res.status_code >= 400:
                    return JSONResponse(status_code=502, content={"error": data.get("error", {}).get("message", "Stripe API error")})
                return {"mode": "stripe", "checkout_url": data.get("url"), "session_id": data.get("id")}
        except Exception as e:
            return JSONResponse(status_code=502, content={"error": f"Stripe checkout failed: {str(e)}"})

    # 3. Never allow silent free upgrades when no payment gateway is configured
    return JSONResponse(
        status_code=402,
        content={
            "error": f"Online checkout is currently unavailable. Please contact support@renim.ai or your workspace admin to upgrade to {plan['name']} (₹{amount:,})."
        },
    )


@router.post("/razorpay/verify")
async def verify_razorpay_payment(
    req: RazorpayVerifyRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_authenticated_email(authorization)
    if not email:
        return JSONResponse(status_code=401, content={"error": "Authentication required."})
    if not RAZORPAY_KEY_SECRET:
        return JSONResponse(status_code=503, content={"error": "Razorpay is not configured."})
    msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}".encode("utf-8")
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, req.razorpay_signature):
        return JSONResponse(status_code=400, content={"error": "Invalid Razorpay payment signature."})
    plan = next((p for p in SAAS_PLANS if p["id"] == req.plan_id.lower()), None)
    if not plan:
        return JSONResponse(status_code=400, content={"error": "Invalid plan_id"})
    amount = plan["price_yearly"] if req.billing_cycle == "yearly" else plan["price_monthly"]
    sub, inv_num = _activate_subscription_plan(
        email=email,
        org_id=req.org_id or "personal",
        plan=plan,
        billing_cycle=req.billing_cycle,
        amount=amount,
        provider="razorpay",
        provider_session_id=req.razorpay_payment_id,
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return {"verified": True, "subscription": sub, "invoice_number": inv_num, "message": f"Payment verified! Upgraded to {plan['name']} plan."}


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(default=None)):
    """Handles Stripe webhook events with HMAC-SHA256 signature verification."""
    raw_body = await request.body()
    if STRIPE_WEBHOOK_SECRET:
        if not stripe_signature:
            return JSONResponse(status_code=400, content={"error": "Missing Stripe-Signature header"})
        try:
            parts = dict(item.split("=", 1) for item in stripe_signature.split(",") if "=" in item)
            ts = parts.get("t", "")
            v1 = parts.get("v1", "")
            signed_payload = f"{ts}.{raw_body.decode('utf-8')}".encode("utf-8")
            expected = hmac.new(STRIPE_WEBHOOK_SECRET.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, v1) or abs(time.time() - int(ts or 0)) > 300:
                return JSONResponse(status_code=400, content={"error": "Invalid Stripe signature"})
        except Exception:
            return JSONResponse(status_code=400, content={"error": "Malformed Stripe-Signature header"})

    try:
        event = json.loads(raw_body.decode("utf-8"))
        etype = event.get("type", "")
        obj = (event.get("data") or {}).get("object") or {}
        meta = obj.get("metadata") or {}
        if etype == "checkout.session.completed":
            email = (meta.get("user_email") or obj.get("customer_email") or "").strip().lower()
            plan_id = (meta.get("plan_id") or "pro").lower()
            org_id = meta.get("org_id") or "personal"
            cycle = meta.get("billing_cycle") or "monthly"
            plan = next((p for p in SAAS_PLANS if p["id"] == plan_id), SAAS_PLANS[1])
            amount = plan["price_yearly"] if cycle == "yearly" else plan["price_monthly"]
            pool = get_db_pool()
            if pool and email:
                inv_num = f"INV-{uuid.uuid4().hex[:8].upper()}"
                with pool.connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO public.org_subscriptions
                                (org_id, user_email, plan_id, status, ai_credits_limit, storage_mb_limit, seats_limit, billing_cycle, amount_usd, updated_at)
                            VALUES (%s, %s, %s, 'active', %s, %s, %s, %s, %s, now())
                            ON CONFLICT (user_email, org_id)
                            DO UPDATE SET plan_id = EXCLUDED.plan_id, ai_credits_limit = EXCLUDED.ai_credits_limit,
                                          storage_mb_limit = EXCLUDED.storage_mb_limit, seats_limit = EXCLUDED.seats_limit,
                                          billing_cycle = EXCLUDED.billing_cycle, amount_usd = EXCLUDED.amount_usd, updated_at = now()
                            """,
                            (org_id, email, plan["id"], plan["ai_credits_limit"], plan["storage_mb_limit"], plan["seats_limit"], cycle, amount),
                        )
                        cur.execute(
                            """
                            INSERT INTO public.billing_invoices
                                (invoice_number, user_email, org_id, plan_id, billing_cycle, amount_usd, provider, provider_session_id, status)
                            VALUES (%s, %s, %s, %s, %s, %s, 'stripe', %s, 'paid')
                            """,
                            (inv_num, email, org_id, plan["id"], cycle, amount, obj.get("id", "")),
                        )
                log_audit(email, "billing.stripe_webhook_paid", "subscription", plan["id"], {"session_id": obj.get("id", "")}, org_id=org_id)
        return {"received": True, "type": etype}
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@router.get("/invoices")
async def get_invoices(
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"invoices": []}
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT invoice_number, plan_id, billing_cycle, amount_usd, provider, status, created_at
                    FROM public.billing_invoices
                    WHERE user_email = %s
                    ORDER BY created_at DESC
                    LIMIT 20
                    """,
                    (email,),
                )
                inv_rows = cur.fetchall()
                if inv_rows:
                    invoices = [
                        {
                            "invoice_id": r["invoice_number"],
                            "plan_id": r["plan_id"],
                            "date": r["created_at"],
                            "amount_usd": float(r["amount_usd"] or 0),
                            "cycle": r["billing_cycle"],
                            "provider": r["provider"],
                            "status": r["status"],
                        }
                        for r in inv_rows
                    ]
                    return {"invoices": invoices}
                cur.execute(
                    """
                    SELECT id::text, details, created_at
                    FROM public.audit_logs
                    WHERE user_email = %s AND action = 'billing.plan_upgraded'
                    ORDER BY created_at DESC
                    LIMIT 12
                    """,
                    (email,),
                )
                logs = cur.fetchall()
                invoices = [
                    {
                        "invoice_id": f"INV-{str(row['id'])[:8].upper()}",
                        "date": row["created_at"],
                        "amount_usd": (row.get("details") or {}).get("amount_usd", 0),
                        "cycle": (row.get("details") or {}).get("billing_cycle", "monthly"),
                        "status": "paid",
                    }
                    for row in logs
                ]
                return {"invoices": invoices}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
