import { useEffect, useMemo, useState } from 'react';
import { AccountDialog, Settings } from './components/Account.jsx';
import CheatSheet from './components/CheatSheet.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import Practice from './components/Practice.jsx';
import Progress from './components/Progress.jsx';
import { cardsForLevel } from './data/index.js';
import { guestLevelKey, guestProgressKey, readGuestLevel, readGuestProgress, useAccount } from './useAccount.js';

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
  const { user, ready, api, profileLoading } = account;
  const [page, setPage] = useState(currentPage);
  const [guestLevel, setGuestLevel] = useState(readGuestLevel);
  const [guestProgress, setGuestProgress] = useState(readGuestProgress);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [saving, setSaving] = useState(false);
  const level = user ? account.level : guestLevel;
  const learner = user?.uid ?? 'guest';
  const cards = useMemo(() => cardsForLevel(level), [level]);

  useEffect(() => {
    function navigate() {
      setPage(currentPage());
      window.scrollTo(0, 0);
    }
    function syncGuest(event) {
      if (event.key === guestLevelKey || event.key === null) setGuestLevel(readGuestLevel());
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
    if (user) {
      await api.grade(user.uid, card, result, inQuiz);
      return;
    }
    const previous = guestProgress[card.id];
    const updated = {
      ...guestProgress,
      [card.id]: {
        right: (previous?.right ?? 0) + Number(result === 'right'),
        wrong: (previous?.wrong ?? 0) + Number(result === 'wrong'),
        last: result,
      },
    };
    setGuestProgress(updated);
    try {
      localStorage.setItem(guestProgressKey, JSON.stringify(updated));
    } catch {
      return 'Browser storage is unavailable. This answer is saved for this visit.';
    }
  }

  async function saveSettings(settings) {
    if (user) await account.saveProfile(settings);
    else {
      localStorage.setItem(guestLevelKey, settings.level);
      setGuestLevel(settings.level);
    }
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
        <Practice key={learner + ':' + level} active={page === 'practice'} level={level} cards={cards}
          track={track} ready={ready} profileLoading={profileLoading} saving={saving} setSaving={setSaving}
          review={review?.level === level && review.learner === learner ? review : null} onExitReview={() => setReview(null)} />
        {page === 'progress' && <Progress level={level} cards={cards} records={user ? account.progress : guestProgress}
          synced={!!user} status={user ? account.progressMessage : ''} onReview={startReview} saving={saving} />}
        {page === 'leaderboard' && <Leaderboard key={level} initialLevel={level} user={user} api={api} ready={ready} />}
        {page === 'cheat-sheet' && <CheatSheet />}
        {page === 'settings' && <Settings key={learner} level={level} account={account} saving={saving} save={saveSettings} />}
      </main>
      <footer><span>Lernigo</span><span>German vocabulary · A1–C1</span></footer>
      {dialogOpen && <AccountDialog account={account} onClose={() => setDialogOpen(false)} onRegistered={() => {
        setReview(null);
        location.hash = 'practice';
      }} />}
    </>
  );
}
