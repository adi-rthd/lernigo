import { useEffect, useRef, useState } from 'react';
import { levels } from '../study.js';

const usernamePattern = '[A-Za-z0-9_]{3,24}';

function normalizedIdentity(fields) {
  return {
    firstName: fields.firstName.trim(),
    lastName: fields.lastName.trim(),
    username: fields.username.trim().toLowerCase(),
  };
}

function IdentityFields({ value, onChange, required = false, disabled }) {
  return <>
    {[
      ['firstName', 'First name', 'given-name', 60],
      ['lastName', 'Last name', 'family-name', 60],
      ['username', 'Username', 'username', 24],
    ].map(([name, label, autoComplete, maxLength]) => <label className="field" key={name}>
      {label}
      <input type="text" name={name} autoComplete={autoComplete} maxLength={maxLength} required={required} disabled={disabled}
        pattern={name === 'username' ? usernamePattern : undefined}
        title={name === 'username' ? 'Use 3–24 letters, numbers, or underscores.' : undefined}
        {...(onChange && { value: value[name] ?? '', onChange: event => onChange(name, event.target.value) })} />
    </label>)}
  </>;
}

function LevelOptions() {
  return levels.map(level => <option key={level} value={level}>{level}</option>);
}

export function Settings({ level, account, saving, save }) {
  const { profile, profileMessage, ready } = account;
  const [preferences, setPreferences] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const settings = preferences ?? { level, listed: !!profile?.listed, alias: profile?.alias ?? '',
    firstName: profile?.firstName ?? '', lastName: profile?.lastName ?? '', username: profile?.username ?? '',
  };

  function change(name, value) {
    setPreferences({ ...settings, [name]: value });
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || saving) return;
    const alias = settings.listed ? settings.alias.trim() : '';
    if (settings.listed && alias.length < 2) {
      setMessage('Enter a leaderboard name with at least two characters.');
      return;
    }
    const identity = normalizedIdentity(settings);
    const hasIdentity = Object.values(identity).some(Boolean);
    if (hasIdentity && Object.values(identity).some(value => !value)) {
      setMessage('Enter a first name, last name, and username.');
      return;
    }
    setBusy(true);
    try {
      await save({ level: settings.level, listed: settings.listed, alias, ...(hasIdentity ? identity : {}) });
      setMessage('Settings saved.');
      setPreferences(null);
    } catch {
      setMessage('Couldn’t save your settings. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="settings">
      <div className="intro"><p className="kicker">Lernigo</p><h1>Settings</h1><p>Choose your study level and how you appear on the leaderboard.</p></div>
      <form className="panel preferences" onSubmit={submit}>
        <h2>Profile</h2>
        <IdentityFields value={settings} onChange={change} disabled={busy} />
        <h2>Study level</h2>
        <label className="field">
          German level
          <select name="level" required value={settings.level} disabled={busy} onChange={event => change('level', event.target.value)}>
            <LevelOptions />
          </select>
        </label>
        <div id="board-preferences">
          <h2>Leaderboard</h2>
          <label className="check"><input type="checkbox" name="listed" checked={settings.listed} disabled={busy}
            onChange={event => change('listed', event.target.checked)} /> Show my scores on the leaderboards</label>
          {settings.listed && <label className="field">
            Leaderboard name
            <input type="text" name="alias" minLength={2} maxLength={30} autoComplete="off" required
              value={settings.alias} disabled={busy} onChange={event => change('alias', event.target.value)} />
            <span className="field-hint">Use a nickname. Signed-in learners can see it.</span>
          </label>}
        </div>
        <button className="primary" type="submit" disabled={busy || saving || !ready}>Save settings</button>
        <p className="message" aria-live="polite">{profileMessage && message === 'Settings saved.' ? profileMessage : message || profileMessage}</p>
      </form>
    </section>
  );
}

const authErrors = {
  'auth/invalid-credential': 'Check your email and password and try again.',
  'auth/email-already-in-use': 'This email is already registered. Sign in or reset your password.',
  'auth/weak-password': 'Choose a stronger password with at least six characters.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'auth/network-request-failed': 'Check your internet connection and try again.',
  'auth/operation-not-allowed': 'Email and password sign-in is disabled in Firebase.',
};

export function AccountDialog({ account, onClose, onRegistered }) {
  const { user, api, ready } = account;
  const dialog = useRef(null);
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const element = dialog.current;
    if (!element.open) element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);

  async function perform(action, success = '') {
    if (busy) return;
    setBusy(true);
    setMessage('One moment…');
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(authErrors[error.code] || 'Firebase could not complete the request. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const email = fields.get('email').trim();
    const password = fields.get('password');
    const identity = registering ? normalizedIdentity(Object.fromEntries(fields)) : null;
    if (identity && Object.values(identity).some(value => !value)) {
      setMessage('Enter a first name, last name, and username.');
      return;
    }
    void perform(async () => {
      if (registering) {
        await account.register(email, password, fields.get('level'), identity);
        onRegistered();
      } else {
        await api.signIn(email, password);
      }
      onClose();
    });
  }

  return (
    <dialog ref={dialog} aria-labelledby="auth-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
      <div className="dialog-head">
        <h2 id="auth-title">{user ? 'Your account' : registering ? 'Create an account' : 'Sign in to Lernigo'}</h2>
        <button className="outline small" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button>
      </div>
      <p id="auth-description">{user ? account.profile?.username ? '@' + account.profile.username + ' · ' + user.email : user.email : !ready ? 'Connecting to Firebase…'
        : api ? 'Sign in to sync your practice and settings across devices.' : 'Firebase could not connect. Reload this page to try again.'}</p>
      {api && ready && !user && <form id="auth-form" onSubmit={submit}>
        {registering && <IdentityFields required disabled={busy} />}
        <label className="field">Email<input type="email" name="email" autoComplete="email" required /></label>
        <label className="field">Password<input type="password" name="password"
          autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 6 : undefined} required /></label>
        {registering && <label className="field">
          What level are you studying?
          <select name="level" defaultValue="" required><option value="">Select your level</option><LevelOptions /></select>
        </label>}
        <button className="primary" type="submit" disabled={busy}>{registering ? 'Create account' : 'Sign in'}</button>
        <button className="text-button" type="button" disabled={busy} onClick={() => {
          setRegistering(!registering);
          setMessage('');
        }}>{registering ? 'Back to sign in' : 'Create an account'}</button>
        {!registering && <button className="text-button" type="button" disabled={busy} onClick={event => {
          const input = event.currentTarget.form.elements.email;
          if (input.reportValidity()) void perform(() => api.reset(input.value.trim()), 'If that account exists, check your email for a reset link.');
        }}>Reset password</button>}
      </form>}
      {user && <button type="button" className="outline" disabled={busy} onClick={() => void perform(async () => {
        await account.signOut();
        onClose();
      })}>Sign out</button>}
      <p className="message" aria-live="polite">{message}</p>
    </dialog>
  );
}
