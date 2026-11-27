import { useEffect, useRef, useState } from 'react';
import units from '../data/a1-course.json';
import { speakGerman } from '../germanSpeech.js';
import { readLocal, writeLocal } from '../useAccount.js';

const course = units.flatMap((unit, index) => [
  ...unit.lessons,
  { id: 'review-' + (index + 1), title: 'Unit practice', practice: unit.review, task: unit.task },
].map(lesson => ({ ...lesson, unit, number: index + 1 })));

function progressKey(learner) {
  return 'lernigo:learn-a1:' + learner;
}

export function HomeA1({ learner }) {
  return (
    <section className="a1-home" aria-labelledby="home-a1-title">
      <h2 id="home-a1-title"><a href="#learn">Learn A1</a></h2>
      <p>Learn everyday German with short explanations, examples, and practice.</p>
      <CourseProgress results={readResults(progressKey(learner))} />
    </section>
  );
}

export default function LearnA1({ lessonId, learner }) {
  const storageKey = progressKey(learner);
  const [results, setResults] = useState(() => readResults(storageKey));
  const [storageError, setStorageError] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const heading = useRef(null);
  const index = course.findIndex(lesson => lesson.id === lessonId);
  const lesson = course[index];
  const next = course[index + 1];

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [lessonId]);

  function selectTopic(id) {
    setTopicsOpen(false);
    if (lesson?.id === id) heading.current?.focus();
  }

  function finish(score) {
    const saved = readResults(storageKey);
    const updated = { ...results, ...saved, [lesson.id]: Math.max(score, results[lesson.id] ?? 0, saved[lesson.id] ?? 0) };
    setResults(updated);
    setStorageError(!writeLocal(storageKey, updated));
  }

  return (
    <section id="learn" className="a1-course">
      <aside className="a1-sidebar panel">
        <h2 className="a1-sidebar-title">Course topics</h2>
        <button type="button" className="a1-topic-toggle outline" aria-expanded={topicsOpen}
          aria-controls="a1-topic-navigation" onClick={() => setTopicsOpen(open => !open)}>
          Course topics
        </button>
        <nav id="a1-topic-navigation" aria-label="A1 course topics" data-open={topicsOpen}>
          <a className="a1-overview-link" href="#learn" aria-current={lesson ? undefined : 'page'}
            onClick={() => selectTopic(undefined)}>Course overview</a>
          {units.map((unit, i) => <div className="a1-topic-group" key={unit.title}>
            <h3>Unit {i + 1} · {unit.title}</h3>
            <ul className="a1-lesson-list">
              {course.filter(item => item.unit === unit).map(item => <li key={item.id}>
                <a href={'#learn/' + item.id} aria-current={lesson?.id === item.id ? 'page' : undefined}
                  onClick={() => selectTopic(item.id)}>
                  <span>{item.title}</span>
                  {Object.hasOwn(results, item.id) && <small aria-label={results[item.id] + ' of ' + item.practice.length + ' correct, best score'}>
                    {results[item.id]}/{item.practice.length}
                  </small>}
                </a>
              </li>)}
            </ul>
          </div>)}
        </nav>
      </aside>
      <div className="a1-content">
        <div className="intro a1-intro">
          {lesson && <p className="kicker">Unit {lesson.number} · {lesson.unit.title}</p>}
          <h1 tabIndex={-1} ref={heading}>{lesson?.title ?? 'Learn A1'}</h1>
          {!lesson && <p>Learn everyday German with short explanations, examples, and practice.</p>}
        </div>
        {lesson ? <>
          {lesson.rule && <div className="panel a1-card">
            <h2>The rule</h2>
            <p>{lesson.rule}</p>
            {lesson.examples.length > 0 && <dl className="a1-examples">
              {lesson.examples.map(([german, english]) => <div key={german}>
                <dt lang="de">{german}</dt><dd>{english}</dd>
              </div>)}
            </dl>}
            {lesson.audio && <Listening key={lesson.id} text={lesson.audio} />}
          </div>}
          {lesson.task && <div className="panel a1-card">
            <h2>Try it yourself</h2><p>{lesson.task}</p>
          </div>}
          <Practice key={lesson.id} questions={lesson.practice} onFinish={finish} next={next} />
          {storageError && <p role="status">This browser couldn’t save your progress.</p>}
        </> : <>
          <CourseProgress results={results} />
          <div className="panel a1-card">
            <h2>What you’ll learn</h2>
            <dl className="a1-examples">
              {units.map((unit, i) => <div key={unit.title}>
                <dt>Unit {i + 1} · {unit.title}</dt><dd>{unit.goal}</dd>
              </div>)}
            </dl>
          </div>
        </>}
      </div>
    </section>
  );
}

function CourseProgress({ results }) {
  const resume = course.find(item => !Object.hasOwn(results, item.id));
  const completed = course.filter(item => Object.hasOwn(results, item.id)).length;

  return (
    <div className="panel a1-overview">
      <div>
        <strong>{completed} of {course.length} activities finished</strong>
        <progress value={completed} max={course.length} aria-label="Course progress" />
        <p>Progress is saved in this browser.</p>
      </div>
      <a className="primary" href={resume ? '#learn/' + resume.id : '#learn'}>
        {resume ? (completed ? 'Continue learning' : 'Start Unit 1') : 'Review course'}
      </a>
    </div>
  );
}

function Listening({ text }) {
  const [error, setError] = useState('');

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  return (
    <div className="a1-listening">
      <button className="outline" type="button" onClick={() => speakGerman(text, setError)}>
        Play announcement
      </button>
      {error && <p role="status">{error} You can use the transcript below.</p>}
      <details>
        <summary>Show transcript</summary>
        <p lang="de">{text}</p>
      </details>
    </div>
  );
}

function readResults(storageKey) {
  const data = readLocal(storageKey, {});
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function Practice({ questions, onFinish, next }) {
  const [answers, setAnswers] = useState([]);
  const [choice, setChoice] = useState(null);
  const [checked, setChecked] = useState(false);
  const practiceHeading = useRef(null);
  const actionButton = useRef(null);
  const number = answers.length;
  const question = questions[number];
  const score = answers.filter((answer, index) => answer === questions[index][2]).length;

  function continuePractice() {
    const updated = [...answers, choice];
    setAnswers(updated);
    setChoice(null);
    setChecked(false);
    if (updated.length === questions.length) {
      onFinish(score + Number(choice === question[2]));
    }
  }

  useEffect(() => {
    if (number > 0) practiceHeading.current?.focus();
  }, [number]);

  useEffect(() => {
    if (checked) actionButton.current?.focus();
  }, [checked]);

  if (!question) return <div className="panel a1-card">
    <h2 ref={practiceHeading} tabIndex={-1}>Practice complete</h2>
    <p>You answered {score} of {questions.length} correctly.</p>
    <div className="a1-actions">
      <button className="outline" type="button" onClick={() => {
        setAnswers([]);
        requestAnimationFrame(() => practiceHeading.current?.focus());
      }}>Try again</button>
      {next
        ? <a className="primary" href={'#learn/' + next.id}>Next activity</a>
        : <a className="primary" href="#learn">Back to course</a>}
    </div>
  </div>;

  const [prompt, options, correct, explanation] = question;
  return <div className="panel a1-card">
    <h2 ref={practiceHeading} tabIndex={-1}>Practice question {number + 1} of {questions.length}</h2>
    <form onSubmit={event => {
      event.preventDefault();
      if (checked) continuePractice();
      else if (choice !== null) setChecked(true);
    }}>
      <fieldset className="a1-choices" disabled={checked}>
        <legend>{prompt}</legend>
        {options.map((option, i) => <label key={option} className="a1-choice"
          data-result={checked && (i === correct ? 'correct' : i === choice ? 'incorrect' : undefined) || undefined}>
          <input type="radio" name="a1-answer" checked={choice === i} onChange={() => setChoice(i)} />
          <span lang="de">{option}</span>
        </label>)}
      </fieldset>
      <div className="a1-feedback" aria-live="polite">
        {checked && <p><strong>{choice === correct ? 'Correct. ' : 'Not quite. '}</strong>{explanation}</p>}
      </div>
      <button ref={actionButton} type="submit" className="primary" disabled={choice === null}>
        {checked ? (number + 1 === questions.length ? 'See result' : 'Next question') : 'Check answer'}
      </button>
    </form>
  </div>;
}
