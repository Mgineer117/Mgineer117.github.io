# Publication comments — setup

Every publication page gets a discussion box. A visitor picks **a name and a password**,
writes a comment, and can come back later, re-enter the same pair, and edit or delete
what they wrote. You can delete anything.

The site is static, so the password check happens in **Firebase Auth** rather than on
this server. The name is mapped to a synthetic email (`alice@guests.mgineer117.github.io`)
purely so Firebase has something to key the account on — nothing is ever emailed, and
no password or password hash is ever stored in the database.

Until `firebase.apiKey` in `_config.yml` has a value, the comment box is not rendered at
all, so you can deploy this safely before finishing setup.

---

## 1. Create the Firebase project

1. <https://console.firebase.google.com> → **Create a project**. Analytics is not needed.
2. In the project, **Build → Firestore Database → Create database**.
   Pick **production mode** and any region close to you (`nam5` is fine).
3. **Build → Authentication → Get started → Email/Password → Enable → Save.**
   Leave "Email link" off.

## 2. Allow your domains

**Authentication → Settings → Authorized domains** must include:

- `mgineer117.github.io`
- `localhost` (already there by default — needed for local previews)

## 3. Paste the security rules

**Firestore Database → Rules**, replace everything with the contents of
[`firestore.rules`](firestore.rules) in this repo, then **Publish**.

These rules are what actually enforce the behaviour: anyone can read comments, only a
signed-in author can edit their own, and only an author or an owner can delete.

## 4. Register the web app and copy the keys

**Project settings (gear icon) → General → Your apps → Web (`</>`)**. Register the app,
then copy the `firebaseConfig` values into `_config.yml`:

```yaml
firebase:
  apiKey                 : "AIza..."
  authDomain             : "your-project.firebaseapp.com"
  projectId              : "your-project"
  appId                  : "1:1234567890:web:abc123"
  storageBucket          : "your-project.appspot.com"
  messagingSenderId      : "1234567890"
  collection             : "comments"
  guestDomain            : "guests.mgineer117.github.io"
```

The `apiKey` is **not** a secret — Firebase web API keys are public by design, and the
security rules above are what protect the data.

Restart `jekyll serve` after editing `_config.yml`; it is not hot-reloaded.

## 5. Make yourself the owner

1. Open any publication page and post a comment with the name and password you want to
   keep as your moderator login.
2. Open the browser console — it prints `[comments] signed in as <name> · uid: <uid>`.
   (Or read it from **Authentication → Users → User UID**.)
3. In **Firestore Database → Data**, create a collection `admins`, and inside it a
   document whose **Document ID is that uid**. The fields don't matter; add
   `note: "owner"` so it's obvious later.

From then on, signing in with that name and password shows a **site owner** badge and a
**Delete** control on every comment.

---

## Where things live

| Piece | File |
|---|---|
| Markup, config injection | `_includes/comments-box.html` |
| Auth, reads, writes | `assets/js/comments.js` |
| Styling | `assets/css/site.css` (`.cbox__*`) |
| Where it is rendered | `_layouts/single.html` |
| Access control | `firestore.rules` |

Add `comments_box: true` to any page's front matter to show the box outside the
publications collection.

## Notes

- Firebase requires passwords of **at least 6 characters**.
- A name is claimed by whoever uses it first. Someone re-using a taken name with the
  wrong password is told the name is taken, and is not signed in.
- Comments are capped at 4000 characters, names at 40, enforced in the rules.
- The free Spark plan covers this comfortably; there is no billing account to attach.
- To wipe a page's discussion, delete the matching documents in **Firestore → Data**.
