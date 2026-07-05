"""E2E smoke test for the password-reset flow against a running backend."""
import json
import sys
import uuid
import urllib.request
import urllib.error

API = "http://localhost:8000"


def request(path, method="GET", data=None, cookies=None):
    url = f"{API}{path}"
    body = json.dumps(data).encode() if data is not None else None
    headers = {"Content-Type": "application/json"}
    if cookies:
        headers["Cookie"] = cookies
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            set_cookie = r.headers.get("Set-Cookie")
            new_cookies = cookies or ""
            if set_cookie:
                token_pair = set_cookie.split(";", 1)[0]
                if "=" in token_pair:
                    name, value = token_pair.split("=", 1)
                    pairs = [
                        p for p in (cookies or "").split("; ")
                        if p and not p.startswith(name + "=")
                    ]
                    pairs.append(f"{name}={value}")
                    new_cookies = "; ".join(pairs)
            payload = r.read()
            return r.status, (json.loads(payload) if payload else None), new_cookies
    except urllib.error.HTTPError as e:
        return e.code, None, cookies


def assert_eq(label, actual, expected):
    ok = actual == expected
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}: {actual!r}")
    if not ok:
        print(f"         expected: {expected!r}")
        sys.exit(1)


email = f"e2e-reset-{uuid.uuid4().hex[:8]}@example.com"
original_pw = "OriginalPass1!"
new_pw = "BrandNewPw2!"

print(f"=== 1. Signup {email} ===")
status, body, cookies = request(
    "/api/auth/signup", "POST",
    {"email": email, "password": original_pw, "display_name": "E2E"},
)
assert_eq("status", status, 201)
assert_eq("user email", body["email"], email)

print("=== 2. Forgot password ===")
status, body, _ = request("/api/auth/forgot-password", "POST", {"email": email})
assert_eq("status", status, 200)
assert_eq("dev_reset_url present",
          "dev_reset_url" in body and bool(body["dev_reset_url"]), True)
reset_url = body["dev_reset_url"]
token = reset_url.split("?token=", 1)[1]
print(f"  token length = {len(token)}")

print("=== 3. Reset password (with token) ===")
status, body, reset_cookies = request(
    "/api/auth/reset-password", "POST",
    {"token": token, "new_password": new_pw},
)
assert_eq("status", status, 200)
assert_eq("user email", body["email"], email)
assert_eq("session cookie issued",
          "contentsync_session=" in (reset_cookies or ""), True)

print("=== 4. Old password rejected ===")
status, body, _ = request(
    "/api/auth/login", "POST",
    {"email": email, "password": original_pw},
)
assert_eq("status", status, 401)

print("=== 5. New password works ===")
status, body, _ = request(
    "/api/auth/login", "POST",
    {"email": email, "password": new_pw},
)
assert_eq("status", status, 200)
assert_eq("user email", body["email"], email)

print("=== 6. Bogus token rejected ===")
status, body, _ = request(
    "/api/auth/reset-password", "POST",
    {"token": "this.is.notarealtoken", "new_password": "AnotherPw1!"},
)
assert_eq("status", status, 400)

print("=== 7. Nonexistent email returns same generic 200 (no enumeration) ===")
status, body, _ = request(
    "/api/auth/forgot-password", "POST", {"email": "nobody@example.com"},
)
assert_eq("status", status, 200)
assert_eq("dev_reset_url leaked", "dev_reset_url" in body, False)

print("\nALL CHECKS PASSED")
