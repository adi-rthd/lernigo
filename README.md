# Lernigo

Lernigo is a static German vocabulary study app. The published site stays private. For local development, serve the web files over HTTP, for example `python -m http.server 8000 --directory dist`.

The complete A1 deck comes from the supplied workbook. A2, B1, B2 and C1 have 12 original starter cards each. The A1 PDF is available under Cheat sheet. A1 keeps its original card IDs and storage paths.

## Firebase setup

The app uses the `lernigo-1` public web SDK configuration. Enable Email/Password in Firebase Authentication and add the published hostname to Authentication → Settings → Authorized domains if you use it for Auth redirects.

Enable Cloud Firestore in production mode. In the Firebase console, merge the functions and match blocks from `firestore.rules` inside the existing `match /databases/{database}/documents` block. Preserve rules for other applications and review any broad matching grants that could also reach the Lernigo collections. Publish the result. For a project dedicated to Lernigo, publish the file as-is using `firebase deploy --only firestore:rules --project lernigo-1`.

Each account has an independent private study level, answer history, and per-level quiz score in `wortdeckUsers`. Signed-in learners can opt to list a nickname and their points through Settings; opt-out deletes their ranking entries while preserving their scores. A correctly answered quiz card earns one point per account, with transactional deduplication. Multiple-choice answers are evaluated by the browser, so the leaderboard is for friendly practice. Guest progress and the guest level stay in browser storage.
