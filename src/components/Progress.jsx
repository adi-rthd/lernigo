import { useState } from 'react';
import { english, german } from '../study.js';

const filters = [
  ['all', 'All studied', 'Your answers will appear here after you study a card.'],
  ['wrong', 'Needs practice', 'No cards currently need practice.'],
  ['right', 'Got it right', 'No cards have a correct latest answer yet.'],
  ['new', 'Not yet studied', 'You’ve studied every word in the deck.'],
];

export default function Progress({ level, cards, records, synced, status, onReview, saving }) {
  const [filter, setFilter] = useState('all');
  const studied = cards.filter(card => records[card.id]);
  const right = studied.filter(card => records[card.id].last === 'right');
  const wrong = studied.filter(card => records[card.id].last === 'wrong');
  const fresh = cards.filter(card => !records[card.id]);
  const rows = status ? [] : { all: studied, right, wrong, new: fresh }[filter];

  return (
    <section id="progress">
      <div className="intro"><p className="kicker">German vocabulary</p><h1>Progress</h1><p>Your {level} answers and words to review.</p></div>
      <div className="stats">
        {[
          ['Words studied', studied.length, ''],
          ['Last answer right', right.length, ' metric-right'],
          ['Needs practice', wrong.length, ' metric-wrong'],
          ['Not yet studied', fresh.length, ''],
        ].map(([label, count, style]) => <div className={'panel metric' + style} key={label}>
          <span>{label}</span><strong>{status ? '–' : count}</strong>
        </div>)}
      </div>
      <div className="panel results">
        <div className="results-bar">
          <div><h2>Word history</h2><p>{status || (synced ? 'Synced with Firebase' : 'Guest progress on this browser')}</p></div>
          <button type="button" className="primary" disabled={saving || !!status || !wrong.length} onClick={() => onReview(wrong)}>
            Review missed cards
          </button>
        </div>
        <div className="history-filters" aria-label="Filter words">
          {filters.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
        {rows.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Vocabulary answer history">
          <table>
            <thead><tr><th>German</th><th>English</th><th>Right</th><th>Wrong</th><th>Last answer</th></tr></thead>
            <tbody>{rows.map(card => {
              const record = records[card.id];
              return <tr key={card.id}>
                <td lang="de">{german(card)}</td><td>{english(card)}</td><td>{record?.right ?? '–'}</td><td>{record?.wrong ?? '–'}</td>
                <td data-result={record?.last}>{record ? record.last === 'right' ? 'Right' : 'Wrong' : 'Unstudied'}</td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <p className="empty-text">{status || filters.find(([id]) => id === filter)[2]}</p>}
      </div>
    </section>
  );
}
