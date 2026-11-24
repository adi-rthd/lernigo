export const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

export function german(card) {
  return card.article ? card.article + ' ' + card.word : card.word;
}

export function english(card) {
  return card.en.replaceAll(' | ', ' · ');
}

export function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const other = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[other]] = [shuffled[other], shuffled[i]];
  }
  return shuffled;
}

function equivalentTerms(word) {
  return word.toLowerCase().normalize('NFKC')
    .replace(/\([^)]*\)/g, '')
    .split(/\s*[;,·/|]\s*/)
    .map(part => part.replace(/^to\s+/, '').trim())
    .filter(Boolean);
}

export function choicesFor(card, candidates, germanAnswer) {
  const answer = germanAnswer ? german : english;
  const prompt = germanAnswer ? english : german;
  const promptTerms = new Set(equivalentTerms(prompt(card)));
  const terms = new Set(equivalentTerms(answer(card)));
  const alternatives = [];
  const sameKind = candidates.filter(candidate => candidate.kind === card.kind && candidate.id !== card.id);
  for (const candidate of shuffle(sameKind)) {
    if (equivalentTerms(prompt(candidate)).some(meaning => promptTerms.has(meaning))) continue;
    const label = answer(candidate);
    const meanings = equivalentTerms(label);
    if (!meanings.length || meanings.some(meaning => terms.has(meaning))) continue;
    alternatives.push({ text: label, correct: false });
    for (const meaning of meanings) terms.add(meaning);
    if (alternatives.length === 3) break;
  }
  return shuffle([{ text: answer(card), correct: true }, ...alternatives]);
}
