/* ==========================================================================
   comments.js — the discussion under each paper.

   Public only, and deliberately account-free. You type a name, a password and
   a comment, and that is the whole ceremony: the site signs you in for the
   instant it takes to write the document and signs you straight back out. To
   revise or remove a comment later you open its ⋯ menu and give the same
   password again. Nothing persists between actions, so a shared laptop never
   leaves someone else able to speak as you.

   The exception is master mode (see master.js): the owner stays signed in, so
   the password prompts fall away and Reply appears on every comment.
   ========================================================================== */

import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot, query, where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { connect, signInOnly, signUpOrIn } from "./cbox-core.js";

const $ = (id) => document.getElementById(id);

const root = $("comments");
if (root) boot().catch((err) => fatal(err && err.message ? err.message : String(err)));

function fatal(msg, keepForm) {
  const el = $("cbox-fatal");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  const form = $("cbox-form");
  if (form && !keepForm) form.hidden = true;   /* only for a broken configuration */
}

async function boot() {
  let cfg;
  try {
    cfg = JSON.parse($("cbox-config").textContent);
  } catch (e) {
    return fatal("Comment configuration could not be read.");
  }
  if (!cfg.apiKey || !cfg.projectId) {
    return fatal("Comments are not configured yet.");
  }

  const { auth, col, admins } = connect(cfg);

  const els = {
    form: $("cbox-form"), ids: $("cbox-ids"), hint: $("cbox-hint"),
    name: $("cbox-name"), pass: $("cbox-pass"), body: $("cbox-body"),
    submit: $("cbox-submit"), status: $("cbox-status"), error: $("cbox-error"),
    notice: $("cbox-notice"), list: $("cbox-list"), empty: $("cbox-empty"),
    count: $("cbox-count")
  };

  let isAdmin = false;
  let posting = false;
  let rows = [];
  let open = null;                 /* { id, mode: "menu" | "edit" | "delete" | "reply" } */
  const adminUids = new Set();

  /* One read, at load: the owner's uid, so their comments can be badged
     without asking Firestore about every author in the list. */
  try {
    (await getDocs(admins)).forEach((d) => adminUids.add(d.id));
  } catch (e) { /* roster unreadable — nobody gets badged, nothing else breaks */ }

  /* --------------------------------------------------------------- session -- */

  onAuthStateChanged(auth, (u) => {
    isAdmin = !!u && adminUids.has(u.uid);
    paintForm();
    refresh();
  });

  /* Every action re-proves the password, then drops the session. The owner is
     the one exception: master mode is a session, and holding it is the point. */
  async function act(row, password, fn) {
    if (isAdmin) return fn(auth.currentUser);
    const u = await signInOnly(auth, cfg, row.name, password,
      "That password doesn’t match this comment.");
    try {
      if (u.uid !== row.uid) {
        throw new Error("That name and password belong to a different account.");
      }
      return await fn(u);
    } finally {
      await signOut(auth);
    }
  }

  /* The button ships disabled: until the listener below is attached, pressing
     it would submit the form the browser's own way and navigate off the page. */
  function paintForm() {
    els.submit.disabled = posting;
    els.ids.hidden = isAdmin;
    els.hint.hidden = isAdmin;
    els.notice.hidden = isAdmin;
    els.submit.textContent = isAdmin ? "Post as " + cfg.ownerName : "Post comment";
    els.body.placeholder = isAdmin
      ? "Posting as the author."
      : "Questions and corrections welcome.";
  }
  /* --------------------------------------------------------------- posting -- */

  function setError(msg) {
    els.error.textContent = msg || "";
    els.error.hidden = !msg;
  }
  function setStatus(msg) {
    els.status.textContent = msg || "";
    if (msg) setTimeout(() => {
      if (els.status.textContent === msg) els.status.textContent = "";
    }, 4000);
  }

  function newComment(who, name, body, replyTo) {
    const d = {
      page: cfg.page,
      name: name,
      uid: who.uid,
      body: body,
      private: false,          /* kept for the rules; the box is public-only */
      createdAt: serverTimestamp(),
      updatedAt: null
    };
    if (replyTo) d.replyTo = replyTo;
    return addDoc(col, d);
  }

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");

    const body = els.body.value.trim();
    if (!body) return setError("Write something first.");
    if (body.length > 4000) return setError("Comments are limited to 4000 characters.");

    posting = true;
    els.submit.disabled = true;
    const label = els.submit.textContent;
    els.submit.textContent = "Posting…";
    try {
      if (isAdmin) {
        await newComment(auth.currentUser, cfg.ownerName, body);
      } else {
        const name = els.name.value.trim();
        const who = await signUpOrIn(auth, cfg, name, els.pass.value);
        try {
          await newComment(who, name, body);
        } finally {
          await signOut(auth);
        }
      }
      els.body.value = "";
      els.pass.value = "";
      setStatus("Posted.");
    } catch (err) {
      setError(err && err.message ? err.message : "Could not post that comment.");
    } finally {
      posting = false;
      els.submit.disabled = false;
      els.submit.textContent = label;
    }
  });

  paintForm();
  root.dataset.ready = "1";

  /* --------------------------------------------------------------- listing -- */

  onSnapshot(
    query(col, where("page", "==", cfg.page), where("private", "==", false)),
    (snap) => {
      rows = [];
      snap.forEach((d) => rows.push(Object.assign({ id: d.id }, d.data())));
      rows.sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
      refresh();
    },
    (err) => fatal("Comments could not be loaded: " + err.message, true)
  );

  const ms = (ts) =>
    (ts && typeof ts.toMillis === "function" ? ts.toMillis() : Number.MAX_SAFE_INTEGER);

  /* Minutes and hours while it is fresh, then the calendar. A comment posted
     an hour ago reads better as "1h ago" than as today's date and a clock. */
  function when(ts) {
    if (!ts || typeof ts.toDate !== "function") return { text: "just now" };
    const d = ts.toDate();
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    const text =
      mins < 1    ? "just now" :
      mins < 60   ? mins + "m ago" :
      mins < 1440 ? Math.round(mins / 60) + "h ago" :
      d.toLocaleString(undefined, { month: "short", day: "numeric",
        year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
        hour: "numeric", minute: "2-digit" });
    return { text, iso: d.toISOString(), full: d.toLocaleString() };
  }

  function stamp(row) {
    const w = when(row.createdAt);
    const t = el("time", "cbox__item-when", w.text + (row.updatedAt ? " · edited" : ""));
    if (w.iso) { t.dateTime = w.iso; t.title = w.full; }
    return t;
  }

  /* An open menu closes on the next click anywhere else, or on Escape. */
  document.addEventListener("click", (e) => {
    if (open && open.mode === "menu" && !e.target.closest(".cbox__more")) {
      open = null;
      paintList();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) { open = null; paintList(); }
  });

  /* Redraws that come from outside — a new comment arriving, or the sign-out
     that lands a second after posting — must not rebuild the list while an
     Edit, Delete or Reply panel is open: that would throw away half-typed text
     and any error worth reading. Closing the panel always paints, and by then
     `rows` holds whatever the latest snapshot left. Redraws the reader asked
     for go straight to paintList. */
  function refresh() {
    if (open && open.mode !== "menu") return;
    paintList();
  }

  function paintList() {
    els.list.textContent = "";
    els.empty.hidden = rows.length > 0;
    els.count.hidden = rows.length === 0;
    els.count.textContent = rows.length === 1 ? "1 comment" : rows.length + " comments";

    /* Replies hang under the comment they answer. One level, no deeper: a
       reply whose parent has been deleted falls back to the top of the list
       rather than disappearing with it. */
    const present = new Set(rows.map((r) => r.id));
    const kids = new Map();
    const tops = [];
    rows.forEach((r) => {
      if (r.replyTo && present.has(r.replyTo)) {
        if (!kids.has(r.replyTo)) kids.set(r.replyTo, []);
        kids.get(r.replyTo).push(r);
      } else {
        tops.push(r);
      }
    });

    tops.forEach((row) => {
      const li = itemFor(row);
      const mine = kids.get(row.id);
      if (mine) {
        const sub = document.createElement("ol");
        sub.className = "cbox__thread";
        mine.forEach((kid) => sub.appendChild(itemFor(kid)));
        li.appendChild(sub);
      }
      els.list.appendChild(li);
    });
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

  /* Drawn rather than typed: the ⋯ character sits differently in every font
     and never lines up with the text beside it. These are static strings, so
     innerHTML carries nothing a commenter wrote. */
  const ICONS = {
    more:  '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
    edit:  '<path d="M4 20.5h4L19 9.5a2.83 2.83 0 0 0-4-4L4 16.5v4z"/><path d="M14.5 6.5l3 3"/>',
    trash: '<path d="M4 7h16"/><path d="M10 7V4.8h4V7"/><path d="M6.5 7l.9 12.2h9.2L17.5 7"/>',
    reply: '<path d="M9.5 14.5 5 10l4.5-4.5"/><path d="M5 10h8.5a5.5 5.5 0 0 1 5.5 5.5V19"/>'
  };

  function icon(name, solid) {
    const span = el("span", "cbox__ico");
    span.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" ' +
      (solid ? 'fill="currentColor" stroke="none"'
             : 'fill="none" stroke="currentColor" stroke-width="1.6" ' +
               'stroke-linecap="round" stroke-linejoin="round"') +
      '>' + ICONS[name] + '</svg>';
    return span;
  }

  function menuItem(name, label, danger, onClick) {
    const b = button("cbox__menuitem" + (danger ? " cbox__menuitem--danger" : ""), null, onClick);
    b.append(icon(name), el("span", null, label));
    return b;
  }

  function itemFor(row) {
    const li = el("li", "cbox__item");
    const byOwner = adminUids.has(row.uid);
    if (byOwner) li.classList.add("cbox__item--author");

    const head = el("div", "cbox__item-head");
    head.append(el("b", "cbox__item-name", row.name || "anonymous"));
    if (byOwner) {
      const tag = el("span", "cbox__tag cbox__tag--author", "author");
      tag.title = "Written by the site owner";
      head.appendChild(tag);
    }
    head.append(stamp(row));

    const showing = !!open && open.id === row.id && open.mode === "menu";
    const more = el("div", "cbox__more" + (showing ? " cbox__more--open" : ""));
    const dots = button("cbox__dots", null, (e) => {
      e.stopPropagation();
      open = showing ? null : { id: row.id, mode: "menu" };
      paintList();
    });
    dots.appendChild(icon("more", true));
    dots.setAttribute("aria-label", "Actions for this comment");
    dots.setAttribute("aria-haspopup", "menu");
    dots.setAttribute("aria-expanded", String(showing));
    more.appendChild(dots);

    if (showing) {
      const menu = el("div", "cbox__menu");
      menu.setAttribute("role", "menu");
      menu.append(
        menuItem("edit", "Edit", false, () => { open = { id: row.id, mode: "edit" }; paintList(); }),
        menuItem("trash", "Delete", true, () => { open = { id: row.id, mode: "delete" }; paintList(); })
      );
      if (isAdmin && !row.replyTo) {
        menu.appendChild(menuItem("reply", "Reply as author", false,
          () => { open = { id: row.id, mode: "reply" }; paintList(); }));
      }
      more.appendChild(menu);
    }
    head.appendChild(more);

    li.append(head, el("p", "cbox__item-body", row.body || ""));

    if (open && open.id === row.id && open.mode !== "menu") {
      li.appendChild(
        open.mode === "edit"   ? editPanel(row) :
        open.mode === "delete" ? deletePanel(row) : replyPanel(row));
    }
    return li;
  }

  /* Each panel carries its own password field and its own error line, so a
     failure is reported against the comment it belongs to. */
  function panel(row, cls) {
    const box = el("div", "cbox__panel " + cls);
    const pass = el("input");
    pass.type = "password";
    pass.className = "cbox__panel-pass";
    pass.placeholder = `Password for “${row.name}”`;
    pass.autocomplete = "current-password";
    const err = el("p", "cbox__error");
    err.hidden = true;
    err.setAttribute("role", "alert");
    return { box, pass, err, showPass: !isAdmin };
  }

  function tools(box, primary, cancel) {
    const bar = el("div", "cbox__item-tools");
    bar.append(primary, button("cbox__linkbtn", "Cancel", () => { open = null; paintList(); }));
    box.appendChild(bar);
    return bar;
  }

  async function run(btn, err, work) {
    err.hidden = true;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Working…";
    try {
      await work();
      open = null;
      paintList();
    } catch (e) {
      err.textContent = e && e.message ? e.message : "That didn’t work.";
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  function editPanel(row) {
    const p = panel(row, "cbox__panel--edit");
    const area = el("textarea", "cbox__edit");
    area.rows = 4;
    area.maxLength = 4000;
    area.value = row.body || "";
    p.box.appendChild(area);
    if (p.showPass) p.box.appendChild(p.pass);

    const save = button("btn-x btn-x--sm", "Save", () => run(save, p.err, async () => {
      const text = area.value.trim();
      if (!text) throw new Error("A comment can’t be empty — delete it instead.");
      await act(row, p.pass.value, () => updateDoc(doc(col, row.id), {
        body: text, updatedAt: serverTimestamp()
      }));
      setStatus("Saved.");
    }));
    tools(p.box, save);
    p.box.appendChild(p.err);
    return p.box;
  }

  function deletePanel(row) {
    const p = panel(row, "cbox__panel--delete");
    p.box.appendChild(el("p", "cbox__panel-ask", isAdmin
      ? "Delete this comment?"
      : "Enter the password you used for this comment to delete it."));
    if (p.showPass) p.box.appendChild(p.pass);

    const go = button("btn-x btn-x--sm btn-x--danger", "Delete",
      () => run(go, p.err, async () => {
        await act(row, p.pass.value, async () => {
          /* The owner takes the answers with the question; a visitor deleting
             their own comment leaves any author reply standing. */
          if (isAdmin) {
            const replies = rows.filter((r) => r.replyTo === row.id);
            for (const r of replies) await deleteDoc(doc(col, r.id));
          }
          await deleteDoc(doc(col, row.id));
        });
        setStatus("Deleted.");
      }));
    tools(p.box, go);
    p.box.appendChild(p.err);
    return p.box;
  }

  function replyPanel(row) {
    const p = panel(row, "cbox__panel--reply");
    const area = el("textarea", "cbox__edit");
    area.rows = 3;
    area.maxLength = 4000;
    area.placeholder = `Answering ${row.name}…`;
    p.box.appendChild(area);

    const send = button("btn-x btn-x--sm", "Post reply",
      () => run(send, p.err, async () => {
        const text = area.value.trim();
        if (!text) throw new Error("Write a reply first.");
        if (!isAdmin) throw new Error("Only the site owner can reply as the author.");
        await newComment(auth.currentUser, cfg.ownerName, text, row.id);
        setStatus("Replied.");
      }));
    tools(p.box, send);
    p.box.appendChild(p.err);
    return p.box;
  }
}
