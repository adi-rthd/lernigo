import { useEffect, useRef, useState } from 'react';
import { bossQuestions, dailyQuestions, mistakeCards, recordMistake, rematchQuestions, streakInfo } from '../challenges.js';
import { english, german } from '../study.js';

const labels = { daily: 'Daily 5', rematch: 'Mistake Rematch', boss: 'Chapter boss' };
const instructions = {
  article: 'Choose the article.',
  sentence: 'Choose the English meaning of the highlighted word.',
  meaning: 'Choose the English meaning.',
};

export default function Challenges({ cards, records, progress, sound, disabled, onSignIn }) {
  const { data, today, update, storageAvailable } = progress;
  const [chapter, setChapter] = useState(1);
  const [session, setSession] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const titleRef = useRef(null);
  const nextRef = useRef(null);
  const returnRef = useRef(null);
  const returning = useRef(false);
  const missed = onSignIn ? [] : mistakeCards(cards, records, data.mistakes);
  const daily = data.daily[today];
  const streak = streakInfo(data.daily, today);
  const activeDaily = session?.mode === 'daily';
  const expired = activeDaily && session.day !== today;
  const attempt = activeDaily ? data.daily[session.day] : session;
  const score = attempt?.answers.filter(answer => answer.correct).length ?? 0;
  const current = feedback?.question ?? attempt?.questions[attempt.answers.length];

  useEffect(() => {
    if (feedback) nextRef.current?.focus();
    else if (session) titleRef.current?.focus();
    else if (returning.current) {
      returning.current = false;
      returnRef.current?.focus();
    }
  }, [session?.mode, feedback]);

  function start(mode) {
    if (onSignIn) {
      onSignIn();
      return;
    }
    if (mode === 'daily') {
      update(state => state.daily[today] ? state : {
        ...state, daily: { ...state.daily, [today]: { questions: dailyQuestions(cards, missed), answers: [] } },
      });
      setSession({ mode, day: today });
    } else {
      const questions = mode === 'boss' ? bossQuestions(cards, chapter) : rematchQuestions(cards, missed);
      if (!questions.length) return;
      setSession({ mode, chapter, questions, answers: [] });
    }
    setFeedback(null);
  }

  function back() {
    returning.current = true;
    setSession(null);
    setFeedback(null);
  }

  function answer(choice, index) {
    if (feedback || !current || expired) return;
    const entry = { id: current.id, correct: choice.correct };
    const answers = [...attempt.answers, entry];
    const finished = answers.length === attempt.questions.length;
    let accepted = false;
    update(state => {
      if (activeDaily && state.daily[session.day]?.answers.length !== attempt.answers.length) return state;
      accepted = true;
      const mistakes = recordMistake(state.mistakes, entry.id, entry.correct, today, records[entry.id]?.last === 'wrong');
      if (activeDaily) return { ...state, mistakes, daily: {
        ...state.daily, [session.day]: { ...attempt, answers, finished },
      } };
      if (session.mode === 'boss' && finished) {
        const right = answers.filter(result => result.correct).length;
        const best = Math.max(right, state.bosses[session.chapter] ?? 0);
        return { ...state, mistakes, bosses: { ...state.bosses, [session.chapter]: best } };
      }
      return { ...state, mistakes };
    });
    if (!accepted) return;
    if (!activeDaily) setSession({ ...session, answers, finished });
    setFeedback({ index, question: current, number: answers.length });
    void Promise.resolve(sound.unlock?.()).then(() => sound.play(choice.correct ? 'correct' : 'incorrect', 'home'));
  }

  if (!session) return (
    <section className="challenge-hub" aria-label="Practice challenges">
      <div className="panel daily-challenge">
        <div>
          <h2>Daily 5</h2>
          <p>{streak.current} day{streak.current === 1 ? '' : 's'} in a row · Best {streak.best}</p>
          <p className="field-hint">{streak.skipUsed ? 'This week’s skip has been used.' : 'One missed day is covered each week.'}</p>
        </div>
        <button ref={returnRef} className="primary" type="button" disabled={disabled} onClick={() => start('daily')}>
          {onSignIn ? 'Sign in to play' : daily?.finished ? 'View today’s result' : daily ? 'Continue today’s challenge' : 'Start today’s challenge'}
        </button>
      </div>
      <div className="challenge-options">
        <div className="panel challenge-panel">
          <h2>Mistake Rematch</h2>
          <p>{missed.length ? 'Get a word right on two later days to clear it.' : 'Missed words will show up here.'}</p>
          <button className="outline" type="button" disabled={disabled || !missed.length} onClick={() => start('rematch')}>
            {missed.length ? `Retry ${Math.min(missed.length, 10)} missed ${missed.length === 1 ? 'word' : 'words'}` : 'Retry missed words'}
          </button>
        </div>
        <div className="panel challenge-panel">
          <h2>Chapter boss</h2>
          <label className="field">Chapter
            <select value={chapter} onChange={event => setChapter(Number(event.target.value))}>
              {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>Chapter {index + 1}</option>)}
            </select>
          </label>
          <button className="outline" type="button" disabled={disabled} onClick={() => start('boss')}>Start boss round</button>
          {data.bosses[chapter] !== undefined && <p className="field-hint">Best score: {data.bosses[chapter]} / 8</p>}
        </div>
      </div>
    </section>
  );

  const title = session.mode === 'boss' ? `Chapter ${session.chapter} boss` : labels[session.mode];
  const wrongIds = new Set(attempt?.answers.filter(result => !result.correct).map(result => result.id));
  const wrong = cards.filter(card => wrongIds.has(card.id));
  const rightIds = new Set(attempt?.answers.filter(result => result.correct).map(result => result.id));
  const right = cards.filter(card => rightIds.has(card.id));

  return (
    <section className="panel challenge-panel challenge-session" aria-label={title}>
      <div className="session-line"><h2 ref={titleRef} tabIndex={-1}>{title}</h2><button className="text-button" type="button" onClick={back}>Back to challenges</button></div>
      {expired || !attempt ? <p>A new daily challenge is ready.</p>
        : current ? <>
          <p className="field-hint">Question {feedback?.number ?? attempt.answers.length + 1} of {attempt.questions.length}</p>
          <p>{instructions[current.format]}</p>
          <p className="challenge-prompt" lang="de">{current.word
            ? current.prompt.split(/([^\p{L}]+)/u).map((part, index) => part.toLowerCase() === current.word.toLowerCase()
              ? <strong key={index}>{part}</strong> : part)
            : current.prompt}</p>
          <div className="quiz-options">{current.choices.map((choice, index) =>
            <button key={choice.text} type="button" disabled={!!feedback} onClick={() => answer(choice, index)}
              data-result={feedback ? choice.correct ? 'right' : feedback.index === index ? 'wrong' : undefined : undefined}>
              {choice.text}
            </button>)}</div>
          {feedback && <div className="challenge-feedback">
            <p role="status">{current.choices[feedback.index].correct ? 'Correct!' : `Answer: ${current.choices.find(option => option.correct).text}`}</p>
            <button ref={nextRef} className="primary" type="button" onClick={() => setFeedback(null)}>{attempt.finished ? 'See results' : 'Next question'}</button>
          </div>}
        </> : <>
          <h3>{score} / {attempt.questions.length} correct</h3>
          {activeDaily && <p>Daily challenge complete. Come back tomorrow for five more.</p>}
          {!!right.length && session.mode === 'boss' && <WordList title="Got right" cards={right} />}
          {!!wrong.length && <WordList title="Practise again" cards={wrong} />}
          {!!wrong.length && <button className="outline" type="button" onClick={() => {
            setSession({ mode: 'rematch', questions: rematchQuestions(cards, wrong), answers: [] });
          }}>Retry these words</button>}
        </>}
      {!storageAvailable && <p role="status">Browser storage is unavailable. Challenge progress is saved for this visit.</p>}
    </section>
  );
}

function WordList({ title, cards }) {
  return <div>
    <h4>{title}</h4>
    <ul className="challenge-word-list">{cards.map(card =>
      <li key={card.id}><span lang="de">{german(card)}</span> · {english(card)}</li>)}</ul>
  </div>;
}
