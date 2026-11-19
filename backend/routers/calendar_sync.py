"""
Renim AI — External calendar sync (Google Calendar, Microsoft Outlook). Read-only.

Everything here is env-gated: when OAuth credentials are absent the providers report
"configured: false" and no outbound calls are made.
"""

import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlencode, quote

import httpx
from fastapi import APIRouter, Header, Query
from fastapi.responses import JSONResponse, RedirectResponse

from db import get_db_pool
from auth_utils import (
    JWT_SECRET,
    _b64url_encode,
    resolve_authenticated_email,
    server_error,
    verify_access_token,
)

logger = logging.getLogger("renim.calendar_sync")
router = APIRouter(prefix="/api/calendar-sync", tags=["Calendar Sync"])

PROVIDERS = ("google", "microsoft")
STATE_PURPOSE = "calendar_oauth"
STATE_TTL = 600
SYNC_PAST_DAYS = 7
SYNC_FUTURE_DAYS = 60

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_SCOPES = "openid email https://www.googleapis.com/auth/calendar.readonly"
MS_SCOPES = "offline_access Calendars.Read User.Read"


# ---------------------------------------------------------------- config
def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _redirect_base() -> str:
    return _env("OAUTH_REDIRECT_BASE").rstrip("/")


def _frontend_base() -> str:
    return (_env("FRONTEND_URL") or _redirect_base()).rstrip("/")


def _is_configured(provider: str) -> bool:
    if not _redirect_base():
        return False
    if provider == "google":
        return bool(_env("GOOGLE_CLIENT_ID") and _env("GOOGLE_CLIENT_SECRET"))
    if provider == "microsoft":
        return bool(_env("MS_CLIENT_ID") and _env("MS_CLIENT_SECRET"))
    return False


def _redirect_uri(provider: str) -> str:
    return f"{_redirect_base()}/api/calendar-sync/{provider}/callback"


def _ms_tenant() -> str:
    return _env("MS_TENANT", "common") or "common"


def _ms_auth_url() -> str:
    return f"https://login.microsoftonline.com/{quote(_ms_tenant())}/oauth2/v2.0/authorize"


def _ms_token_url() -> str:
    return f"https://login.microsoftonline.com/{quote(_ms_tenant())}/oauth2/v2.0/token"


# ---------------------------------------------------------------- token encryption
_fernet = None
_warned_plain = False


def _get_fernet():
    global _fernet, _warned_plain
    key = _env("CALENDAR_TOKEN_KEY")
    if not key:
        if not _warned_plain:
            logger.warning("CALENDAR_TOKEN_KEY is not set; calendar OAuth tokens are stored unencrypted.")
            _warned_plain = True
        return None
    if _fernet is None:
        try:
            from cryptography.fernet import Fernet
            _fernet = Fernet(key.encode("utf-8"))
        except Exception as e:  # bad key or missing package
            logger.warning("CALENDAR_TOKEN_KEY could not be used (%s); storing tokens unencrypted.", type(e).__name__)
            return None
    return _fernet


def _encrypt(value: str) -> str:
    if not value:
        return ""
    f = _get_fernet()
    return "enc:" + f.encrypt(value.encode("utf-8")).decode("ascii") if f else value


def _decrypt(value: Optional[str]) -> str:
    if not value:
        return ""
    if value.startswith("enc:"):
        f = _get_fernet()
        if not f:
            return ""
        try:
            return f.decrypt(value[4:].encode("ascii")).decode("utf-8")
        except Exception:
            return ""
    return value


# ---------------------------------------------------------------- state JWT
def _create_state(email: str, provider: str) -> str:
    now = int(time.time())
    payload = {
        "sub": email,
        "provider": provider,
        "nonce": secrets.token_urlsafe(16),
        "purpose": STATE_PURPOSE,
        "iat": now,
        "exp": now + STATE_TTL,
    }
    header_b64 = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(JWT_SECRET.encode("utf-8"), f"{header_b64}.{payload_b64}".encode("ascii"), hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def _verify_state(state: str, provider: str) -> Optional[str]:
    payload = verify_access_token(state or "")
    if not payload or payload.get("purpose") != STATE_PURPOSE or payload.get("provider") != provider:
        return None
    email = str(payload.get("sub") or "").strip().lower()
    return email or None


# ---------------------------------------------------------------- db helpers
def _get_connection(email: str, provider: str) -> Optional[Dict[str, Any]]:
    pool = get_db_pool()
    if not pool:
        return None
    from psycopg.rows import dict_row
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT * FROM public.calendar_connections WHERE user_email = %s AND provider = %s;",
                (email, provider),
            )
            return cur.fetchone()


def _save_tokens(email: str, provider: str, tok: Dict[str, Any], account_email: Optional[str] = None) -> None:
    pool = get_db_pool()
    if not pool:
        raise RuntimeError("Database unavailable")
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(tok.get("expires_in") or 3600) - 60)
    access = _encrypt(tok.get("access_token") or "")
    refresh = _encrypt(tok.get("refresh_token") or "")
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.calendar_connections
                    (user_email, provider, access_token, refresh_token, expires_at, account_email, connected_at)
                VALUES (%s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (user_email, provider) DO UPDATE SET
                    access_token = EXCLUDED.access_token,
                    refresh_token = CASE WHEN EXCLUDED.refresh_token <> '' THEN EXCLUDED.refresh_token
                                         ELSE public.calendar_connections.refresh_token END,
                    expires_at = EXCLUDED.expires_at,
                    account_email = COALESCE(NULLIF(EXCLUDED.account_email, ''), public.calendar_connections.account_email);
                """,
                (email, provider, access, refresh, expires_at, account_email or ""),
            )


async def _token_request(provider: str, data: Dict[str, str]) -> Dict[str, Any]:
    if provider == "google":
        url = GOOGLE_TOKEN_URL
        data = {**data, "client_id": _env("GOOGLE_CLIENT_ID"), "client_secret": _env("GOOGLE_CLIENT_SECRET")}
    else:
        url = _ms_token_url()
        data = {**data, "client_id": _env("MS_CLIENT_ID"), "client_secret": _env("MS_CLIENT_SECRET"), "scope": MS_SCOPES}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, data=data)
    if r.status_code != 200:
        # Never log the body: it may echo secrets.
        raise RuntimeError(f"token endpoint returned {r.status_code}")
    return r.json()


async def _valid_access_token(email: str, provider: str) -> Optional[str]:
    row = _get_connection(email, provider)
    if not row:
        return None
    access = _decrypt(row.get("access_token"))
    exp = row.get("expires_at")
    if access and exp and exp > datetime.now(timezone.utc):
        return access
    refresh = _decrypt(row.get("refresh_token"))
    if not refresh:
        return None
    tok = await _token_request(provider, {"grant_type": "refresh_token", "refresh_token": refresh})
    _save_tokens(email, provider, tok)
    return tok.get("access_token")


# ---------------------------------------------------------------- event fetchers
def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        v = value.strip()
        if v.endswith("Z"):
            v = v[:-1] + "+00:00"
        # Graph returns 7 fractional digits; trim to 6.
        if "." in v:
            head, frac = v.split(".", 1)
            tz = ""
            for sep in ("+", "-"):
                if sep in frac:
                    idx = frac.index(sep)
                    frac, tz = frac[:idx], frac[idx:]
                    break
            v = f"{head}.{frac[:6]}{tz}"
        dt = datetime.fromisoformat(v)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


async def _fetch_google(token: str, start: datetime, end: datetime) -> list:
    events: list = []
    params: Dict[str, Any] = {
        "timeMin": start.isoformat(), "timeMax": end.isoformat(),
        "singleEvents": "true", "orderBy": "startTime", "maxResults": 250,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        for _ in range(10):
            r = await client.get(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                params=params, headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            body = r.json()
            for it in body.get("items", []):
                if it.get("status") == "cancelled":
                    continue
                s, e = it.get("start", {}), it.get("end", {})
                all_day = "date" in s and "dateTime" not in s
                st = _parse_dt(s.get("dateTime") or (s.get("date") + "T00:00:00+00:00" if s.get("date") else None))
                en = _parse_dt(e.get("dateTime") or (e.get("date") + "T00:00:00+00:00" if e.get("date") else None))
                if not st:
                    continue
                events.append({
                    "external_id": it.get("id"), "title": it.get("summary") or "(No title)",
                    "description": (it.get("description") or "")[:4000], "location": it.get("location") or "",
                    "start_at": st, "end_at": en, "all_day": all_day, "html_link": it.get("htmlLink") or "",
                })
            tok = body.get("nextPageToken")
            if not tok:
                break
            params["pageToken"] = tok
    return events


async def _fetch_microsoft(token: str, start: datetime, end: datetime) -> list:
    events: list = []
    url: Optional[str] = "https://graph.microsoft.com/v1.0/me/calendarView?" + urlencode({
        "startDateTime": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endDateTime": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "$top": "200", "$orderby": "start/dateTime",
        "$select": "id,subject,bodyPreview,location,start,end,isAllDay,webLink,isCancelled",
    })
    headers = {"Authorization": f"Bearer {token}", "Prefer": 'outlook.timezone="UTC"'}
    async with httpx.AsyncClient(timeout=20) as client:
        for _ in range(10):
            if not url:
                break
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            body = r.json()
            for it in body.get("value", []):
                if it.get("isCancelled"):
                    continue
                st = _parse_dt((it.get("start") or {}).get("dateTime"))
                en = _parse_dt((it.get("end") or {}).get("dateTime"))
                if not st:
                    continue
                events.append({
                    "external_id": it.get("id"), "title": it.get("subject") or "(No title)",
                    "description": (it.get("bodyPreview") or "")[:4000],
                    "location": (it.get("location") or {}).get("displayName") or "",
                    "start_at": st, "end_at": en, "all_day": bool(it.get("isAllDay")),
                    "html_link": it.get("webLink") or "",
                })
            url = body.get("@odata.nextLink")
    return events


async def _fetch_account_email(provider: str, tok: Dict[str, Any]) -> str:
    access = tok.get("access_token") or ""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if provider == "google":
                r = await client.get("https://openidconnect.googleapis.com/v1/userinfo",
                                     headers={"Authorization": f"Bearer {access}"})
                return (r.json() or {}).get("email", "") if r.status_code == 200 else ""
            r = await client.get("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
                                 headers={"Authorization": f"Bearer {access}"})
            if r.status_code == 200:
                b = r.json() or {}
                return b.get("mail") or b.get("userPrincipalName") or ""
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------- helpers
def _auth(authorization: Optional[str]) -> Optional[str]:
    email = resolve_authenticated_email(authorization)
    if not email or email == "guest@renimai.com":
        return None
    return email


def _unauth():
    return JSONResponse(status_code=401, content={"error": "Sign in to manage calendar connections."})


def _bad_provider():
    return JSONResponse(status_code=404, content={"error": "Unknown calendar provider."})


def _iso(v: Any) -> Optional[str]:
    return v.isoformat() if isinstance(v, datetime) else v


# ---------------------------------------------------------------- endpoints
@router.get("/providers")
def list_providers(authorization: Optional[str] = Header(default=None)):
    email = _auth(authorization)
    rows: Dict[str, Dict[str, Any]] = {}
    pool = get_db_pool()
    if email and pool:
        try:
            from psycopg.rows import dict_row
            with pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(
                        "SELECT provider, account_email, connected_at, last_synced_at FROM public.calendar_connections WHERE user_email = %s;",
                        (email,),
                    )
                    rows = {r["provider"]: r for r in cur.fetchall()}
        except Exception as e:
            logger.warning("calendar providers lookup failed: %s", type(e).__name__)
    out = []
    for p in PROVIDERS:
        r = rows.get(p)
        out.append({
            "provider": p,
            "configured": _is_configured(p),
            "connected": bool(r),
            "account_email": (r or {}).get("account_email") or "",
            "connected_at": _iso((r or {}).get("connected_at")),
            "last_synced_at": _iso((r or {}).get("last_synced_at")),
        })
    return {"providers": out}


@router.get("/events")
def list_external_events(
    authorization: Optional[str] = Header(default=None),
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
):
    return _list_events(authorization, from_, to)


def _list_events(authorization: Optional[str], from_: Optional[str], to: Optional[str]):
    email = _auth(authorization)
    if not email:
        return {"events": []}
    pool = get_db_pool()
    if not pool:
        return {"events": []}
    start = _parse_dt(from_ + "T00:00:00" if from_ and len(from_) == 10 else from_) or (datetime.now(timezone.utc) - timedelta(days=SYNC_PAST_DAYS))
    end = _parse_dt(to + "T23:59:59" if to and len(to) == 10 else to) or (datetime.now(timezone.utc) + timedelta(days=SYNC_FUTURE_DAYS))
    try:
        from psycopg.rows import dict_row
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT provider, external_id, title, description, location, start_at, end_at, all_day, html_link
                    FROM public.external_calendar_events
                    WHERE user_email = %s AND start_at < %s AND COALESCE(end_at, start_at) >= %s
                    ORDER BY start_at ASC LIMIT 1000;
                    """,
                    (email, end, start),
                )
                rows = cur.fetchall()
        return {"events": [{**r, "start_at": _iso(r["start_at"]), "end_at": _iso(r["end_at"])} for r in rows]}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.get("/{provider}/connect")
def connect(provider: str, authorization: Optional[str] = Header(default=None)):
    if provider not in PROVIDERS:
        return _bad_provider()
    email = _auth(authorization)
    if not email:
        return _unauth()
    if not _is_configured(provider):
        return JSONResponse(status_code=400, content={"error": "This calendar provider is not configured yet."})
    state = _create_state(email, provider)
    if provider == "google":
        url = GOOGLE_AUTH_URL + "?" + urlencode({
            "client_id": _env("GOOGLE_CLIENT_ID"), "redirect_uri": _redirect_uri(provider),
            "response_type": "code", "scope": GOOGLE_SCOPES, "access_type": "offline",
            "prompt": "consent", "include_granted_scopes": "true", "state": state,
        })
    else:
        url = _ms_auth_url() + "?" + urlencode({
            "client_id": _env("MS_CLIENT_ID"), "redirect_uri": _redirect_uri(provider),
            "response_type": "code", "response_mode": "query", "scope": MS_SCOPES, "state": state,
        })
    return {"authorization_url": url}


def _app_redirect(param: str, value: str) -> RedirectResponse:
    return RedirectResponse(url=f"{_frontend_base()}/app?{urlencode({param: value})}", status_code=302)


@router.get("/{provider}/callback")
async def callback(provider: str, code: str = "", state: str = "", error: str = ""):
    if provider not in PROVIDERS:
        return _bad_provider()
    if error:
        return _app_redirect("calendar_error", "access_denied" if error == "access_denied" else "provider_error")
    email = _verify_state(state, provider)
    if not email:
        return _app_redirect("calendar_error", "invalid_state")
    if not code or not _is_configured(provider):
        return _app_redirect("calendar_error", "not_configured" if code else "missing_code")
    try:
        tok = await _token_request(provider, {
            "grant_type": "authorization_code", "code": code, "redirect_uri": _redirect_uri(provider),
        })
        account = await _fetch_account_email(provider, tok)
        _save_tokens(email, provider, tok, account)
    except Exception as e:
        logger.warning("calendar oauth exchange failed for %s: %s", provider, type(e).__name__)
        return _app_redirect("calendar_error", "exchange_failed")
    return _app_redirect("calendar_connected", provider)


@router.post("/{provider}/sync")
async def sync(provider: str, authorization: Optional[str] = Header(default=None)):
    if provider not in PROVIDERS:
        return _bad_provider()
    email = _auth(authorization)
    if not email:
        return _unauth()
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"error": "Database unavailable."})
    if not _is_configured(provider):
        return JSONResponse(status_code=400, content={"error": "This calendar provider is not configured yet."})
    try:
        token = await _valid_access_token(email, provider)
    except Exception as e:
        logger.warning("calendar token refresh failed for %s: %s", provider, type(e).__name__)
        token = None
    if not token:
        return JSONResponse(status_code=409, content={"error": "Calendar connection expired. Please reconnect."})
    now = datetime.now(timezone.utc)
    start, end = now - timedelta(days=SYNC_PAST_DAYS), now + timedelta(days=SYNC_FUTURE_DAYS)
    try:
        events = await (_fetch_google if provider == "google" else _fetch_microsoft)(token, start, end)
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        msg = "Calendar access was revoked. Please reconnect." if code in (401, 403) else "The calendar provider returned an error."
        return JSONResponse(status_code=502, content={"error": msg})
    except Exception as e:
        logger.warning("calendar fetch failed for %s: %s", provider, type(e).__name__)
        return JSONResponse(status_code=502, content={"error": "Could not reach the calendar provider."})
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                ids = []
                for ev in events:
                    if not ev.get("external_id"):
                        continue
                    ids.append(ev["external_id"])
                    cur.execute(
                        """
                        INSERT INTO public.external_calendar_events
                            (user_email, provider, external_id, title, description, location, start_at, end_at, all_day, html_link, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                        ON CONFLICT (user_email, provider, external_id) DO UPDATE SET
                            title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
                            start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at, all_day = EXCLUDED.all_day,
                            html_link = EXCLUDED.html_link, updated_at = now();
                        """,
                        (email, provider, ev["external_id"], ev["title"][:500], ev["description"], ev["location"][:500],
                         ev["start_at"], ev["end_at"], ev["all_day"], ev["html_link"][:2000]),
                    )
                # Remove events in the sync window that no longer exist upstream.
                cur.execute(
                    """
                    DELETE FROM public.external_calendar_events
                    WHERE user_email = %s AND provider = %s AND start_at >= %s AND start_at < %s
                      AND NOT (external_id = ANY(%s));
                    """,
                    (email, provider, start, end, ids),
                )
                cur.execute(
                    "UPDATE public.calendar_connections SET last_synced_at = now() WHERE user_email = %s AND provider = %s;",
                    (email, provider),
                )
        return {"provider": provider, "synced": len(ids), "last_synced_at": now.isoformat()}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))


@router.delete("/{provider}")
def disconnect(provider: str, authorization: Optional[str] = Header(default=None)):
    if provider not in PROVIDERS:
        return _bad_provider()
    email = _auth(authorization)
    if not email:
        return _unauth()
    pool = get_db_pool()
    if not pool:
        return {"disconnected": True}
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.external_calendar_events WHERE user_email = %s AND provider = %s;", (email, provider))
                cur.execute("DELETE FROM public.calendar_connections WHERE user_email = %s AND provider = %s;", (email, provider))
        return {"disconnected": True}
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))
