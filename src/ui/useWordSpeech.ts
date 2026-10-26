import { useCallback, useEffect, useState } from 'react';
import { browserWordSpeech, createWordSpeaker, idleSpeech } from '../game/wordSpeech';

export function useWordSpeech(context: string) {
  const [status, setStatus] = useState(idleSpeech);
  const [speaker] = useState(() => createWordSpeaker(browserWordSpeech(), setStatus));
  useEffect(() => { speaker.cancel(); return () => speaker.cancel(false); }, [speaker, context]);
  const speak = useCallback((word: string) => speaker.speak(word), [speaker]);
  const stop = useCallback(() => speaker.cancel(), [speaker]);
  return { status, available: speaker.available, speak, stop };
}
