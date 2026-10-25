import { describe, expect, it, vi } from 'vitest';
import { GameAudio, type AudioCatalog, type AudioState } from './GameAudio';

const catalog: AudioCatalog = {
  music: [0, 1, 2].map(index => ({ id: `song-${index}`, title: `Song ${index}`, url: `/music/${index}.mp3`, duration: 180 })),
  sfx: { kill: { url: '/sfx/death.mp3', duration: 1.8, volume: .4 }, 'boss-slam': { url: '/sfx/boom.mp3', duration: .5 } },
};
const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class FakeMedia extends EventTarget {
  src = ''; preload = ''; loop = true; hidden = false; dataset: Record<string, string> = {};
  volume = 1; muted = false; paused = true; currentTime = 0; ended = false; error: object | null = null;
  playResult: () => Promise<void> = () => Promise.resolve();
  play = vi.fn(() => this.playResult().then(() => { this.paused = false; }));
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn(() => { this.currentTime = 0; this.ended = false; this.error = null; });
  remove = vi.fn();
  removeAttribute = vi.fn((name: string) => { if (name === 'src') this.src = ''; });
  finish() { this.ended = true; this.paused = true; this.dispatchEvent(new Event('ended')); }
}
class FakeDocument extends EventTarget { hidden = false; body = { appendChild: vi.fn() }; }
class FakeNode {
  connect = vi.fn(); disconnect = vi.fn();
  gain = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  pan = { value: 0 };
  frequency = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  buffer: unknown; type = ''; onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn((at?: number) => { if (at === undefined) this.onended?.(); });
  end() { this.onended?.(); }
}
class FakeContext {
  state = 'suspended'; currentTime = 10; destination = {};
  oscillators: FakeNode[] = []; sources: FakeNode[] = []; gains: FakeNode[] = []; panners: FakeNode[] = [];
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createGain = () => { const node = new FakeNode(); this.gains.push(node); return node; };
  createStereoPanner = () => { const node = new FakeNode(); this.panners.push(node); return node; };
  createOscillator = () => { const node = new FakeNode(); this.oscillators.push(node); return node; };
  createBufferSource = () => { const node = new FakeNode(); this.sources.push(node); return node; };
  decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => ({ duration: 2 } as AudioBuffer));
}

function setup(customCatalog = catalog) {
  const media = new FakeMedia();
  const doc = new FakeDocument();
  const win = new EventTarget();
  const context = new FakeContext();
  const states: AudioState[] = [];
  let now = 0;
  const createContext = vi.fn(() => context as unknown as AudioContext);
  const fetchData = vi.fn(async (_url: string, _signal: AbortSignal) => new ArrayBuffer(10));
  const createAudio = vi.fn(() => media as unknown as HTMLAudioElement);
  const audio = new GameAudio(state => states.push(state), { catalog: customCatalog,
    createAudio, createContext, fetchData, document: doc as unknown as Document,
    window: win as unknown as Window, now: () => now });
  const start = async () => { audio.setPhase('playing'); audio.unlock(); await flush(); };
  return { audio, media, doc, win, context, states, createContext, createAudio, fetchData, start,
    state: () => states.at(-1)!, advance: (ms: number) => { now += ms; } };
}

describe('streamed music lifecycle', () => {
  it('creates one inspectable stream, waits for a gesture, and never decodes songs or churns per frame', async () => {
    const h = setup();
    expect(h.media.dataset.role).toBe('background-music');
    expect(h.media.preload).toBe('metadata');
    expect(h.doc.body.appendChild).toHaveBeenCalledOnce();
    expect(h.media.play).not.toHaveBeenCalled();
    expect(h.createContext).not.toHaveBeenCalled();
    expect(h.fetchData).not.toHaveBeenCalled();
    await h.start();
    const count = h.states.length;
    for (let frame = 0; frame < 1000; frame++) {
      h.audio.setPhase('playing'); h.audio.configure({ muted: false, musicVolume: .25, sfxVolume: .6 });
    }
    expect(h.media.play).toHaveBeenCalledOnce();
    expect(h.createAudio).toHaveBeenCalledOnce();
    expect(h.createContext).toHaveBeenCalledOnce();
    expect(h.fetchData.mock.calls.map(call => call[0])).toEqual(['/sfx/death.mp3', '/sfx/boom.mp3']);
    expect(h.context.decodeAudioData).toHaveBeenCalledTimes(2);
    expect(h.states).toHaveLength(count);
    expect(h.state()).toMatchObject({ title: 'Song 0', index: 0, total: 3, status: 'playing', playing: true });
    h.audio.destroy();
  });

  it('plays every track sequentially and wraps using the same element', async () => {
    const h = setup(); await h.start();
    for (const next of [1, 2, 0, 1]) {
      h.media.finish(); await flush();
      expect(h.state()).toMatchObject({ index: next, status: 'playing' });
      expect(h.media.src).toBe(`/music/${next}.mp3`);
    }
    expect(h.createAudio).toHaveBeenCalledOnce();
    h.audio.destroy();
  });

  it('preserves position across mute, pause, countdown, menu and another run; next while paused stays paused', async () => {
    const h = setup(); await h.start();
    h.media.currentTime = 37.5;
    h.audio.configure({ muted: true }); await flush();
    expect(h.state().status).toBe('paused');
    h.audio.configure({ muted: false }); await flush();
    expect(h.media.currentTime).toBe(37.5);
    h.audio.setPhase('paused'); await flush();
    h.audio.setPhase('countdown'); await flush();
    expect(h.media.paused).toBe(true);
    h.audio.setPhase('playing'); await flush();
    expect(h.media.currentTime).toBe(37.5);
    h.audio.setPhase('menu'); await flush();
    h.audio.setPhase('playing'); await flush();
    expect(h.media.currentTime).toBe(37.5);
    h.audio.setPhase('paused'); await flush();
    const plays = h.media.play.mock.calls.length;
    h.audio.nextTrack(); await flush();
    expect(h.state()).toMatchObject({ index: 1, playing: false, status: 'paused' });
    expect(h.media.currentTime).toBe(0);
    expect(h.media.play).toHaveBeenCalledTimes(plays);
    h.audio.destroy();
  });

  it('waits for another gesture after autoplay rejection without skipping or retrying each frame', async () => {
    const h = setup();
    h.media.playResult = () => Promise.reject({ name: 'NotAllowedError' });
    await h.start();
    for (let frame = 0; frame < 100; frame++) h.audio.setPhase('playing');
    h.audio.configure({ muted: false, musicVolume: .4 }); await flush();
    expect(h.media.play).toHaveBeenCalledOnce();
    expect(h.state()).toMatchObject({ index: 0, status: 'waiting' });
    h.media.playResult = () => Promise.resolve();
    h.audio.unlock(); await flush();
    expect(h.media.play).toHaveBeenCalledTimes(2);
    expect(h.state().status).toBe('playing');
    h.audio.destroy();
  });

  it('advances a queued ended event during pause without playing, then resumes the next song', async () => {
    const h = setup(); await h.start();
    h.audio.setPhase('paused');
    const plays = h.media.play.mock.calls.length;
    h.media.finish(); await flush();
    expect(h.state()).toMatchObject({ index: 1, status: 'paused', playing: false });
    expect(h.media.play).toHaveBeenCalledTimes(plays);
    h.audio.setPhase('playing'); await flush();
    expect(h.state()).toMatchObject({ index: 1, status: 'playing' });
    expect(h.media.src).toBe('/music/1.mp3');
    h.audio.destroy();
  });

  it('suspends a context whose delayed resume completes after a pause', async () => {
    const h = setup(); const resumed = deferred<void>();
    h.context.resume.mockImplementation(() => resumed.promise.then(() => { h.context.state = 'running'; }));
    h.audio.setPhase('playing'); h.audio.unlock(); h.audio.setPhase('paused');
    resumed.resolve(); await flush();
    expect(h.context.state).toBe('suspended');
    expect(h.context.resume).toHaveBeenCalledOnce();
    expect(h.context.suspend).toHaveBeenCalledOnce();
    expect(h.media.paused).toBe(true);
    h.audio.destroy();
  });

  it('ignores stale play rejection after changing tracks and stale resolution after pausing', async () => {
    const h = setup();
    const first = deferred<void>();
    h.media.playResult = () => first.promise;
    h.audio.setPhase('playing'); h.audio.unlock();
    h.media.playResult = () => Promise.resolve();
    h.audio.nextTrack(); await flush();
    first.reject({ name: 'NotSupportedError' }); await flush();
    expect(h.state()).toMatchObject({ index: 1, status: 'playing' });
    const pending = deferred<void>();
    h.media.playResult = () => pending.promise;
    h.audio.nextTrack(); h.audio.setPhase('paused');
    pending.resolve(); await flush();
    expect(h.media.paused).toBe(true);
    expect(h.state()).toMatchObject({ index: 2, status: 'paused', playing: false });
    h.audio.destroy();
  });

  it('skips broken tracks finitely and reports unavailable when none can play', async () => {
    const h = setup();
    h.media.playResult = () => Promise.reject({ name: 'NotSupportedError' });
    await h.start();
    expect(h.media.play).toHaveBeenCalledTimes(3);
    expect(h.state()).toMatchObject({ total: 3, playing: false, status: 'unavailable' });
    h.audio.unlock(); h.audio.nextTrack(); h.audio.setPhase('paused'); h.audio.setPhase('playing'); await flush();
    expect(h.media.play).toHaveBeenCalledTimes(3);
    h.audio.destroy();
  });

  it('skips a media error once and never revisits that failed track on subsequent loops', async () => {
    const h = setup(); await h.start();
    h.media.error = { code: 3 }; h.media.dispatchEvent(new Event('error')); await flush();
    expect(h.state().index).toBe(1);
    h.media.finish(); await flush(); expect(h.state().index).toBe(2);
    h.media.finish(); await flush(); expect(h.state().index).toBe(1);
    h.audio.destroy();
  });

  it('silences both blur and hidden tabs immediately, preserving position until visible and playing', async () => {
    const h = setup(); await h.start();
    h.media.currentTime = 51; h.audio.play('letter');
    h.win.dispatchEvent(new Event('blur')); await flush();
    expect(h.media.paused).toBe(true);
    expect(h.context.state).toBe('suspended');
    expect(h.context.oscillators[0].disconnect).toHaveBeenCalled();
    h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
    h.win.dispatchEvent(new Event('focus')); await flush();
    expect(h.media.paused).toBe(true);
    h.audio.setPhase('paused'); h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange')); await flush();
    expect(h.media.paused).toBe(true);
    h.audio.setPhase('playing'); await flush();
    expect(h.media.paused).toBe(false);
    expect(h.media.currentTime).toBe(51);
    h.audio.destroy();
  });

  it('destroys idempotently and cannot be restarted by pending media promises or old DOM events', async () => {
    const h = setup(); const pending = deferred<void>();
    h.media.playResult = () => pending.promise;
    h.audio.setPhase('playing'); h.audio.unlock(); h.audio.play('letter');
    const changes = h.states.length;
    h.audio.destroy(); h.audio.destroy();
    pending.resolve(); await flush();
    h.media.finish(); h.win.dispatchEvent(new Event('focus')); h.doc.dispatchEvent(new Event('visibilitychange'));
    h.audio.unlock(); h.audio.nextTrack(); h.audio.setPhase('playing');
    expect(h.media.paused).toBe(true);
    expect(h.media.src).toBe('');
    expect(h.media.remove).toHaveBeenCalledOnce();
    expect(h.context.close).toHaveBeenCalledOnce();
    expect(h.states).toHaveLength(changes);
    expect(h.media.play).toHaveBeenCalledOnce();
  });
});

describe('bounded short effects', () => {
  it('rate limits repeated letters, caps simultaneous voices, pans and cleans up finished sources', async () => {
    const h = setup(); await h.start();
    for (let key = 0; key < 10; key++) h.audio.play('letter', { pan: 10 });
    expect(h.context.oscillators).toHaveLength(1);
    expect(h.context.panners[0].pan.value).toBe(1);
    h.advance(50); h.audio.play('letter');
    h.advance(50); h.audio.play('letter');
    expect(h.context.oscillators).toHaveLength(2);
    for (const cue of ['jam', 'impact', 'player-hurt', 'pickup', 'skill', 'victory', 'game-over'] as const) h.audio.play(cue);
    expect(h.context.oscillators).toHaveLength(8);
    h.context.oscillators[0].end(); h.advance(100); h.audio.play('letter');
    expect(h.context.oscillators).toHaveLength(9);
    h.audio.destroy();
    expect(h.context.oscillators.every(node => node.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it('warms only short effects after unlock, shares decoded buffers, and never plays a late downloaded impact', async () => {
    const h = setup();
    expect(h.fetchData).not.toHaveBeenCalled();
    const loaded = deferred<ArrayBuffer>(); h.fetchData.mockImplementation(() => loaded.promise);
    await h.start();
    h.audio.play('kill'); h.advance(200); h.audio.play('kill');
    expect(h.fetchData).toHaveBeenCalledTimes(2);
    expect(h.context.sources).toHaveLength(0);
    expect(h.context.oscillators).toHaveLength(2);
    loaded.resolve(new ArrayBuffer(100)); await flush();
    expect(h.context.sources).toHaveLength(0);
    h.advance(200); h.audio.play('kill', { pan: -.5 });
    expect(h.context.sources).toHaveLength(1);
    expect(h.context.sources[0].start).toHaveBeenCalledWith(10, 0, 1.8);
    expect(h.context.decodeAudioData).toHaveBeenCalledTimes(2);
    expect(h.fetchData.mock.calls[0][0]).toBe('/sfx/death.mp3');
    h.audio.destroy();
  });

  it('keeps a safe synthesized fallback when an effect fails instead of fetching it on every hit', async () => {
    const h = setup();
    h.fetchData.mockRejectedValue(new Error('Missing effect'));
    await h.start();
    h.audio.play('kill'); await flush();
    h.advance(1000); h.audio.play('kill'); await flush();
    expect(h.fetchData.mock.calls.filter(call => call[0] === '/sfx/death.mp3')).toHaveLength(1);
    expect(h.context.oscillators).toHaveLength(2);
    expect(h.context.sources).toHaveLength(0);
    h.audio.destroy();
  });

  it('aborts pending effect loads on destroy and does not decode or schedule anything afterward', async () => {
    const h = setup();
    const pending = deferred<ArrayBuffer>(); h.fetchData.mockImplementation(() => pending.promise);
    await h.start();
    h.audio.play('kill');
    const signal = h.fetchData.mock.calls[0][1];
    h.audio.destroy();
    expect(signal.aborted).toBe(true);
    pending.resolve(new ArrayBuffer(100)); await flush();
    expect(h.context.decodeAudioData).not.toHaveBeenCalled();
    expect(h.context.sources).toHaveLength(0);
  });

  it('allows only the final outcome cue after game over and respects volume and mute controls', async () => {
    const h = setup(); await h.start();
    h.audio.configure({ muted: false, musicVolume: 9, sfxVolume: .3 });
    expect(h.media.volume).toBe(1);
    expect(h.context.gains[0].gain.value).toBe(.3);
    h.audio.setPhase('over'); await flush();
    h.audio.play('letter'); h.audio.play('game-over');
    expect(h.media.paused).toBe(true);
    expect(h.context.oscillators).toHaveLength(1);
    h.audio.configure({ muted: true }); await flush();
    h.audio.play('victory');
    expect(h.context.oscillators).toHaveLength(1);
    h.audio.destroy();
  });
});
