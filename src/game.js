export class GameError extends Error {}

export const gameTypes = {
  mixed: 'Mixed',
  articles: 'Noun articles',
  nouns: 'Noun translations',
  verbs: 'Verb translations',
};

export const gameRounds = 10;
export const maxGameRounds = 20;
export const gameChapters = Array.from({ length: 12 }, (_, index) => index + 1);

export function roomSettings(room) {
  return {
    level: 'A1',
    chapter: room?.chapter ?? 0,
    totalRounds: room?.totalRounds ?? gameRounds,
    type: room?.type ?? 'mixed',
    seconds: room?.seconds ?? 10,
  };
}
export const gameSeats = 10;
const articles = ['der', 'die', 'das'];

const codeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newRoomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), value => codeAlphabet[value & 31]).join('');
}

export function gamePrompt(card, type, round) {
  const article = type === 'articles' || (type === 'mixed' && (round - 1) % 3 === 0);
  return {
    word: card.word,
    instruction: article ? 'Choose the correct article.' : 'Type the English meaning.',
    choices: article ? articles : null,
    answers: article ? card.article : card.en,
  };
}

export function gameCards(cards, type, round, chapter = 0) {
  const deck = chapter ? cards.filter(card => card.chapters.includes(chapter)) : cards;
  if (type === 'articles' || (type === 'mixed' && (round - 1) % 3 === 0)) {
    return deck.filter(card => articles.includes(card.article));
  }
  if (type === 'nouns' || (type === 'mixed' && (round - 1) % 3 === 1)) {
    return deck.filter(card => card.kind === 'noun');
  }
  return deck.filter(card => card.kind === 'verb');
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

export function gameScores(room, cards, rounds, results) {
  const scoredRounds = Object.entries(results).flatMap(([index, guesses]) => {
    const round = rounds[index];
    const card = cards.find(card => card.id === round?.cardId);
    if (!card) return [];
    return [{
      guesses,
      answers: gamePrompt(card, room.type, Number(index)).answers,
      startedAt: round.startedAt?.toMillis(),
    }];
  });

  return [[room.host, 'Host'], ...Object.entries(room.players)].map(([player, name]) => {
    let points = 0;
    let answerTime = 0;
    for (const { guesses, answers, startedAt } of scoredRounds) {
      const guess = guesses[player];
      if (!correctGuess(guess?.answer, answers)) continue;
      points += 1;
      const elapsed = guess.submittedAt?.toMillis() - startedAt;
      answerTime += Number.isFinite(elapsed) ? Math.max(0, elapsed) : Infinity;
    }
    return { player, name, points, answerTime };
  }).sort((a, b) => b.points - a.points || a.answerTime - b.answerTime || a.name.localeCompare(b.name));
}
