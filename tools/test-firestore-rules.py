#!/usr/bin/env python3
"""Attack the live Firestore rules from outside, the way a browser would.

The comment box hands every visitor the same public API key, so the rules in
firestore.rules are the only thing standing between a stranger and everyone
else's comments. Reading them is not enough: an earlier version of readable()
looked right and returned private comments to anonymous callers, and only a
test that ran the queries which *should* be refused caught it. Keep that habit.

    python3 tools/test-firestore-rules.py                  # visitor tests only
    CBOX_OWNER_PASSWORD=... python3 tools/test-firestore-rules.py   # owner too

Every account and comment it creates is removed before it exits. It writes to
the real project, under a page path that no page uses.
"""

import json, os, sys, urllib.error, urllib.parse, urllib.request, uuid

KEY    = "AIzaSyBl76h4Oq0OOulgsrvl8ItpEcLUhZyTA8U"
PROJ   = "mgineer117-site"
DOMAIN = "guests.mgineer117.github.io"
OWNER  = "site-owner"
PEPPER = "#cbox"          # must match assets/js/cbox-core.js

ROOT = f"projects/{PROJ}/databases/(default)/documents"
BASE = f"https://firestore.googleapis.com/v1/{ROOT}"
IDP  = "https://identitytoolkit.googleapis.com/v1"

PAGE = "/__rulestest__/" + uuid.uuid4().hex[:8]
S = lambda v: {"stringValue": v}
B = lambda v: {"booleanValue": v}


def call(url, payload=None, bearer=None):
    headers = {"Content-Type": "application/json"}
    if bearer:
        headers["Authorization"] = "Bearer " + bearer
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        return True, json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        return False, json.loads(e.read().decode() or "{}")


def sign_up(name, password):
    ok, r = call(f"{IDP}/accounts:signUp?key={KEY}",
                 {"email": f"{name}@{DOMAIN}", "password": password + PEPPER,
                  "returnSecureToken": True})
    if not ok:
        return sign_in(name, password)
    return r["localId"], r["idToken"]


def sign_in(name, password):
    ok, r = call(f"{IDP}/accounts:signInWithPassword?key={KEY}",
                 {"email": f"{name}@{DOMAIN}", "password": password + PEPPER,
                  "returnSecureToken": True})
    if not ok:
        raise RuntimeError(json.dumps(r)[:200])
    return r["localId"], r["idToken"]


def create(token, uid, name, body, private=False, reply=None, stamp=True):
    cid = uuid.uuid4().hex[:20]
    fields = {"page": S(PAGE), "name": S(name), "uid": S(uid), "body": S(body),
              "private": B(private), "updatedAt": {"nullValue": None}}
    if reply is not None:
        fields["replyTo"] = S(reply)
    write = {"update": {"name": f"{ROOT}/comments/{cid}", "fields": fields},
             "updateMask": {"fieldPaths": list(fields) + ["createdAt"]},
             "currentDocument": {"exists": False}}
    if stamp:
        write["updateTransforms"] = [
            {"fieldPath": "createdAt", "setToServerValue": "REQUEST_TIME"}]
    ok, _ = call(f"{BASE}:commit", {"writes": [write]}, bearer=token)
    return ok, cid


def edit(token, cid, body, extra=None):
    fields = {"body": S(body)}
    fields.update(extra or {})
    write = {"update": {"name": f"{ROOT}/comments/{cid}", "fields": fields},
             "updateMask": {"fieldPaths": list(fields) + ["updatedAt"]},
             "updateTransforms": [
                 {"fieldPath": "updatedAt", "setToServerValue": "REQUEST_TIME"}],
             "currentDocument": {"exists": True}}
    return call(f"{BASE}:commit", {"writes": [write]}, bearer=token)[0]


def delete(token, cid):
    return call(f"{BASE}:commit",
                {"writes": [{"delete": f"{ROOT}/comments/{cid}"}]}, bearer=token)[0]


def listing(token, filters):
    clauses = [{"fieldFilter": {"field": {"fieldPath": k}, "op": "EQUAL", "value": v}}
               for k, v in filters]
    sq = {"from": [{"collectionId": "comments"}]}
    if len(clauses) == 1:
        sq["where"] = clauses[0]
    elif clauses:
        sq["where"] = {"compositeFilter": {"op": "AND", "filters": clauses}}
    url = f"{BASE}:runQuery" + ("" if token else f"?key={KEY}")
    ok, r = call(url, {"structuredQuery": sq}, bearer=token)
    return (ok, [x["document"] for x in r if "document" in x] if ok else [])


# --- view counters -------------------------------------------------------
#
# The one door in these rules that opens for an unauthenticated caller, so
# the interesting cases are all the ways of pushing something other than +1
# through it.

VIEW_DOC = lambda pid: f"{ROOT}/views/{pid}"


def bump(pid, path="/__rulestest__/", by=1):
    ok, _ = call(f"{BASE}:commit?key={KEY}", {"writes": [{
        "update": {"name": VIEW_DOC(pid), "fields": {"path": S(path)}},
        "updateMask": {"fieldPaths": ["path"]},
        "updateTransforms": [
            {"fieldPath": "count", "increment": {"integerValue": str(by)}}]}]})
    return ok


def view_count(pid):
    ok, r = call(f"{BASE}/views/{pid}?key={KEY}")
    return int(r["fields"]["count"]["integerValue"]) if ok else None


def main():
    failed = []

    def check(label, got, want=True):
        if got != want:
            failed.append(label)
        print(f"  {'PASS' if got == want else 'FAIL'}  {label}")

    tag = PAGE[-8:]
    alice_uid, alice = sign_up("t-alice-" + tag, "ab12")
    mal_uid, mallory = sign_up("t-mallory-" + tag, "zz99")

    owner_pw = os.environ.get("CBOX_OWNER_PASSWORD")
    owner_uid = owner = None
    if owner_pw:
        owner_uid, owner = sign_in(OWNER, owner_pw)

    print("\n== a visitor may only speak for themselves ==")
    ok, alice_id = create(alice, alice_uid, "Alice", "hello")
    check("posts a comment", ok)
    check("cannot post under another uid", create(mallory, alice_uid, "Alice", "forged")[0], False)
    check("cannot forge the timestamp", create(alice, alice_uid, "Alice", "x", stamp=False)[0], False)
    check("cannot post signed out", create(None, alice_uid, "Alice", "x")[0], False)

    print("\n== edits stay inside the comment ==")
    check("author edits their own body", edit(alice, alice_id, "hello, revised"))
    check("a stranger cannot edit", edit(mallory, alice_id, "mallory was here"), False)
    check("cannot rename the author", edit(alice, alice_id, "x", {"name": S("Not Alice")}), False)
    check("cannot become a reply", edit(alice, alice_id, "x", {"replyTo": S(alice_id)}), False)
    check("replyTo over 64 chars refused",
          create(alice, alice_uid, "Alice", "x", reply="y" * 80)[0], False)

    print("\n== the private ones stay private ==")
    ok, secret = create(mallory, mal_uid, "Mallory", "a private note", private=True)
    check("anonymous reads the public list",
          listing(None, [("page", S(PAGE)), ("private", B(False))])[0])
    check("anonymous cannot list a page unfiltered", listing(None, [("page", S(PAGE))])[0], False)
    check("anonymous cannot list private comments",
          listing(None, [("page", S(PAGE)), ("private", B(True))])[0], False)
    check("a visitor cannot list another's private comments",
          listing(alice, [("page", S(PAGE)), ("private", B(True))])[0], False)

    print("\n== deletion ==")
    check("a stranger cannot delete", delete(mallory, alice_id), False)
    check("the author can", delete(alice, alice_id))

    if owner:
        print("\n== the owner ==")
        ok, reply_id = create(owner, owner_uid, "Author", "an answer", reply=secret)
        check("may reply", ok)
        check("may read every private comment",
              listing(owner, [("page", S(PAGE)), ("private", B(True))])[0])
        check("may sweep the whole site (the backstage roster)",
              listing(owner, [("private", B(False))])[0])
        check("still cannot rewrite someone's words", edit(owner, secret, "owner rewrite"), False)
        check("may delete anything", delete(owner, secret))
        delete(owner, reply_id)
    else:
        print("\n  (set CBOX_OWNER_PASSWORD to test master mode too)")
        delete(mallory, secret)

    # The view counter is written by people who have not signed in, so every
    # one of these runs with nothing but the public key.
    print("\n== a view counter only ever goes up by one ==")
    pid = "_rulestest"
    check("an uncounted page starts at one", bump(pid))
    before = view_count(pid)
    check("anyone may read the count", before is not None)
    check("a second visit adds one", bump(pid) and view_count(pid) == before + 1)

    at = view_count(pid)
    check("cannot add two at a time", bump(pid, by=2), False)
    check("cannot add a thousand", bump(pid, by=1000), False)
    check("cannot count down", bump(pid, by=-1), False)
    check("cannot repoint the page", bump(pid, path="/somewhere-else/"), False)
    check("cannot set the count outright",
          call(f"{BASE}:commit?key={KEY}", {"writes": [{
              "update": {"name": VIEW_DOC(pid),
                         "fields": {"path": S("/__rulestest__/"),
                                    "count": {"integerValue": "99999"}}},
              "updateMask": {"fieldPaths": ["path", "count"]}}]})[0], False)
    check("cannot smuggle in another field",
          call(f"{BASE}:commit?key={KEY}", {"writes": [{
              "update": {"name": VIEW_DOC(pid),
                         "fields": {"path": S("/__rulestest__/"), "junk": S("x")}},
              "updateMask": {"fieldPaths": ["path", "junk"]},
              "updateTransforms": [
                  {"fieldPath": "count", "increment": {"integerValue": "1"}}]}]})[0], False)
    check("cannot delete a counter",
          call(f"{BASE}:commit?key={KEY}",
               {"writes": [{"delete": VIEW_DOC(pid)}]})[0], False)
    check("none of that moved the number", view_count(pid) == at)

    # The daily bucket is an ordinary counter under a dated id, so the same
    # rules have to accept that shape.
    check("a dated bucket id is accepted", bump("_day-2000-01-01", path="2000-01-01"))

    # The id is part of the shape: the collection is for page slugs, not for
    # whatever a stranger would like to store in it.
    check("an id with capitals is refused", bump("BadId"), False)
    check("an id starting with a dash is refused", bump("-nope"), False)
    check("an id over 64 characters is refused", bump("a" * 65), False)

    for token in (alice, mallory):
        call(f"{IDP}/accounts:delete?key={KEY}", {"idToken": token})

    print("\n" + ("ALL PASS" if not failed else f"{len(failed)} FAILED: " + ", ".join(failed)))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
