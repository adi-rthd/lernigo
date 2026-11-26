import { useCallback, useEffect, useRef, useState } from 'react';
import { readLocal, writeLocal } from './useAccount.js';
import { studyDay } from './challenges.js';

const empty = { daily: {}, mistakes: {}, bosses: {} };

export function useChallenges(learner) {
  const key = 'lernigo-challenges-v1:' + learner;
  const [data, setData] = useState(() => readLocal(key, empty));
  const [today, setToday] = useState(studyDay);
  const saved = useRef(true);
  const latest = useRef(data);

  useEffect(() => {
    function sync(event) {
      if (saved.current && (event.key === key || event.key === null)) {
        latest.current = readLocal(key, empty);
        setData(latest.current);
      }
    }
    function refreshDay() { setToday(studyDay()); }
    const timer = window.setInterval(refreshDay, 30_000);
    window.addEventListener('focus', refreshDay);
    window.addEventListener('storage', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshDay);
      window.removeEventListener('storage', sync);
    };
  }, [key]);

  const update = useCallback(transform => {
    const current = saved.current ? readLocal(key, latest.current) : latest.current;
    latest.current = transform(current);
    saved.current = writeLocal(key, latest.current);
    setData(latest.current);
    return latest.current;
  }, [key]);

  return { data, today, update, storageAvailable: saved.current };
}
