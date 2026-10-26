export interface WordSpeechStatus { state: 'idle' | 'speaking' | 'unavailable' | 'error'; word: string; message: string }
export interface SpeechUtterance {
  lang: string; rate: number; onend: (() => void) | null; onerror: (() => void) | null;
}
export interface WordSpeechAdapter {
  create(text: string): SpeechUtterance;
  speak(utterance: SpeechUtterance): void;
  cancel(): void;
}
export const idleSpeech: WordSpeechStatus = { state: 'idle', word: '', message: '' };

/** A single utterance at a time; late callbacks cannot replace the current status. */
export function createWordSpeaker(adapter: WordSpeechAdapter | undefined, notify: (status: WordSpeechStatus) => void) {
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    revision++;
    clearTimeout(timer);
    timer = undefined;
    try { adapter?.cancel(); } catch { /* A closed audio device must not block the notebook. */ }
  };
  return {
    available: Boolean(adapter),
    cancel(announce = true) { stop(); if (announce) notify(idleSpeech); },
    speak(word: string) {
      stop();
      if (!adapter) { notify({ state: 'unavailable', word, message: 'Trình duyệt này chưa hỗ trợ đọc từ. Hãy thử Edge hoặc Chrome.' }); return; }
      const request = revision;
      const failed = () => {
        if (request !== revision) return;
        stop();
        notify({ state: 'error', word, message: 'Chưa phát được giọng tiếng Anh. Bấm nghe lại để thử.' });
      };
      try {
        const utterance = adapter.create(word);
        utterance.lang = 'en-US';
        utterance.rate = .85;
        utterance.onend = () => { if (request === revision) { clearTimeout(timer); timer = undefined; notify(idleSpeech); } };
        utterance.onerror = failed;
        notify({ state: 'speaking', word, message: `Đang đọc ${word}` });
        timer = setTimeout(failed, 15000);
        adapter.speak(utterance);
      } catch { failed(); }
    },
  };
}

export function browserWordSpeech(): WordSpeechAdapter | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
  return {
    create(text) {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = window.speechSynthesis.getVoices().find(candidate => /^en(?:-|_)/i.test(candidate.lang));
      if (voice) utterance.voice = voice;
      return utterance as unknown as SpeechUtterance;
    },
    speak(utterance) { window.speechSynthesis.speak(utterance as SpeechSynthesisUtterance); },
    cancel() { window.speechSynthesis.cancel(); },
  };
}
