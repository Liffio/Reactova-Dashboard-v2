#!/usr/bin/env python3
"""
Exercises S0.11's TOTP contract on the five guarded admin package routes, against a real server.

    python scripts/totp-contract-probe.py <ADMIN_TOKEN> <TOTP_CODE> [PACKAGE_ID] [--replace-sets]

ADMIN_TOKEN   bearer token of a platform admin holding platform:package_manage.
              DevTools > Network > any /api/v1/admin request > Authorization header, minus the
              leading "Bearer ". Nothing here fetches or derives it.
TOTP_CODE     a CURRENT six-digit code from the authenticator enrolled on the account that owns
              the token. `requireTotpConfirm` reads `user_mfa_methods` for the logged-in user, so
              it must be that account's own app code. Supply it fresh: the three success cases run
              back to back specifically so one code can cover them before the window turns over.
PACKAGE_ID    optional. Defaults to the first package the list endpoint returns.

================================================================================================
EVERY WRITE THIS MAKES, BY DEFAULT -- three, all PATCHes that set a column to the value it
already holds:

  W1  PATCH /admin/packages/:id  {"name": <its current name>}                      no code
  W2  PATCH /admin/packages/:id  {"sortOrder": <its current sortOrder>}            with the code
  W3  PATCH /admin/packages/:id  {"isActive": <its current isActive>}              with the code

  `updatePackage` computes `diff(existing, patch)` and only records an audit row when that diff is
  non-empty, so an identical-value patch writes NO audit row. What each one does cost: one UPDATE
  statement, and one `invalidateSellablePackages()` cache bust -- which only makes the next read of
  the sellable list go to the database.

  Nothing else writes. Every other case below is refused by the guard before the handler runs, so
  those requests reach no service and change nothing.

  NOTE: It never sends a valid code to POST /publish or POST /apply-live. Those two are probed for
  their refusal only -- one creates and archives objects at Stripe and Razorpay, the other
  re-resolves entitlement for every workspace on the package and notifies their members.

WITH --replace-sets, two more, and they are NOT free:

  W4  PUT /admin/packages/:id/features  {"features": <its current feature set>}    with the code
  W5  PUT /admin/packages/:id/limits    {"limits": <its current limits>}           with the code

  Both are whole-set replaces. `setPackageFeatures` DELETEs every `package_features` row for the
  package and reinserts them, so the rows come back with new ids even though the set is identical,
  and it records an audit entry. Only pass this flag if you want the features route -- the one that
  failed in production -- proven end to end, and accept that cost.
================================================================================================
"""

import json
import ssl
import sys
import urllib.error
import urllib.request

# Windows consoles default to cp1252; every line this prints is ASCII, and this makes any
# stray byte from a server response degrade instead of killing the run.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE = "https://api.liffio.com"
V1 = "/api/v1"

results = []


def _ssl_context():
    """
    api.liffio.com's certificate is valid; some Windows boxes carry a stale OpenSSL root store and
    reject it with "certificate has expired". certifi is the fix, and it is a real trust store --
    verification is never turned off here, because a probe that skips it cannot tell a working
    endpoint from a man in the middle.
    """
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where()), "certifi"
    except ImportError:
        return ssl.create_default_context(), "system"


SSL_CTX, SSL_SOURCE = _ssl_context()

# Cloudflare sits in front of api.liffio.com and answers Python-urllib's default signature with
# "Error 1010: Access denied" before the request ever reaches Express -- which reads exactly like
# a broken endpoint. These are the headers the console's own fetch sends.
BROWSER_HEADERS = {
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://app.liffio.com",
    "Referer": "https://app.liffio.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
}


def call(method, path, body=None, token=None):
    """Returns (status, parsed body or truncated text). Never raises on an HTTP error status."""
    data = None
    headers = dict(BROWSER_HEADERS)
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as res:
            return res.status, _parse(res.read())
    except urllib.error.HTTPError as e:
        return e.code, _parse(e.read())
    except urllib.error.URLError as e:
        reason = str(e.reason)
        if "CERTIFICATE_VERIFY_FAILED" in reason:
            reason += "  (try: pip install certifi)"
        return 0, {"_transport_error": reason}
    except Exception as e:  # DNS, timeout, anything else
        return 0, {"_transport_error": str(e)}


def _parse(raw):
    text = raw.decode("utf-8", "replace")
    try:
        return json.loads(text)
    except ValueError:
        return text[:400]


def short(payload):
    s = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    return s if len(s) <= 260 else s[:260] + "..."


def check(label, status, body, want_status, want_code=None):
    code = body.get("code") if isinstance(body, dict) else None
    ok = status == want_status and (want_code is None or code == want_code)
    want = str(want_status) + ((" " + want_code) if want_code else "")
    print(("  PASS  " if ok else "  FAIL  ") + label)
    print("          want " + want + "   got " + str(status) + ((" " + code) if code else ""))
    print("          body " + short(body))
    results.append((ok, label))
    return ok


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    replace_sets = "--replace-sets" in sys.argv
    if len(argv) < 2:
        print(__doc__)
        return 2

    token, totp = argv[0].strip(), argv[1].strip()
    pkg_id = argv[2].strip() if len(argv) > 2 else None

    if not (len(totp) == 6 and totp.isdigit()):
        print("TOTP_CODE must be exactly six digits; got " + repr(totp))
        return 2

    print("== 0. target ==  (TLS trust store: " + SSL_SOURCE + ")")
    status, me = call("GET", V1 + "/auth/me", token=token)
    if status != 200:
        print("  cannot authenticate: " + str(status) + " " + short(me))
        return 1
    print("  authenticated")

    if not pkg_id:
        status, listing = call("GET", V1 + "/admin/packages?limit=5", token=token)
        if status != 200 or not isinstance(listing, dict) or not listing.get("items"):
            print("  cannot list packages: " + str(status) + " " + short(listing))
            return 1
        pkg_id = listing["items"][0]["id"]

    status, pkg = call("GET", V1 + "/admin/packages/" + pkg_id, token=token)
    if status != 200:
        print("  cannot read package " + pkg_id + ": " + str(status) + " " + short(pkg))
        return 1

    snapshot = {k: v for k, v in pkg.items() if k != "updatedAt"}
    print("  " + str(pkg.get("name")) + "  (" + pkg_id + ")")
    print(
        "  "
        + str(len(pkg.get("features", [])))
        + " features - "
        + str(len(pkg.get("limits", [])))
        + " limits - sortOrder="
        + str(pkg.get("sortOrder"))
        + " - isActive="
        + str(pkg.get("isActive"))
        + " - isPublic="
        + str(pkg.get("isPublic"))
    )

    features = [
        {"parentKey": f["parentKey"], "childKey": f.get("childKey")}
        for f in pkg.get("features", [])
    ]
    limits = [{"key": lim["key"], "value": lim["value"]} for lim in pkg.get("limits", [])]

    patch_p = V1 + "/admin/packages/" + pkg_id
    feat_p = patch_p + "/features"
    lim_p = patch_p + "/limits"
    pub_p = patch_p + "/publish"
    live_p = patch_p + "/apply-live"

    # -- 1. the field name, and the shape of the refusal --------------------------------------
    # All four are rejected by the guard before the handler. No writes.
    print("\n== 1. no confirmCode, on the four unconditionally guarded routes ==")
    s, b = call("PUT", feat_p, {"features": features}, token)
    check("PUT  /features", s, b, 400, "TOTP_CODE_REQUIRED")
    s, b = call("PUT", lim_p, {"limits": limits}, token)
    check("PUT  /limits", s, b, 400, "TOTP_CODE_REQUIRED")
    s, b = call("POST", pub_p, {}, token)
    check("POST /publish", s, b, 400, "TOTP_CODE_REQUIRED")
    s, b = call("POST", live_p, {}, token)
    check("POST /apply-live", s, b, 400, "TOTP_CODE_REQUIRED")

    # -- 2. malformed and wrong codes ---------------------------------------------------------
    # All rejected before the handler. No writes.
    print("\n== 2. codes the guard should refuse ==")
    for label, value in (
        ("five digits", "12345"),
        ("seven digits", "1234567"),
        ("non-numeric", "abcdef"),
        ("empty string", ""),
        ("a number, not a string", 123456),
    ):
        s, b = call("PUT", feat_p, {"features": features, "confirmCode": value}, token)
        check(label.ljust(24) + "-> treated as missing", s, b, 400, "TOTP_CODE_REQUIRED")
    wrong = "000000" if totp != "000000" else "111111"
    s, b = call("PUT", feat_p, {"features": features, "confirmCode": wrong}, token)
    check("six wrong digits".ljust(24) + "-> invalid", s, b, 403, "TOTP_INVALID")

    # -- 3. PATCH is conditional --------------------------------------------------------------
    print("\n== 3. PATCH steps up only for structural fields ==")
    # Refused before the handler -- proves the check is on key PRESENCE, not on a changed value.
    s, b = call("PATCH", patch_p, {"isActive": pkg["isActive"]}, token)
    check(
        "structural key at its CURRENT value still demands a code (presence, not change)",
        s,
        b,
        400,
        "TOTP_CODE_REQUIRED",
    )
    # W1 -- the only unguarded write in the default run.
    s, b = call("PATCH", patch_p, {"name": pkg["name"]}, token)
    check("W1  name-only patch goes through with NO code", s, b, 200)

    # -- 4. a real code -----------------------------------------------------------------------
    print("\n== 4. a valid code, on writes that set a field to what it already is ==")
    s, b = call("PATCH", patch_p, {"sortOrder": pkg["sortOrder"], "confirmCode": totp}, token)
    if not check("W2  guarded patch, first use of the code", s, b, 200):
        print("\n  If this says TOTP_INVALID the code has turned over -- re-run with a fresh one.")

    s, b = call("PATCH", patch_p, {"isActive": pkg["isActive"], "confirmCode": totp}, token)
    reused = check("W3  guarded patch, SAME code a second time", s, b, 200)
    print("  -> single-use?  " + ("NO -- reusable inside its window" if reused else "APPARENTLY YES (or the window lapsed)"))

    # Not asserted here: that the guard strips confirmCode before the handler. zod would drop an
    # unknown key anyway, so the response can never carry it back and the check could not fail --
    # a green line that proves nothing is worse than no line. The backend covers it directly, in
    # requireTotpConfirm.test.ts.

    if replace_sets:
        print("\n== 4b. whole-set replaces (--replace-sets) ==")
        s, b = call("PUT", feat_p, {"features": features, "confirmCode": totp}, token)
        check("W4  PUT /features, same set echoed back", s, b, 200)
        s, b = call("PUT", lim_p, {"limits": limits, "confirmCode": totp}, token)
        check("W5  PUT /limits, same limits echoed back", s, b, 200)
    else:
        print("\n== 4b. skipped -- pass --replace-sets to prove /features and /limits end to end ==")

    # -- 5. nothing moved ---------------------------------------------------------------------
    print("\n== 5. the package is unchanged ==")
    s, after = call("GET", V1 + "/admin/packages/" + pkg_id, token=token)
    if s != 200:
        print("  could not re-read: " + str(s) + " " + short(after))
        results.append((False, "no net change"))
    else:
        now = {k: v for k, v in after.items() if k != "updatedAt"}
        same = json.dumps(now, sort_keys=True) == json.dumps(snapshot, sort_keys=True)
        print(("  PASS  " if same else "  FAIL  ") + "identical to the snapshot taken before any write")
        if not same:
            for key in sorted(set(snapshot) | set(now)):
                a = json.dumps(snapshot.get(key), sort_keys=True)
                z = json.dumps(now.get(key), sort_keys=True)
                if a != z:
                    print("          " + key + ":  " + short(snapshot.get(key)) + "  ->  " + short(now.get(key)))
        results.append((same, "no net change"))

    passed = sum(1 for ok, _ in results if ok)
    print("\n== " + str(passed) + "/" + str(len(results)) + " as expected ==")
    for ok, label in results:
        if not ok:
            print("  unexpected:  " + label)
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
