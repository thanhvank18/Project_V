import { AUDIO_CATALOG, type AudioCue, type AudioSample, type AudioTrack } from './audioCatalog';
import type { Phase } from './types';

export type { AudioCue } from './audioCatalog';
export interface AudioState {
  title: string; index: number; total: number; playing: boolean;
  status: 'waiting' | 'playing' | 'paused' | 'unavailable';
}
export const INITIAL_AUDIO_STATE: AudioState = { title: '', index: 0, total: 0, playing: false, status: 'waiting' };
export interface AudioConfiguration { muted: boolean; musicVolume?: number; sfxVolume?: number }
export interface AudioCatalog { music: readonly AudioTrack[]; sfx: Readonly<Partial<Record<AudioCue, AudioSample>>> }
export interface GameAudioDependencies {
  catalog?: AudioCatalog;
  createAudio?: () => HTMLAudioElement;
  createContext?: () => AudioContext;
  fetchData?: (url: string, signal: AbortSignal) => Promise<ArrayBuffer>;
  document?: Document | null;
  window?: Window | null;
  now?: () => number;
}

const MAX_VOICES = 8;
const MAX_SAMPLE_BYTES = 8 * 1024 * 1024;
const MIN_INTERVAL: Record<AudioCue, number> = {
  letter: 40, jam: 120, impact: 55, kill: 100, 'player-hurt': 220,
  'boss-slam': 500, pickup: 160, skill: 300, 'game-over': 1500, victory: 1500,
};
const TONES: Record<AudioCue, { frequency: number; end: number; seconds: number; gain: number; type: OscillatorType }> = {
  letter: { frequency: 660, end: 420, seconds: .045, gain: .055, type: 'triangle' },
  jam: { frequency: 135, end: 65, seconds: .1, gain: .09, type: 'sawtooth' },
  impact: { frequency: 240, end: 75, seconds: .08, gain: .1, type: 'triangle' },
  kill: { frequency: 390, end: 110, seconds: .2, gain: .12, type: 'triangle' },
  'player-hurt': { frequency: 140, end: 45, seconds: .2, gain: .15, type: 'sawtooth' },
  'boss-slam': { frequency: 90, end: 25, seconds: .35, gain: .2, type: 'triangle' },
  pickup: { frequency: 520, end: 1040, seconds: .22, gain: .1, type: 'sine' },
  skill: { frequency: 280, end: 920, seconds: .3, gain: .12, type: 'triangle' },
  'game-over': { frequency: 320, end: 65, seconds: .65, gain: .12, type: 'triangle' },
  victory: { frequency: 390, end: 1200, seconds: .65, gain: .12, type: 'sine' },
};
const clamp = (value: number, fallback: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

/** One streamed music element and one lazily unlocked context for bounded, short effects. */
export class GameAudio {
  private readonly catalog: AudioCatalog;
  private readonly doc: Document | null;
  private readonly win: Window | null;
  private readonly now: () => number;
  private media?: HTMLAudioElement;
  private context?: AudioContext;
  private master?: GainNode;
  private phase: Phase = 'menu';
  private muted = false;
  private musicVolume = .25;
  private sfxVolume = .6;
  private unlocked = false;
  private blurred = false;
  private destroyed = false;
  private index = 0;
  private generation = 0;
  private pendingPlay: number | null = null;
  private policyBlocked = false;
  private playing = false;
  private failed = new Set<number>();
  private mediaUnavailable = false;
  private contextTransition: 'resume' | 'suspend' | null = null;
  private state: AudioState = { ...INITIAL_AUDIO_STATE };
  private lastCue = new Map<AudioCue, number>();
  private voices = new Map<number, { cue: AudioCue; stop: () => void }>();
  private voiceId = 0;
  private buffers = new Map<string, AudioBuffer | null>();
  private loads = new Map<string, AbortController>();

  constructor(private readonly onState?: (state: AudioState) => void, private readonly deps: GameAudioDependencies = {}) {
    this.catalog = deps.catalog ?? AUDIO_CATALOG;
    this.doc = deps.document === undefined ? (typeof document === 'undefined' ? null : document) : deps.document;
    this.win = deps.window === undefined ? (typeof window === 'undefined' ? null : window) : deps.window;
    this.now = deps.now ?? (() => performance.now());
    try {
      this.media = (deps.createAudio ?? (() => new Audio()))();
      this.media.preload = 'metadata';
      this.media.loop = false;
      this.media.hidden = true;
      this.media.dataset.role = 'background-music';
      this.media.volume = this.musicVolume;
      this.media.addEventListener('ended', this.onEnded);
      this.media.addEventListener('error', this.onMediaError);
      this.doc?.body?.appendChild(this.media);
      this.selectTrack(0);
    } catch { this.mediaUnavailable = true; }
    this.doc?.addEventListener('visibilitychange', this.onVisibility);
    this.win?.addEventListener('blur', this.onBlur);
    this.win?.addEventListener('focus', this.onFocus);
    this.publish();
  }

  configure(config: AudioConfiguration): void {
    if (this.destroyed) return;
    const music = config.musicVolume === undefined ? this.musicVolume : clamp(config.musicVolume, this.musicVolume);
    const sfx = config.sfxVolume === undefined ? this.sfxVolume : clamp(config.sfxVolume, this.sfxVolume);
    if (this.muted === config.muted && music === this.musicVolume && sfx === this.sfxVolume) return;
    this.muted = config.muted;
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (this.media) { this.media.volume = music; this.media.muted = this.muted; }
    if (this.master) this.master.gain.value = sfx;
    if (sfx === 0) this.stopVoices();
    this.reconcile();
  }

  setPhase(phase: Phase): void {
    if (this.destroyed || phase === this.phase) return;
    this.phase = phase;
    this.stopVoices();
    this.reconcile();
  }

  /** Call directly inside a trusted pointer/key event: no await precedes browser unlock calls. */
  unlock(): void {
    if (this.destroyed) return;
    this.unlocked = true;
    this.policyBlocked = false;
    if (!this.context) {
      try {
        const create = this.deps.createContext ?? (() => {
          const NativeContext = globalThis.AudioContext
            ?? (this.win as (Window & { webkitAudioContext?: typeof AudioContext }) | null)?.webkitAudioContext;
          if (!NativeContext) throw new Error('Web Audio unavailable');
          return new NativeContext();
        });
        this.context = create();
        this.master = this.context.createGain();
        this.master.gain.value = this.sfxVolume;
        this.master.connect(this.context.destination);
      } catch { /* Streaming music can still work without Web Audio. */ }
    }
    // Only the tiny effect catalog is decoded after a gesture; songs always remain streamed.
    if (this.context) for (const sample of Object.values(this.catalog.sfx)) this.loadSample(sample);
    this.reconcile();
  }

  nextTrack(): void {
    if (this.destroyed || !this.catalog.music.length) return;
    const next = this.nextAvailable(this.index);
    if (next === undefined) { this.publish(); return; }
    this.selectTrack(next);
    this.reconcile();
  }

  play(cue: AudioCue, opts: { pan?: number; momentum?: number } = {}): void {
    const context = this.context;
    if (!this.canPlayCue(cue) || !context || context.state !== 'running' || !this.master) return;
    const now = this.now();
    if (now - (this.lastCue.get(cue) ?? -Infinity) < MIN_INTERVAL[cue]) return;
    if (this.voices.size >= MAX_VOICES || (cue === 'letter' && [...this.voices.values()].filter(voice => voice.cue === cue).length >= 2)) return;
    this.lastCue.set(cue, now);
    const sample = this.catalog.sfx[cue];
    const buffer = sample ? this.buffers.get(sample.url) : undefined;
    if (sample && buffer === undefined) this.loadSample(sample);
    // A first-use load never queues a late impact. A quiet synthesized cue covers it immediately.
    const gain = context.createGain();
    let panner: StereoPannerNode | undefined;
    if (context.createStereoPanner) {
      panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, Number.isFinite(opts.pan) ? opts.pan! : 0));
      gain.connect(panner); panner.connect(this.master);
    } else gain.connect(this.master);
    const source = buffer && sample ? context.createBufferSource() : context.createOscillator();
    const at = context.currentTime;
    let duration: number;
    let offset = 0;
    if (buffer && sample) {
      const node = source as AudioBufferSourceNode;
      node.buffer = buffer;
      offset = Math.max(0, Math.min(buffer.duration, sample.start ?? 0));
      duration = Math.min(buffer.duration - offset, sample.duration ?? buffer.duration, cue === 'game-over' || cue === 'victory' ? 6 : 3);
      gain.gain.setValueAtTime(clamp(sample.volume ?? .65, .65), at);
    } else {
      const tone = TONES[cue];
      const node = source as OscillatorNode;
      const momentum = cue === 'letter' && Number.isFinite(opts.momentum) ? Math.max(0, Math.min(5, opts.momentum!)) : 0;
      const pitch = 1 + momentum * .03;
      node.type = tone.type;
      node.frequency.setValueAtTime(tone.frequency * pitch, at);
      node.frequency.exponentialRampToValueAtTime(tone.end * pitch, at + tone.seconds);
      duration = tone.seconds;
      gain.gain.setValueAtTime(tone.gain * (1 + momentum * .025), at);
      gain.gain.exponentialRampToValueAtTime(.001, at + duration);
    }
    if (!(duration > 0)) { source.disconnect(); gain.disconnect(); panner?.disconnect(); return; }
    source.connect(gain);
    const id = ++this.voiceId;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      this.voices.delete(id);
      source.disconnect(); gain.disconnect(); panner?.disconnect();
    };
    source.onended = cleanup;
    this.voices.set(id, { cue, stop: () => { try { source.stop(); } catch { /* Already ended. */ } cleanup(); } });
    try {
      if (buffer && sample) (source as AudioBufferSourceNode).start(at, offset, duration);
      else { source.start(at); source.stop(at + duration); }
    } catch { cleanup(); }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.generation++;
    this.pendingPlay = null;
    this.doc?.removeEventListener('visibilitychange', this.onVisibility);
    this.win?.removeEventListener('blur', this.onBlur);
    this.win?.removeEventListener('focus', this.onFocus);
    if (this.media) {
      this.media.removeEventListener('ended', this.onEnded);
      this.media.removeEventListener('error', this.onMediaError);
      this.media.pause();
      this.media.removeAttribute('src');
      this.media.load();
      this.media.remove();
    }
    this.stopVoices();
    for (const controller of this.loads.values()) controller.abort();
    this.loads.clear(); this.buffers.clear();
    this.master?.disconnect();
    void this.context?.close().catch(() => {});
  }

  private backgrounded(): boolean { return this.blurred || Boolean(this.doc?.hidden); }
  private wantsMusic(): boolean {
    return !this.destroyed && this.unlocked && !this.muted && this.musicVolume > 0
      && !this.backgrounded() && this.phase === 'playing';
  }
  private wantsContext(): boolean {
    return !this.destroyed && this.unlocked && !this.muted && !this.backgrounded()
      && (this.phase === 'playing' || this.phase === 'over');
  }
  private canPlayCue(cue: AudioCue): boolean {
    return this.wantsContext() && this.sfxVolume > 0 && (this.phase === 'playing' || cue === 'game-over' || cue === 'victory');
  }

  private reconcile(): void {
    if (this.destroyed) return;
    this.syncContext();
    if (!this.wantsContext()) this.stopVoices();
    if (!this.wantsMusic()) {
      if (this.playing || this.pendingPlay !== null || (this.media && !this.media.paused)) {
        this.generation++;
        this.pendingPlay = null;
        this.media?.pause();
      }
      this.playing = false;
      this.publish();
      return;
    }
    if (!this.media || this.mediaUnavailable || !this.catalog.music.length || this.failed.size >= this.catalog.music.length
      || this.policyBlocked || this.pendingPlay !== null || this.playing) { this.publish(); return; }
    const generation = ++this.generation;
    this.pendingPlay = generation;
    let result: Promise<void>;
    try { result = this.media.play(); }
    catch (error) { this.onPlayRejected(error, generation); return; }
    this.publish();
    Promise.resolve(result).then(() => {
      if (this.destroyed || generation !== this.generation) {
        if (!this.wantsMusic()) this.media?.pause();
        return;
      }
      this.pendingPlay = null;
      this.playing = this.wantsMusic();
      if (!this.playing) this.media?.pause();
      this.publish();
    }, error => this.onPlayRejected(error, generation));
  }

  private syncContext(): void {
    const context = this.context;
    if (!context || context.state === 'closed') return;
    const desired = this.wantsContext() ? 'resume' : 'suspend';
    if (this.contextTransition || (desired === 'resume' ? context.state === 'running' : context.state === 'suspended')) return;
    this.contextTransition = desired;
    const request = desired === 'resume' ? context.resume() : context.suspend();
    void request.catch(() => {}).finally(() => {
      this.contextTransition = null;
      // Reconcile only a changed intent; a rejected resume must wait for another trusted gesture.
      if (!this.destroyed && (this.wantsContext() ? 'resume' : 'suspend') !== desired) this.syncContext();
    });
  }

  private onPlayRejected(error: unknown, generation: number): void {
    if (this.destroyed || generation !== this.generation) return;
    this.pendingPlay = null;
    this.playing = false;
    const name = (error as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'AbortError') {
      this.policyBlocked = true;
      this.publish();
    } else this.failTrack();
  }

  private selectTrack(index: number): void {
    this.generation++;
    this.pendingPlay = null;
    this.playing = false;
    this.index = index;
    if (!this.media || !this.catalog.music[index]) return;
    this.media.pause();
    this.media.src = this.catalog.music[index].url;
    this.media.load();
  }

  private nextAvailable(after: number): number | undefined {
    for (let offset = 1; offset <= this.catalog.music.length; offset++) {
      const candidate = (after + offset) % this.catalog.music.length;
      if (!this.failed.has(candidate)) return candidate;
    }
    return undefined;
  }

  private failTrack(): void {
    if (this.destroyed || !this.catalog.music.length || this.failed.has(this.index)) return;
    this.failed.add(this.index);
    const next = this.nextAvailable(this.index);
    if (next === undefined) {
      this.generation++;
      this.pendingPlay = null;
      this.playing = false;
      this.media?.pause();
      this.publish();
      return;
    }
    this.selectTrack(next);
    this.reconcile();
  }

  private onEnded = (): void => {
    // An ended event queued just before Pause/blur still advances, while reconcile keeps it silent.
    if (this.destroyed || !this.media?.ended) return;
    this.nextTrack();
  };
  private onMediaError = (): void => {
    if (this.media?.error) this.failTrack();
  };
  private onVisibility = (): void => { this.reconcile(); };
  private onBlur = (): void => { this.blurred = true; this.reconcile(); };
  private onFocus = (): void => { this.blurred = false; this.reconcile(); };

  private publish(): void {
    if (this.destroyed) return;
    const unavailable = this.mediaUnavailable || !this.catalog.music.length || this.failed.size >= this.catalog.music.length;
    const inactive = this.muted || this.musicVolume === 0 || this.backgrounded() || this.phase !== 'playing';
    const next: AudioState = { title: this.catalog.music[this.index]?.title ?? '', index: this.index,
      total: this.catalog.music.length, playing: this.playing,
      status: unavailable ? 'unavailable' : this.playing ? 'playing' : inactive ? 'paused' : 'waiting' };
    if (Object.keys(next).every(key => next[key as keyof AudioState] === this.state[key as keyof AudioState])) return;
    this.state = next;
    this.onState?.({ ...next });
  }

  private stopVoices(): void { for (const voice of [...this.voices.values()]) voice.stop(); }

  private loadSample(sample: AudioSample): void {
    const context = this.context;
    if (!context || this.loads.has(sample.url) || this.buffers.has(sample.url)) return;
    const controller = new AbortController();
    this.loads.set(sample.url, controller);
    const fetchData = this.deps.fetchData ?? (async (url: string, signal: AbortSignal) => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Audio response ${response.status}`);
      const declared = Number(response.headers.get('content-length'));
      if (declared > MAX_SAMPLE_BYTES) throw new Error('Effect exceeds short-audio budget');
      return response.arrayBuffer();
    });
    void fetchData(sample.url, controller.signal).then(bytes => {
      if (this.destroyed || controller.signal.aborted || bytes.byteLength > MAX_SAMPLE_BYTES) throw new Error('Audio load cancelled or too large');
      return context.decodeAudioData(bytes);
    }).then(buffer => {
      if (!this.destroyed) this.buffers.set(sample.url, buffer.duration <= 12 ? buffer : null);
    }).catch(() => { if (!this.destroyed) this.buffers.set(sample.url, null); })
      .finally(() => this.loads.delete(sample.url));
  }
}
