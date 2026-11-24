import { useEffect, useMemo, useRef, useState } from 'react';
import { choicesFor, english, german, shuffle } from '../study.js';

const modes = [['flash', 'Flashcards'], ['mcq', 'Multiple choice']];
const deckScopes = [['unanswered', 'Unanswered'], ['all', 'All words']];
const types = [['all', 'All words'], ['noun', 'Nouns'], ['verb', 'Verbs']];

function Options({ label, value, items, onChange, disabled }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="segments">
        {items.map(([id, text]) => (
          <button key={id} type="button" aria-pressed={value === id} disabled={disabled} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function Practice({ active, level, cards, records, quizCandidates, track, sound, review, onExitReview, ready, guestRemaining, saving, setSaving }) {
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [mode, setMode] = useState('mcq');
  const [scope, setScope] = useState('unanswered');
  const [type, setType] = useState('all');
  const [chapter, setChapter] = useState('all');
  const [direction, setDirection] = useState('de');
  const [mixed, setMixed] = useState(null);
  const [round, setRound] = useState(0);
  const [directionLocked, setDirectionLocked] = useState(false);
  const matching = useMemo(() => cards.filter(card => review
    ? review.ids.has(card.id)
    : (type === 'all' || type === card.kind) && (chapter === 'all' || card.chapters.includes(Number(chapter)))),
  [cards, review, type, chapter]);
  const deck = mixed?.matching === matching ? mixed.deck : matching;
  const signedIn = guestRemaining === null;
  const unansweredOnly = signedIn && !review && scope === 'unanswered';
  const completedIds = new Set(cards.filter(card => records[card.id] || savedIds.has(card.id)).map(card => card.id));
  const available = unansweredOnly ? deck.filter(card => !completedIds.has(card.id)).length : deck.length;

  async function saveAnswer(card, result, quiz) {
    const message = await track(card, result, quiz);
    if (signedIn) setSavedIds(previous => previous.has(card.id) ? previous : new Set(previous).add(card.id));
    return message;
  }

  useEffect(() => { setDirectionLocked(false); }, [review]);

  function reset() {
    setMixed(null);
    setRound(value => value + 1);
    setDirectionLocked(false);
  }

  function changeFilter(setter, value) {
    setter(value);
    reset();
  }

  return (
    <section id="practice" hidden={!active}>
      <div className="intro">
        <p className="kicker">German vocabulary <span className="intro-level">{level}</span></p>
        <h1>Practice</h1>
        <p>{guestRemaining === null
          ? level === 'A1' ? 'Nouns and verbs from chapters 1–12.' : level + ' starter deck · ' + cards.length + ' words.'
          : 'Guest practice · ' + guestRemaining + (guestRemaining === 1 ? ' answer left' : ' answers left')}
        </p>
      </div>
      <div className="layout">
        <aside className="settings">
          <button className="settings-toggle" type="button" aria-expanded={optionsOpen} aria-controls="study-options"
            onClick={() => setOptionsOpen(open => !open)}>
            Study options
          </button>
          <div className="settings-controls" id="study-options">
            <Options label="Practice mode" items={modes} value={mode} onChange={value => { if (mode !== value) changeFilter(setMode, value); }} disabled={saving} />
            <Options label="Word type" items={types} value={type} onChange={value => { if (type !== value) changeFilter(setType, value); }} disabled={saving || !!review} />
            <label className="field" id="chapter-field" hidden={level !== 'A1' || guestRemaining !== null}>
              Chapter
              <select value={chapter} onChange={event => changeFilter(setChapter, event.target.value)} disabled={saving || !!review}>
                <option value="all">All chapters</option>
                {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Chapter {index + 1}</option>)}
              </select>
            </label>
            <label className="field">
              Card direction
              <select value={direction} onChange={event => setDirection(event.target.value)} disabled={saving || directionLocked}>
                <option value="de">German to English</option>
                <option value="en">English to German</option>
              </select>
            </label>
            {signedIn && (
              <div className="deck-scope">
                <Options label="Deck" items={deckScopes} value={scope} disabled={saving || !!review}
                  onChange={value => { if (scope !== value) changeFilter(setScope, value); }} />
              </div>
            )}
            <div className="settings-footer">
              <span>{available} {unansweredOnly ? 'unanswered' : available === 1 ? 'word' : 'words'}</span>
              <button className="text-button" type="button" disabled={saving || available < 2} onClick={() => {
                setMixed({ matching, deck: shuffle(deck) });
                setRound(value => value + 1);
                setDirectionLocked(false);
              }}>Shuffle</button>
            </div>
          </div>
        </aside>
        <div className="study">
          {signedIn && (
            <div className="deck-progress">
              <div className="session-line">
                <strong>{level} progress</strong>
                <span>{completedIds.size} / {cards.length} completed</span>
              </div>
              <progress value={completedIds.size} max={cards.length || 1} aria-label={level + ' vocabulary completed'} />
            </div>
          )}
          {review && (
            <div className="review-banner">
              <strong>Reviewing missed cards</strong>
              <button className="text-button" type="button" onClick={() => { reset(); onExitReview(); }} disabled={saving}>
                Return to practice
              </button>
            </div>
          )}
          <Session key={round + ':' + (review?.id ?? '')} {...{
            active, deck, completedIds, unansweredOnly, mode, direction, ready, saving, setSaving, setDirectionLocked,
          }} track={saveAnswer} sound={sound} candidates={quizCandidates ?? cards} onRestart={reset} onPracticeAll={() => changeFilter(setScope, 'all')} />
        </div>
      </div>
    </section>
  );
}

function Session({ active, deck, completedIds, unansweredOnly, candidates, mode, direction, track, sound, ready, saving, setSaving, setDirectionLocked, onRestart, onPracticeAll }) {
  const [answeredIds, setAnsweredIds] = useState(() => new Set());
  const [flippedFor, setFlippedFor] = useState(null);
  const [response, setResponse] = useState(null);
  const [answerSaved, setAnswerSaved] = useState(false);
  const [rightCount, setRightCount] = useState(0);
  const [message, setMessage] = useState('');
  const savingRef = useRef(false);
  const focusAfterRender = useRef(false);
  const flashButton = useRef(null);
  const firstChoice = useRef(null);
  const nextButton = useRef(null);
  const restartButton = useRef(null);
  const pending = deck.filter(card => !answeredIds.has(card.id) && (!unansweredOnly || !completedIds.has(card.id)));
  const answer = response?.choice;
  const card = response?.card ?? pending[0];
  const graded = answeredIds.size;
  const index = graded - Number(answerSaved);
  const pendingResponse = response && !answerSaved && !pending.includes(response.card);
  const total = graded + pending.length + Number(Boolean(pendingResponse));
  const quiz = mode === 'mcq';
  const flipKey = card?.id + ':' + direction;
  const flipped = flippedFor === flipKey;
  const germanAnswer = direction === 'en';
  const choices = useMemo(() => card && quiz ? choicesFor(card, candidates, germanAnswer) : [],
    [card, candidates, germanAnswer, quiz]);

  function next() {
    setFlippedFor(null);
    setResponse(null);
    setAnswerSaved(false);
    setDirectionLocked(false);
    focusAfterRender.current = true;
  }

  async function record(result, quizChoice) {
    if (!card || !ready || savingRef.current || (quiz ? answerSaved : !flipped)) return;
    savingRef.current = true;
    setSaving(true);
    setMessage('Saving answer…');
    if (!answer && sound.unlock) {
      const cue = result === 'right' ? 'correct' : 'incorrect';
      void Promise.resolve(sound.unlock()).then(() => sound.play(cue, 'practice'));
    }
    if (quizChoice) {
      setResponse({ card, choice: quizChoice });
      setDirectionLocked(true);
    }
    try {
      setMessage(await track(card, result, quiz) ?? '');
      setAnsweredIds(previous => new Set(previous).add(card.id));
      if (result === 'right') setRightCount(value => value + 1);
      if (quiz) setAnswerSaved(true);
      else next();
    } catch {
      setMessage('Couldn’t save your answer. Check your connection and try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
      if (quiz) focusAfterRender.current = true;
    }
  }

  function flip() {
    if (card && !saving) setFlippedFor(previous => previous === flipKey ? null : flipKey);
  }

  useEffect(() => {
    if (!active || saving || !focusAfterRender.current) return;
    focusAfterRender.current = false;
    const target = card ? quiz ? answer ? nextButton : firstChoice : flashButton : restartButton;
    target.current?.focus();
  });

  useEffect(() => {
    if (!active || quiz) return;
    function onKey(event) {
      if (document.querySelector('dialog[open]') || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        event.target.closest?.('input, select, textarea, [contenteditable]')) return;
      if (event.code === 'Space' && !event.target.closest?.('button, a')) {
        event.preventDefault();
        flip();
      }
      if (event.key === '1') void record('wrong');
      if (event.key === '2') void record('right');
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className="session-line">
        <span>{card ? (quiz ? 'Question ' : 'Card ') + (index + 1) + ' of ' + total : total > 0 && total + ' answered this round'}</span>
        {graded > 0 && <span>{rightCount} right · {graded - rightCount} wrong</span>}
      </div>
      {!unansweredOnly && <progress value={graded} max={total || 1} aria-label="Cards answered in this round" />}
      {card && !quiz && (
        <Flashcard card={card} direction={direction} flipped={flipped} flip={flip} focus={flashButton}
          record={record} saving={saving} ready={ready} />
      )}
      {card && quiz && (
        <Quiz {...{ card, germanAnswer, choices, answer, saving, ready, answerSaved, index, total, firstChoice, nextButton }}
          pick={choice => void record(choice.correct ? 'right' : 'wrong', choice)}
          onNext={() => answerSaved ? next() : void record(answer.correct ? 'right' : 'wrong', answer)} />
      )}
      {!card && (
        <div className="panel end-state">
          <h2>{unansweredOnly && deck.length ? 'No unanswered words left' : total ? 'You finished this deck' : 'No cards in this deck'}</h2>
          <p>{graded
            ? rightCount + ' right and ' + (graded - rightCount) + ' wrong in this round.'
            : 'Choose a different chapter or word type to keep practising.'}</p>
          <div className="end-actions">
            {deck.length > 0 && (
              <button ref={restartButton} className="primary" type="button" onClick={unansweredOnly ? onPracticeAll : onRestart}>
                {unansweredOnly ? 'Practice all words' : 'Study again'}
              </button>
            )}
            <a className="outline" href="#progress">View progress</a>
          </div>
        </div>
      )}
      <p className="message" aria-live="polite">{message}</p>
    </>
  );
}

function Flashcard({ card, direction, flipped, flip, focus, record, saving, ready }) {
  const germanSide = (direction === 'de') !== flipped;
  const word = germanSide ? german(card) : english(card);
  return (
    <div>
      <button ref={focus} type="button" className="flashcard" aria-pressed={flipped} disabled={saving} onClick={flip}>
        <span className="card-top"><span className="kind">{card.kind === 'noun' ? 'Noun' : 'Verb'}</span>{germanSide ? 'German' : 'English'}</span>
        <span className="card-center">
          <span id="card-word" className={word.length > 28 ? 'long' : undefined} lang={germanSide ? 'de' : 'en'}>{word}</span>
          {!flipped && <span className="card-hint">{germanSide ? 'Think of the English meaning.'
            : card.kind === 'noun' ? 'Recall the German noun and its article.' : 'Recall the German verb.'}</span>}
          {flipped && card.notes && <span className="card-note">{card.notes}</span>}
        </span>
        <span className="card-bottom">{flipped ? 'Show prompt' : 'Reveal answer'}</span>
      </button>
      <div className="grading" role="group" aria-label="Grade your answer">
        <button className="wrong-btn" type="button" disabled={!flipped || saving || !ready} onClick={() => void record('wrong')}>
          <span aria-hidden="true">×</span> Got it wrong <kbd>1</kbd>
        </button>
        <button className="right-btn" type="button" disabled={!flipped || saving || !ready} onClick={() => void record('right')}>
          <span aria-hidden="true">✓</span> Got it right <kbd>2</kbd>
        </button>
      </div>
      <p className="keyboard"><kbd>Space</kbd> reveal · <kbd>1</kbd> wrong · <kbd>2</kbd> right</p>
    </div>
  );
}

function Quiz({ card, germanAnswer, choices, answer, saving, ready, answerSaved, index, total, firstChoice, nextButton, pick, onNext }) {
  const prompt = germanAnswer ? english(card) : german(card);
  return (
    <div>
      <div className="panel quiz-prompt">
        <div className="card-top"><span className="kind">{card.kind === 'noun' ? 'Noun' : 'Verb'}</span>{germanAnswer ? 'English' : 'German'}</div>
        <p id="quiz-prompt" className={prompt.length > 28 ? 'long' : undefined} lang={germanAnswer ? 'en' : 'de'}>{prompt}</p>
        <p className="card-hint">{germanAnswer ? 'Choose the German translation.' : 'Choose the English meaning.'}</p>
      </div>
      <div className="quiz-options" role="group" aria-label="Answer choices">
        {choices.map((choice, option) => (
          <button key={choice.text} type="button" ref={option === 0 ? firstChoice : null}
            disabled={!!answer || saving || !ready}
            data-result={answer ? choice.correct ? 'right' : choice === answer ? 'wrong' : undefined : undefined}
            onClick={() => pick(choice)}>
            <span className="choice-letter" aria-hidden="true">{'ABCD'[option]}</span>
            <span lang={germanAnswer ? 'de' : 'en'}>{choice.text}</span>
          </button>
        ))}
      </div>
      {answer && <div className="quiz-feedback">
        <p aria-live="polite">{answer.correct ? 'Correct.' : 'Correct answer: ' + choices.find(choice => choice.correct).text}</p>
        <button ref={nextButton} type="button" className="primary" disabled={saving} onClick={onNext}>
          {answerSaved ? index + 1 === total ? 'See results' : 'Next question' : saving ? 'Saving…' : 'Retry save'}
        </button>
      </div>}
    </div>
  );
}
