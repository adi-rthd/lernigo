import { useState } from 'react';
import { english, german } from '../study.js';

const collator = new Intl.Collator('de');

export default function Read({ cards }) {
  const [chapter, setChapter] = useState(1);
  const chapters = [...new Set(cards.flatMap(card => card.chapters))].sort((a, b) => a - b);
  const words = cards.filter(card => card.chapters.includes(chapter))
    .sort((a, b) => collator.compare(a.word, b.word));

  return (
    <section id="read">
      <div className="intro">
        <p className="kicker">German vocabulary · A1</p>
        <h1>Read</h1>
        <p>Browse German nouns and verbs with their English meanings.</p>
      </div>
      <label className="field read-chapter">
        Chapter
        <select value={chapter} onChange={event => setChapter(Number(event.target.value))}>
          {chapters.map(number => <option key={number} value={number}>Chapter {number}</option>)}
        </select>
      </label>
      <div className="read-lists">
        <WordList title="Nouns" words={words.filter(card => card.kind === 'noun')} />
        <WordList title="Verbs" words={words.filter(card => card.kind === 'verb')} />
      </div>
    </section>
  );
}

function WordList({ title, words }) {
  return (
    <section className="panel read-list" aria-label={title}>
      <h2>{title} <span>({words.length})</span></h2>
      {words.length ? (
        <dl>
          {words.map(card => (
            <div key={card.id}>
              <dt lang="de">{german(card)}</dt>
              <dd>{english(card)}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="empty-text">No {title.toLowerCase()} in this chapter.</p>}
    </section>
  );
}
