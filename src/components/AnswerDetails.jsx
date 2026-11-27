import { useEffect, useRef, useState } from 'react';
import { practiceExample } from '../data/practice-examples.js';
import { english, german } from '../study.js';
import { speakGerman } from '../germanSpeech.js';

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

  return (
    <section ref={details} className="panel answer-details" aria-label="Word details">
      <div className="answer-details-header">
        <strong lang="de">{word}</strong>
        <button className="outline small" type="button" onClick={() => speakGerman(word, setError)}>Listen</button>
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
