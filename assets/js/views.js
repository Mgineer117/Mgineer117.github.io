/* ==========================================================================
   views.js — visit counters.

   Straight over the Firestore REST API: a counter is one number, and no page
   should pay for the Firebase SDK to show it. Two requests, one to add this
   visit and one to read the totals back, and the page never waits on either.

   The only write the rules accept here is "+1 and nothing else" (see the
   /views block in firestore.rules), which is what lets a visitor who has not
   signed in — that is, everybody — be counted at all.
   ========================================================================== */
(function () {
  "use strict";

  var node = document.getElementById("views-config");
  if (!node || !window.fetch) return;

  var cfg;
  try { cfg = JSON.parse(node.textContent); } catch (e) { return; }
  if (!cfg.apiKey || !cfg.projectId) return;

  var ROOT = "projects/" + cfg.projectId + "/databases/(default)/documents";
  var API = "https://firestore.googleapis.com/v1/" + ROOT;

  /* The rules only accept a document id shaped like a page slug, so a path
     that cannot be flattened into one simply goes uncounted rather than
     failing loudly. */
  function idFor(path) {
    var s = String(path || "/").toLowerCase()
      .replace(/index\.html$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!s) return "_root";
    return s.slice(0, 64);
  }

  var pageId = idFor(cfg.page || location.pathname);
  var pagePath = cfg.page || location.pathname;

  /* A visit is a session, not a page load: reading five pages is one visit to
     the site, and re-reading one page is not a second view of it. */
  function fresh(key) {
    try {
      if (sessionStorage.getItem(key) === "1") return false;
      sessionStorage.setItem(key, "1");
      return true;
    } catch (e) {
      return true;      /* private mode: count it, better than silence */
    }
  }

  function bump(id, path) {
    return {
      update: { name: ROOT + "/views/" + id, fields: { path: { stringValue: path } } },
      updateMask: { fieldPaths: ["path"] },
      updateTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }]
    };
  }

  function post(url, body) {
    return fetch(API + url + "?key=" + encodeURIComponent(cfg.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
  }

  function show(which, n) {
    var nodes = document.querySelectorAll('[data-views="' + which + '"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = n.toLocaleString();
      var box = nodes[i].closest("[data-views-box]") || nodes[i];
      box.hidden = false;
    }
  }

  function read() {
    return post(":batchGet", {
      documents: [ROOT + "/views/_site", ROOT + "/views/" + pageId]
    }).then(function (rows) {
      for (var i = 0; i < rows.length; i++) {
        var d = rows[i].found;
        if (!d) continue;
        var n = parseInt((d.fields && d.fields.count && d.fields.count.integerValue) || "0", 10);
        show(d.name.slice(d.name.lastIndexOf("/") + 1) === "_site" ? "site" : "page", n);
      }
    });
  }

  var writes = [];
  if (fresh("views:_site")) writes.push(bump("_site", "/"));
  if (fresh("views:" + pageId)) writes.push(bump(pageId, pagePath.slice(0, 200)));

  /* Read after the write so a visitor sees a total that includes themselves;
     if the write is refused or offline, still show what is there. */
  (writes.length ? post(":commit", { writes: writes }).catch(function () {}) : Promise.resolve())
    .then(read)
    .catch(function () { /* a counter is never worth an error on the page */ });
})();
