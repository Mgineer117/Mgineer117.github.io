/* ==========================================================================
   comments.js — per-publication discussion, Firebase Auth + Firestore.

   Identity is a name + password pair, handled by Firebase Auth (the name is
   mapped to a synthetic email, never sent anywhere). Passwords are never
   stored by this site: Firebase does the hashing, and Firestore rules decide
   who may edit or delete. Re-entering the same pair signs you back in, which
   is what lets you revise or remove what you wrote.
   ========================================================================== */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDoc,
  onSnapshot, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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

  const app = initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
    storageBucket: cfg.storageBucket || undefined,
    messagingSenderId: cfg.messagingSenderId || undefined
  });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const col = collection(db, cfg.collection || "comments");

  const els = {
    form: $("cbox-form"), ids: $("cbox-ids"), hint: $("cbox-hint"),
    name: $("cbox-name"), pass: $("cbox-pass"), body: $("cbox-body"),
    submit: $("cbox-submit"), status: $("cbox-status"), error: $("cbox-error"),
    who: $("cbox-who"), whoName: $("cbox-who-name"), admin: $("cbox-admin"),
    signout: $("cbox-signout"), list: $("cbox-list"), empty: $("cbox-empty"),
    count: $("cbox-count")
  };

  let user = null;
  let isAdmin = false;
  let rows = [];
  let editingId = null;

  /* ---------------------------------------------------------------- auth -- */

  const slug = (s) => s.toLowerCase().trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const emailFor = (name) => `${slug(name)}@${cfg.guestDomain || "guests.invalid"}`;

  const AUTH_MESSAGES = {
    "auth/invalid-email": "That name can't be used — try letters and numbers.",
    "auth/weak-password": "Passwords need at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
    "auth/network-request-failed": "Network error — check your connection.",
    "auth/operation-not-allowed": "Comment sign-in is not enabled on this site yet."
  };

  async function authenticate(name, password) {
    const email = emailFor(name);
    if (!email.split("@")[0]) throw new Error("Please enter a name.");
    if (password.length < 6) throw new Error("Passwords need at least 6 characters.");

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (cred.user.displayName !== name) {
        await updateProfile(cred.user, { displayName: name });
      }
      return cred.user;
    } catch (err) {
      /* With email-enumeration protection on, a wrong password and an unknown
         name look identical, so try creating the account and let that tell us. */
      const retryable = ["auth/user-not-found", "auth/invalid-credential", "auth/invalid-login-credentials"];
      if (!retryable.includes(err.code)) {
        throw new Error(AUTH_MESSAGES[err.code] || "Could not sign in.");
      }
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        return cred.user;
      } catch (err2) {
        if (err2.code === "auth/email-already-in-use") {
          throw new Error(`"${name}" is already taken — that password doesn't match it.`);
        }
        throw new Error(AUTH_MESSAGES[err2.code] || "Could not sign in.");
      }
    }
  }

  onAuthStateChanged(auth, async (u) => {
    user = u;
    isAdmin = false;
    if (u) {
      try {
        isAdmin = (await getDoc(doc(db, "admins", u.uid))).exists();
      } catch (e) { /* admins list unreadable — treat as a normal commenter */ }
      /* handy for setup: this is the id to add under admins/ in Firestore */
      console.info("[comments] signed in as", u.displayName, "· uid:", u.uid);
    }
    paintAuth();
    paintList();
  });

  function paintAuth() {
    const signedIn = !!user;
    els.who.hidden = !signedIn;
    els.ids.hidden = signedIn;
    els.hint.hidden = signedIn;
    if (signedIn) {
      els.whoName.textContent = user.displayName || "you";
      els.who.title = "uid: " + user.uid;
      els.admin.hidden = !isAdmin;
      els.submit.textContent = "Post comment";
    }
  }

  els.signout.addEventListener("click", async () => {
    await signOut(auth);
    els.pass.value = "";
    setError("");
    setStatus("Signed out.");
  });

  /* --------------------------------------------------------------- posting -- */

  function setError(msg) {
    els.error.textContent = msg || "";
    els.error.hidden = !msg;
  }
  function setStatus(msg) {
    els.status.textContent = msg || "";
    if (msg) setTimeout(() => { if (els.status.textContent === msg) els.status.textContent = ""; }, 4000);
  }
  function busy(on, label) {
    els.submit.disabled = on;
    els.submit.textContent = on ? (label || "Posting…") : "Post comment";
  }

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");

    const body = els.body.value.trim();
    if (!body) return setError("Write something first.");
    if (body.length > 4000) return setError("Comments are limited to 4000 characters.");

    busy(true);
    try {
      let who = user;
      if (!who) {
        const name = els.name.value.trim();
        if (!name) throw new Error("Please enter a name.");
        who = await authenticate(name, els.pass.value);
      }
      await addDoc(col, {
        page: cfg.page,
        name: who.displayName || els.name.value.trim(),
        uid: who.uid,
        body: body,
        createdAt: serverTimestamp(),
        updatedAt: null
      });
      els.body.value = "";
      els.pass.value = "";
      setStatus("Posted.");
    } catch (err) {
      setError(err && err.message ? err.message : "Could not post that comment.");
    } finally {
      busy(false);
    }
  });

  /* --------------------------------------------------------------- listing -- */

  onSnapshot(
    query(col, where("page", "==", cfg.page)),
    (snap) => {
      rows = [];
      snap.forEach((d) => rows.push(Object.assign({ id: d.id }, d.data())));
      rows.sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
      paintList();
    },
    (err) => fatal("Comments could not be loaded: " + err.message, true)
  );

  const ms = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : Number.MAX_SAFE_INTEGER);

  function when(ts) {
    if (!ts || typeof ts.toDate !== "function") return "just now";
    return ts.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function paintList() {
    els.list.textContent = "";
    els.empty.hidden = rows.length > 0;
    els.count.hidden = rows.length === 0;
    els.count.textContent = rows.length === 1 ? "1 comment" : rows.length + " comments";

    rows.forEach((row) => els.list.appendChild(
      row.id === editingId ? editorFor(row) : itemFor(row)
    ));
  }

  function itemFor(row) {
    const li = document.createElement("li");
    li.className = "cbox__item";

    const head = document.createElement("div");
    head.className = "cbox__item-head";

    const name = document.createElement("b");
    name.className = "cbox__item-name";
    name.textContent = row.name || "anonymous";

    const meta = document.createElement("span");
    meta.className = "cbox__item-when";
    meta.textContent = when(row.createdAt) + (row.updatedAt ? " · edited" : "");

    head.append(name, meta);

    const body = document.createElement("p");
    body.className = "cbox__item-body";
    body.textContent = row.body || "";

    li.append(head, body);

    const mine = user && row.uid === user.uid;
    if (mine || isAdmin) {
      const tools = document.createElement("div");
      tools.className = "cbox__item-tools";

      if (mine) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "cbox__linkbtn";
        edit.textContent = "Edit";
        edit.addEventListener("click", () => { editingId = row.id; paintList(); });
        tools.appendChild(edit);
      }

      const del = document.createElement("button");
      del.type = "button";
      del.className = "cbox__linkbtn cbox__linkbtn--danger";
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        if (!window.confirm("Delete this comment?")) return;
        try {
          await deleteDoc(doc(col, row.id));
        } catch (err) {
          setError("Could not delete that comment: " + err.message);
        }
      });
      tools.appendChild(del);

      li.appendChild(tools);
    }

    return li;
  }

  function editorFor(row) {
    const li = document.createElement("li");
    li.className = "cbox__item cbox__item--editing";

    const area = document.createElement("textarea");
    area.className = "cbox__edit";
    area.rows = 4;
    area.maxLength = 4000;
    area.value = row.body || "";

    const tools = document.createElement("div");
    tools.className = "cbox__item-tools";

    const save = document.createElement("button");
    save.type = "button";
    save.className = "btn-x btn-x--sm";
    save.textContent = "Save";
    save.addEventListener("click", async () => {
      const text = area.value.trim();
      if (!text) return setError("A comment can't be empty — delete it instead.");
      save.disabled = true;
      try {
        await updateDoc(doc(col, row.id), { body: text, updatedAt: serverTimestamp() });
        editingId = null;
        setError("");
        setStatus("Saved.");
      } catch (err) {
        setError("Could not save that edit: " + err.message);
        save.disabled = false;
      }
    });

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "cbox__linkbtn";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => { editingId = null; paintList(); });

    tools.append(save, cancel);
    li.append(area, tools);
    return li;
  }
}
