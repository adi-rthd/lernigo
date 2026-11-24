import config from './firebase-config.js';
import { levels } from './study.js';

export const configured = Boolean(config?.apiKey && config?.projectId && config?.appId);

export async function connectFirebase() {
  const [app, auth, store] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);
  const firebase = app.getApps().length ? app.getApp() : app.initializeApp(config);
  const accounts = auth.getAuth(firebase);
  const db = store.getFirestore(firebase);
  const profileRef = uid => store.doc(db, 'wortdeckUsers', uid);
  const cardCollection = uid => store.collection(profileRef(uid), 'cards');
  const scoreRef = (uid, level) => store.doc(profileRef(uid), 'scores', level);
  const boardCollection = level => store.collection(db, 'lernigoLeaderboards', level, 'entries');
  const boardRef = (uid, level) => store.doc(boardCollection(level), uid);

  function watch(target, read, onResult, onError, includeCacheStatus = false) {
    return store.onSnapshot(target, { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.metadata.fromCache) onResult(read(snapshot), true);
      else if (includeCacheStatus) onResult(undefined, false);
    }, onError);
  }

  return {
    observeUser: (onUser, onError) => auth.onAuthStateChanged(accounts, onUser, onError),
    signIn: (email, password) => auth.signInWithEmailAndPassword(accounts, email, password),
    register: (email, password) => auth.createUserWithEmailAndPassword(accounts, email, password),
    reset: email => auth.sendPasswordResetEmail(accounts, email),
    signOut: () => auth.signOut(accounts),
    watch: (uid, onProgress, onError) => watch(cardCollection(uid),
      snapshot => Object.fromEntries(snapshot.docs.map(doc => {
        const { updatedAt, ...data } = doc.data();
        return [doc.id, { ...data, at: updatedAt?.toMillis() ?? 0 }];
      })), onProgress, onError, true),
    watchProfile: (uid, onProfile, onError) => watch(profileRef(uid), snapshot => snapshot.data(), onProfile, onError, true),
    watchLeaderboard: (level, onBoard, onError) => watch(
      store.query(boardCollection(level), store.orderBy('points', 'desc'), store.limit(25)),
      snapshot => snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })), onBoard, onError,
    ),
    saveProfile: (uid, settings) => store.runTransaction(db, async transaction => {
      const ref = profileRef(uid);
      const previous = (await transaction.get(ref)).data();
      const scores = settings.listed
        ? await Promise.all(levels.map(level => transaction.get(scoreRef(uid, level))))
        : [];
      transaction.set(ref, settings);
      if (settings.listed) {
        for (const score of scores) {
          if (score.exists()) transaction.set(boardRef(uid, score.id), { alias: settings.alias, points: score.data().points });
        }
      } else if (previous?.listed) {
        for (const level of levels) transaction.delete(boardRef(uid, level));
      }
    }),
    grade: (uid, card, result, inQuiz) => {
      const ref = store.doc(cardCollection(uid), card.id);
      return store.runTransaction(db, async transaction => {
        const previous = (await transaction.get(ref)).data();
        if (inQuiz && result === 'right') {
          const marker = store.doc(profileRef(uid), 'quizSolved', card.id);
          if (!(await transaction.get(marker)).exists()) {
            const score = scoreRef(uid, card.level);
            const [total, profile] = await Promise.all([transaction.get(score), transaction.get(profileRef(uid))]);
            const points = (total.data()?.points ?? 0) + 1;
            transaction.set(marker, { level: card.level });
            transaction.set(score, { points, cardId: card.id });
            if (profile.data()?.listed) {
              transaction.set(boardRef(uid, card.level), { points, alias: profile.data().alias });
            }
          }
        }
        transaction.set(ref, {
          right: (previous?.right ?? 0) + Number(result === 'right'),
          wrong: (previous?.wrong ?? 0) + Number(result === 'wrong'),
          last: result,
          updatedAt: store.serverTimestamp(),
        });
      });
    },
  };
}
