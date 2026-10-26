import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWordSpeaker, idleSpeech, type SpeechUtterance, type WordSpeechAdapter, type WordSpeechStatus } from './wordSpeech';

function setup() {
  const utterances: SpeechUtterance[] = [];
  const states: WordSpeechStatus[] = [];
  const adapter: WordSpeechAdapter = {
    create: () => { const utterance = { lang: '', rate: 1, onend: null, onerror: null }; utterances.push(utterance); return utterance; },
    speak: vi.fn(), cancel: vi.fn(),
  };
  const speaker = createWordSpeaker(adapter, value => states.push(value));
  return { speaker, states, utterances, adapter };
}
afterEach(() => vi.useRealTimers());
describe('notebook pronunciation', () => {
  it('uses English pronunciation, clears completed audio, and allows another word', () => {
    vi.useFakeTimers();
    const { speaker, states, utterances } = setup();
    speaker.speak('apple');
    expect(utterances[0].lang).toBe('en-US');
    expect(utterances[0].rate).toBe(.85);
    expect(states.at(-1)?.state).toBe('speaking');
    utterances[0].onend?.();
    expect(states.at(-1)).toEqual(idleSpeech);
    vi.advanceTimersByTime(16000);
    expect(states.at(-1)).toEqual(idleSpeech);
  });
  it('cancels prior audio and ignores stale completion/error callbacks', () => {
    vi.useFakeTimers();
    const { speaker, states, utterances, adapter } = setup();
    speaker.speak('apple');
    speaker.speak('book');
    utterances[0].onerror?.();
    utterances[0].onend?.();
    expect(states.at(-1)?.word).toBe('book');
    expect(adapter.cancel).toHaveBeenCalledTimes(2);
    speaker.cancel();
    utterances[1].onerror?.();
    expect(states.at(-1)).toEqual(idleSpeech);
  });
  it('reports unsupported browsers and speech failures with retry available', () => {
    vi.useFakeTimers();
    const report = vi.fn();
    const unavailable = createWordSpeaker(undefined, report);
    expect(unavailable.available).toBe(false);
    unavailable.speak('book');
    expect(report.mock.calls.at(-1)?.[0].state).toBe('unavailable');
    const { speaker, states, utterances } = setup();
    speaker.speak('book');
    utterances[0].onerror?.();
    expect(states.at(-1)?.state).toBe('error');
    speaker.speak('book');
    expect(states.at(-1)?.state).toBe('speaking');
    speaker.cancel();
  });
  it('bounds a stalled speech request and cleans up silently on panel unmount', () => {
    vi.useFakeTimers();
    const { speaker, states } = setup();
    speaker.speak('book');
    vi.advanceTimersByTime(15000);
    expect(states.at(-1)?.state).toBe('error');
    speaker.speak('apple');
    const length = states.length;
    speaker.cancel(false);
    vi.advanceTimersByTime(16000);
    expect(states).toHaveLength(length);
  });
  it('contains synchronous browser exceptions', () => {
    const report = vi.fn();
    const speaker = createWordSpeaker({ create() { throw new Error('device'); }, cancel() { throw new Error('device'); }, speak() {} }, report);
    expect(() => speaker.speak('apple')).not.toThrow();
    expect(report.mock.calls.at(-1)?.[0].state).toBe('error');
  });
});
