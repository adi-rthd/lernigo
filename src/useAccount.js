import { useEffect, useState } from 'react';
import { configured, connectFirebase } from './firebase.js';

export const guestLevelKey = 'lernigo-guest-level';
export const guestProgressKey = 'wortdeck-a1-guest-v1';

export function readLocal(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function readGuestLevel() {
  try {
    const value = localStorage.getItem(guestLevelKey);
    return ['A1', 'A2', 'B1', 'B2', 'C1'].includes(value) ? value : 'A1';
  } catch {
    return 'A1';
  }
}

export function readGuestProgress() {
  const value = readLocal(guestProgressKey, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function useAccount() {
  const [api, setApi] = useState(null);
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [history, setHistory] = useState(null);
  const [signupLevel, setSignupLevel] = useState(null);
  const uid = user?.uid;

  useEffect(() => {
    if (!configured) return;
    let active = true;
    let stop;
    function failed() {
      if (active) {
        setApi(null);
        setReady(true);
      }
    }
    connectFirebase().then(connected => {
      if (!active) return;
      setApi(connected);
      stop = connected.observeUser(currentUser => {
        if (!active) return;
        setUser(currentUser);
        setReady(true);
      }, failed);
    }).catch(failed);
    return () => { active = false; stop?.(); };
  }, []);

  useEffect(() => {
    if (!api || !uid) return;
    let active = true;
    const stopProfile = api.watchProfile(uid, value => {
      if (active) setProfiles({ uid, value, message: '' });
    }, () => {
      if (active) setProfiles({ uid, message: 'Couldn’t load account settings. Try reloading this page.' });
    });
    const stopProgress = api.watch(uid, value => {
      if (active) setHistory({ uid, value, message: '' });
    }, () => {
      if (active) setHistory({ uid, message: 'Couldn’t load synced progress. Reload the page to retry.' });
    });
    return () => {
      active = false;
      stopProfile();
      stopProgress();
    };
  }, [api, uid]);

  async function saveProfile(settings, accountId = uid) {
    await api.saveProfile(accountId, settings);
    setProfiles({ uid: accountId, value: settings, message: '' });
    setSignupLevel(null);
  }

  async function register(email, password, level) {
    setSignupLevel(level);
    let registration;
    try {
      registration = await api.register(email, password);
    } catch (error) {
      setSignupLevel(null);
      throw error;
    }
    try {
      await saveProfile({ level, listed: false, alias: '' }, registration.user.uid);
    } catch {
      setProfiles({ uid: registration.user.uid, message: 'Account created. Save your study level in Settings to sync it.' });
    }
  }

  async function signOut() {
    await api.signOut();
    setSignupLevel(null);
  }

  const currentProfile = uid && profiles?.uid === uid ? profiles : null;
  const currentHistory = uid && history?.uid === uid ? history : null;
  return {
    api,
    user,
    ready,
    level: currentProfile?.value?.level ?? signupLevel ?? 'A1',
    profile: currentProfile?.value,
    profileLoading: Boolean(uid && !currentProfile && !signupLevel),
    profileMessage: currentProfile?.message ?? '',
    progress: currentHistory?.value ?? {},
    progressMessage: currentHistory?.message ?? 'Loading your synced history…',
    saveProfile,
    register,
    signOut,
  };
}
