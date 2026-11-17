"""
Renim AI — Enterprise Security, Auth, 2FA, Rate-Limit, RBAC & Billing Test Suite
"""

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from auth_utils import (
    hash_password,
    verify_password,
    is_password_hashed,
    create_access_token,
    verify_access_token,
    generate_totp_secret,
    get_totp_uri,
    verify_totp_code,
    _totp_at,
    check_rate_limit,
    reset_rate_limits,
    is_safe_public_url,
    has_min_role,
    create_password_reset_token,
    verify_password_reset_token,
)


def test_password_hashing_and_verification():
    pw = "SuperSecret!2026"
    hashed = hash_password(pw)
    assert is_password_hashed(hashed)
    assert verify_password(pw, hashed)
    assert not verify_password("wrong-password", hashed)
    assert not is_password_hashed("plaintext123")
    assert verify_password("plaintext123", "plaintext123")


def test_jwt_lifecycle():
    token = create_access_token("mijanur@renim.ai", "Mijanur", "superadmin")
    payload = verify_access_token(token)
    assert payload is not None
    assert payload["sub"] == "mijanur@renim.ai"
    assert payload["role"] == "superadmin"
    assert verify_access_token(token + "tamper") is None


def test_totp_2fa_rfc6238():
    secret = generate_totp_secret()
    uri = get_totp_uri("mijanur@renim.ai", secret)
    assert uri.startswith("otpauth://totp/")
    assert f"secret={secret}" in uri

    current_code = _totp_at(secret, int(time.time()) // 30)
    assert verify_totp_code(secret, current_code)
    assert not verify_totp_code(secret, "000000" if current_code != "000000" else "111111")
    assert not verify_totp_code(secret, "abc")


def test_rate_limiter_enforces_threshold():
    reset_rate_limits()
    key = "test-ip:signin"
    for _ in range(5):
        allowed, retry = check_rate_limit(key, max_requests=5, window_seconds=60)
        assert allowed is True
        assert retry == 0
    allowed, retry = check_rate_limit(key, max_requests=5, window_seconds=60)
    assert allowed is False
    assert retry >= 1
    reset_rate_limits()


def test_ssrf_guard():
    assert is_safe_public_url("http://127.0.0.1:3057") is False
    assert is_safe_public_url("http://localhost:8000/admin") is False
    assert is_safe_public_url("http://169.254.169.254/latest/meta-data/") is False
    assert is_safe_public_url("file:///etc/passwd") is False
    assert is_safe_public_url("https://example.com") is True


def test_rbac_hierarchy():
    assert has_min_role("owner", "admin") is True
    assert has_min_role("admin", "member") is True
    assert has_min_role("viewer", "member") is False
    assert has_min_role("viewer", "viewer") is True


def test_password_reset_token_purpose():
    reset_tok = create_password_reset_token("user@renim.ai")
    assert verify_password_reset_token(reset_tok) == "user@renim.ai"
    # Regular access token must not work as password reset token
    access_tok = create_access_token("user@renim.ai", "User", "owner")
    assert verify_password_reset_token(access_tok) is None


if __name__ == "__main__":
    tests = [
        test_password_hashing_and_verification,
        test_jwt_lifecycle,
        test_totp_2fa_rfc6238,
        test_rate_limiter_enforces_threshold,
        test_ssrf_guard,
        test_rbac_hierarchy,
        test_password_reset_token_purpose,
    ]
    for fn in tests:
        fn()
        print(f"PASS: {fn.__name__}")
    print(f"\nAll {len(tests)} enterprise tests passed!")
