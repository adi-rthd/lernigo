import { configured, connectFirebase } from './firebase.js';
import { choicesFor, english, german, levels, shuffle } from './study.js';

const $ = id => document.getElementById(id);
const guestKey = 'wortdeck-a1-guest-v1';
const guestLevelKey = 'lernigo-guest-level';
let cards = [];
let deck = [];
let index = 0;
let type = 'all';
let mode = 'flash';
let level = getGuestLevel();
let reviewIds = null;
let flipped = false;
let quizOptions = [];
let quizAnswer = null;
let quizSaved = false;
let saving = false;
let roundRight = 0;
let historyFilter = 'all';
let view = 'practice';
let db;
let user;
let profile;
let profileStatus = '';
let preferredSignupLevel;
let stopWatching;
let stopProfile;
let stopBoard;
let boardLevel = level;
let accountReady = !configured;
let cloudStatus = '';
let authMode = 'sign-in';
let authBusy = false;
let settingsBusy = false;
let dataState = 'loading';
let guestProgress = getGuestProgress();
let cloudProgress = {};

function getGuestLevel() {
  try {
    const saved = localStorage.getItem(guestLevelKey);
    return levels.includes(saved) ? saved : 'A1';
  } catch {
    return 'A1';
  }
}

function getGuestProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(guestKey));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
  } catch {
    // Browser storage can be unavailable or contain malformed data.
  }
  return {};
}

function progressRecords() {
  return user ? cloudProgress : guestProgress;
}

function applyLevel(next) {
  if (level === next) return;
  level = next;
  boardLevel = next;
  reviewIds = null;
  $('chapter').value = 'all';
  resetDeck();
}

function levelCards() {
  return cards.filter(card => card.level === level);
}

function showView() {
  const requested = location.hash.slice(1);
  view = ['practice', 'progress', 'leaderboard', 'cheat-sheet', 'settings'].includes(requested) ? requested : 'practice';
  for (const section of document.querySelectorAll('[data-view]')) section.hidden = section.id !== view;
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (view === 'progress') renderProgress();
  stopBoard?.();
  stopBoard = undefined;
  if (view === 'leaderboard') loadBoard();
  if (view === 'settings') renderSettings(true);
  if (view === 'cheat-sheet' && !$('pages').childElementCount) {
    for (let page = 1; page <= 4; page++) {
      const image = new Image();
      image.src = './assets/cheat-sheet-' + page + '.webp';
      image.alt = 'German A1 cheat sheet, page ' + page + ' of 4';
      image.width = 1041;
      image.height = 1347;
      image.loading = 'lazy';
      $('pages').append(image);
    }
  }
  window.scrollTo(0, 0);
}

function clearQuestion() {
  flipped = false;
  quizOptions = [];
  quizAnswer = null;
  quizSaved = false;
}

function resetDeck(mix = false) {
  const chapter = $('chapter').value;
  deck = levelCards().filter(card => reviewIds ? reviewIds.has(card.id) :
    (type === 'all' || type === card.kind) && (chapter === 'all' || card.chapters.includes(Number(chapter))));
  if (mix) deck = shuffle(deck);
  index = 0;
  roundRight = 0;
  clearQuestion();
  $('save-message').textContent = '';
  renderCard();
}

function renderCard() {
  const card = deck[index];
  const quiz = mode === 'mcq';
  const loadingProfile = !!user && profileStatus === 'Loading your settings…' && !preferredSignupLevel;
  const ended = dataState !== 'loading' && !loadingProfile && !card;
  const waiting = saving || !accountReady || loadingProfile;
  $('study-level').textContent = level;
  $('deck-description').textContent = level === 'A1'
    ? 'Nouns and verbs from chapters 1–12.'
    : level + ' starter deck · ' + levelCards().length + ' words.';
  $('review-banner').hidden = !reviewIds;
  $('chapter-field').hidden = level !== 'A1';
  $('types').querySelectorAll('button').forEach(button => { button.disabled = saving || !!reviewIds; });
  $('modes').querySelectorAll('button').forEach(button => { button.disabled = saving; });
  $('chapter').disabled = saving || !!reviewIds;
  $('direction').disabled = saving || !!quizAnswer;
  $('exit-review').disabled = saving;
  $('restart').hidden = !deck.length;
  $('account').disabled = saving;
  $('card-area').hidden = ended || quiz || loadingProfile;
  $('quiz-area').hidden = !quiz || !card || loadingProfile;
  $('end-state').hidden = !ended;
  $('flashcard').disabled = !card || saving;
  $('shuffle').disabled = saving || deck.length < 2;
  $('session-progress').max = deck.length || 1;
  $('session-progress').value = index + Number(quizSaved && !!quizAnswer);
  $('deck-size').textContent = dataState === 'loading'
    ? 'Loading cards…' : deck.length + (deck.length === 1 ? ' word' : ' words');
  $('position').textContent = loadingProfile ? 'Loading your study level…' : card
    ? (quiz ? 'Question ' : 'Card ') + (index + 1) + ' of ' + deck.length
    : dataState === 'loading' ? 'Loading deck…' : index + ' of ' + deck.length + ' answered';
  const graded = index + Number(quizSaved && !!quizAnswer);
  $('round-summary').textContent = graded ? roundRight + ' right · ' + (graded - roundRight) + ' wrong' : '';
  $('wrong').disabled = $('right').disabled = !card || !flipped || waiting;
  if (!card) {
    $('end-title').textContent = dataState === 'error' ? 'Couldn’t load the deck' : deck.length ? 'You finished this deck' : 'No cards in this deck';
    $('end-description').textContent = dataState === 'error' ? 'Reload this page to try again.'
      : deck.length ? roundRight + ' right and ' + (deck.length - roundRight) + ' wrong in this round.'
      : 'Choose a different chapter or word type to keep practising.';
    return;
  }
  if (quiz) {
    renderQuiz(card);
    return;
  }
  const germanSide = ($('direction').value === 'de') !== flipped;
  const word = germanSide ? german(card) : english(card);
  $('kind').textContent = card.kind === 'noun' ? 'Noun' : 'Verb';
  $('card-language').textContent = germanSide ? 'German' : 'English';
  $('card-word').textContent = word;
  $('card-word').lang = germanSide ? 'de' : 'en';
  $('card-word').classList.toggle('long', word.length > 28);
  $('card-hint').textContent = flipped ? '' :
    germanSide ? 'Think of the English meaning.' : card.kind === 'noun' ? 'Recall the German noun and its article.' : 'Recall the German verb.';
  $('card-note').hidden = !(flipped && card.notes);
  $('card-note').textContent = card.notes;
  $('flashcard').setAttribute('aria-pressed', String(flipped));
  $('card-instruction').textContent = flipped ? 'Show prompt' : 'Reveal answer';
}

function renderQuiz(card) {
  const germanAnswer = $('direction').value === 'en';
  const prompt = germanAnswer ? english(card) : german(card);
  $('quiz-kind').textContent = card.kind === 'noun' ? 'Noun' : 'Verb';
  $('quiz-language').textContent = germanAnswer ? 'English' : 'German';
  $('quiz-prompt').textContent = prompt;
  $('quiz-prompt').lang = germanAnswer ? 'en' : 'de';
  $('quiz-prompt').classList.toggle('long', prompt.length > 28);
  $('quiz-instruction').textContent = germanAnswer ? 'Choose the German translation.' : 'Choose the English meaning.';
  if (!quizOptions.length) {
    quizOptions = choicesFor(card, levelCards(), germanAnswer);
    $('quiz-options').replaceChildren(...quizOptions.map((choice, optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.option = optionIndex;
      const letter = document.createElement('span');
      letter.className = 'choice-letter';
      letter.setAttribute('aria-hidden', 'true');
      letter.textContent = 'ABCD'[optionIndex];
      const label = document.createElement('span');
      label.lang = germanAnswer ? 'de' : 'en';
      label.textContent = choice.text;
      button.append(letter, label);
      return button;
    }));
  }
  [...$('quiz-options').children].forEach((button, optionIndex) => {
    const choice = quizOptions[optionIndex];
    const result = quizAnswer && (choice.correct ? 'right' : choice === quizAnswer ? 'wrong' : '');
    button.disabled = !!quizAnswer || saving || !accountReady;
    button.dataset.result = result || '';
  });
  $('quiz-feedback').hidden = !quizAnswer;
  if (quizAnswer) {
    $('quiz-result').textContent = quizAnswer.correct ? 'Correct.' : 'Correct answer: ' + quizOptions.find(choice => choice.correct).text;
    $('quiz-next').disabled = saving;
    $('quiz-next').textContent = quizSaved ? index + 1 === deck.length ? 'See results' : 'Next question' : saving ? 'Saving…' : 'Retry save';
  }
}

function flip() {
  if (!deck[index] || saving || mode !== 'flash') return;
  flipped = !flipped;
  renderCard();
}

function nextCard(focus = false) {
  index++;
  clearQuestion();
  renderCard();
  if (view !== 'practice' || !focus) return;
  if (!deck[index]) $('restart').focus();
  else if (mode === 'flash') $('flashcard').focus();
  else $('quiz-options').firstElementChild?.focus();
}

async function grade(result, inQuiz = false) {
  const card = deck[index];
  if (!card || saving || !accountReady || (inQuiz ? !quizAnswer || quizSaved : !flipped)) return;
  const moveFocus = inQuiz || document.activeElement?.closest('.grading, .flashcard');
  const uid = user?.uid;
  saving = true;
  $('save-message').textContent = uid ? 'Saving answer…' : '';
  renderCard();
  let saved = false;
  try {
    if (uid) {
      await db.grade(uid, card, result, inQuiz);
      $('save-message').textContent = '';
    } else {
      const previous = guestProgress[card.id];
      guestProgress[card.id] = {
        right: (previous?.right ?? 0) + Number(result === 'right'),
        wrong: (previous?.wrong ?? 0) + Number(result === 'wrong'),
        last: result,
      };
      try {
        localStorage.setItem(guestKey, JSON.stringify(guestProgress));
      } catch {
        $('save-message').textContent = 'Browser storage is unavailable. This answer is saved for this visit.';
      }
    }
    if (uid !== user?.uid || card !== deck[index]) return;
    roundRight += Number(result === 'right');
    saved = true;
    if (inQuiz) quizSaved = true;
  } catch {
    $('save-message').textContent = 'Couldn’t save your answer. Check your connection and try again.';
  } finally {
    saving = false;
    if (saved && !inQuiz) nextCard(moveFocus);
    else renderCard();
    if (view === 'progress') renderProgress();
    if (view === 'practice' && inQuiz && quizAnswer) $('quiz-next').focus();
    if (view === 'settings') renderSettings();
  }
}

function renderProgress() {
  const records = progressRecords();
  const current = levelCards();
  const studied = current.filter(card => records[card.id]);
  const correct = studied.filter(card => records[card.id].last === 'right');
  const missed = studied.filter(card => records[card.id].last === 'wrong');
  const fresh = current.filter(card => !records[card.id]);
  const countsAvailable = !user || !cloudStatus;
  $('progress-level').textContent = 'Your ' + level + ' answers and words to review.';
  for (const [label, value] of Object.entries({ studied, right: correct, wrong: missed, new: fresh })) {
    $('total-' + label).textContent = countsAvailable && dataState === 'ready' ? value.length : '–';
  }
  $('start-review').disabled = saving || !countsAvailable || !missed.length;
  $('progress-source').textContent = user ? cloudStatus || 'Synced with Firebase' : 'Guest progress on this browser';
  const rows = countsAvailable ? { all: studied, right: correct, wrong: missed, new: fresh }[historyFilter] : [];
  const fragment = document.createDocumentFragment();
  for (const card of rows) {
    const record = records[card.id];
    const row = tableRow([german(card), english(card), record?.right ?? '–', record?.wrong ?? '–',
      record ? record.last === 'right' ? 'Right' : 'Wrong' : 'Unstudied']);
    row.firstChild.lang = 'de';
    if (record) row.lastChild.dataset.result = record.last;
    fragment.append(row);
  }
  $('history').replaceChildren(fragment);
  $('history-scroll').hidden = !rows.length;
  $('history-empty').hidden = !!rows.length;
  $('history-empty').textContent = !countsAvailable ? cloudStatus
    : dataState === 'loading' ? 'Loading your vocabulary…'
    : dataState === 'error' ? 'Couldn’t load the vocabulary. Reload this page to try again.'
    : historyFilter === 'wrong' ? 'No cards currently need practice.'
    : historyFilter === 'right' ? 'No cards have a correct latest answer yet.'
    : historyFilter === 'new' ? 'You’ve studied every word in the deck.'
    : 'Your answers will appear here after you study a card.';
}

function tableRow(values) {
  const row = document.createElement('tr');
  for (const value of values) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(cell);
  }
  return row;
}

function loadBoard() {
  stopBoard?.();
  stopBoard = undefined;
  $('board-heading').textContent = boardLevel + ' rankings';
  for (const button of $('board-levels').children) button.setAttribute('aria-pressed', String(button.value === boardLevel));
  $('board-table').hidden = true;
  $('board-empty').hidden = false;
  $('board-rows').replaceChildren();
  if (!user) {
    $('board-empty').textContent = accountReady ? 'Sign in to see the rankings.' : 'Connecting to Firebase…';
    return;
  }
  const requestedLevel = boardLevel;
  $('board-empty').textContent = 'Loading rankings…';
  stopBoard = db.watchLeaderboard(requestedLevel, entries => {
    if (requestedLevel !== boardLevel || view !== 'leaderboard') return;
    let rank = 0;
    let previousPoints;
    $('board-rows').replaceChildren(...entries.map((entry, i) => {
      if (previousPoints !== entry.points) rank = i + 1;
      previousPoints = entry.points;
      return tableRow([rank, entry.alias + (entry.uid === user?.uid ? ' (you)' : ''), entry.points]);
    }));
    $('board-table').hidden = !entries.length;
    $('board-empty').hidden = !!entries.length;
    $('board-empty').textContent = 'No scores yet for ' + requestedLevel + '.';
  }, () => {
    if (requestedLevel === boardLevel && view === 'leaderboard') $('board-empty').textContent = 'Rankings couldn’t load. Try again later.';
  });
}

function renderSettings(populate = false) {
  const fields = $('settings-form').elements;
  if (populate) {
    fields.level.value = level;
    fields.listed.checked = !!profile?.listed;
    fields.alias.value = profile?.alias || '';
  }
  $('board-preferences').hidden = !user;
  $('settings-guest').hidden = !!user;
  $('alias-field').hidden = !user || !fields.listed.checked;
  fields.alias.required = !!user && fields.listed.checked;
  $('save-settings').disabled = !accountReady || saving || settingsBusy || (user && !profile && profileStatus === 'Loading your settings…');
  if (populate) $('settings-message').textContent = profileStatus;
}

function showAuth() {
  const register = authMode === 'register';
  $('account-label').textContent = user ? 'Account' : 'Sign in';
  $('auth-title').textContent = user ? 'Your account' : register ? 'Create an account' : 'Sign in to Lernigo';
  $('auth-description').textContent = user ? user.email
    : !configured ? 'You can practise as a guest and save progress on this browser.'
    : !accountReady ? 'Connecting to Firebase…'
    : !db ? 'Firebase could not connect. Reload this page to try again.'
    : 'Sign in to sync your practice and settings across devices.';
  $('auth-form').hidden = !db || !accountReady || !!user;
  $('sign-out').hidden = !user;
  $('auth-submit').textContent = register ? 'Create account' : 'Sign in';
  $('auth-toggle').textContent = register ? 'Back to sign in' : 'Create an account';
  $('auth-reset').hidden = register;
  $('signup-level-field').hidden = !register;
  $('signup-level').required = register;
  $('auth-form').elements.password.autocomplete = register ? 'new-password' : 'current-password';
  $('auth-form').elements.password.minLength = register ? 6 : 0;
}

function updateAccount(nextUser) {
  const changed = user?.uid !== nextUser?.uid;
  stopWatching?.();
  stopProfile?.();
  user = nextUser;
  accountReady = true;
  cloudProgress = {};
  profile = undefined;
  profileStatus = user ? 'Loading your settings…' : '';
  cloudStatus = user ? 'Loading your synced history…' : '';
  if (user) {
    const uid = user.uid;
    applyLevel(preferredSignupLevel || 'A1');
    stopWatching = db.watch(uid, records => {
      if (user?.uid !== uid) return;
      cloudProgress = records;
      cloudStatus = '';
      if (view === 'progress') renderProgress();
    }, () => {
      if (user?.uid !== uid) return;
      cloudStatus = 'Couldn’t load synced progress. Reload the page to retry.';
      if (view === 'progress') renderProgress();
    });
    stopProfile = db.watchProfile(uid, record => {
      if (user?.uid !== uid) return;
      profile = record;
      profileStatus = '';
      applyLevel(record?.level || preferredSignupLevel || 'A1');
      renderCard();
      if (view === 'settings') renderSettings(!settingsBusy);
      if (view === 'progress') renderProgress();
      if (view === 'leaderboard') loadBoard();
    }, () => {
      if (user?.uid !== uid) return;
      profileStatus = 'Couldn’t load account settings. Try reloading this page.';
      renderCard();
      if (view === 'settings') renderSettings(true);
    });
  } else {
    applyLevel(getGuestLevel());
  }
  if (changed) {
    reviewIds = null;
    resetDeck();
    if ($('auth-dialog').open) $('auth-dialog').close();
  }
  showAuth();
  renderCard();
  if (view === 'progress') renderProgress();
  if (view === 'settings') renderSettings(true);
  if (view === 'leaderboard') loadBoard();
}

async function authAction(action, successMessage = '') {
  if (authBusy) return;
  authBusy = true;
  for (const id of ['auth-submit', 'auth-toggle', 'auth-reset', 'sign-out']) $(id).disabled = true;
  $('auth-message').textContent = 'One moment…';
  try {
    await action();
    $('auth-message').textContent = successMessage;
  } catch (error) {
    const errors = {
      'auth/invalid-credential': 'Check your email and password and try again.',
      'auth/email-already-in-use': 'This email is already registered. Sign in or reset your password.',
      'auth/weak-password': 'Choose a stronger password with at least six characters.',
      'auth/too-many-requests': 'Too many attempts. Try again later.',
      'auth/network-request-failed': 'Check your internet connection and try again.',
      'auth/operation-not-allowed': 'Email and password sign-in is disabled in Firebase.',
    };
    $('auth-message').textContent = errors[error.code] || 'Firebase could not complete the request. Try again.';
  } finally {
    authBusy = false;
    for (const id of ['auth-submit', 'auth-toggle', 'auth-reset', 'sign-out']) $(id).disabled = false;
  }
}

for (let chapter = 1; chapter <= 12; chapter++) $('chapter').add(new Option('Chapter ' + chapter, chapter));
for (const item of levels) {
  $('signup-level').add(new Option(item, item));
  $('settings-level').add(new Option(item, item));
  const button = document.createElement('button');
  button.type = 'button';
  button.value = button.textContent = item;
  $('board-levels').append(button);
}

for (const [group, key, onChange] of [
  ['types', 'type', value => { type = value; resetDeck(); }],
  ['modes', 'mode', value => { mode = value; resetDeck(); }],
  ['history-filters', 'status', value => { historyFilter = value; renderProgress(); }],
]) {
  $(group).addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.getAttribute('aria-pressed') === 'true') return;
    for (const item of $(group).children) item.setAttribute('aria-pressed', String(item === button));
    onChange(button.dataset[key]);
  });
}
$('chapter').addEventListener('change', () => resetDeck());
$('direction').addEventListener('change', () => { clearQuestion(); renderCard(); });
$('flashcard').addEventListener('click', flip);
$('shuffle').addEventListener('click', () => resetDeck(true));
$('restart').addEventListener('click', () => resetDeck());
$('right').addEventListener('click', () => grade('right'));
$('wrong').addEventListener('click', () => grade('wrong'));
$('quiz-options').addEventListener('click', event => {
  const button = event.target.closest('[data-option]');
  if (!button || button.disabled) return;
  quizAnswer = quizOptions[Number(button.dataset.option)];
  void grade(quizAnswer.correct ? 'right' : 'wrong', true);
});
$('quiz-next').addEventListener('click', () => {
  if (quizSaved) nextCard(true);
  else if (quizAnswer) void grade(quizAnswer.correct ? 'right' : 'wrong', true);
});
$('start-review').addEventListener('click', () => {
  reviewIds = new Set(levelCards().filter(card => progressRecords()[card.id]?.last === 'wrong').map(card => card.id));
  resetDeck();
  location.hash = 'practice';
});
$('exit-review').addEventListener('click', () => { reviewIds = null; resetDeck(); });
$('board-levels').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.value === boardLevel) return;
  boardLevel = button.value;
  loadBoard();
});
$('settings-form').addEventListener('change', event => {
  if (event.target.name === 'listed') renderSettings();
});
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (settingsBusy || saving) return;
  const fields = event.currentTarget.elements;
  const settings = { level: fields.level.value, listed: !!user && fields.listed.checked, alias: fields.listed.checked ? fields.alias.value.trim() : '' };
  if (settings.listed && settings.alias.length < 2) {
    $('settings-message').textContent = 'Enter a leaderboard name with at least two characters.';
    return;
  }
  settingsBusy = true;
  renderSettings();
  try {
    if (user) {
      await db.saveProfile(user.uid, settings);
      profile = settings;
      profileStatus = '';
    } else {
      localStorage.setItem(guestLevelKey, settings.level);
    }
    applyLevel(settings.level);
    $('settings-message').textContent = 'Settings saved. Your study level is ' + settings.level + '.';
  } catch {
    $('settings-message').textContent = 'Couldn’t save your settings. Try again.';
  } finally {
    settingsBusy = false;
    renderSettings();
  }
});
document.addEventListener('keydown', event => {
  if (view !== 'practice' || mode !== 'flash' || $('auth-dialog').open || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
      event.target.closest('input, select, textarea, [contenteditable]')) return;
  if (event.code === 'Space' && !event.target.closest('button, a')) {
    event.preventDefault();
    flip();
  }
  if (event.key === '1') void grade('wrong');
  if (event.key === '2') void grade('right');
});
$('account').addEventListener('click', () => {
  authMode = 'sign-in';
  $('auth-message').textContent = '';
  showAuth();
  $('auth-dialog').showModal();
});
$('close-auth').addEventListener('click', () => $('auth-dialog').close());
$('auth-dialog').addEventListener('close', () => $('auth-form').reset());
$('auth-toggle').addEventListener('click', () => {
  authMode = authMode === 'register' ? 'sign-in' : 'register';
  $('auth-message').textContent = '';
  showAuth();
});
$('auth-form').addEventListener('submit', event => {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const email = fields.email.value.trim();
  const password = fields.password.value;
  const selectedLevel = fields.level.value;
  void authAction(async () => {
    if (authMode !== 'register') {
      await db.signIn(email, password);
      return;
    }
    preferredSignupLevel = selectedLevel;
    try {
      const { user: account } = await db.register(email, password);
      applyLevel(selectedLevel);
      location.hash = 'practice';
      const settings = { level: selectedLevel, listed: false, alias: '' };
      try {
        await db.saveProfile(account.uid, settings);
        profile = settings;
      } catch {
        profileStatus = 'Your account was created. Save your study level in Settings to sync it.';
        if (view === 'settings') renderSettings(true);
      }
    } finally {
      preferredSignupLevel = undefined;
    }
  });
});
$('auth-reset').addEventListener('click', () => {
  const email = $('auth-form').elements.email;
  if (email.reportValidity()) void authAction(() => db.reset(email.value.trim()), 'If that account exists, check your email for a reset link.');
});
$('sign-out').addEventListener('click', () => { if (!saving && !settingsBusy) void authAction(() => db.signOut()); });
window.addEventListener('hashchange', showView);
window.addEventListener('storage', event => {
  if (user) return;
  if (event.key === guestKey || event.key === null) {
    guestProgress = getGuestProgress();
    if (view === 'progress') renderProgress();
  }
  if ((event.key === guestLevelKey || event.key === null) && !saving) {
    applyLevel(getGuestLevel());
    if (view === 'progress') renderProgress();
    if (view === 'settings') renderSettings(true);
  }
});

async function initializeAccount() {
  if (!configured) return;
  try {
    db = await connectFirebase();
    db.observeUser(updateAccount);
  } catch {
    accountReady = true;
    showAuth();
    renderCard();
    if (view === 'settings') renderSettings(true);
    if (view === 'leaderboard') loadBoard();
  }
}

async function readDeck(filename) {
  const response = await fetch(new URL('./assets/' + filename, import.meta.url));
  if (!response.ok) throw new Error('Vocabulary request failed');
  return response.json();
}

showView();
renderCard();
void initializeAccount();
try {
  const [a1, starters] = await Promise.all([readDeck('vocabulary.json'), readDeck('starter-vocabulary.json')]);
  cards = [...a1.map(card => ({ ...card, level: 'A1' })), ...starters];
  dataState = 'ready';
} catch {
  dataState = 'error';
}
resetDeck();
if (view === 'progress') renderProgress();
