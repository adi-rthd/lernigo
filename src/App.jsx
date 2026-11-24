import { useEffect, useMemo, useState } from 'react';
import { AccountDialog, Settings } from './components/Account.jsx';
import CheatSheet from './components/CheatSheet.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import Practice from './components/Practice.jsx';
import Progress from './components/Progress.jsx';
import { cardsForLevel } from './data/index.js';
import { availableLevel, availableLevels } from './study.js';
import {
  addAnswer, guestAttemptsKey, guestLimit, guestProgressKey, readGuestAttempts, readGuestProgress, useAccount, writeLocal,
} from './useAccount.js';

const a1Cards = cardsForLevel('A1');
const guestDeck = [
  ...a1Cards.filter(card => card.kind === 'noun').slice(0, 3),
  ...a1Cards.filter(card => card.kind === 'verb').slice(0, 2),
];

const navigation = [
  ['practice', 'Practice'],
  ['progress', 'Progress'],
  ['leaderboard', 'Leaderboard'],
  ['cheat-sheet', 'Cheat sheet'],
  ['settings', 'Settings'],
];

function currentPage() {
  const hash = location.hash.slice(1);
  return navigation.some(([id]) => id === hash) ? hash : 'practice';
}

export default function App() {
  const account = useAccount();
  const { user, ready, api } = account;
  const [page, setPage] = useState(currentPage);
  const [guestAttempts, setGuestAttempts] = useState(readGuestAttempts);
  const [guestProgress, setGuestProgress] = useState(readGuestProgress);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [saving, setSaving] = useState(false);
  const level = availableLevel(user ? account.level : 'A1');
  const locked = !user && guestAttempts >= guestLimit;
  const learner = user?.uid ?? 'guest';
  const records = user ? account.progress : guestProgress;
  const cards = useMemo(() => user ? cardsForLevel(level) : guestDeck, [level, user]);

  useEffect(() => {
    function navigate() {
      setPage(currentPage());
      window.scrollTo(0, 0);
    }
    function syncGuest(event) {
      if (event.key === guestAttemptsKey || event.key === null) setGuestAttempts(readGuestAttempts());
      if (event.key === guestProgressKey || event.key === null) setGuestProgress(readGuestProgress());
    }
    window.addEventListener('hashchange', navigate);
    window.addEventListener('storage', syncGuest);
    return () => {
      window.removeEventListener('hashchange', navigate);
      window.removeEventListener('storage', syncGuest);
    };
  }, []);

  async function track(card, result, inQuiz) {
    if (user) return account.grade(card, result, inQuiz);

    const count = Math.max(guestAttempts, readGuestAttempts());
    if (count >= guestLimit) {
      setGuestAttempts(guestLimit);
      setDialogOpen(true);
      return;
    }

    const updated = { ...guestProgress, [card.id]: addAnswer(guestProgress[card.id], result) };
    setGuestProgress(updated);
    const next = count + 1;
    const attemptsSaved = writeLocal(guestAttemptsKey, next);
    const progressSaved = writeLocal(guestProgressKey, updated);
    setGuestAttempts(next);
    if (next === guestLimit) setDialogOpen(true);
    if (!attemptsSaved || !progressSaved) return 'Browser storage is unavailable. This answer is saved for this visit.';
  }

  function saveSettings(settings) {
    const savedLevel = availableLevels.length === 1 ? account.level : settings.level;
    account.saveProfile({ ...settings, level: savedLevel });
    if (settings.level !== level) setReview(null);
  }

  function startReview(words) {
    setReview(previous => ({
      id: (previous?.id ?? 0) + 1, level, learner, ids: new Set(words.map(card => card.id)),
    }));
    location.hash = 'practice';
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#practice" aria-label="Lernigo study home"><span className="brand-mark" aria-hidden="true"><span /></span>Lernigo</a>
          <nav aria-label="Main navigation">
            {navigation.map(([id, label]) => <a key={id} href={'#' + id} aria-current={page === id ? 'page' : undefined}>{label}</a>)}
          </nav>
          <button type="button" className="outline account" disabled={saving} onClick={() => setDialogOpen(true)}>{user ? 'Account' : 'Sign in'}</button>
        </div>
      </header>
      <main>
        {locked ? <section id="practice" hidden={page !== 'practice'}>
          <div className="intro"><p className="kicker">German vocabulary</p><h1>Practice</h1></div>
          <div className="panel end-state">
            <h2>You’ve finished your five guest cards</h2>
            <p>Sign in or create an account to keep practising.</p>
            <div className="end-actions"><button type="button" className="primary" onClick={() => setDialogOpen(true)}>Sign in to continue</button></div>
          </div>
        </section> : <Practice key={learner + ':' + level} active={page === 'practice'} level={level} cards={cards} records={records}
          track={track} ready={ready} saving={saving} setSaving={setSaving}
          guestRemaining={!user ? guestLimit - guestAttempts : null} quizCandidates={!user ? a1Cards : null}
          review={review?.level === level && review.learner === learner ? review : null} onExitReview={() => setReview(null)} />}
        {page === 'progress' && <Progress level={level} cards={cards} records={records}
          source={user ? account.progressMessage : 'Guest progress on this browser'}
          onReview={startReview} saving={saving || locked} />}
        {page === 'leaderboard' && <Leaderboard key={level} initialLevel={level} user={user} api={api} ready={ready} />}
        {page === 'cheat-sheet' && <CheatSheet />}
        {page === 'settings' && (user ? <Settings key={learner} level={level} account={account} saving={saving} save={saveSettings} /> :
          <section id="settings">
            <div className="intro"><p className="kicker">Lernigo</p><h1>Settings</h1><p>Sign in to manage your profile and leaderboard settings.</p></div>
            <button type="button" className="primary" onClick={() => setDialogOpen(true)}>Sign in</button>
          </section>)}
      </main>
      <footer><span>Lernigo</span><span>German vocabulary · {availableLevels.join(", ")}</span></footer>
      {dialogOpen && <AccountDialog account={account} onClose={() => setDialogOpen(false)} onRegistered={() => {
        setReview(null);
        location.hash = 'practice';
      }} />}
    </>
  );
}
