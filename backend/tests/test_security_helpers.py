"""
Pure-helper security tests: password policy, JWT/purpose tokens, SSRF guard, LLM target selection,
RBAC hierarchy, rate limiting and the CORS origin regex. No database required.
"""

import os
import re
import sys
import time
import json
import socket
from pathlib import Path

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-" + "x" * 40)

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import auth_utils  # noqa: E402
from auth_utils import (  # noqa: E402
    validate_password_strength,
    create_access_token,
    verify_access_token,
    create_password_reset_token,
    resolve_authenticated_email,
    is_safe_public_url,
    resolve_llm_target,
    has_min_role,
    check_rate_limit,
    reset_rate_limits,
    hash_password,
    verify_password,
    hash_api_key,
    _b64url_encode,
    _b64url_decode,
)


# ---------- password strength ----------

@pytest.mark.parametrize("pw", ["", "short1", "abc12"])
def test_password_too_short_rejected(pw):
    assert "at least" in (validate_password_strength(pw) or "")


@pytest.mark.parametrize("pw", ["12345678901", "abcdefghijk"])
def test_password_single_class_rejected(pw):
    assert "mix" in (validate_password_strength(pw) or "")


@pytest.mark.parametrize("pw", ["password1", "PASSWORD1", "qwerty123", "letmein123"])
def test_common_passwords_rejected(pw):
    assert validate_password_strength(pw) == "That password is too common."


@pytest.mark.parametrize("pw", ["correct-horse-9", "Renim2026!", "a1b2c3d4"])
def test_strong_passwords_accepted(pw):
    assert validate_password_strength(pw) is None


def test_password_hash_is_salted_and_verifies():
    a, b = hash_password("Same-Pass-1"), hash_password("Same-Pass-1")
    assert a != b
    assert verify_password("Same-Pass-1", a) and verify_password("Same-Pass-1", b)
    assert not verify_password("same-pass-1", a)
    assert not verify_password("", a)


def test_api_key_hash_is_deterministic_sha256():
    assert hash_api_key("sk_renim_abc") == hash_api_key("sk_renim_abc")
    assert len(hash_api_key("sk_renim_abc")) == 64


def test_b64url_roundtrip_without_padding():
    for raw in (b"", b"a", b"ab", b"abc", bytes(range(256))):
        enc = _b64url_encode(raw)
        assert "=" not in enc
        assert _b64url_decode(enc) == raw


# ---------- JWT ----------

def test_access_token_roundtrip_and_claims():
    tok = create_access_token("  Alice@Example.COM ", "Alice", "admin", token_version=3)
    payload = verify_access_token(tok)
    assert payload["sub"] == "alice@example.com"
    assert payload["role"] == "admin"
    assert payload["tv"] == 3
    assert payload["exp"] > payload["iat"]
    assert "purpose" not in payload


def test_tampered_payload_rejected():
    tok = create_access_token("bob@example.com")
    h, p, s = tok.split(".")
    data = json.loads(_b64url_decode(p))
    data["role"] = "superadmin"
    forged = f"{h}.{_b64url_encode(json.dumps(data).encode())}.{s}"
    assert verify_access_token(forged) is None


@pytest.mark.parametrize("bad", ["", "abc", "a.b", "a.b.c.d", "....", "x.y.z"])
def test_malformed_tokens_rejected(bad):
    assert verify_access_token(bad) is None


def test_token_signed_with_other_secret_rejected(monkeypatch):
    tok = create_access_token("carol@example.com")
    monkeypatch.setattr(auth_utils, "JWT_SECRET", "a-completely-different-secret-value-123456")
    assert verify_access_token(tok) is None


def test_expired_token_rejected(monkeypatch):
    real = time.time
    monkeypatch.setattr(auth_utils.time, "time", lambda: real() - auth_utils.JWT_EXPIRY_SECONDS - 10)
    tok = create_access_token("old@example.com")
    monkeypatch.setattr(auth_utils.time, "time", real)
    assert verify_access_token(tok) is None


def _fake_db(monkeypatch, valid=True):
    import types
    fake = types.ModuleType("db")
    fake.is_token_version_valid = lambda email, tv: valid
    fake.resolve_api_key_email = lambda key: None
    monkeypatch.setitem(sys.modules, "db", fake)


def test_session_token_accepted_for_auth(monkeypatch):
    _fake_db(monkeypatch)
    tok = create_access_token("dave@example.com")
    assert resolve_authenticated_email(f"Bearer {tok}") == "dave@example.com"


def test_revoked_token_version_rejected(monkeypatch):
    _fake_db(monkeypatch, valid=False)
    tok = create_access_token("dave@example.com")
    assert resolve_authenticated_email(f"Bearer {tok}") is None


def test_password_reset_token_rejected_for_normal_auth(monkeypatch):
    _fake_db(monkeypatch)
    reset = create_password_reset_token("erin@example.com")
    assert verify_access_token(reset)["purpose"] == "password_reset"  # valid signature...
    assert resolve_authenticated_email(f"Bearer {reset}") is None      # ...but never a session


def test_token_without_version_rejected_for_auth(monkeypatch):
    _fake_db(monkeypatch)
    header = _b64url_encode(b'{"alg":"HS256","typ":"JWT"}')
    body = _b64url_encode(json.dumps({"sub": "x@example.com", "exp": int(time.time()) + 60}).encode())
    import hmac, hashlib
    sig = hmac.new(auth_utils.JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    tok = f"{header}.{body}.{_b64url_encode(sig)}"
    assert verify_access_token(tok) is not None
    assert resolve_authenticated_email(f"Bearer {tok}") is None


@pytest.mark.parametrize("hdr", [None, "", "Basic abc", "Bearer ", "Token abc"])
def test_missing_or_non_bearer_auth_rejected(hdr):
    assert resolve_authenticated_email(hdr) is None


# ---------- SSRF guard ----------

@pytest.mark.parametrize("url", [
    "http://localhost/x", "http://127.0.0.1:8000", "http://0.0.0.0", "http://[::1]/",
    "http://10.0.0.5", "http://192.168.1.1", "http://172.16.0.1", "http://169.254.169.254/latest/meta-data",
    "http://printer.local", "http://svc.internal", "ftp://example.com", "file:///etc/passwd",
    "javascript:alert(1)", "", "not a url", "http://224.0.0.1",
])
def test_unsafe_urls_blocked(url):
    assert is_safe_public_url(url) is False


def test_hostname_resolving_to_private_ip_blocked(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("10.1.2.3", 0))])
    assert is_safe_public_url("https://evil-rebind.example.com") is False


def test_public_hostname_allowed(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("93.184.216.34", 0))])
    assert is_safe_public_url("https://api.example.com/v1") is True


def test_public_ip_literal_allowed():
    assert is_safe_public_url("https://8.8.8.8/") is True


def test_unresolvable_host_blocked(monkeypatch):
    def boom(*a, **k):
        raise socket.gaierror("nope")
    monkeypatch.setattr(socket, "getaddrinfo", boom)
    assert is_safe_public_url("https://does-not-exist.example") is False


# ---------- LLM target selection ----------

def test_server_key_never_sent_to_caller_url():
    key, model, base = resolve_llm_target(None, "evil-model", "https://attacker.example", "SERVER", "m", "https://default/")
    assert (key, model, base) == ("SERVER", "m", "https://default")


def test_own_key_with_private_url_falls_back_to_default():
    key, _, base = resolve_llm_target("mine", None, "https://127.0.0.1", "SERVER", "m", "https://default")
    assert key == "mine" and base == "https://default"


def test_own_key_with_http_url_falls_back_to_default():
    _, _, base = resolve_llm_target("mine", None, "http://8.8.8.8", "SERVER", "m", "https://default")
    assert base == "https://default"


def test_own_key_with_public_https_url_used():
    key, model, base = resolve_llm_target("mine", "gpt-x", "https://8.8.8.8/v1/", "SERVER", "m", "https://default")
    assert (key, model, base) == ("mine", "gpt-x", "https://8.8.8.8/v1")


# ---------- RBAC + rate limiting ----------

def test_role_hierarchy():
    assert has_min_role("owner", "admin")
    assert has_min_role("admin", "admin")
    assert not has_min_role("member", "admin")
    assert not has_min_role("viewer", "editor")
    assert not has_min_role("unknown-role", "viewer")


def test_rate_limit_blocks_after_max_and_isolates_keys():
    reset_rate_limits()
    for _ in range(3):
        assert check_rate_limit("k1", max_requests=3, window_seconds=60)[0]
    allowed, retry = check_rate_limit("k1", max_requests=3, window_seconds=60)
    assert not allowed and retry > 0
    assert check_rate_limit("k2", max_requests=3, window_seconds=60)[0]
    reset_rate_limits()
    assert check_rate_limit("k1", max_requests=3, window_seconds=60)[0]


# ---------- CORS origin regex ----------

def _cors_regex() -> str:
    """Reads allow_origin_regex straight from main.py so the test doesn't need a database to import the app."""
    src = (ROOT / "main.py").read_text(encoding="utf-8")
    m = re.search(r'allow_origin_regex\s*=\s*r"([^"]+)"', src)
    assert m, "allow_origin_regex not found in main.py"
    return m.group(1)


@pytest.fixture(scope="module")
def cors_client():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.testclient import TestClient

    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origin_regex=_cors_regex(), allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return TestClient(app)


def _preflight(client, origin):
    return client.options("/ping", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})


@pytest.mark.parametrize("origin", [
    "chrome-extension://" + "a" * 32,
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    "http://localhost:4321",
    "http://localhost",
    "http://127.0.0.1:3057",
])
def test_cors_allows_extension_and_localhost(cors_client, origin):
    r = _preflight(cors_client, origin)
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == origin


@pytest.mark.parametrize("origin", [
    "https://evil.example.com",
    "https://localhost.evil.com",
    "http://localhost.evil.com",
    "chrome-extension://" + "z" * 32,
    "chrome-extension://" + "a" * 31,
    "chrome-extension://" + "a" * 33,
    "moz-extension://" + "a" * 32,
    "null",
])
def test_cors_rejects_other_origins(cors_client, origin):
    r = _preflight(cors_client, origin)
    assert r.headers.get("access-control-allow-origin") != origin
