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

The app uses the `lernigo-1` public web SDK configuration in `src/firebase-config.js`. In Firebase Authentication → Sign-in method, enable Email/Password and Google. Select a project support email when enabling Google. Add the published hostname (such as `lernigo.onlylabs.in`) to Authentication → Settings → Authorized domains. Add `localhost` there if you need to test Google sign-in locally.

Enable Cloud Firestore in production mode. In the Firebase console, merge the functions and match blocks from `firestore.rules` inside the existing `match /databases/{database}/documents` block. Preserve rules for other applications and review any broad matching grants that could also reach the Lernigo collections. Publish the result. For a project dedicated to Lernigo, publish the file as-is using `firebase deploy --only firestore:rules --project lernigo-1`.

Each account has an independent private study level, answer history, and per-level quiz score in `wortdeckUsers`. Signed-in learners can opt to list a nickname and their points through Settings; opt-out deletes their ranking entries while preserving their scores. A correctly answered quiz card earns one point per account, with transactional deduplication. Multiple-choice answers are evaluated by the browser, so the leaderboard is for friendly practice. Guests get five A1 practice answers per browser, shared between flashcards and quizzes. Signup collects a first name, last name, and username in the private profile. Google sign-in shows the learner’s name, email, and Lernigo ID. Learners can optionally link an email password to the same Firebase account from the Account dialog. If Firestore is unavailable, practice opens immediately using this device’s data. Pending profile changes can sync when Firestore is reachable. Answers saved during the fallback stay on that device.

## Multiplayer Game

Publish the updated Firestore rules before deploying the frontend. For a Firebase project shared with other apps, merge the game and leaderboard match blocks into the existing rules, keeping the other apps' rules in place. For a dedicated project, run `firebase deploy --only firestore:rules --project lernigo-1`.

Anyone signed in with a Lernigo account can create or join a room. The creator is the host and can change the chapter, question type, 5–60 second timer, and 1–20 round count in the waiting room, start the game, and advance between rounds. A room takes ten guests plus its host and defaults to A1, all chapters, and ten rounds. The host can submit guesses and earn points alongside the guests. Firestore rules restrict settings and host controls to the creator and enforce the player limit, submission deadline, and one guess per player per question.

The global Leaderboard and Cheat sheet are temporarily locked. Leaderboard rules preserve writes for existing account settings and practice scores. Cheat sheet source assets are kept in `locked-assets/` and excluded from the published site.

## Display ad frames

Publish the two files in `ad-frames/` at the root of a dedicated HTTPS origin. Serve the files directly without redirects and keep the ad host separate from the Lernigo app, its authentication, and its cookies. On `lernigo.onlylabs.in`, banners use `https://ads.lernigo.onlylabs.in` by default. Set `VITE_AD_FRAME_ORIGIN` at build time to override the default or configure a preview. The app skips live banners if the configured origin is invalid or matches its own.

On a desktop viewport at least 1160px wide, open Practice and check both banners. On a preview build, add `?showAds=1` before `#practice`. The loader log confirms that the script loaded. Check the banner itself to verify creative delivery. If the host sets a framing policy, allow the Lernigo origin on the ad pages and the ad origin in Lernigo's `frame-src`.
