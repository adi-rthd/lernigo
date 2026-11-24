export const gameTypes = {
  mixed: 'Mixed',
  articles: 'Noun articles',
  nouns: 'Noun translations',
  verbs: 'Verb translations',
};

export const gameRounds = 10;
export const gameSeats = 10;

const codeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newRoomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), value => codeAlphabet[value & 31]).join('');
}

export function gamePrompt(card, type, round) {
  const article = type === 'articles' || (type === 'mixed' && (round - 1) % 3 === 0);
  return {
    word: card.word,
    instruction: article ? 'Type the article (der, die, or das).' : 'Type the English meaning.',
    answers: article ? card.article : card.en,
  };
}

export function gameCards(cards, type, round) {
  if (type === 'articles' || (type === 'mixed' && (round - 1) % 3 === 0)) {
    return cards.filter(card => ['der', 'die', 'das'].includes(card.article));
  }
  if (type === 'nouns' || (type === 'mixed' && (round - 1) % 3 === 1)) {
    return cards.filter(card => card.kind === 'noun');
  }
  return cards.filter(card => card.kind === 'verb');
}

function normalizeAnswer(value) {
  return value.normalize('NFKC').toLowerCase().trim()
    .replace(/^[\s.,!?]+|[\s.,!?]+$/g, '')
    .replace(/^(to|a|an|the)\s+/, '')
    .replace(/\s+/g, ' ');
}

export function correctGuess(guess, answers) {
  const normalized = normalizeAnswer(guess ?? '');
  if (!normalized) return false;
  const accepted = answers.split(/\s*[|;/,·]\s*/);
  return accepted.some(answer => [answer, answer.replace(/\([^)]*\)/g, '')]
    .some(variant => normalizeAnswer(variant) === normalized));
}
