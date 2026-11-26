import { GameError, gameRounds, gameSeats, maxGameRounds, newRoomCode, roomSettings } from './game.js';

export function gameFirebase(db, store) {
  const roomRef = code => store.doc(db, 'lernigoGameRooms', code);
  const hostedRoomRef = uid => store.doc(db, 'lernigoHostedRooms', uid);
  const rooms = () => store.collection(db, 'lernigoGameRooms');
  // Existing rooms may contain rounds from previous games.
  const roundOffset = match => match * 20;
  const roundRef = (code, round) => store.doc(roomRef(code), 'rounds', String(round));
  const guessRef = (code, round, uid) => store.doc(roundRef(code, round), 'guesses', uid);

  return {
    async create(uid, { type, seconds, chapter, totalRounds }) {
      const hosted = hostedRoomRef(uid);
      const existing = (await store.getDocFromServer(hosted)).data();
      const ownedRooms = existing ? null
        : await store.getDocsFromServer(store.query(rooms(), store.where('host', '==', uid)));
      const latest = ownedRooms?.docs.sort((a, b) =>
        b.data().createdAt.toMillis() - a.data().createdAt.toMillis() || a.id.localeCompare(b.id))[0];
      const code = newRoomCode();
      return store.runTransaction(db, async transaction => {
        const saved = (await transaction.get(hosted)).data();
        const currentCode = saved?.code ?? latest?.id;
        if (currentCode) {
          const current = (await transaction.get(roomRef(currentCode))).data();
          if (current && current.phase !== 'finished') {
            if (!saved) transaction.set(hosted, { code: currentCode });
            return currentCode;
          }
        }

        transaction.set(roomRef(code), {
          code, host: uid, type, seconds,
          ...(chapter === 0 ? {} : { chapter }),
          ...(totalRounds === gameRounds ? {} : { totalRounds }),
          players: {}, phase: 'lobby', round: 0,
          createdAt: store.serverTimestamp(), startedAt: null,
        });
        transaction.set(hosted, { code });
        return code;
      }).catch(async error => {
        if (error.code !== 'permission-denied') throw error;
        // Another tab can replace the finished room before this write reaches the rules.
        const saved = (await store.getDocFromServer(hosted)).data();
        if (saved && saved.code !== existing?.code) {
          const current = (await store.getDocFromServer(roomRef(saved.code))).data();
          if (current && current.phase !== 'finished') return saved.code;
        }
        throw error;
      });
    },
    join: (code, uid, name) => store.runTransaction(db, async transaction => {
      const ref = roomRef(code);
      const room = (await transaction.get(ref)).data();
      if (!room) throw new GameError('Room code not found.');
      if (room.host === uid || Object.hasOwn(room.players, uid)) return;
      if (room.phase !== 'lobby') throw new GameError('This game has already started.');
      if (Object.keys(room.players).length >= gameSeats) throw new GameError('This room already has 10 players.');
      transaction.update(ref, { players: { ...room.players, [uid]: name } });
    }),
    removePlayer: (code, uid) => store.runTransaction(db, async transaction => {
      const ref = roomRef(code);
      const room = (await transaction.get(ref)).data();
      if (!room || room.host === uid || !Object.hasOwn(room.players, uid)) return;
      const players = { ...room.players };
      delete players[uid];
      transaction.update(ref, { players });
    }),
    watchRoom: (code, onRoom, onError) => store.onSnapshot(roomRef(code), snapshot => {
      if (!snapshot.metadata.hasPendingWrites && (snapshot.exists() || !snapshot.metadata.fromCache)) onRoom(snapshot.data());
    }, onError),
    watchRounds: (code, match, onRounds, onError) => {
      const offset = roundOffset(match);
      const ids = Array.from({ length: maxGameRounds }, (_, index) => String(offset + index + 1));
      const query = store.query(store.collection(roomRef(code), 'rounds'), store.where(store.documentId(), 'in', ids));
      return store.onSnapshot(query, snapshot => {
        if (!snapshot.metadata.hasPendingWrites) {
          onRounds(Object.fromEntries(snapshot.docs.map(round => [Number(round.id) - offset, round.data()])));
        }
      }, onError);
    },
    watchGuess: (code, match, round, uid, onGuess, onError) => store.onSnapshot(guessRef(code, roundOffset(match) + round, uid), snapshot => {
      if (!snapshot.metadata.hasPendingWrites) onGuess(snapshot.data()?.answer ?? '');
    }, onError),
    async guesses(code, match, round) {
      const snapshot = await store.getDocsFromServer(store.collection(roundRef(code, roundOffset(match) + round), 'guesses'));
      return Object.fromEntries(snapshot.docs.map(guess => [guess.id, guess.data()]));
    },
    updateSettings: (code, { type, seconds, chapter, totalRounds }, room) => {
      const previous = roomSettings(room);
      const settings = { type, seconds, chapter, totalRounds };
      const changes = Object.entries(settings).filter(([key, value]) => value !== previous[key]);
      if (changes.length) return store.updateDoc(roomRef(code), Object.fromEntries(changes));
    },
    start: (code, match, round, cardId, settings) => store.runTransaction(db, async transaction => {
      const ref = roomRef(code);
      const room = (await transaction.get(ref)).data();
      if (!room || (room.gameNumber ?? 0) !== match || !['lobby', 'results'].includes(room.phase) || room.round + 1 !== round) {
        throw new GameError('The room has changed. Try again.');
      }
      const current = roomSettings(room);
      if (round > current.totalRounds || Object.keys(current).some(key => current[key] !== settings[key])) {
        throw new GameError('Room settings changed. Refresh them before starting the round.');
      }
      transaction.update(ref, { phase: 'playing', round, startedAt: store.serverTimestamp() });
      transaction.set(roundRef(code, roundOffset(match) + round), { cardId, startedAt: store.serverTimestamp() });
    }),
    end: (code, match) => store.runTransaction(db, async transaction => {
      const ref = roomRef(code);
      const room = (await transaction.get(ref)).data();
      if (!room || (room.gameNumber ?? 0) !== match || room.phase === 'lobby') {
        throw new GameError('The room has changed. Try again.');
      }
      if (room.phase === 'playing' || room.phase === 'results') {
        transaction.update(ref, { phase: 'finished' });
      }
    }),
    reveal: (code, match, round) => store.runTransaction(db, async transaction => {
      const ref = roomRef(code);
      const room = (await transaction.get(ref)).data();
      if (room?.phase === 'playing' && (room.gameNumber ?? 0) === match && room.round === round) {
        transaction.update(ref, { phase: round === roomSettings(room).totalRounds ? 'finished' : 'results' });
      }
    }),
    guess: (code, match, round, uid, answer) => store.setDoc(guessRef(code, roundOffset(match) + round, uid), {
      answer, submittedAt: store.serverTimestamp(),
    }),
  };
}
