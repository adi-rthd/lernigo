import { useEffect, useRef, useState } from 'react';
import { correctGuess, gameCards, gamePrompt, gameRounds, gameSeats, gameTypes } from '../game.js';
import { shuffle } from '../study.js';
import { useSound } from '../useSound.js';

const validCode = /^[2-9A-HJ-NP-Z]{6}$/;

function gameError(error) {
  if (error.code === 'permission-denied') return 'Firebase denied this action. The room may have changed, or game permissions may need updating.';
  if (error.code) return 'Couldn’t reach the game room. Check your connection and try again.';
  return error.message;
}

export default function Game({ active, user, online, name, game, cards, onSignIn }) {
  const sound = useSound(active, 'lernigo:game-sound');
  return (
    <section id="game" hidden={!active}>
      <div className="intro">
        <p className="kicker">A1 vocabulary · Multiplayer</p>
        <div className="game-intro-title">
          <h1>Flashcard game</h1>
          {user && game && <button className="outline small" type="button" aria-label="Game sound"
            aria-pressed={sound.enabled} onClick={sound.toggle}>Sound {sound.enabled ? 'on' : 'off'}</button>}
        </div>
        <p>Join a room and guess the German article or English meaning before time runs out.</p>
      </div>
      {!online ? <div className="panel game-panel"><p>Connecting to Lernigo…</p></div>
        : !user ? <div className="panel game-panel"><h2>Sign in to play</h2>
          <button className="primary" type="button" onClick={onSignIn}>Sign in</button></div>
        : !game ? <div className="panel game-panel"><p>Multiplayer is unavailable. Try reloading the page.</p></div>
        : <GameLobby key={user.uid} uid={user.uid} name={name} game={game} cards={cards} sound={sound} />}
    </section>
  );
}

function GameLobby({ uid, name, game, cards, sound }) {
  const [roomCode, setRoomCode] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState(null);
  const displayName = nickname ?? name ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function openRoom(event, action) {
    event.preventDefault();
    sound.unlock?.();
    setBusy(true);
    setError('');
    try {
      setRoomCode(await action());
    } catch (error) {
      setError(gameError(error));
    } finally {
      setBusy(false);
    }
  }

  if (roomCode) return <GameRoom key={roomCode} {...{ uid, game, cards }} code={roomCode} playSound={sound.play}
    onExit={() => { setCode(roomCode); setRoomCode(''); }} />;

  return (
    <div className="game-lobby">
      <form className="panel game-panel" onSubmit={event => void openRoom(event, async () => {
        const trimmed = displayName.trim();
        if (!trimmed) throw Error('Enter a display name.');
        await game.join(code, uid, trimmed);
        return code;
      })}>
        <h2>Join a room</h2>
        <label className="field">Room code
          <input name="code" value={code} onChange={event => setCode(event.target.value.toUpperCase().trim())}
            autoCapitalize="characters" autoComplete="off" maxLength={6} required />
        </label>
        <label className="field">Display name
          <input value={displayName} onChange={event => setNickname(event.target.value)}
            maxLength={24} autoComplete="nickname" required />
        </label>
        <button className="primary" disabled={busy || !validCode.test(code)} type="submit">Join room</button>
      </form>
      <RoomSettingsForm title="Create a room" submitLabel="Create room" busy={busy}
        onSubmit={(event, type, seconds) => void openRoom(event, () => game.create(uid, type, seconds))} />
      {error && <p className="game-error" role="status">{error}</p>}
    </div>
  );
}

function RoomSettingsForm({ title, submitLabel, busy, onSubmit, room, onStart }) {
  const [type, setType] = useState(room?.type ?? 'mixed');
  const [seconds, setSeconds] = useState(room?.seconds ?? 10);
  const changed = !room || type !== room.type || seconds !== room.seconds;

  return (
    <form className="panel game-panel" onSubmit={event => onSubmit(event, type, seconds)}>
      <h2>{title}</h2>
      <label className="field">Question type
        <select value={type} disabled={busy} onChange={event => setType(event.target.value)}>
          {Object.entries(gameTypes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label className="field">Seconds per question
        <input type="number" min={5} max={60} step={1} value={seconds} disabled={busy}
          onChange={event => setSeconds(event.target.value === '' ? '' : Number(event.target.value))} required />
      </label>
      <div className="game-answer">
        <button className={room ? 'outline' : 'primary'} type="submit" disabled={busy || !changed}>{submitLabel}</button>
        {room && <button className="primary" type="button" onClick={onStart}
          disabled={busy || changed || !Object.keys(room.players).length}>Start game</button>}
      </div>
    </form>
  );
}

function GameRoom({ code, uid, game, cards, playSound, onExit }) {
  const [room, setRoom] = useState(null);
  const [rounds, setRounds] = useState({});
  const [results, setResults] = useState({});
  const [resultsRetry, setResultsRetry] = useState(0);
  const [resultsError, setResultsError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const soundedRound = useRef(0);
  const host = room?.host === uid;
  const revealed = room?.phase === 'playing' ? room.round - 1 : room?.round ?? 0;
  const roundCard = cards.find(card => card.id === rounds[room?.round]?.cardId);
  const prompt = roundCard && gamePrompt(roundCard, room.type, room.round);
  const roundGuesses = results[room?.round];
  const answers = prompt?.answers;

  useEffect(() => {
    if (!roundGuesses || !answers || soundedRound.current >= revealed) return;
    soundedRound.current = revealed;
    const guess = roundGuesses[uid];
    playSound(guess ? (correctGuess(guess, answers) ? 'correct' : 'incorrect') : 'time');
  }, [answers, playSound, revealed, roundGuesses, uid]);

  useEffect(() => {
    const failed = error => setConnectionError(gameError(error));
    const endRoom = game.watchRoom(code, next => {
      if (next) {
        setRoom(next);
        setConnectionError('');
      } else setConnectionError('This room couldn’t be found.');
    }, failed);
    const endRounds = game.watchRounds(code, setRounds, failed);
    return () => { endRoom(); endRounds(); };
  }, [code, game]);

  useEffect(() => {
    const missing = Array.from({ length: revealed }, (_, index) => index + 1).filter(round => !Object.hasOwn(results, round));
    if (!missing.length) return;
    let current = true;
    Promise.all(missing.map(async round => [round, await game.guesses(code, round)])).then(guesses => {
      if (current) {
        setResults(previous => ({ ...previous, ...Object.fromEntries(guesses) }));
        setResultsError('');
      }
    }).catch(error => { if (current) setResultsError(gameError(error)); });
    return () => { current = false; };
  }, [code, game, results, resultsRetry, revealed]);

  async function perform(action) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setError(gameError(error));
    } finally {
      setBusy(false);
    }
  }

  function start() {
    const next = room.round + 1;
    const used = new Set(Object.values(rounds).map(round => round.cardId));
    const card = shuffle(gameCards(cards, room.type, next).filter(card => !used.has(card.id)))[0];
    if (!card) {
      setError('There are no more words for this question type.');
      return;
    }
    void perform(() => game.start(code, next, card.id, room.type));
  }

  if (connectionError || !room) {
    return <div className="panel game-panel">
      <p role="status">{connectionError || 'Joining room…'}</p>
      <button className="outline" type="button" onClick={onExit}>Back to Game</button>
    </div>;
  }

  const players = Object.entries(room.players);
  const currentRound = rounds[room.round];
  const scores = [[room.host, 'Host'], ...players].map(([player, name]) => {
    let points = 0;
    for (const [index, guesses] of Object.entries(results)) {
      const card = cards.find(card => card.id === rounds[index]?.cardId);
      if (card && correctGuess(guesses[player], gamePrompt(card, room.type, Number(index)).answers)) points += 1;
    }
    return { player, name, points };
  }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  return (
    <div className="game-room">
      <div className="panel game-panel game-room-heading">
        <div><h2>Room <span className="game-code">{code}</span></h2>
          <p>{gameTypes[room.type]} · {room.seconds}s per question · {players.length}/{gameSeats} guests + host</p></div>
        <button className="outline small" type="button" disabled={busy} onClick={() => void perform(async () => {
          if (!host && room.phase === 'lobby') await game.leave(code, uid);
          onExit();
        })}>Leave room</button>
      </div>

      {room.phase === 'lobby' && <div className="panel game-panel">
        <h2>Waiting room</h2>
        <p>{host ? 'Share the room code, then start when everyone is ready.' : 'The host will start the game.'}</p>
        {!!players.length && <ul className="game-players">{players.map(([id, name]) => <li key={id}>{name}</li>)}</ul>}
      </div>}

      {host && room.phase === 'lobby' && <RoomSettingsForm key={room.type + ':' + room.seconds}
        title="Room settings" submitLabel="Save settings" busy={busy} room={room} onStart={start}
        onSubmit={(event, type, seconds) => {
          event.preventDefault();
          void perform(() => game.updateSettings(code, type, seconds));
        }} />}

      {room.phase === 'playing' && (prompt
        ? <TimedRound key={room.round} {...{ room, prompt, code, uid, game, playSound }} />
        : <div className="panel game-panel"><p role="status">Loading the question…</p></div>)}

      {(room.phase === 'results' || room.phase === 'finished') && <div className="panel game-panel">
        <h2>{room.phase === 'finished' ? 'Game complete' : 'Round ' + room.round + ' results'}</h2>
        {prompt && <p><strong>{prompt.word}</strong> · {prompt.answers.replaceAll(' | ', ' / ')}</p>}
        {resultsError ? <p role="status">{resultsError} <button className="text-button" type="button"
          onClick={() => setResultsRetry(value => value + 1)}>Retry scores</button></p>
          : Object.keys(results).length < revealed || !prompt ? <p role="status">Loading scores…</p>
          : <ol className="game-scores">{scores.map(({ player, name, points }) => {
            const guess = results[room.round]?.[player];
            return <li key={player}><span><strong>{name}</strong>
              <small>{guess ? (correctGuess(guess, prompt.answers) ? 'Correct · ' : 'Incorrect · ') + guess : 'No answer'}</small>
            </span><span>{points} {points === 1 ? 'point' : 'points'}</span></li>;
          })}</ol>}
        {room.phase === 'results' && (host
          ? <button className="primary" type="button" onClick={start} disabled={busy || !currentRound}>Next round</button>
          : <p>Waiting for the host to start the next round.</p>)}
      </div>}

      {error && <p className="game-error" role="status">{error}</p>}
    </div>
  );
}

function TimedRound({ room, prompt, code, uid, game, playSound }) {
  const [now, setNow] = useState(Date.now);
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastCountdown = useRef(null);
  const deadline = room.startedAt.toMillis() + room.seconds * 1000;
  const remaining = Math.max(0, Math.min(room.seconds, Math.ceil((deadline - now) / 1000)));

  useEffect(() => {
    const previous = lastCountdown.current;
    lastCountdown.current = remaining;
    if (previous === null && remaining > 3) playSound('start');
    if (remaining > 0 && remaining <= 3 && (previous === null || remaining < previous)) playSound('tick');
  }, [playSound, remaining]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return game.watchGuess(code, room.round, uid, answer => { if (answer) setSubmitted(answer); },
      error => setError(gameError(error)));
  }, [code, game, room.round, uid]);

  useEffect(() => {
    if (remaining) return;
    let current = true;
    let timer;
    async function reveal(attempts) {
      try {
        await game.reveal(code, room.round);
      } catch (error) {
        if (!current) return;
        if (attempts) timer = setTimeout(() => void reveal(attempts - 1), 1000);
        else setError(gameError(error));
      }
    }
    timer = setTimeout(() => void reveal(4), 300);
    return () => { current = false; clearTimeout(timer); };
  }, [code, game, remaining, room.round]);

  async function submit(event) {
    event.preventDefault();
    const answer = guess.trim();
    if (!answer || submitted || busy || !remaining) return;
    setBusy(true);
    setError('');
    try {
      await game.guess(code, room.round, uid, answer);
      setSubmitted(answer);
    } catch (error) {
      setError(error.code === 'permission-denied' ? 'This guess was rejected. Time may have run out or you already answered.' : gameError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel game-panel game-round">
      <div className="session-line"><h2>Round {room.round} of {gameRounds}</h2><strong>{remaining}s left</strong></div>
      <progress value={remaining} max={room.seconds} aria-label="Round time remaining" />
      <p className="game-word" lang="de">{prompt.word}</p>
      <p>{prompt.instruction}</p>
      {!remaining ? <p role="status">Time’s up. Loading results…</p>
        : submitted ? <p role="status">Guess saved. Results appear when time runs out.</p>
        : <form className="game-answer" onSubmit={submit}>
          <label className="field">Your guess
            <input value={guess} onChange={event => setGuess(event.target.value)} maxLength={120}
              autoComplete="off" disabled={busy} required />
          </label>
          <button className="primary" type="submit" disabled={busy || !guess.trim()}>{busy ? 'Submitting…' : 'Submit guess'}</button>
        </form>}
      {error && <p className="game-error" role="status">{error}{!remaining && <button className="text-button" type="button"
        onClick={() => void game.reveal(code, room.round).catch(error => setError(gameError(error)))}>Retry results</button>}</p>}
    </div>
  );
}
