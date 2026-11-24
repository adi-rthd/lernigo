import { useEffect, useState } from 'react';
import { levels } from '../study.js';

export default function Leaderboard({ initialLevel, user, api, ready }) {
  const [level, setLevel] = useState(initialLevel);
  const [results, setResults] = useState(null);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid || !api) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) setResults({ level, uid, error: true });
    }, 5000);
    const stop = api.watchLeaderboard(level, entries => {
      clearTimeout(timer);
      if (active) setResults({ level, uid, entries });
    }, () => {
      clearTimeout(timer);
      if (active) setResults({ level, uid, error: true });
    });
    return () => { active = false; clearTimeout(timer); stop(); };
  }, [api, level, uid]);

  const board = results?.level === level && results?.uid === uid ? results : null;
  const entries = board?.entries ?? [];
  const message = !uid ? ready ? 'Sign in to see the rankings.' : 'Connecting to Firebase…'
    : board?.error ? 'Rankings couldn’t load. Try again later.'
    : board ? 'No scores yet for ' + level + '.' : 'Loading rankings…';
  let rank = 0;
  let previousPoints;

  return (
    <section id="leaderboard">
      <div className="intro"><p className="kicker">German vocabulary</p><h1>Leaderboard</h1><p>Earn one point the first time you answer a word correctly in multiple choice.</p></div>
      <div className="panel results">
        <div className="results-bar"><h2>{level} rankings</h2><a className="outline" href="#settings">Leaderboard settings</a></div>
        <div className="history-filters" aria-label="Leaderboard level">
          {levels.map(item => <button key={item} type="button" aria-pressed={item === level} onClick={() => setLevel(item)}>{item}</button>)}
        </div>
        {entries.length ? <div className="table-scroll">
          <table>
            <thead><tr><th>Rank</th><th>Learner</th><th>Points</th></tr></thead>
            <tbody>{entries.map((entry, index) => {
              if (previousPoints !== entry.points) rank = index + 1;
              previousPoints = entry.points;
              return <tr key={entry.uid}><td>{rank}</td><td>{entry.alias}{entry.uid === uid ? ' (you)' : ''}</td><td>{entry.points}</td></tr>;
            })}</tbody>
          </table>
        </div> : <p className="empty-text" role="status">{message}</p>}
      </div>
    </section>
  );
}
