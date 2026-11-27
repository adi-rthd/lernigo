export function speakGerman(text, reportError) {
  const synthesis = window.speechSynthesis;
  if (!synthesis || !window.SpeechSynthesisUtterance) {
    reportError('German audio is unavailable in this browser.');
    return;
  }

  const voices = synthesis.getVoices();
  const germanVoice = voices.find(voice => voice.lang.toLowerCase() === 'de-de')
    ?? voices.find(voice => /^de(?:-|$)/i.test(voice.lang));
  if (voices.length && !germanVoice) {
    reportError('A German voice is needed for audio on this device.');
    return;
  }

  reportError('');
  synthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = germanVoice?.lang ?? 'de-DE';
  if (germanVoice) utterance.voice = germanVoice;
  utterance.rate = .85;
  utterance.onerror = event => {
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      reportError('Couldn’t play German audio. Check your device’s speech settings.');
    }
  };
  synthesis.speak(utterance);
}
