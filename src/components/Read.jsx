import { useState } from 'react';
import { english, german } from '../study.js';

const collator = new Intl.Collator('de');

function searchText(text) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('ß', 'ss');
}

export default function Read({ cards }) {
  const [chapter, setChapter] = useState(1);
  const [search, setSearch] = useState('');
  const query = searchText(search.trim());
  const chapters = [...new Set(cards.flatMap(card => card.chapters))].sort((a, b) => a - b);
  const words = cards.filter(card => query
    ? [german(card), english(card)].some(text => searchText(text).includes(query))
    : card.chapters.includes(chapter))
    .sort((a, b) => collator.compare(a.word, b.word));

  return (
    <section id="read">
      <div className="intro">
        <p className="kicker">German vocabulary · A1</p>
        <h1>Read</h1>
        <p>Browse German nouns and verbs with their English meanings.</p>
      </div>
      <div className="read-controls">
        <label className="field">
          Search vocabulary
          <input type="search" value={search} placeholder="German word or English meaning"
            onChange={event => setSearch(event.target.value)} />
        </label>
        <label className="field">
          Chapter
          <select value={chapter} disabled={!!query} onChange={event => setChapter(Number(event.target.value))}>
            {chapters.map(number => <option key={number} value={number}>Chapter {number}</option>)}
          </select>
        </label>
      </div>
      <p className="message read-search-status" role="status">{query && (words.length
        ? words.length + (words.length === 1 ? ' match' : ' matches') + ' across all chapters'
        : 'No matching words across all chapters.')}</p>
      {(!query || words.length > 0) && <div className="read-lists">
        <WordList title="Nouns" words={words.filter(card => card.kind === 'noun')} searching={!!query} />
        <WordList title="Verbs" words={words.filter(card => card.kind === 'verb')} searching={!!query} />
      </div>}
    </section>
  );
}

function WordList({ title, words, searching }) {
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
      ) : <p className="empty-text">No {title.toLowerCase()} {searching ? 'match this search.' : 'in this chapter.'}</p>}
    </section>
  );
}
