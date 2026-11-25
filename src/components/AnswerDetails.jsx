import { useEffect, useRef, useState } from 'react';
import { practiceExample } from '../data/practice-examples.js';
import { english, german } from '../study.js';

export default function AnswerDetails({ card, active, revealOnMobile = false }) {
  const word = german(card);
  const details = useRef(null);
  const [error, setError] = useState('');
  const pronunciation = card.word === 'Produkt' ? 'pro-DUKT' : '';
  const example = practiceExample(card);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
  }, [active]);

  useEffect(() => {
    if (!revealOnMobile || !window.matchMedia('(max-width: 690px)').matches) return;

    const frame = window.requestAnimationFrame(() => {
      details.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [revealOnMobile]);

  function listen() {
    const synthesis = window.speechSynthesis;
    if (!synthesis || !window.SpeechSynthesisUtterance) {
      setError('Pronunciation audio is unavailable in this browser.');
      return;
    }

    const voices = synthesis.getVoices();
    const germanVoice = voices.find(voice => voice.lang.toLowerCase() === 'de-de')
      ?? voices.find(voice => /^de(?:-|$)/i.test(voice.lang));
    if (voices.length && !germanVoice) {
      setError('A German voice is needed for pronunciation audio on this device.');
      return;
    }

    setError('');
    synthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(word);
    utterance.lang = germanVoice?.lang ?? 'de-DE';
    if (germanVoice) utterance.voice = germanVoice;
    utterance.rate = .85;
    utterance.onerror = event => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setError('Couldn’t play the German pronunciation. Check your device’s speech settings.');
      }
    };
    synthesis.speak(utterance);
  }

  return (
    <section ref={details} className="panel answer-details" aria-label="Word details">
      <div className="answer-details-header">
        <strong lang="de">{word}</strong>
        <button className="outline small" type="button" onClick={listen}>Listen</button>
      </div>
      {pronunciation && <p className="field-hint">Pronunciation: {pronunciation}</p>}
      <dl>
        <div><dt>English meaning</dt><dd lang="en">{english(card)}</dd></div>
        {example && <div><dt>German example</dt><dd lang="de">{example}</dd></div>}
      </dl>
      {error && <p className="message" role="status">{error}</p>}
    </section>
  );
}
