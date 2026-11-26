import { practiceExample } from './data/practice-examples.js';
import { choicesFor, german, shuffle } from './study.js';

const dayMs = 86_400_000;
const articles = ['der', 'die', 'das'];

export function studyDay(date = new Date()) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / dayMs;
}

function week(day) {
  return Math.floor((day + 3) / 7);
}

export function streakInfo(daily, today) {
  const days = Object.keys(daily).map(Number).filter(day => day <= today && daily[day].finished).sort((a, b) => a - b);
  const skips = new Set();
  let run = 0;
  let best = 0;
  let previous;
  for (const day of days) {
    const gap = day - previous;
    const skipWeek = week(day - 1);
    if (gap === 2 && !skips.has(skipWeek)) {
      skips.add(skipWeek);
      run += 1;
    } else {
      run = gap === 1 ? run + 1 : 1;
    }
    previous = day;
    best = Math.max(best, run);
  }
  const gap = today - previous;
  const current = gap <= 1 || (gap === 2 && !skips.has(week(today - 1))) ? run : 0;
  return { current, best, skipUsed: skips.has(week(today)) };
}

export function mistakeCards(cards, records, mistakes) {
  return cards.filter(card => {
    const entry = mistakes[card.id];
    return entry ? entry.days.length < 2 : records[card.id]?.last === 'wrong';
  });
}

export function recordMistake(mistakes, cardId, correct, day, previouslyMissed) {
  const entry = mistakes[cardId];
  if (!correct) return { ...mistakes, [cardId]: { since: day, days: [] } };
  if (!entry && !previouslyMissed) return mistakes;
  const days = entry?.days ?? [];
  if (day <= (entry?.since ?? -Infinity) || days.includes(day) || days.length >= 2) return mistakes;
  return { ...mistakes, [cardId]: { since: entry?.since ?? null, days: [...days, day] } };
}

function question(card, cards, format = 'meaning', example) {
  if (format === 'article') return {
    id: card.id, format, prompt: card.word,
    choices: articles.map(text => ({ text, correct: text === card.article })),
  };
  return {
    id: card.id, format, prompt: example ?? german(card), word: example ? card.word : null,
    choices: choicesFor(card, cards, false),
  };
}

export function dailyQuestions(cards, missed) {
  const review = shuffle(missed).slice(0, 2);
  const missedIds = new Set(missed.map(card => card.id));
  const other = [
    ...shuffle(cards.filter(card => !missedIds.has(card.id))),
    ...shuffle(missed.filter(card => !review.includes(card))),
  ].slice(0, 5 - review.length);
  return shuffle([...review, ...other]).map(card => question(card, cards));
}

export function rematchQuestions(cards, missed) {
  return shuffle(missed).slice(0, 10).map(card => question(card, cards));
}

export function bossQuestions(cards, chapter) {
  const chapterCards = shuffle(cards.filter(card => card.chapters.includes(chapter)));
  const nouns = chapterCards.filter(card => articles.includes(card.article)).slice(0, 2);
  const examples = chapterCards.filter(card => !nouns.includes(card)).flatMap(card => {
    const example = practiceExample(card);
    if (!example?.toLowerCase().split(/[^\p{L}]+/u).includes(card.word.toLowerCase())) return [];
    return [{ card, example }];
  }).slice(0, 2);
  const translations = chapterCards.filter(card =>
    !nouns.includes(card) && !examples.some(entry => entry.card === card)).slice(0, 8 - nouns.length - examples.length);
  return shuffle([
    ...nouns.map(card => question(card, cards, 'article')),
    ...examples.map(({ card, example }) => question(card, cards, 'sentence', example)),
    ...translations.map(card => question(card, cards)),
  ]);
}
