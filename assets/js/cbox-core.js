/* ==========================================================================
   cbox-core.js — the identity half of the comment system.

   There is no account to make and no session to keep. A visitor types a name
   and a password; the name is mapped to a synthetic email so Firebase Auth can
   hold the password (hashed, salted, rate-limited), and the pair is presented
   again for every later action. Nothing is emailed, and no password ever
   reaches Firestore.

   Shared by comments.js (the box under each paper) and master.js (the owner's
   panel), so the mapping from a typed name to an account exists in one place.
   ========================================================================== */

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, updatePassword
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

/* Firebase refuses passwords under six characters; the site asks for four.
   The rest is added here so the shorter password the visitor chose still
   works. It is not a secret — it only pads. */
const PEPPER = "#cbox";

export const MIN_PASSWORD = 4;

export function connect(cfg) {
  const app = getApps()[0] || initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
    storageBucket: cfg.storageBucket || undefined,
    messagingSenderId: cfg.messagingSenderId || undefined
  });
  const db = getFirestore(app);
  return {
    app, db,
    auth: getAuth(app),
    col: collection(db, cfg.collection || "comments"),
    admins: collection(db, "admins")
  };
}

export const slug = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 48);

export const emailFor = (cfg, name) =>
  `${slug(name)}@${cfg.guestDomain || "guests.invalid"}`;

const MESSAGES = {
  "auth/invalid-email": "That name can’t be used — try letters and numbers.",
  "auth/weak-password": `Passwords need at least ${MIN_PASSWORD} characters.`,
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed": "Network error — check your connection.",
  "auth/operation-not-allowed": "Commenting is not enabled on this site yet."
};

/* A wrong password and an unknown name are deliberately indistinguishable
   when email-enumeration protection is on, so both arrive as these codes. */
const UNKNOWN = ["auth/user-not-found", "auth/wrong-password",
                 "auth/invalid-credential", "auth/invalid-login-credentials"];

function check(name, password) {
  if (!slug(name)) throw new Error("Please enter a name.");
  if (!password || password.length < MIN_PASSWORD) {
    throw new Error(`Passwords need at least ${MIN_PASSWORD} characters.`);
  }
}

/* Prove an existing identity. Never creates anything, so it is safe behind an
   edit or a delete: an unknown name fails rather than quietly claiming one. */
export async function signInOnly(auth, cfg, name, password, wrongMsg) {
  check(name, password);
  try {
    const cred = await signInWithEmailAndPassword(
      auth, emailFor(cfg, name), password + PEPPER);
    return cred.user;
  } catch (err) {
    if (UNKNOWN.includes(err.code)) throw new Error(wrongMsg || "Wrong password.");
    throw new Error(MESSAGES[err.code] || "Could not verify that password.");
  }
}

/* Claim a name, or sign back into one already claimed. Used only for posting:
   the first person to use a name owns it, and keeps it with the password. */
export async function signUpOrIn(auth, cfg, name, password) {
  check(name, password);
  const email = emailFor(cfg, name);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password + PEPPER);
    if (cred.user.displayName !== name) {
      await updateProfile(cred.user, { displayName: name });
    }
    return cred.user;
  } catch (err) {
    if (!UNKNOWN.includes(err.code)) {
      throw new Error(MESSAGES[err.code] || "Could not post that comment.");
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password + PEPPER);
      await updateProfile(cred.user, { displayName: name });
      return cred.user;
    } catch (err2) {
      if (err2.code === "auth/email-already-in-use") {
        throw new Error(`“${name}” is taken — that password doesn’t match it.`);
      }
      throw new Error(MESSAGES[err2.code] || "Could not post that comment.");
    }
  }
}

/* Change the password on the signed-in identity. Firebase only allows this
   soon after a sign-in, which is exactly when master mode offers it. */
export async function setPassword(user, password) {
  if (!password || password.length < MIN_PASSWORD) {
    throw new Error(`Passwords need at least ${MIN_PASSWORD} characters.`);
  }
  try {
    await updatePassword(user, password + PEPPER);
  } catch (err) {
    if (err.code === "auth/requires-recent-login") {
      throw new Error("Sign in again first, then change the password.");
    }
    throw new Error(MESSAGES[err.code] || "Could not change the password.");
  }
}
