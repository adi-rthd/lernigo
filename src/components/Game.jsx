import { useCallback, useEffect, useRef, useState } from 'react';
import { GameError, correctGuess, gameCards, gamePrompt, gameChapters, gameScores, gameSeats, gameTypes, maxGameRounds, roomSettings } from '../game.js';
import { shuffle } from '../study.js';

const validCode = /^[2-9A-HJ-NP-Z]{6}$/;

function gameError(error, fallback) {
  if (error instanceof GameError) return error.message;
  if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') {
    return 'Check your internet connection and try again.';
  }
  return fallback;
}

export default function Game({ active, user, online, name, game, cards, sound, onSignIn }) {
  return (
    <section id="game" hidden={!active}>
      <div className="intro">
        <p className="kicker">A1 vocabulary · Multiplayer</p>
        <h1>Flashcard game</h1>
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
  const { play, unlock } = sound;
  const playSound = useCallback(cue => play(cue, 'game'), [play]);
  const [roomCode, setRoomCode] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState(null);
  const displayName = nickname ?? name ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function openRoom(event, action, fallback) {
    event.preventDefault();
    unlock?.();
    setBusy(true);
    setError('');
    try {
      setRoomCode(await action());
    } catch (error) {
      setError(gameError(error, fallback));
    } finally {
      setBusy(false);
    }
  }

  if (roomCode) return <GameRoom key={roomCode} {...{ uid, game, cards }} code={roomCode} playSound={playSound}
    onOpen={setRoomCode} onExit={() => { setCode(''); setRoomCode(''); }} />;

  return (
    <div className="game-lobby">
      <form className="panel game-panel" onSubmit={event => void openRoom(event, async () => {
        const trimmed = displayName.trim();
        if (!trimmed) throw new GameError('Enter a display name.');
        await game.join(code, uid, trimmed);
        return code;
      }, 'Couldn’t join the room. Check the room code and try again.')}>
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
      <RoomSettingsForm title="Host a room" submitLabel="Open game room" busy={busy}
        onSubmit={(event, settings) => void openRoom(event, () => game.create(uid, settings), 'Couldn’t open your room. Please try again.')} />
      {error && <p className="game-error" role="status">{error}</p>}
    </div>
  );
}

function RoomSettingsForm({ title, submitLabel, busy, onSubmit, room, onStart }) {
  const defaults = roomSettings(room);
  const [settings, setSettings] = useState(defaults);
  const { level, chapter, type, seconds, totalRounds } = settings;
  const changed = !room || Object.keys(defaults).some(key => settings[key] !== defaults[key]);
  const hasGuests = room && Object.keys(room.players).length > 0;

  function submit(event) {
    if (event.nativeEvent.submitter?.value === 'start') {
      event.preventDefault();
      if (!busy && hasGuests) onStart(settings);
      return;
    }
    if (!busy && changed) onSubmit(event, settings);
    else event.preventDefault();
  }

  function change(key, value) {
    setSettings(previous => ({ ...previous, [key]: value }));
  }

  return (
    <form className="panel game-panel" onSubmit={submit}>
      <h2>{title}</h2>
      {!room && <p>Finished games get a new room code.</p>}
      <label className="field">German level
        <select value={level} disabled><option value="A1">A1</option></select>
      </label>
      <label className="field">Chapter
        <select value={chapter} disabled={busy} onChange={event => change('chapter', Number(event.target.value))}>
          <option value={0}>All chapters</option>
          {gameChapters.map(number => <option key={number} value={number}>Chapter {number}</option>)}
        </select>
      </label>
      <label className="field">Question type
        <select value={type} disabled={busy} onChange={event => change('type', event.target.value)}>
          {Object.entries(gameTypes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label className="field">Seconds per question
        <input type="number" min={5} max={60} step={1} value={seconds} disabled={busy}
          onChange={event => change('seconds', event.target.value === '' ? '' : Number(event.target.value))} required />
      </label>
      <label className="field">Number of rounds
        <input type="number" min={1} max={maxGameRounds} step={1} value={totalRounds} disabled={busy}
          onChange={event => change('totalRounds', event.target.value === '' ? '' : Number(event.target.value))} required />
      </label>
      <div className="game-answer">
        <button className={room ? 'outline' : 'primary'} type="submit" disabled={busy || !changed}>{submitLabel}</button>
        {room && <button className="primary" type="submit" value="start"
          disabled={busy || !hasGuests}>Start game</button>}
      </div>
      {room && !hasGuests && <p>At least one guest must join before you can start.</p>}
    </form>
  );
}

function GameRoom({ code, uid, game, cards, playSound, onOpen, onExit }) {
  const [room, setRoom] = useState(null);
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => game.watchRoom(code, next => {
    if (next) {
      setRoom(next);
      setConnectionError('');
    } else {
      setConnectionError('This room couldn’t be found.');
    }
  }, error => setConnectionError(gameError(error, 'Couldn’t load this room. Go back to Game and try joining again.'))), [code, game]);

  const removed = room && room.host !== uid && !Object.hasOwn(room.players, uid);
  if (removed || connectionError || !room) {
    return <div className="panel game-panel">
      <p role="status">{removed ? 'You were removed from the room.' : connectionError || 'Joining room…'}</p>
      <button className="outline" type="button" onClick={onExit}>Back to Game</button>
    </div>;
  }

  const match = room.gameNumber ?? 0;
  return <RoomMatch key={match} {...{ code, uid, game, cards, playSound, onOpen, onExit, room, match }} />;
}

function RoomMatch({ code, uid, game, cards, playSound, onOpen, onExit, room, match }) {
  const [rounds, setRounds] = useState({});
  const [results, setResults] = useState({});
  const [resultsRetry, setResultsRetry] = useState(0);
  const [resultsError, setResultsError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const soundedRound = useRef(0);
  const host = room.host === uid;
  const revealed = room.phase === 'playing' ? room.round - 1 : room.round;
  const roundCard = cards.find(card => card.id === rounds[room.round]?.cardId);
  const prompt = roundCard && gamePrompt(roundCard, room.type, room.round);
  const roundGuesses = results[room.round];
  const answers = prompt?.answers;

  useEffect(() => {
    if (!roundGuesses || !answers || soundedRound.current >= revealed) return;
    soundedRound.current = revealed;
    const guess = roundGuesses[uid]?.answer;
    playSound(guess ? (correctGuess(guess, answers) ? 'correct' : 'incorrect') : 'time');
  }, [answers, playSound, revealed, roundGuesses, uid]);

  useEffect(() => game.watchRounds(code, match, setRounds,
    error => setError(gameError(error, 'Couldn’t load the rounds. Go back to Game and reopen the room.'))),
  [code, game, match]);

  useEffect(() => {
    const missing = Array.from({ length: revealed }, (_, index) => index + 1).filter(round => !Object.hasOwn(results, round));
    if (!missing.length) return;
    let current = true;
    Promise.all(missing.map(async round => [round, await game.guesses(code, match, round)])).then(guesses => {
      if (current) {
        setResults(previous => ({ ...previous, ...Object.fromEntries(guesses) }));
        setResultsError('');
      }
    }).catch(error => { if (current) setResultsError(gameError(error, 'Couldn’t load the scores.')); });
    return () => { current = false; };
  }, [code, game, match, results, resultsRetry, revealed]);

  async function perform(action, fallback) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setError(gameError(error, fallback));
    } finally {
      setBusy(false);
    }
  }

  function start(settings = roomSettings(room)) {
    const next = room.round + 1;
    const used = new Set(Object.values(rounds).map(round => round.cardId));
    const card = shuffle(gameCards(cards, settings.type, next, settings.chapter).filter(card => !used.has(card.id)))[0];
    if (!card) {
      setError('There are no more words for this question type.');
      return;
    }
    void perform(async () => {
      if (room.phase === 'lobby') await game.updateSettings(code, settings, room);
      await game.start(code, match, next, card.id, settings);
    }, 'Couldn’t start the game. Please try again.');
  }

  const { level, chapter, totalRounds } = roomSettings(room);
  const players = Object.entries(room.players);
  const currentRound = rounds[room.round];
  const scores = gameScores(room, cards, rounds, results);

  return (
    <div className="game-room">
      <div className="panel game-panel game-room-heading">
        <div><h2>Room <span className="game-code">{code}</span></h2>
          <p>{level} · {chapter ? `Chapter ${chapter}` : 'All chapters'} · {totalRounds} {totalRounds === 1 ? 'round' : 'rounds'}</p>
          <p>{gameTypes[room.type]} · {room.seconds}s per question · {players.length}/{gameSeats} guests + host</p></div>
        <button className="outline small" type="button" disabled={busy} onClick={() => void perform(async () => {
          if (!host && room.phase === 'finished') {
            onExit();
            void game.removePlayer(code, uid).catch(() => {});
            return;
          }
          if (!host) await game.removePlayer(code, uid);
          onExit();
        }, 'Couldn’t leave the room. Please try again.')}>Leave room</button>
      </div>

      {room.phase === 'lobby' && <div className="panel game-panel">
        <h2>Waiting room</h2>
        <p>{host ? 'Share the room code, then start when everyone is ready.' : 'The host will start the game.'}</p>
        {!!players.length && <ul className="game-players">
          {players.map(([id, name]) => <li key={id}>
            <span>{name}</span>
            {host && <button className="text-button" type="button" disabled={busy} aria-label={`Remove ${name}`}
              onClick={() => void perform(() => game.removePlayer(code, id), 'Couldn’t remove the guest. Please try again.')}>
              Remove
            </button>}
          </li>)}
        </ul>}
      </div>}

      {host && room.phase === 'lobby' && <RoomSettingsForm key={JSON.stringify(roomSettings(room))}
        title="Room settings" submitLabel="Save settings" busy={busy} room={room} onStart={start}
        onSubmit={(event, settings) => {
          event.preventDefault();
          void perform(() => game.updateSettings(code, settings, room), 'Couldn’t save these settings. Please try again.');
        }} />}

      {room.phase === 'playing' && (prompt
        ? <TimedRound key={room.round} {...{ room, match, prompt, code, uid, game, playSound }} />
        : <div className="panel game-panel"><p role="status">Loading the question…</p></div>)}

      {(room.phase === 'results' || room.phase === 'finished') && (
        <RoundResults key={room.round} {...{ room, prompt, resultsError, roundGuesses, scores, uid }}
          loading={Object.keys(results).length < revealed || !prompt}
          onRetry={() => setResultsRetry(value => value + 1)}
          onNext={host ? room.phase === 'finished'
            ? () => void perform(async () => {
              onOpen(await game.create(uid, roomSettings(room)));
            }, 'Couldn’t open the next game. Please try again.')
            : () => start() : null} nextDisabled={busy || (room.phase !== 'finished' && !currentRound)} />
      )}

      {error && <p className="game-error" role="status">{error}</p>}
    </div>
  );
}

const outcomes = {
  correct: { icon: '🎯', title: 'Correct!', label: 'Correct' },
  incorrect: { icon: '💡', title: 'Not quite', label: 'Incorrect' },
  missed: { icon: '⏱️', title: 'Time’s up', label: 'No guess' },
};

function roundOutcome(guess, answers) {
  if (!guess) return 'missed';
  return correctGuess(guess, answers) ? 'correct' : 'incorrect';
}

function RoundResults({ room, prompt, resultsError, roundGuesses, scores, uid, loading, onRetry, onNext, nextDisabled }) {
  const finished = room.phase === 'finished';
  const ready = !resultsError && !loading && !!roundGuesses;
  const guess = roundGuesses?.[uid]?.answer;
  const outcome = ready ? roundOutcome(guess, prompt.answers) : null;

  return (
    <div className="panel game-panel game-results">
      <div className="game-results-hero" data-outcome={outcome} aria-live="polite">
        <p className="game-results-round">{finished ? 'Game complete' : `Round ${room.round} of ${roomSettings(room).totalRounds}`}</p>
        {outcome && <span className="game-outcome-icon" aria-hidden="true">{outcomes[outcome].icon}</span>}
        <h2>{outcome ? outcomes[outcome].title : 'Round results'}</h2>
        {guess && ready && <p className="game-your-guess">You guessed <strong>{guess}</strong></p>}
      </div>

      {prompt && <div className="game-correct-answer">
        <p>Correct answer</p>
        <strong lang="de">{prompt.word}</strong>
        <span>{prompt.answers.replaceAll(' | ', ' / ')}</span>
      </div>}

      {resultsError ? <p role="status">{resultsError} <button className="text-button" type="button" onClick={onRetry}>Retry scores</button></p>
        : !ready ? <p role="status">Loading scores…</p>
        : <div className="game-scoreboard">
          <h3>Scoreboard</h3>
          <p className="game-score-rule">One point per correct answer. Faster correct answers break ties.</p>
          <ol className="game-scores">{scores.map(({ player, name, points }) => {
            const playerGuess = roundGuesses[player]?.answer;
            const playerOutcome = roundOutcome(playerGuess, prompt.answers);
            return <li key={player} data-outcome={playerOutcome}>
              <span className="game-score-player">
                <strong>{name}{player === uid && <span className="game-you"> (you)</span>}</strong>
                <small>{outcomes[playerOutcome].label}{playerGuess && ' · ' + playerGuess}</small>
              </span>
              <span className="game-score-points">{points} {points === 1 ? 'point' : 'points'}</span>
            </li>;
          })}</ol>
        </div>}

      {onNext
        ? <button className="primary game-next-round" type="button" onClick={onNext} disabled={nextDisabled}>
          {finished ? 'Next: Room settings' : 'Next round'}
        </button>
        : !finished && <p className="game-waiting" role="status">Waiting for the host to start the next round.</p>}
    </div>
  );
}

function TimedRound({ room, match, prompt, code, uid, game, playSound }) {
  const [now, setNow] = useState(Date.now);
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastCountdown = useRef(null);
  const submitting = useRef(false);
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
    return game.watchGuess(code, match, room.round, uid, answer => { if (answer) setSubmitted(answer); },
      error => setError(gameError(error, 'Couldn’t check your guess.')));
  }, [code, game, match, room.round, uid]);

  useEffect(() => {
    if (remaining) return;
    let current = true;
    let timer;
    async function reveal(attempts) {
      try {
        await game.reveal(code, match, room.round);
      } catch (error) {
        if (!current) return;
        if (attempts) timer = setTimeout(() => void reveal(attempts - 1), 1000);
        else setError(gameError(error, 'Couldn’t show the round results.'));
      }
    }
    timer = setTimeout(() => void reveal(4), 300);
    return () => { current = false; clearTimeout(timer); };
  }, [code, game, match, remaining, room.round]);

  async function submit(answer) {
    if (!answer || submitted || submitting.current || Date.now() >= deadline) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await game.guess(code, match, room.round, uid, answer);
      setSubmitted(answer);
    } catch (error) {
      setError(gameError(error, Date.now() >= deadline
        ? 'Time ran out before your guess could be saved.'
        : 'Couldn’t save your guess. Try again while there’s time left.'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="panel game-panel game-round">
      <div className="session-line"><h2>Round {room.round} of {roomSettings(room).totalRounds}</h2><strong className="game-clock" data-urgent={remaining > 0 && remaining <= 3 || undefined}>{remaining}s left</strong></div>
      <progress value={remaining} max={room.seconds} aria-label="Round time remaining" />
      <p className="game-word" lang="de">{prompt.word}</p>
      <p>{prompt.instruction}</p>
      {!remaining ? <div className="game-guess-state" role="status"><strong>⏱️ Time’s up</strong><span>Loading round results…</span></div>
        : submitted ? <div className="game-guess-state" role="status">
          <strong><span aria-hidden="true">🔒 </span>Guess locked in</strong>
          <span>You guessed <b>{submitted}</b></span>
          <span>Results appear when the timer ends.</span>
        </div>
        : prompt.choices ? <div className="game-article-options" role="group" aria-label="German articles">
          {prompt.choices.map(article => <button className="outline" key={article} type="button" lang="de"
            disabled={busy} onClick={() => void submit(article)}>{article}</button>)}
        </div>
        : <form className="game-answer" onSubmit={event => {
          event.preventDefault();
          void submit(guess.trim());
        }}>
          <label className="field">Your guess
            <input value={guess} onChange={event => setGuess(event.target.value)} maxLength={120}
              autoComplete="off" disabled={busy} required />
          </label>
          <button className="primary" type="submit" disabled={busy || !guess.trim()}>{busy ? 'Submitting…' : 'Submit guess'}</button>
        </form>}
      {error && <p className="game-error" role="status">{error}{!remaining && <button className="text-button" type="button"
        onClick={() => void game.reveal(code, match, room.round).catch(error => setError(gameError(error, 'Couldn’t show the round results.')))}>Retry results</button>}</p>}
    </div>
  );
}
