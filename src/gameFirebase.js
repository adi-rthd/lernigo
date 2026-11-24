import { gameRounds, gameSeats, newRoomCode } from './game.js';

export function gameFirebase(db, store) {
  const roomRef = code => store.doc(db, 'lernigoGameRooms', code);
  const roundRef = (code, round) => store.doc(roomRef(code), 'rounds', String(round));
  const guessRef = (code, round, uid) => store.doc(roundRef(code, round), 'guesses', uid);

  return {
    canHost: async uid => (await store.getDocFromServer(store.doc(db, 'lernigoGameAdmins', uid))).data()?.enabled === true,
    async create(uid, type, seconds) {
      const code = newRoomCode();
      const ref = roomRef(code);
      await store.setDoc(ref, {
        code, host: uid, type, seconds, players: {}, phase: 'lobby', round: 0,
        createdAt: store.serverTimestamp(), startedAt: null,
      });
      return code;
    },
    join: (code, uid, name) => store.runTransaction(db, async transaction => {
      const ref = roomRef(code);
      const room = (await transaction.get(ref)).data();
      if (!room) throw Error('Room code not found.');
      if (room.host === uid || Object.hasOwn(room.players, uid)) return;
      if (room.phase !== 'lobby') throw Error('This game has already started.');
      if (Object.keys(room.players).length >= gameSeats) throw Error('This room already has 10 players.');
      transaction.update(ref, { players: { ...room.players, [uid]: name } });
    }),
    leave: (code, uid) => store.runTransaction(db, async transaction => {
      const ref = roomRef(code);
      const room = (await transaction.get(ref)).data();
      if (!room || room.phase !== 'lobby' || !Object.hasOwn(room.players, uid)) return;
      const players = { ...room.players };
      delete players[uid];
      transaction.update(ref, { players });
    }),
    watchRoom: (code, onRoom, onError) => store.onSnapshot(roomRef(code), snapshot => {
      if (!snapshot.metadata.hasPendingWrites && (snapshot.exists() || !snapshot.metadata.fromCache)) onRoom(snapshot.data());
    }, onError),
    watchRounds: (code, onRounds, onError) => store.onSnapshot(store.collection(roomRef(code), 'rounds'), snapshot => {
      if (!snapshot.metadata.hasPendingWrites) onRounds(Object.fromEntries(snapshot.docs.map(round => [Number(round.id), round.data()])));
    }, onError),
    watchGuess: (code, round, uid, onGuess, onError) => store.onSnapshot(guessRef(code, round, uid), snapshot => {
      if (!snapshot.metadata.hasPendingWrites) onGuess(snapshot.data()?.answer ?? '');
    }, onError),
    async guesses(code, round) {
      const snapshot = await store.getDocsFromServer(store.collection(roundRef(code, round), 'guesses'));
      return Object.fromEntries(snapshot.docs.map(guess => [guess.id, guess.data().answer]));
    },
    start: (code, round, cardId) => {
      const batch = store.writeBatch(db);
      batch.update(roomRef(code), { phase: 'playing', round, startedAt: store.serverTimestamp() });
      batch.set(roundRef(code, round), { cardId, startedAt: store.serverTimestamp() });
      return batch.commit();
    },
    reveal: (code, round) => store.runTransaction(db, async transaction => {
      const ref = roomRef(code);
      const room = (await transaction.get(ref)).data();
      if (room?.phase === 'playing' && room.round === round) {
        transaction.update(ref, { phase: round === gameRounds ? 'finished' : 'results' });
      }
    }),
    guess: (code, round, uid, answer) => store.setDoc(guessRef(code, round, uid), {
      answer, submittedAt: store.serverTimestamp(),
    }),
  };
}
