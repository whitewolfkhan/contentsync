"""End-to-end check: every frontend page returns 200 + logo asset is served.

Hits the Next.js dev server directly (no UI driver needed) and prints a
check-marked summary so we know the public/ logo fix and the four new
routes all work.
"""
import urllib.request
import sys

PAGES = ["/", "/login", "/signup", "/forgot-password"]
ASSETS = ["/logo.png"]


def head(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", "")


def main() -> int:
    ok = True
    print("=== Frontend pages ===")
    for path in PAGES:
        status, ctype = head(f"http://127.0.0.1:3000{path}")
        passed = status == 200 and "text/html" in ctype
        ok = ok and passed
        mark = "PASS" if passed else "FAIL"
        print(f"  [{mark}] {path:<22} status={status} ctype={ctype}")

    print("\n=== Static assets ===")
    for path in ASSETS:
        status, ctype = head(f"http://127.0.0.1:3000{path}")
        passed = status == 200 and "image/png" in ctype
        ok = ok and passed
        mark = "PASS" if passed else "FAIL"
        print(f"  [{mark}] {path:<22} status={status} ctype={ctype}")

    print("\nALL CHECKS PASSED" if ok else "\nSOME CHECKS FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())