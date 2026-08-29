/* ==========================================================================
   master.js — the owner's panel behind /backstage/.

   Master mode is not a client-side flag. It is a sign-in to one ordinary
   comment identity whose uid is listed in Firestore's `admins` collection,
   and the Firestore rules are what let that uid delete other people's
   comments. Typing the wrong password here gets you nothing at all — the
   page cannot grant a permission the database will not.

   The session persists, so once it is open every comment box on the site
   drops its password prompts and grows a "Reply as author" action.
   ========================================================================== */

import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getDocs, onSnapshot, query, where, deleteDoc, doc }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { connect, signInOnly, setPassword } from "./cbox-core.js";

const $ = (id) => document.getElementById(id);

if ($("mx")) boot().catch((e) => say($("mx-error"), e.message || String(e)));

function say(node, msg) {
  if (!node) return;
  node.textContent = msg || "";
  node.hidden = !msg;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function button(cls, text, onClick) {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

async function boot() {
  const cfg = JSON.parse($("mx-config").textContent);
  if (!cfg.apiKey || !cfg.projectId) {
    return say($("mx-error"), "Comments are not configured on this site.");
  }

  const { auth, col, admins } = connect(cfg);

  const els = {
    gate: $("mx-gate"), pass: $("mx-pass"), error: $("mx-error"),
    panel: $("mx-panel"), who: $("mx-who"), count: $("mx-count"),
    list: $("mx-list"), signout: $("mx-signout"), status: $("mx-status"),
    pwform: $("mx-pwform"), newpass: $("mx-newpass"), stranger: $("mx-stranger")
  };

  const adminUids = new Set();
  (await getDocs(admins)).forEach((d) => adminUids.add(d.id));

  let rows = [];
  let streams = [];

  onAuthStateChanged(auth, (u) => {
    const owner = !!u && adminUids.has(u.uid);
    els.gate.hidden = owner;
    els.panel.hidden = !owner;
    els.stranger.hidden = !(u && !owner);
    if (u && !owner) {
      els.stranger.textContent =
        "That password signed in an account that is not an owner (uid " + u.uid +
        "). Add that uid as a document under the `admins` collection in the " +
        "Firebase console to give it master mode.";
    }
    if (owner) {
      els.who.textContent = cfg.ownerName;
      els.pass.value = "";
      say(els.error, "");
      watch();
    } else {
      stopWatching();
      rows = [];
      paint();
    }
  });

  els.gate.addEventListener("submit", async (e) => {
    e.preventDefault();
    say(els.error, "");
    const btn = els.gate.querySelector("button");
    btn.disabled = true;
    try {
      await signInOnly(auth, cfg, cfg.owner, els.pass.value, "Wrong master password.");
    } catch (err) {
      say(els.error, err.message);
    } finally {
      btn.disabled = false;
    }
  });

  els.gate.querySelector("button").disabled = false;   /* live only once armed */

  els.signout.addEventListener("click", () => signOut(auth));

  els.pwform.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = els.pwform.querySelector("button");
    btn.disabled = true;
    try {
      await setPassword(auth.currentUser, els.newpass.value);
      els.newpass.value = "";
      els.status.textContent = "Master password changed.";
    } catch (err) {
      els.status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  /* ----------------------------------------------------------- the roster -- */

  function stopWatching() {
    while (streams.length) {
      const stop = streams.pop();
      try { stop(); } catch (e) { /* already detached */ }
    }
  }

  /* Every comment on the site, from every page. Public and private are
     separate queries because the rules prove them separately; private only
     ever holds notes left before the box went public-only. */
  function watch() {
    stopWatching();
    const buckets = new Map();
    [false, true].forEach((secret) => {
      const key = String(secret);
      buckets.set(key, []);
      streams.push(onSnapshot(
        query(col, where("private", "==", secret)),
        (snap) => {
          const found = [];
          snap.forEach((d) => found.push(Object.assign({ id: d.id }, d.data())));
          buckets.set(key, found);
          rows = [].concat(buckets.get("false"), buckets.get("true"))
            .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
          paint();
        },
        () => { buckets.set(key, []); }
      ));
    });
  }

  const ms = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0);

  function when(ts) {
    if (!ts || typeof ts.toDate !== "function") return "just now";
    return ts.toDate().toLocaleString(undefined,
      { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function paint() {
    els.list.textContent = "";
    els.count.textContent = rows.length === 1 ? "1 comment" : rows.length + " comments";
    if (!rows.length) {
      els.list.appendChild(el("p", "mx__empty", "Nothing has been posted yet."));
      return;
    }

    /* Grouped by the page they were left on, newest page first. */
    const pages = new Map();
    rows.forEach((r) => {
      if (!pages.has(r.page)) pages.set(r.page, []);
      pages.get(r.page).push(r);
    });

    pages.forEach((items, page) => {
      const group = el("section", "mx__group");
      const head = el("h3", "mx__group-head");
      const link = el("a", null, page);
      link.href = page;
      head.append(link, el("span", "mx__group-n", items.length));
      group.appendChild(head);

      items.forEach((row) => {
        const card = el("article", "mx__row");
        const top = el("div", "mx__row-head");
        top.append(el("b", null, row.name || "anonymous"),
                   el("span", "mx__when", when(row.createdAt)));
        if (adminUids.has(row.uid)) top.appendChild(el("span", "cbox__tag cbox__tag--author", "you"));
        if (row.replyTo) top.appendChild(el("span", "cbox__tag", "reply"));
        if (row.private) top.appendChild(el("span", "cbox__tag", "private"));

        const del = button("cbox__linkbtn cbox__linkbtn--danger", "Delete", async () => {
          if (!window.confirm("Delete this comment permanently?")) return;
          del.disabled = true;
          try {
            await deleteDoc(doc(col, row.id));
            els.status.textContent = "Deleted.";
          } catch (err) {
            els.status.textContent = "Could not delete: " + err.message;
            del.disabled = false;
          }
        });
        top.appendChild(del);

        card.append(top, el("p", "mx__body", row.body || ""));
        group.appendChild(card);
      });

      els.list.appendChild(group);
    });
  }

  paint();
}
