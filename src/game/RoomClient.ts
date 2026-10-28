import { GameEngine } from './engine';
import { getHeroCharacter } from './characterCatalog';
import { historyKeysFor } from './vocabulary';
import type { Language } from '../i18n';
import { vocabularyForLanguage } from './englishDictionary';
import { localizeSnapshot } from './localization';
import { customDeckWords, type CustomDeck } from './customDeck';
import type { Enemy, EnginePort, GameEvent, ItemKind, Progress, Snapshot, Word, WorldObject } from './types';

export interface RoomState {
  status: 'connecting' | 'lobby' | 'playing' | 'disconnected' | 'offline' | 'expired';
  pin: string; selfId: string; hostId: string;
  players: { id: string; name: string; heroId: string; connected: boolean }[];
  error: string;
  language: Language;
  languagePending?: boolean;
  customDeck?: Pick<CustomDeck, 'id' | 'title' | 'language' | 'createdAt' | 'expiresAt' | 'damageMode'> & { entryCount: number };
}
const SESSION_KEY = 'zvs-room-session-v1';
// Rooms broadcast at 20 Hz. Blend only the rendered coordinates between those samples.
const FRAME_INTERVAL = 50;
const initialRoom = (language: Language = 'vi'): RoomState => ({ status: 'connecting', pin: '', selfId: '', hostId: '', players: [], error: '', language, languagePending: false });
const freshProgress = (): Progress => ({ highScore: 0, runs: 0, totalWords: 0, words: {}, seenWords: {} });

export function roomSocketUrl(apiUrl = import.meta.env.VITE_API_URL, locationUrl = location.href): string {
  const url = new URL(apiUrl?.trim() || locationUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search && apiUrl || url.hash && apiUrl) throw new Error('Invalid room API URL');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${apiUrl ? url.pathname.replace(/\/+$/, '') : ''}/api/rooms`;
  url.search = ''; url.hash = '';
  return url.toString();
}

/** The scene reads this port for either local play or the server-owned shared simulation. */
export class RoomClient implements EnginePort {
  private local: GameEngine;
  private state = initialRoom();
  private listeners = new Set<(room: RoomState) => void>();
  private socket: WebSocket | null = null;
  private remote: Snapshot | null = null;
  private displaySnapshot: Snapshot | null = null;
  private displayPlayer = { x: 0 };
  private motionSamples: { view: { x: number }; from: number; to: number }[] = [];
  private motionElapsed = FRAME_INTERVAL;
  private motionReady = false;
  private remoteEnemies: Enemy[] = [];
  private remoteObjects: WorldObject[] = [];
  private events: GameEvent[] = [];
  private remoteClock = 0;
  private displayClock = 0;
  private sequence = 0;
  private preferredHero = 'soldier';
  private pendingHero = '';
  private pendingLanguage: Language | null = null;
  private resumeToken = '';
  private seen = new Set<string>();
  private words: Map<string, Word>;
  private historyAnswers = new Map<string, string[]>();
  private disposed = false;
  private localPaused = false;
  private reconnects = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private movement: -1 | 0 | 1 = 0;
  private progress: Progress;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private sessionKey: string;

  constructor(progress: Progress, private onWordSeen: (word: Word) => void, bank: readonly Word[], language: Language = 'vi', private customDeck?: CustomDeck) {
    if (customDeck) { language = customDeck.language; bank = customDeckWords(customDeck); }
    this.state = initialRoom(language); this.progress = customDeck ? freshProgress() : progress;
    this.sessionKey = customDeck ? `${SESSION_KEY}:deck:${customDeck.id}` : SESSION_KEY;
    if (customDeck) this.state.customDeck = { id: customDeck.id, title: customDeck.title, language, createdAt: customDeck.createdAt,
      expiresAt: customDeck.expiresAt, entryCount: customDeck.entries.length, damageMode: customDeck.damageMode ?? 'health' };
    this.words = new Map(bank.map(word => [word.answer, word]));
    for (const word of bank) for (const key of historyKeysFor(word)) {
      const answers = this.historyAnswers.get(key);
      if (answers) answers.push(word.answer); else this.historyAnswers.set(key, [word.answer]);
    }
    this.local = this.createLocal(language);
    this.setProgress(progress);
    try { this.resumeToken = sessionStorage.getItem(this.sessionKey) ?? ''; } catch { /* Reconnection remains optional. */ }
    this.watchExpiry();
  }

  get room(): RoomState { return this.state; }
  get clock(): number { return this.state.status === 'offline' ? this.local.clock : this.displayClock; }
  get playerX(): number { return this.remote ? this.displayPlayer.x : this.local.playerX; }
  get enemies(): Enemy[] { return this.remote ? this.remoteEnemies : this.local.enemies; }
  get targetId(): number | null { return this.remote?.target?.id ?? (this.remote ? null : this.local.targetId); }
  get worldObjects(): WorldObject[] { return this.remote ? this.remoteObjects : this.local.worldObjects; }
  get players() { return this.displaySnapshot?.party?.players ?? []; }

  subscribeRoom(listener: (room: RoomState) => void): () => void {
    this.listeners.add(listener); listener(this.state);
    return () => { this.listeners.delete(listener); };
  }
  private update(patch: Partial<RoomState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
  private send(message: object): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 128 * 1024) return false;
    this.socket.send(JSON.stringify(message)); return true;
  }
  private command(command: object): void {
    if (!this.activeDeck()) return;
    if (!this.remote || this.remote.phase !== 'playing' || this.localPaused || this.state.status !== 'playing') return;
    this.send({ type: 'command', seq: this.sequence++, command });
  }

  connect(): void {
    if (!this.activeDeck()) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    this.disposed = false; clearTimeout(this.retryTimer); clearTimeout(this.timeout);
    this.motionReady = false;
    this.watchExpiry();
    this.update({ status: 'connecting', error: '' });
    let socket: WebSocket;
    try { socket = new WebSocket(roomSocketUrl()); }
    catch { this.update({ status: 'disconnected', error: 'Chưa kết nối được máy chủ phòng.' }); return; }
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.send({ type: 'hello', resumeToken: this.resumeToken, heroId: this.preferredHero, seen: this.customDeck ? [] : [...this.seen],
        language: this.state.language, ...(this.customDeck ? { deckId: this.customDeck.id } : {}) });
    };
    socket.onmessage = event => {
      if (this.socket !== socket || this.disposed) return;
      try { this.receive(JSON.parse(event.data)); }
      catch { this.update({ error: 'Dữ liệu phòng chưa hợp lệ. Hãy kết nối lại.' }); }
    };
    socket.onerror = () => { /* onclose owns reconnection and the visible message. */ };
    socket.onclose = event => {
      if (this.socket !== socket || this.disposed || this.state.status === 'offline') return;
      if (event.code === 4004) { this.expireDeck(); return; }
      this.socket = null; this.movement = 0; this.pendingLanguage = null; clearInterval(this.heartbeat); clearTimeout(this.timeout);
      this.update({ status: 'disconnected', languagePending: false, error: event.code === 4001 ? 'Phiên này đang mở ở kết nối khác.' : 'Mất kết nối. Đang thử nối lại; trận vẫn tiếp tục trên máy chủ.' });
      if (event.code !== 4001 && this.reconnects++ < 6) this.retryTimer = setTimeout(() => this.connect(), Math.min(3000, this.reconnects * 500));
    };
    this.timeout = setTimeout(() => { if (this.state.status === 'connecting') { socket.close(); this.update({ status: 'disconnected', error: 'Máy chủ phòng chưa phản hồi. Hãy thử lại hoặc chơi riêng.' }); } }, 10_000);
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => { if (this.movement) this.command({ kind: 'move', direction: this.movement }); }, 400);
  }

  private receive(message: Record<string, any>): void {
    if (message.type === 'session') {
      this.resumeToken = message.token; this.sequence = Math.max(this.sequence, message.nextSeq ?? 0);
      try { sessionStorage.setItem(this.sessionKey, this.resumeToken); } catch { /* No credential is required to keep this socket open. */ }
      return;
    }
    if (message.type === 'error') {
      if (this.customDeck && ['deck-expired', 'deck-missing'].includes(message.code)) { this.expireDeck(String(message.error)); return; }
      this.pendingHero = ''; this.pendingLanguage = null; this.update({ error: String(message.error), languagePending: false }); return;
    }
    if (message.type === 'replaced') { this.disposed = true; this.update({ status: 'disconnected', error: String(message.error) }); return; }
    if (message.type === 'room') {
      clearTimeout(this.timeout); this.reconnects = 0;
      const room = message.room as RoomState;
      if (room.status === 'expired') { this.expireDeck(room.error); return; }
      if ((room.customDeck?.id ?? '') !== (this.customDeck?.id ?? '')) { this.expireDeck('Phòng dùng bộ từ khác. Hãy mở cùng liên kết bộ từ.'); return; }
      room.language = room.language === 'en' ? 'en' : 'vi';
      if (room.language !== this.state.language) this.local = this.createLocal(room.language);
      const changedRoom = room.pin !== this.state.pin;
      if (this.customDeck && (changedRoom || room.status === 'lobby' || this.remote?.phase === 'over')) this.seen.clear();
      if (changedRoom || room.language === this.pendingLanguage || room.hostId !== room.selfId) this.pendingLanguage = null;
      const hero = room.players.find(player => player.id === room.selfId)?.heroId;
      if (hero) { this.preferredHero = hero; this.pendingHero = ''; }
      if (changedRoom || room.status === 'lobby') {
        this.remote = this.displaySnapshot = null; this.remoteEnemies = []; this.remoteObjects = []; this.events = [];
        this.motionSamples = []; this.motionReady = false;
        this.remoteClock = this.displayClock = 0; this.localPaused = false; this.movement = 0;
        this.local.toMenu(); this.local.setHero(hero);
        this.syncLocalSeen();
      }
      this.update({ ...room, languagePending: this.pendingLanguage !== null }); return;
    }
    if ((message.type === 'seen' || message.type === 'deck-seen') && Array.isArray(message.words)) {
      if (this.customDeck ? message.type !== 'deck-seen' : message.type !== 'seen') return;
      for (const answer of message.words) {
        const word = this.words.get(answer);
        if (!word || this.seen.has(answer)) continue;
        this.seen.add(answer); this.onWordSeen(word);
      }
      return;
    }
    if (message.type === 'frame' && message.snapshot && Array.isArray(message.enemies)) {
      const fresh = message.snapshot as Snapshot;
      const reset = fresh.elapsed < (this.remote?.elapsed ?? 0) || fresh.summary?.id !== this.remote?.summary?.id;
      if (reset) this.events = [];
      const clockGap = message.clock - this.remoteClock;
      const blend = this.motionReady && !reset && this.remote?.phase === 'playing' && fresh.phase === 'playing'
        && clockGap > 0 && clockGap <= 250;
      const previousEnemies = new Map(this.remoteEnemies.map(enemy => [enemy.id, enemy]));
      const previousPlayers = new Map(this.players.map(player => [player.id, player]));
      const frameEvents = (message.events ?? []) as GameEvent[];
      // Charge impacts relocate the boss immediately. The scene starts its recovery at
      // the landing position, so that coordinate must already be final when it drains events.
      const landedEnemies = new Set(frameEvents.filter(event => event.type === 'attack-impact' && event.attackKind === 'charge')
        .map(event => event.enemyId));
      this.motionSamples = []; this.motionElapsed = 0;
      const place = (view: { x: number }, from: number | undefined, to: number): void => {
        view.x = blend && from !== undefined ? from : to;
        if (view.x !== to) this.motionSamples.push({ view, from: view.x, to });
      };
      place(this.displayPlayer, this.remote && this.remote.hp > 0 && fresh.hp > 0 && this.remote.hero.id === fresh.hero.id
        ? this.displayPlayer.x : undefined, fresh.playerX);
      // Keep combat state and snapshot.playerX authoritative. Only party rendering gets a copy.
      this.displaySnapshot = { ...fresh, ...(fresh.party ? { party: { ...fresh.party, players: fresh.party.players.map(player => {
        const previous = previousPlayers.get(player.id), view = { ...player };
        place(view, previous && previous.hp > 0 && player.hp > 0 && previous.heroId === player.heroId ? previous.x : undefined, player.x);
        return view;
      }) } } : {}) };
      this.remote = fresh;
      this.remoteClock = message.clock;
      this.displayClock = blend ? Math.max(this.displayClock, message.clock) : message.clock;
      this.motionReady = fresh.phase === 'playing';
      this.remoteEnemies = message.enemies.map((enemy: Enemy) => {
        const previous = previousEnemies.get(enemy.id);
        const view = { ...enemy, challenge: { ...enemy.challenge, credited: new Set(enemy.challenge.credited as unknown as number[]) } };
        place(view, !landedEnemies.has(enemy.id) && previous?.state === 'alive' && enemy.state === 'alive'
          && previous.hp > 0 && enemy.hp > 0 ? previous.x : undefined, enemy.x);
        return view;
      });
      this.remoteObjects = (message.worldObjects ?? []).map((object: WorldObject) => ({ ...object,
        ...(object.challenge ? { challenge: { ...object.challenge, credited: new Set(object.challenge.credited as unknown as number[]) } } : {}) }));
      this.events.push(...frameEvents);
      if (this.events.length > 512) this.events.splice(0, this.events.length - 512);
      if (fresh.phase === 'over') { this.localPaused = false; this.movement = 0; }
    }
  }

  setProgress(progress: Progress): void {
    if (this.customDeck) { this.progress = freshProgress(); this.local.setProgress(this.progress); return; }
    this.progress = progress;
    this.local.setProgress(progress);
    for (const key of [...Object.keys(progress.seenWords ?? {}), ...Object.keys(progress.words)]) {
      for (const answer of this.historyAnswers.get(key.trim().toLowerCase()) ?? []) this.seen.add(answer);
    }
  }
  setLanguage(language: Language): void {
    if (this.customDeck) return;
    if (!['vi', 'en'].includes(language) || (language === this.state.language && !this.pendingLanguage)) return;
    if ((this.remote && this.remote.phase !== 'menu') || this.state.status === 'playing' || (this.state.status === 'lobby' && this.state.hostId !== this.state.selfId)) return;
    if (this.state.status === 'offline' && this.local.snapshot().phase !== 'menu') return;
    if (this.state.status === 'lobby') {
      if (language === this.pendingLanguage) return;
      if (this.send({ type: 'language', language })) { this.pendingLanguage = language; this.update({ languagePending: true, error: '' }); }
      return;
    }
    this.local = this.createLocal(language); this.syncLocalSeen();
    this.update({ language });
  }
  private createLocal(language: Language): GameEngine {
    const local = new GameEngine(Math.random, this.progress, word => {
      this.seen.add(word.answer); this.onWordSeen(this.words.get(word.answer) ?? word);
    }, this.customDeck ? [...this.words.values()] : vocabularyForLanguage([...this.words.values()], language),
    { damageMode: this.customDeck?.damageMode ?? 'health' });
    local.setHero(this.preferredHero);
    return local;
  }
  setHero(id?: string): void {
    const heroId = getHeroCharacter(id).id;
    this.preferredHero = heroId;
    if (this.state.status === 'offline') { this.local.setHero(heroId); return; }
    const current = this.state.players.find(player => player.id === this.state.selfId)?.heroId;
    if (this.state.status !== 'lobby' || current === heroId || this.pendingHero === heroId) return;
    this.pendingHero = heroId;
    if (!this.send({ type: 'hero', heroId })) this.pendingHero = '';
  }
  start(mode: 'survival' | 'boss' = 'survival'): void {
    if (!this.activeDeck()) return;
    if (this.state.status === 'offline') {
      if (this.customDeck) { this.seen.clear(); this.local = this.createLocal(this.state.language); }
      this.local.start(mode);
    }
    else { this.localPaused = false; this.send({ type: 'start', mode }); }
  }
  setMovement(direction: -1 | 0 | 1): void {
    if (!this.activeDeck()) return;
    if (this.state.status === 'offline') this.local.setMovement(direction);
    else { this.movement = direction; this.command({ kind: 'move', direction }); }
  }
  cancelApproach(): void {
    if (this.state.status === 'offline') this.local.cancelApproach();
    else this.command({ kind: 'cancel-approach' });
  }
  step(deltaMs: number): void {
    if (!this.activeDeck()) return;
    if (this.state.status === 'offline') this.local.step(deltaMs);
    else if (this.remote?.phase === 'playing') {
      const dt = Math.max(0, deltaMs);
      this.displayClock = Math.min(this.remoteClock + FRAME_INTERVAL, this.displayClock + dt);
      this.motionElapsed = Math.min(FRAME_INTERVAL, this.motionElapsed + dt);
      const progress = this.motionElapsed / FRAME_INTERVAL;
      for (const sample of this.motionSamples) sample.view.x = sample.from + (sample.to - sample.from) * progress;
      if (progress === 1) this.motionSamples.length = 0;
    }
  }
  typeKey(key: string): void { if (!this.activeDeck()) return; if (this.state.status === 'offline') this.local.typeKey(key); else this.command({ kind: 'type', key }); }
  cycleTarget(direction = 1): void { if (!this.activeDeck()) return; if (this.state.status === 'offline') this.local.cycleTarget(direction); else this.command({ kind: 'cycle', direction: direction < 0 ? -1 : 1 }); }
  useItem(item: ItemKind): void { if (!this.activeDeck()) return; if (this.state.status === 'offline') this.local.useItem(item); else this.command({ kind: 'item', item }); }
  interactWorld(): void { if (!this.activeDeck()) return; if (this.state.status === 'offline') this.local.interactWorld(); else this.command({ kind: 'interact' }); }
  pause(): void {
    if (this.state.status === 'offline') this.local.pause();
    else if (this.remote?.phase === 'playing') {
      this.setMovement(0);
      // A neutral movement packet also serves as the server watchdog; explicitly stop
      // autonomous melee movement before input is locally paused, without losing the word.
      this.cancelApproach();
      this.localPaused = true;
    }
  }
  resume(): void { if (this.state.status === 'offline') this.local.resume(); else if (this.state.status === 'playing') this.localPaused = false; }
  toMenu(): void {
    if (this.state.status === 'offline') {
      if (this.customDeck) this.local = this.createLocal(this.state.language);
      this.local.toMenu();
    }
    else if (this.remote?.phase === 'over' && this.state.hostId === this.state.selfId) this.returnToLobby();
    else this.createRoom();
  }
  returnToLobby(): void { this.send({ type: 'lobby' }); }
  snapshot(): Snapshot {
    const snapshot = !this.remote ? this.local.snapshot()
      : (this.localPaused || this.state.status === 'disconnected' || this.state.status === 'connecting') && this.remote.phase === 'playing'
        ? { ...this.displaySnapshot!, phase: 'paused' as const } : this.displaySnapshot!;
    return localizeSnapshot(snapshot, this.state.language);
  }
  drainEvents(): GameEvent[] {
    if (this.state.status === 'offline') return this.local.drainEvents();
    const events = this.events; this.events = []; return events;
  }
  joinRoom(pin: string): void { if (this.activeDeck()) this.send({ type: 'join', pin: pin.trim() }); }
  createRoom(): void {
    if (!this.activeDeck()) return;
    if (this.socket?.readyState === WebSocket.OPEN && !this.disposed) this.send({ type: 'create' });
    else { this.resumeToken = ''; this.reconnects = 0; this.connect(); }
  }
  playOffline(): void {
    if (!this.activeDeck()) return;
    this.dispose(); this.remote = this.displaySnapshot = null; this.remoteEnemies = []; this.remoteObjects = []; this.events = [];
    this.local.toMenu(); this.local.setHero(this.preferredHero);
    this.syncLocalSeen();
    this.update({ ...initialRoom(this.state.language), status: 'offline' }); this.watchExpiry();
  }
  dispose(): void {
    this.disposed = true; clearInterval(this.heartbeat); clearTimeout(this.retryTimer); clearTimeout(this.timeout);
    clearTimeout(this.expiryTimer);
    this.socket?.close(); this.socket = null; this.movement = 0;
    this.motionSamples = []; this.motionReady = false;
  }
  private syncLocalSeen(): void {
    if (this.customDeck) { this.local.setProgress(freshProgress()); return; }
    this.local.setProgress({ highScore: 0, runs: 0, totalWords: 0, words: {}, seenWords: Object.fromEntries([...this.seen].map(answer => [answer, 1])) });
  }

  private activeDeck(): boolean {
    if (this.state.status === 'expired') return false;
    if (this.customDeck && Date.now() >= this.customDeck.expiresAt) { this.expireDeck(); return false; }
    return true;
  }
  private watchExpiry(): void {
    clearTimeout(this.expiryTimer);
    if (this.customDeck && this.activeDeck()) this.expiryTimer = setTimeout(() => this.expireDeck(), Math.max(0, this.customDeck.expiresAt - Date.now()));
  }
  private expireDeck(error = 'Liên kết bộ từ đã hết hạn sau 24 giờ.'): void {
    this.dispose(); this.local.toMenu(); this.remote = this.displaySnapshot = null; this.remoteEnemies = []; this.remoteObjects = []; this.events = [];
    this.resumeToken = ''; this.localPaused = false;
    try { sessionStorage.removeItem(this.sessionKey); } catch { /* Storage is optional. */ }
    this.update({ status: 'expired', players: [], pin: '', error, languagePending: false });
  }
}
