import a1Cards from './vocabulary.json';
import starters from './starter-vocabulary.json';

const vocabulary = [...a1Cards.map(card => ({ ...card, level: 'A1' })), ...starters];

export function cardsForLevel(level) {
  return vocabulary.filter(card => card.level === level);
}

export const asset = filename => import.meta.env.BASE_URL + 'assets/' + filename;
