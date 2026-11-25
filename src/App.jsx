import { useEffect, useMemo, useRef, useState } from 'react';
import { AccountDialog, ProfileSettings } from './components/Account.jsx';
import Game from './components/Game.jsx';
import Practice from './components/Practice.jsx';
import PracticeBanner from './components/PracticeBanner.jsx';
import Progress from './components/Progress.jsx';
import Read from './components/Read.jsx';
import { cardsForLevel } from './data/index.js';
import { availableLevel, availableLevels } from './study.js';
import { useSound } from './useSound.js';
import {
  addAnswer, guestAttemptsKey, guestLimit, guestProgressKey, readGuestAttempts, readGuestProgress, useAccount, writeLocal,
} from './useAccount.js';

const a1Cards = cardsForLevel('A1');
const guestDeck = [
  ...a1Cards.filter(card => card.kind === 'noun').slice(0, 3),
  ...a1Cards.filter(card => card.kind === 'verb').slice(0, 2),
];

const lockedTabs = new Set(['leaderboard', 'cheat-sheet']);

const navigation = [
  ['practice', 'Practice'],
  ['read', 'Read'],
  ['game', 'Game'],
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light');
  const sound = useSound(page);
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
      setMenuOpen(false);
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

  function changeTheme(next) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]').content = next === 'dark' ? '#17201c' : '#f7f5ed';
    try {
      localStorage.setItem('lernigo:theme', next);
    } catch {
      // Appearance remains applied for this visit.
    }
  }

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
      <header className="site-header" onKeyDown={event => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}>
        <div className="header-inner">
          <a className="brand" href="#practice" aria-label="Lernigo study home" onClick={() => setMenuOpen(false)}><img className="brand-mark" src={import.meta.env.BASE_URL + 'lernigo.svg'} width="32" height="32" alt="" />Lernigo</a>
          <button type="button" className="outline account" disabled={saving} onClick={() => { setMenuOpen(false); setDialogOpen(true); }}>{user ? 'Account' : 'Sign in'}</button>
          <button ref={menuButton} type="button" className="outline menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            <span className="menu-icon" aria-hidden="true"><span /><span /><span /></span>
          </button>
          <nav id="main-navigation" aria-label="Main navigation" data-open={menuOpen}>
            {navigation.map(([id, label]) => <a key={id} href={'#' + id} onClick={() => setMenuOpen(false)} aria-current={page === id ? 'page' : undefined}
              data-locked={lockedTabs.has(id) || undefined} aria-label={lockedTabs.has(id) ? label + ' (locked)' : undefined}>{label}</a>)}
          </nav>
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
          track={track} sound={sound} ready={ready} saving={saving} setSaving={setSaving}
          guestRemaining={!user ? guestLimit - guestAttempts : null} quizCandidates={!user ? a1Cards : null}
          review={review?.level === level && review.learner === learner ? review : null} onExitReview={() => setReview(null)} />}
        {page === 'read' && <Read cards={a1Cards} />}
        {page === 'progress' && <Progress level={level} cards={cards} records={records}
          source={user ? account.progressMessage : 'Guest progress on this browser'}
          onReview={startReview} saving={saving || locked} />}
        <Game active={page === 'game'} user={user} online={ready} name={account.profile?.username} game={api?.game}
          cards={a1Cards} sound={sound} onSignIn={() => setDialogOpen(true)} />
        {lockedTabs.has(page) && <section id={page}>
          <div className="intro"><h1>{navigation.find(([id]) => id === page)[1]}</h1></div>
          <div className="panel game-panel"><h2>Temporarily locked</h2>
            <a className="outline" href="#practice">Back to practice</a></div>
        </section>}
        {page === 'settings' && <section id="settings">
          <div className="intro"><p className="kicker">Lernigo</p><h1>Settings</h1></div>
          <div className="panel preferences device-preferences">
            <h2>Appearance and sound</h2>
            <label className="field">Theme
              <select value={theme} onChange={event => changeTheme(event.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={sound.enabled} onChange={sound.toggle} /> Sound effects
            </label>
          </div>
          {user ? <ProfileSettings key={learner} level={level} account={account} saving={saving} save={saveSettings} />
            : <button type="button" className="outline" onClick={() => setDialogOpen(true)}>Sign in to manage your profile</button>}
        </section>}
        {page === 'practice' && !locked && <PracticeBanner />}
      </main>
      <footer><span>Lernigo</span><span>German vocabulary · {availableLevels.join(", ")}</span></footer>
      {dialogOpen && <AccountDialog account={account} onClose={() => setDialogOpen(false)} onRegistered={() => {
        setReview(null);
        if (page !== 'game') location.hash = 'practice';
      }} />}
    </>
  );
}
