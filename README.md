# Lernigo

Lernigo is a German vocabulary study app built with React and Vite. The published site stays private.

## Run locally

Use Node.js 20.19+ on Node 20, or Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Run `npm run build` to create the production site in `dist/`. Run `npm run preview` to serve that build locally. React components are in `src/components/`, vocabulary is in `src/data/`, and the original cheat sheet is in `public/assets/`.

The complete A1 deck comes from the supplied workbook. A1 is the only available study level. The A2–C1 starter decks remain in the source for future use. The A1 PDF is available under Cheat sheet. A1 keeps its original card IDs and storage paths.

## Firebase setup

The app uses the `lernigo-1` public web SDK configuration in `src/firebase-config.js`. Enable Email/Password in Firebase Authentication and add the published hostname to Authentication → Settings → Authorized domains if you use it for Auth redirects.

Enable Cloud Firestore in production mode. In the Firebase console, merge the functions and match blocks from `firestore.rules` inside the existing `match /databases/{database}/documents` block. Preserve rules for other applications and review any broad matching grants that could also reach the Lernigo collections. Publish the result. For a project dedicated to Lernigo, publish the file as-is using `firebase deploy --only firestore:rules --project lernigo-1`.

Each account has an independent private study level, answer history, and per-level quiz score in `wortdeckUsers`. Signed-in learners can opt to list a nickname and their points through Settings; opt-out deletes their ranking entries while preserving their scores. A correctly answered quiz card earns one point per account, with transactional deduplication. Multiple-choice answers are evaluated by the browser, so the leaderboard is for friendly practice. Guests get five A1 practice answers per browser, shared between flashcards and quizzes. Signup collects a first name, last name, and username in the private profile. Email and password remain the sign-in credentials. If Firestore is unavailable, practice opens immediately using this device’s data. Pending profile changes can sync when Firestore is reachable. Answers saved during the fallback stay on that device.

## Multiplayer Game

Publish the updated Firestore rules before deploying the frontend. For a Firebase project shared with other apps, merge the game and leaderboard match blocks into the existing rules, keeping the other apps' rules in place. For a dedicated project, run `firebase deploy --only firestore:rules --project lernigo-1`.

In Firebase Authentication, copy the UID of each account that should be able to host. In Firestore, create a document at `lernigoGameAdmins/<uid>` with the boolean field `enabled` set to `true`. Players sign in with their existing Lernigo accounts. A room takes ten players plus its administering host. The host chooses the question type and 5–60 seconds per question, starts the game, and advances between rounds. The fixed game length is ten rounds. Server-side rules enforce joins, the submission deadline, and one guess per player per question.

The global Leaderboard and Cheat sheet are temporarily locked. Leaderboard rules preserve writes for existing account settings and practice scores. Cheat sheet source assets are kept in `locked-assets/` and excluded from the published site.
