"""
Renim AI — Enterprise JWT Auth & RBAC Utilities (Zero External Dependencies)
"""

import os
import hmac
import json
import time
import base64
import secrets
import hashlib
import ipaddress
import socket
import struct
import threading
from urllib.parse import urlparse, quote
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException

JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_hex(32)
JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 7  # 7 days
PBKDF2_ITERATIONS = 120_000
ALLOW_GUEST_MODE = os.getenv("ALLOW_GUEST_MODE", "true").strip().lower() in ("1", "true", "yes")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${base64.b64encode(salt).decode('ascii')}${base64.b64encode(dk).decode('ascii')}"


def is_password_hashed(stored: Optional[str]) -> bool:
    return bool(stored and stored.startswith("pbkdf2_sha256$"))


def verify_password(plain_password: str, stored_hash: Optional[str]) -> bool:
    if not stored_hash:
        return False
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, salt_b64, hash_b64 = stored_hash.split("$", 2)
            salt = base64.b64decode(salt_b64)
            expected = base64.b64decode(hash_b64)
            dk = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
            return hmac.compare_digest(dk, expected)
        except Exception:
            return False
    return hmac.compare_digest(plain_password.encode("utf-8"), stored_hash.encode("utf-8"))


def is_safe_public_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
        if parsed.scheme not in ("http", "https"):
            return False
        host = parsed.hostname
        if not host:
            return False
        lower_host = host.lower()
        if lower_host in ("localhost", "127.0.0.1", "0.0.0.0", "::1") or lower_host.endswith(".local") or lower_host.endswith(".internal"):
            return False
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
                return False
        except ValueError:
            try:
                resolved_ip = socket.gethostbyname(host)
                ip = ipaddress.ip_address(resolved_ip)
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
                    return False
            except Exception:
                return False
        return True
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(email: str, full_name: str = "", role: str = "owner", token_version: int = 1) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": email.strip().lower(),
        "name": full_name,
        "role": role,
        "tv": int(token_version or 1),
        "iat": now,
        "exp": now + JWT_EXPIRY_SECONDS,
    }
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def resolve_authenticated_email(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        payload = verify_access_token(token)
        if payload and payload.get("sub"):
            email = str(payload["sub"]).strip().lower()
            if "tv" in payload:
                try:
                    from db import is_token_version_valid
                    if not is_token_version_valid(email, int(payload["tv"])):
                        return None
                except Exception:
                    pass
            return email
    return None


def resolve_user_email(authorization: Optional[str], fallback_email: Optional[str] = None) -> str:
    authed = resolve_authenticated_email(authorization)
    if authed:
        return authed
    if not ALLOW_GUEST_MODE:
        raise HTTPException(status_code=401, detail="Authentication required (Guest mode disabled).")
    if fallback_email and fallback_email.strip().lower() == "guest@renimai.com":
        return "guest@renimai.com"
    return "guest@renimai.com"


def create_password_reset_token(email: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": email.strip().lower(),
        "purpose": "password_reset",
        "iat": now,
        "exp": now + 900,  # 15 minutes
    }
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def verify_password_reset_token(token: str) -> Optional[str]:
    payload = verify_access_token(token)
    if payload and payload.get("purpose") == "password_reset" and payload.get("sub"):
        return str(payload["sub"]).strip().lower()
    return None


ROLE_HIERARCHY = {
    "viewer": 1,
    "member": 2,
    "editor": 3,
    "admin": 4,
    "owner": 5,
}


def has_min_role(user_role: str, required_role: str) -> bool:
    return ROLE_HIERARCHY.get(user_role.lower(), 0) >= ROLE_HIERARCHY.get(required_role.lower(), 0)


# ================= RFC 6238 TOTP 2FA (ZERO EXTERNAL DEPS) =================

def generate_totp_secret(length: int = 20) -> str:
    raw = os.urandom(length)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def get_totp_uri(email: str, secret: str, issuer: str = "Renim AI") -> str:
    label = quote(f"{issuer}:{email}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"


def _totp_at(secret: str, counter: int) -> str:
    pad = "=" * (-len(secret) % 8)
    key = base64.b32decode(secret.upper() + pad, casefold=True)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{code_int % 1_000_000:06d}"


def verify_totp_code(secret: str, code: str, window: int = 1) -> bool:
    if not secret or not code:
        return False
    clean = code.strip().replace(" ", "")
    if not clean.isdigit() or len(clean) != 6:
        return False
    now_step = int(time.time()) // 30
    for offset in range(-window, window + 1):
        if hmac.compare_digest(_totp_at(secret, now_step + offset), clean):
            return True
    return False


# ================= SLIDING-WINDOW RATE LIMITER =================

_RATE_LOCK = threading.Lock()
_RATE_BUCKETS: Dict[str, list] = {}


def check_rate_limit(key: str, max_requests: int = 60, window_seconds: int = 60) -> Tuple[bool, int]:
    now = time.time()
    cutoff = now - window_seconds
    with _RATE_LOCK:
        bucket = [t for t in _RATE_BUCKETS.get(key, []) if t > cutoff]
        if len(bucket) >= max_requests:
            retry_after = max(1, int(bucket[0] + window_seconds - now))
            _RATE_BUCKETS[key] = bucket
            return False, retry_after
        bucket.append(now)
        _RATE_BUCKETS[key] = bucket
        return True, 0


def reset_rate_limits() -> None:
    with _RATE_LOCK:
        _RATE_BUCKETS.clear()
