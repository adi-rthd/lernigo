import { useEffect, useRef, useState } from 'react';
import units from '../data/a1-course.json';
import { readLocal, writeLocal } from '../useAccount.js';

const course = units.flatMap((unit, index) => [
  ...unit.lessons,
  { id: 'review-' + (index + 1), title: 'Unit practice', practice: unit.review, task: unit.task },
].map(lesson => ({ ...lesson, unit, number: index + 1 })));

export default function LearnA1({ lessonId, learner }) {
  const storageKey = 'lernigo:learn-a1:' + learner;
  const [results, setResults] = useState(() => readResults(storageKey));
  const [storageError, setStorageError] = useState(false);
  const heading = useRef(null);
  const index = course.findIndex(lesson => lesson.id === lessonId);
  const lesson = course[index];
  const next = course[index + 1];
  const resume = course.find(item => !Object.hasOwn(results, item.id));
  const completed = course.filter(item => Object.hasOwn(results, item.id)).length;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [lessonId]);

  function finish(score) {
    const saved = readResults(storageKey);
    const updated = { ...results, ...saved, [lesson.id]: Math.max(score, results[lesson.id] ?? 0, saved[lesson.id] ?? 0) };
    setResults(updated);
    setStorageError(!writeLocal(storageKey, updated));
  }

  return (
    <section id="learn" className="a1-course">
      <div className="intro a1-intro">
        {lesson && <a className="a1-back" href="#learn">← All A1 lessons</a>}
        {lesson && <p className="kicker">Unit {lesson.number} · {lesson.unit.title}</p>}
        <h1 tabIndex={-1} ref={heading}>{lesson?.title ?? 'Learn A1'}</h1>
        {!lesson && <p>Learn everyday German with short explanations, examples, and practice.</p>}
      </div>
      {lesson ? <>
        {lesson.rule && <div className="panel a1-card">
          <h2>The rule</h2>
          <p>{lesson.rule}</p>
          <dl className="a1-examples">
            {lesson.examples.map(([german, english]) => <div key={german}>
              <dt lang="de">{german}</dt><dd>{english}</dd>
            </div>)}
          </dl>
        </div>}
        {lesson.task && <div className="panel a1-card">
          <h2>Try it aloud</h2><p>{lesson.task}</p>
        </div>}
        <Practice key={lesson.id} questions={lesson.practice} onFinish={finish} next={next} />
        {storageError && <p role="status">This browser couldn’t save your progress.</p>}
      </> : <>
        <div className="panel a1-overview">
          <div><strong>{completed} of {course.length} activities finished</strong>
            <progress value={completed} max={course.length} aria-label="Course progress" />
            <p>Progress is saved in this browser.</p>
          </div>
          {resume && <a className="primary" href={'#learn/' + resume.id}>{completed ? 'Continue learning' : 'Start Unit 1'}</a>}
        </div>
        <div className="a1-units">
          {units.map((unit, i) => <section key={unit.title} className="panel a1-card">
            <h2>Unit {i + 1} · {unit.title}</h2>
            <p>{unit.goal}</p>
            <ul className="a1-lesson-list">
              {course.filter(item => item.unit === unit).map(item => <li key={item.id}>
                <a href={'#learn/' + item.id}>{item.title}
                  {Object.hasOwn(results, item.id) && <small>{results[item.id]}/{item.practice.length} best</small>}
                </a>
              </li>)}
            </ul>
          </section>)}
        </div>
      </>}
    </section>
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
