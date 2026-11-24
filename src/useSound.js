import { useCallback, useEffect, useRef, useState } from 'react';

const cues = {
  start: [[440, 0, .11], [587, .08, .15]],
  tick: [[660, 0, .07]],
  correct: [[523, 0, .12], [659, .08, .12], [784, .16, .17]],
  incorrect: [[392, 0, .12], [330, .09, .16]],
  time: [[440, 0, .14]],
};

export function useSound(active, preferenceKey) {
  const audio = useRef(null);
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(preferenceKey) !== 'off';
    } catch {
      return true;
    }
  });

  useEffect(() => () => {
    const current = audio.current;
    audio.current = null;
    if (current) void current.context.close().catch(() => {});
  }, []);

  function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!audio.current) {
        const context = new Audio();
        const output = context.createGain();
        output.connect(context.destination);
        audio.current = { context, output };
      }
      const { context, output } = audio.current;
      output.gain.value = 1;
      if (context.state !== 'running') return context.resume().catch(() => {});
    } catch {
      // Audio is optional when the browser cannot create a context.
    }
  }

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(preferenceKey, next ? 'on' : 'off');
    } catch {
      // The setting still works for this visit.
    }
    if (next) unlock();
    else if (audio.current) audio.current.output.gain.value = 0;
  }

  const play = useCallback(cue => {
    const current = audio.current;
    if (!enabled || !active || document.hidden || current?.context.state !== 'running') return;

    const { context, output } = current;
    const now = context.currentTime;
    for (const [frequency, delay, duration] of cues[cue]) {
      const start = now + delay;
      const end = start + duration;
      const tone = context.createOscillator();
      const envelope = context.createGain();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(.09, start + .012);
      envelope.gain.linearRampToValueAtTime(0, end);
      tone.connect(envelope);
      envelope.connect(output);
      tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
      tone.start(start);
      tone.stop(end);
    }
  }, [active, enabled]);

  return { enabled, toggle, unlock: enabled ? unlock : undefined, play };
}
