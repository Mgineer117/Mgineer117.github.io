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

  /* "Today" is the site owner's today, not the reader's: a visitor in Tokyo
     and a visitor in Chicago have to land in the same bucket or the daily
     number means nothing. Intl does the whole job, DST included. If the
     browser cannot resolve the zone it falls back to UTC, which is wrong by
     a few hours rather than wrong by a day. */
  function chicagoDate() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  var today = chicagoDate();
  var dayId = "_day-" + today;

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

  /* Which documents this page needs, and where each one's number goes.
     A listing asks for a counter per row through data-views-path, so the
     ids come from the same idFor() the writes use and the two can't drift. */
  var targets = {};

  function want(id, node) {
    if (!id || !node) return;
    (targets[id] = targets[id] || []).push(node);
  }

  function each(sel, fn) {
    var n = document.querySelectorAll(sel);
    for (var i = 0; i < n.length; i++) fn(n[i]);
  }

  each('[data-views="site"]',  function (n) { want("_site", n); });
  each('[data-views="today"]', function (n) { want(dayId, n); });
  each('[data-views="page"]',  function (n) { want(pageId, n); });
  each("[data-views-path]", function (el) {
    want(idFor(el.getAttribute("data-views-path")),
         el.querySelector("[data-views]") || el);
  });

  function show(id, n) {
    var nodes = targets[id] || [];
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = n.toLocaleString();
      var box = nodes[i].closest("[data-views-box]") || nodes[i];
      /* "1 views" reads as a bug even when the number is right. */
      var unit = box.querySelector("[data-views-unit]");
      if (unit) {
        unit.textContent = unit.getAttribute("data-views-unit") + (n === 1 ? "" : "s");
      }
      box.hidden = false;
    }
  }

  function read() {
    var names = [];
    for (var id in targets) names.push(ROOT + "/views/" + id);
    if (!names.length) return Promise.resolve();

    return post(":batchGet", { documents: names }).then(function (rows) {
      /* A document that does not exist yet is a real zero. Only a failed
         request leaves a counter hidden, so "0 views" and "offline" never
         look the same. */
      var counts = {};
      for (var i = 0; i < rows.length; i++) {
        var name = rows[i].found ? rows[i].found.name : rows[i].missing;
        if (!name) continue;
        var f = rows[i].found && rows[i].found.fields;
        counts[name.slice(name.lastIndexOf("/") + 1)] =
          parseInt((f && f.count && f.count.integerValue) || "0", 10);
      }

      /* Today cannot be more than all time. The two are incremented in one
         atomic write so they do not drift on their own, but a session that
         runs past Chicago midnight lands on the new day without adding to
         the total, and a counter edited on the server can put them out of
         step for good. Either way "7 visits · 8 today" is nonsense on the
         face of it, and one line makes it unsayable. */
      if (counts[dayId] != null && counts._site != null) {
        counts[dayId] = Math.min(counts[dayId], counts._site);
      }

      for (var id in counts) show(id, counts[id]);
    });
  }

  var writes = [];
  if (fresh("views:_site")) writes.push(bump("_site", "/"));
  /* Keyed by the date, so a session that runs past Chicago midnight is
     counted on both days rather than vanishing from the second one. */
  if (fresh("views:" + dayId)) writes.push(bump(dayId, today));
  if (fresh("views:" + pageId)) writes.push(bump(pageId, pagePath.slice(0, 200)));

  /* Read after the write so a visitor sees a total that includes themselves;
     if the write is refused or offline, still show what is there. */
  (writes.length ? post(":commit", { writes: writes }).catch(function () {}) : Promise.resolve())
    .then(read)
    .catch(function () { /* a counter is never worth an error on the page */ });
})();
