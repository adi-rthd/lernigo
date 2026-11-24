import { useEffect, useMemo, useState } from 'react';
import { configured, connectFirebase } from './firebase.js';

export const guestProgressKey = 'wortdeck-a1-guest-v1';
export const guestAttemptsKey = 'lernigo-guest-attempts-v1';
export const guestLimit = 5;
const empty = {};

function accountKey(uid, kind) {
  return 'lernigo-account-v1:' + uid + ':' + kind;
}

export function readLocal(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readGuestProgress() {
  const value = readLocal(guestProgressKey, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function readGuestAttempts() {
  const count = readLocal(guestAttemptsKey, 0);
  return Number.isInteger(count) && count >= 0 ? Math.min(count, guestLimit) : 0;
}

export function addAnswer(previous, result) {
  return {
    right: (previous?.right ?? 0) + Number(result === 'right'),
    wrong: (previous?.wrong ?? 0) + Number(result === 'wrong'),
    last: result,
    at: Date.now(),
  };
}

function mergedHistory(cloud, local) {
  const result = { ...cloud };
  for (const [id, answer] of Object.entries(local)) {
    const synced = cloud[id];
    result[id] = synced ? {
      right: synced.right + answer.right,
      wrong: synced.wrong + answer.wrong,
      last: answer.at >= synced.at ? answer.last : synced.last,
    } : answer;
  }
  return result;
}

export function useAccount() {
  const [api, setApi] = useState(null);
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [history, setHistory] = useState(null);
  const [draft, setDraft] = useState(null);
  const [localHistory, setLocalHistory] = useState(null);
  const [signupLevel, setSignupLevel] = useState(null);
  const uid = user?.uid;
  const cached = useMemo(() => uid ? {
    profile: readLocal(accountKey(uid, 'profile'), null),
    history: readLocal(accountKey(uid, 'synced-history'), empty),
    local: readLocal(accountKey(uid, 'device-history'), empty),
  } : {}, [uid]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    let stop;
    const failed = () => {
      if (active) {
        setApi(null);
        setReady(true);
      }
    };
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
    const stopProfile = api.watchProfile(uid, (value, online) => {
      if (active) setProfiles(previous => ({
        uid, online, value: online ? value : previous?.uid === uid ? previous.value : undefined,
      }));
    }, () => {
      if (active) setProfiles({ uid, online: false });
    });
    const stopHistory = api.watch(uid, (value, online) => {
      if (!active) return;
      if (online) writeLocal(accountKey(uid, 'synced-history'), value);
      setHistory(previous => ({
        uid, online, value: online ? value : previous?.uid === uid ? previous.value : undefined,
      }));
    }, () => {
      if (active) setHistory(previous => ({
        uid, online: false, value: previous?.uid === uid ? previous.value : undefined,
      }));
    });
    return () => {
      active = false;
      stopProfile();
      stopHistory();
    };
  }, [api, uid]);

  const currentProfile = profiles?.uid === uid ? profiles : null;
  const currentHistory = history?.uid === uid ? history : null;
  const deviceProfile = draft && draft.uid === uid ? draft.value : cached.profile;
  const profileOnline = currentProfile?.online ?? false;
  const pendingProfile = deviceProfile?.pending ? deviceProfile : null;
  const cloudProfile = currentProfile?.value;
  const cloudHistory = currentHistory?.value ?? cached.history ?? empty;
  const deviceHistory = localHistory && localHistory.uid === uid ? localHistory.value : cached.local ?? empty;
  const progressOnline = currentHistory?.online ?? false;

  useEffect(() => {
    if (!uid || !profileOnline || pendingProfile || !cloudProfile) return;
    writeLocal(accountKey(uid, 'profile'), { settings: cloudProfile, pending: false });
  }, [uid, profileOnline, pendingProfile, cloudProfile]);

  useEffect(() => {
    if (!api || !uid || !profileOnline || !pendingProfile) return;
    let active = true;
    api.saveProfile(uid, pendingProfile.settings).then(() => {
      if (!active) return;
      const synced = { settings: pendingProfile.settings, pending: false };
      writeLocal(accountKey(uid, 'profile'), synced);
      setProfiles({ uid, online: true, value: pendingProfile.settings });
      setDraft({ uid, value: synced });
    }).catch(() => {
      // Keep the pending settings on this device. A later connection or edit retries them.
    });
    return () => { active = false; };
  }, [api, uid, profileOnline, pendingProfile]);

  function saveProfile(settings, accountId = uid) {
    const value = { settings, pending: true };
    if (!writeLocal(accountKey(accountId, 'profile'), value)) {
      throw new Error('Account settings could not be saved on this device.');
    }
    setDraft({ uid: accountId, value });
    setSignupLevel(null);
  }

  async function register(email, password, level, identity) {
    setSignupLevel(level);
    let registration;
    try {
      registration = await api.register(email, password);
    } catch (error) {
      setSignupLevel(null);
      throw error;
    }
    const settings = { level, listed: false, alias: '', ...identity };
    try {
      saveProfile(settings, registration.user.uid);
    } catch {
      setDraft({ uid: registration.user.uid, value: { settings, pending: true } });
    }
  }

  async function signOut() {
    await api.signOut();
    setSignupLevel(null);
    setDraft(null);
    setLocalHistory(null);
    setProfiles(null);
    setHistory(null);
  }

  async function grade(card, result, inQuiz) {
    if (progressOnline && navigator.onLine) {
      try {
        await api.grade(uid, card, result, inQuiz);
        return;
      } catch (error) {
        if (!['permission-denied', 'failed-precondition'].includes(error.code)) throw error;
      }
    }
    const updated = { ...deviceHistory, [card.id]: addAnswer(deviceHistory[card.id], result) };
    const saved = writeLocal(accountKey(uid, 'device-history'), updated);
    setLocalHistory({ uid, value: updated });
    return saved ? 'Firebase sync is unavailable. Answer saved on this device.'
      : 'Answer saved for this visit. Browser storage is unavailable.';
  }

  const profile = pendingProfile?.settings ?? cloudProfile ?? deviceProfile?.settings;
  const hasDeviceAnswers = Object.keys(deviceHistory).length > 0;
  return {
    api,
    user,
    ready,
    level: profile?.level ?? signupLevel ?? 'A1',
    profile,
    profileMessage: pendingProfile ? 'Settings saved on this device. Cloud sync is pending.'
      : uid && !profileOnline ? 'Cloud settings are unavailable. You can keep studying on this device.' : '',
    progress: mergedHistory(cloudHistory, deviceHistory),
    progressMessage: hasDeviceAnswers ? 'Includes answers saved only on this device.'
      : progressOnline ? 'Synced with Firebase' : 'Showing progress available on this device.',
    saveProfile,
    register,
    signOut,
    grade,
  };
}
