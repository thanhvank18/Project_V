import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomClient, roomSocketUrl } from './RoomClient';
import { WORDS } from './vocabulary';
import type { Enemy, Snapshot, Word } from './types';
import type { CustomDeck } from './customDeck';
describe('multiplayer transport endpoints', () => {
  it('uses same-origin Vite proxy locally and the public API origin on deployment', () => {
    expect(roomSocketUrl('', 'http://127.0.0.1:5174/?a=1')).toBe('ws://127.0.0.1:5174/api/rooms');
    expect(roomSocketUrl('https://projectv-production.up.railway.app', 'https://project-v-swart.vercel.app')).toBe('wss://projectv-production.up.railway.app/api/rooms');
    expect(roomSocketUrl('https://api.example.com/base/', 'https://game.example.com')).toBe('wss://api.example.com/base/api/rooms');
  });
  it('refuses credential-bearing or non-http endpoints', () => {
    expect(() => roomSocketUrl('https://user:pass@example.com', 'https://game.example.com')).toThrow();
    expect(() => roomSocketUrl('javascript:alert(1)', 'https://game.example.com')).toThrow();
    expect(() => roomSocketUrl('https://example.com?token=a', 'https://game.example.com')).toThrow();
  });
});

class StubSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: StubSocket[] = [];
  readyState = StubSocket.CONNECTING;
  bufferedAmount = 0;
  sent: Record<string, any>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) { StubSocket.instances.push(this); }
  send(value: string) { this.sent.push(JSON.parse(value)); }
  open() { this.readyState = StubSocket.OPEN; this.onopen?.(); }
  receive(message: object) { this.onmessage?.({ data: JSON.stringify(message, (_key, value) => value instanceof Set ? [...value] : value) }); }
  close(code = 1000) { this.readyState = StubSocket.CLOSED; this.onclose?.({ code }); }
}

describe('room client transitions through the public transport', () => {
  const clients: RoomClient[] = [];
  const members = [
    { id: 'self', name: 'Người chơi 1', heroId: 'soldier', connected: true },
    { id: 'friend', name: 'Người chơi 2', heroId: 'wizard', connected: true },
  ];
  beforeEach(() => {
    vi.useFakeTimers();
    StubSocket.instances = [];
    const stored = new Map<string, string>();
    vi.stubGlobal('WebSocket', StubSocket);
    vi.stubGlobal('location', { href: 'http://127.0.0.1:5174/' });
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
  });
  afterEach(() => {
    for (const client of clients.splice(0)) client.dispose();
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
  });
  const client = () => {
    const port = new RoomClient({ highScore: 0, runs: 0, totalWords: 0, words: {}, seenWords: {} }, () => {}, WORDS);
    clients.push(port); return port;
  };
  const deckClient = (onSeen = vi.fn(), overrides: Partial<CustomDeck> = {}) => {
    const deck: CustomDeck = { id: 'a'.repeat(32), title: 'Our pack', language: 'en', createdAt: Date.now(), expiresAt: Date.now() + 86_400_000,
      entries: [{ answer: 'water', meaning: 'A clear liquid.', partOfSpeech: 'noun', level: 1, type: 'fill', sentence: 'I drink ___.' }], ...overrides };
    const port = new RoomClient({ highScore: 999, runs: 9, totalWords: 99, words: {}, seenWords: { water: 1 } }, onSeen, WORDS, 'vi', deck, '  Thanh   Vân  ');
    clients.push(port); return { port, deck, onSeen };
  };

  it('isolates a custom pack from global history and scopes its resume token', () => {
    sessionStorage.setItem('zvs-room-session-v1', 'normal-token');
    const { port, deck, onSeen } = deckClient(); port.connect();
    const socket = StubSocket.instances[0]; socket.open();
    expect(socket.sent[0]).toMatchObject({ type: 'hello', resumeToken: '', seen: [], language: 'en', deckId: deck.id, playerName: 'Thanh Vân' });
    expect(port.snapshot().vocabulary).toMatchObject({ total: 1, remaining: 1 });
    socket.receive({ type: 'session', token: 'deck-token' });
    expect(sessionStorage.getItem('zvs-room-session-v1')).toBe('normal-token');
    expect(sessionStorage.getItem(`zvs-room-session-v1:deck:${deck.id}`)).toBe('deck-token');
    socket.receive({ type: 'seen', words: ['water'] }); expect(onSeen).not.toHaveBeenCalled();
    socket.receive({ type: 'deck-seen', words: ['water'] }); expect(onSeen).toHaveBeenCalledTimes(1);
    port.setLanguage('vi'); expect(port.room.language).toBe('en');
    port.playOffline(); port.start();
    expect(port.enemies[0].challenge.word.meaning).toBe('A clear liquid.');
    for (const key of 'water') port.typeKey(key);
    expect(onSeen).toHaveBeenCalledTimes(2);
    port.toMenu(); expect(port.snapshot().vocabulary.remaining).toBe(1); port.start();
    expect(port.enemies[0].challenge.word.answer).toBe('water');
  });

  it('requires a name before connecting a custom pack and only notifies when ranking status changes', () => {
    const { port, deck } = deckClient();
    const unnamed = new RoomClient({ highScore: 0, runs: 0, totalWords: 0, words: {} }, () => {}, WORDS, 'en', deck);
    clients.push(unnamed); unnamed.connect();
    expect(StubSocket.instances).toHaveLength(0); expect(unnamed.room.error).toContain('tên');
    port.connect(); const socket = StubSocket.instances[0]; socket.open();
    const listen = vi.fn(); port.subscribeRoom(listen); listen.mockClear();
    const frame = { type: 'frame', clock: 1000, snapshot: { ...port.snapshot(), phase: 'over' }, enemies: [], events: [],
      leaderboard: { runId: '12345678-1234-1234-1234-123456789abc', status: 'saving' } };
    socket.receive(frame); socket.receive(frame);
    expect(port.room.leaderboard?.status).toBe('saving'); expect(listen).toHaveBeenCalledTimes(1);
    socket.receive({ ...frame, leaderboard: { ...frame.leaderboard, status: 'saved' } });
    expect(port.room.leaderboard?.status).toBe('saved'); expect(listen).toHaveBeenCalledTimes(2);
    socket.receive({ ...frame, snapshot: { ...frame.snapshot, phase: 'playing' }, leaderboard: undefined });
    expect(port.room.leaderboard).toBeUndefined();
    socket.receive({ ...frame, leaderboard: { ...frame.leaderboard, status: 'saved' } });
    port.playOffline(); expect(port.room.leaderboard).toBeUndefined();
  });

  it('ends offline play and stops reconnecting when a custom link expires', () => {
    const { port } = deckClient(vi.fn(), { expiresAt: Date.now() + 1000 });
    port.playOffline(); port.start(); expect(port.snapshot().phase).toBe('playing');
    vi.advanceTimersByTime(1000);
    expect(port.room.status).toBe('expired'); expect(port.snapshot().phase).toBe('menu');
    port.start(); port.playOffline(); port.createRoom(); port.connect();
    expect(port.room.status).toBe('expired'); expect(StubSocket.instances).toHaveLength(0);
  });

  it('applies a published one-hit rule to offline melee heroes and preserves it on replay', () => {
    const { port } = deckClient(vi.fn(), { damageMode: 'one-hit' });
    expect(port.room.customDeck?.damageMode).toBe('one-hit');
    port.playOffline(); port.setHero('swordsman'); port.start();
    expect(port.snapshot()).toMatchObject({ hp: 1, maxHp: 1 });
    port.toMenu(); port.start(); expect(port.snapshot()).toMatchObject({ hp: 1, maxHp: 1 });
    const legacy = deckClient().port;
    expect(legacy.room.customDeck?.damageMode).toBe('health');
    legacy.playOffline(); legacy.setHero('swordsman'); legacy.start();
    expect(legacy.snapshot()).toMatchObject({ hp: 150, maxHp: 150 });
  });

  it('honors server expiry even before the browser clock says the link has expired', () => {
    const { port } = deckClient(); port.connect(); const socket = StubSocket.instances[0]; socket.open();
    socket.receive({ type: 'error', code: 'deck-expired', error: 'Liên kết bộ từ đã hết hạn sau 24 giờ.' });
    expect(port.room.status).toBe('expired'); expect(socket.readyState).toBe(StubSocket.CLOSED);
    vi.advanceTimersByTime(5000); expect(StubSocket.instances).toHaveLength(1);
  });
  function acknowledge(socket: StubSocket, port: RoomClient) {
    socket.receive({ type: 'session', token: 'test-resume-token', nextSeq: 0 });
    socket.receive({ type: 'room', room: { status: 'playing', pin: '123456', selfId: 'self', hostId: 'self', players: members, error: '' } });
    const snapshot: Snapshot = { ...port.snapshot(), phase: 'playing', elapsed: 1000, hp: 64,
      party: { selfId: 'self', players: members.map((member, index) => ({ ...member, x: 600 + index * 80, hp: index ? 100 : 64, targetId: null })) } };
    socket.receive({ type: 'frame', clock: 1000, snapshot, enemies: [], worldObjects: [], events: [] });
    return snapshot;
  }

  const enemyAt = (id: number, x: number): Enemy => ({
    id, x, kind: 'normal', side: -1, speed: 40, hp: 3, maxHp: 3, state: 'alive',
    stunUntil: 0, immuneUntil: 0, attackUntil: 0, nextAttackAt: 0, bossPhase: 0, rage: 0,
    challenge: { id, word: WORDS[0], kind: 'translate', prompt: 'test', hint: '', credited: new Set([0]), mistakes: 0, assisted: false },
  });
  function positions(socket: StubSocket, port: RoomClient, clock: number, x: number, enemies: Enemy[] = [], overrides: Partial<Snapshot> = {}) {
    const snapshot: Snapshot = { ...port.snapshot(), phase: 'playing', elapsed: clock, playerX: x,
      party: { selfId: 'self', players: members.map((member, index) => ({ ...member, x: x + index * 80, hp: 100, targetId: null })) },
      ...overrides };
    socket.receive({ type: 'frame', clock, snapshot, enemies, worldObjects: [], events: [] });
    return snapshot;
  }

  it('renders 20 Hz positions smoothly while accepting combat state and event coordinates immediately', () => {
    const port = client(); port.connect(); const socket = StubSocket.instances[0]; socket.open(); acknowledge(socket, port);
    positions(socket, port, 1000, 600, [enemyAt(1, 950)]);
    const target = { id: 1, kind: 'normal' as const, prompt: 'test', hint: '', type: 'translate' as const,
      length: 4, meaning: 'test', partOfSpeech: 'noun' as const, difficulty: 1 as const };
    const authoritative = positions(socket, port, 1050, 630, [enemyAt(1, 920)], { hp: 40, target, input: 't', locked: true });
    expect(port.playerX).toBe(600); expect(port.enemies[0].x).toBe(950);
    expect(port.snapshot()).toMatchObject({ playerX: 630, hp: 40, target, input: 't', locked: true });
    expect(port.targetId).toBe(1);
    port.step(25);
    expect(port.playerX).toBe(615); expect(port.enemies[0].x).toBe(935);
    expect(port.snapshot().party!.players.map(player => player.x)).toEqual([615, 695]);
    expect(authoritative.party!.players.map(player => player.x)).toEqual([630, 710]);
    expect(port.enemies[0].challenge.credited.has(0)).toBe(true);
    port.step(25);
    expect(port.playerX).toBe(630); expect(port.enemies[0].x).toBe(920);
    const event = { type: 'attack-impact', x: 920, targetX: 630, hit: true, damage: 24 };
    socket.receive({ type: 'frame', clock: 1100, snapshot: { ...authoritative, elapsed: 1100 }, enemies: [], events: [event] });
    expect(port.drainEvents()).toEqual([event]);
  });

  it('retargets an early packet from the displayed position and holds at the last server position without extrapolating', () => {
    const port = client(); port.connect(); const socket = StubSocket.instances[0]; socket.open(); acknowledge(socket, port);
    positions(socket, port, 1000, 600, [enemyAt(1, 950)]);
    positions(socket, port, 1050, 630, [enemyAt(1, 920)]); port.step(25);
    positions(socket, port, 1075, 660, [enemyAt(1, 890)]);
    expect(port.playerX).toBe(615); expect(port.enemies[0].x).toBe(935);
    port.step(25);
    expect(port.playerX).toBe(637.5); expect(port.enemies[0].x).toBe(912.5);
    port.step(1000);
    expect(port.playerX).toBe(660); expect(port.enemies[0].x).toBe(890);
    port.step(1000);
    expect(port.playerX).toBe(660); expect(port.enemies[0].x).toBe(890);
  });

  it('snaps spawns and defeated actors and removes enemies on the authoritative frame', () => {
    const port = client(); port.connect(); const socket = StubSocket.instances[0]; socket.open(); acknowledge(socket, port);
    positions(socket, port, 1000, 600, [enemyAt(1, 950)]);
    positions(socket, port, 1050, 630, [{ ...enemyAt(1, 920), state: 'resolving', hp: 0 }, enemyAt(2, 1100)],
      { hp: 0, party: { selfId: 'self', players: [{ ...members[0], x: 630, hp: 0, targetId: null }] } });
    expect(port.playerX).toBe(630); expect(port.snapshot().party!.players[0].x).toBe(630);
    expect(port.enemies.map(enemy => enemy.x)).toEqual([920, 1100]);
    positions(socket, port, 1100, 630, [enemyAt(2, 1090)]);
    expect(port.enemies.map(enemy => enemy.id)).toEqual([2]);
  });

  it('lands a boss charge immediately before delivering its impact while other actors keep interpolating', () => {
    const port = client(); port.connect(); const socket = StubSocket.instances[0]; socket.open(); acknowledge(socket, port);
    const bossAt = (x: number): Enemy => ({ ...enemyAt(1, x), kind: 'tank', bossPhase: 2, attackKind: 'charge' });
    positions(socket, port, 1000, 600, [bossAt(1000), enemyAt(2, 1200)]);
    const snapshot = positions(socket, port, 1050, 630, [bossAt(980), enemyAt(2, 1190)]);
    port.step(25);
    expect(port.enemies[0].x).toBe(990);
    const impact = { type: 'attack-impact', enemyId: 1, enemyKind: 'tank', attackKind: 'charge',
      x: 980, targetX: 600, hit: true, damage: 12, laneFrom: 980, laneTo: 600 };
    socket.receive({ type: 'frame', clock: 1100, snapshot: { ...snapshot, elapsed: 1100 },
      enemies: [bossAt(780), enemyAt(2, 1180)], events: [impact] });
    expect(port.enemies[0].x).toBe(780);
    expect(port.enemies[1].x).toBe(1195);
    expect(port.drainEvents()).toEqual([impact]);
    port.step(25);
    expect(port.enemies[0].x).toBe(780); expect(port.enemies[1].x).toBe(1187.5);
    port.step(25);
    expect(port.enemies.map(enemy => enemy.x)).toEqual([780, 1180]);
  });

  it('snaps after a stale stream, match reset, reconnect, and final phase instead of replaying old movement', () => {
    const port = client(); port.connect(); let socket = StubSocket.instances[0]; socket.open(); acknowledge(socket, port);
    positions(socket, port, 1000, 600);
    positions(socket, port, 1500, 900); expect(port.playerX).toBe(900);
    positions(socket, port, 0, 640); expect(port.playerX).toBe(640); expect(port.clock).toBe(0);
    positions(socket, port, 50, 660, [], { phase: 'over' }); expect(port.playerX).toBe(660);
    positions(socket, port, 100, 680); expect(port.playerX).toBe(680);
    socket.close(1006); port.connect(); socket = StubSocket.instances[1]; socket.open();
    positions(socket, port, 150, 720); expect(port.playerX).toBe(720);
    socket.receive({ type: 'room', room: { status: 'lobby', pin: '123456', selfId: 'self', hostId: 'self', players: members, error: '' } });
    expect(port.players).toEqual([]); expect(port.enemies).toEqual([]);
  });

  it('continues interpolating the shared world during a local pause without sending gameplay commands', () => {
    const port = client(); port.connect(); const socket = StubSocket.instances[0]; socket.open(); acknowledge(socket, port);
    positions(socket, port, 1000, 600, [enemyAt(1, 950)]); port.pause();
    const commands = socket.sent.length;
    positions(socket, port, 1050, 630, [enemyAt(1, 920)]); port.step(25); port.typeKey('a');
    expect(port.snapshot().phase).toBe('paused'); expect(port.playerX).toBe(615); expect(port.enemies[0].x).toBe(935);
    expect(socket.sent).toHaveLength(commands);
  });

  it('keeps the render clock monotonic when a server interval arrives slightly early', () => {
    const port = client(); port.connect(); const socket = StubSocket.instances[0]; socket.open(); acknowledge(socket, port);
    positions(socket, port, 1000, 600); port.step(50);
    positions(socket, port, 1048, 630);
    expect(port.clock).toBe(1050);
    port.step(16); expect(port.clock).toBe(1066);
  });

  it('keeps the hero picked offline when opening an online room', () => {
    const port = client();
    port.playOffline(); port.setHero('wizard');
    expect(port.snapshot().hero.id).toBe('wizard');
    port.createRoom();
    const socket = StubSocket.instances[0]; socket.open();
    expect(socket.sent[0]).toMatchObject({ type: 'hello', heroId: 'wizard', resumeToken: '' });
  });

  it('sends canonical seen words for renamed history and alternative spellings when opening a room', () => {
    const bank: Word[] = [
      { id: 'colour', answer: 'colour', meaning: 'màu sắc', category: 'test', partOfSpeech: 'noun', difficulty: 1, alternatives: ['color'], historyAliases: ['colur'] },
      { id: 'travel', answer: 'travel', meaning: 'đi lại', category: 'test', partOfSpeech: 'verb', difficulty: 1, historyAliases: ['travell'] },
      { id: 'book', answer: 'book', meaning: 'sách', category: 'test', partOfSpeech: 'noun', difficulty: 1 },
    ];
    const initial = { highScore: 0, runs: 0, totalWords: 0, words: {}, seenWords: { ' COLUR ': 1, color: 2, unknown: 3 } };
    const port = new RoomClient(initial, () => {}, bank); clients.push(port);
    port.setProgress({ ...initial, words: { travell: {
      word: 'travell', meaning: 'đi lại', encounters: 1, completed: 1, mistakes: 0, assisted: 0,
      totalResponseMs: 1000, lastSeen: 1, nextReview: 2,
    } } });
    port.connect(); const socket = StubSocket.instances[0]; socket.open();
    expect(socket.sent[0].seen.sort()).toEqual(['colour', 'travel']);
    expect(port.snapshot().vocabulary.remaining).toBe(1);
  });

  it('preserves every canonical entry affected by a shared legacy history key', () => {
    const bank: Word[] = ['alpha', 'beta'].map(answer => ({ id: answer, answer, meaning: answer, category: 'test', partOfSpeech: 'noun', difficulty: 1, historyAliases: ['oldterm'] }));
    const port = new RoomClient({ highScore: 0, runs: 0, totalWords: 0, words: {}, seenWords: { oldterm: 1 } }, () => {}, bank); clients.push(port);
    port.connect(); const socket = StubSocket.instances[0]; socket.open();
    expect(socket.sent[0].seen.sort()).toEqual(['alpha', 'beta']);
    expect(port.snapshot().vocabulary.remaining).toBe(0);
  });

  it('pauses only local commands, retains the party state and resumes typing', () => {
    const port = client(); port.connect();
    const socket = StubSocket.instances[0]; socket.open();
    const snapshot = acknowledge(socket, port);
    port.setMovement(1); port.pause();
    expect(socket.sent.slice(-2).map(message => message.command)).toEqual([
      { kind: 'move', direction: 0 }, { kind: 'cancel-approach' },
    ]);
    expect(port.snapshot()).toMatchObject({ phase: 'paused', hp: 64, party: snapshot.party });
    const sent = socket.sent.length;
    port.typeKey('a'); port.cycleTarget(); port.useItem('health'); port.interactWorld(); port.cancelApproach();
    vi.advanceTimersByTime(1600);
    expect(socket.sent).toHaveLength(sent);
    port.resume(); port.typeKey('a');
    expect(port.snapshot().phase).toBe('playing');
    expect(socket.sent.at(-1)).toMatchObject({ type: 'command', command: { kind: 'type', key: 'a' } });
  });

  it('blocks disconnected commands and reconnects to the same party with the resume token', () => {
    const port = client(); port.connect();
    const socket = StubSocket.instances[0]; socket.open();
    const before = acknowledge(socket, port);
    socket.close(1006);
    expect(port.room.status).toBe('disconnected');
    expect(port.snapshot()).toMatchObject({ phase: 'paused', party: before.party });
    const sent = socket.sent.length;
    port.typeKey('a'); port.setMovement(1); port.cycleTarget(); port.useItem('health'); port.interactWorld(); port.resume();
    expect(socket.sent).toHaveLength(sent);
    expect(port.snapshot().phase).toBe('paused');
    port.connect();
    const restored = StubSocket.instances[1]; restored.open();
    expect(restored.sent[0]).toMatchObject({ type: 'hello', resumeToken: 'test-resume-token' });
    acknowledge(restored, port);
    expect(port.room.pin).toBe('123456');
    expect(port.snapshot()).toMatchObject({ phase: 'playing', party: before.party });
    port.typeKey('b');
    expect(restored.sent.at(-1)).toMatchObject({ type: 'command', command: { kind: 'type', key: 'b' } });
  });

  it('keeps an intentional local pause after reconnect until the player resumes', () => {
    const port = client(); port.connect();
    const socket = StubSocket.instances[0]; socket.open(); acknowledge(socket, port);
    port.pause(); socket.close(1006); port.connect();
    const restored = StubSocket.instances[1]; restored.open(); acknowledge(restored, port);
    expect(port.snapshot().phase).toBe('paused');
    port.resume();
    expect(port.snapshot().phase).toBe('playing');
  });

  it('starts with the saved study language, follows the host acknowledgement and locks guests', () => {
    const port = new RoomClient({ highScore: 0, runs: 0, totalWords: 0, words: {} }, () => {}, WORDS, 'en'); clients.push(port);
    port.connect(); const socket = StubSocket.instances[0]; socket.open();
    expect(socket.sent[0]).toMatchObject({ type: 'hello', language: 'en' });
    socket.receive({ type: 'room', room: { status: 'lobby', language: 'vi', pin: '123456', selfId: 'self', hostId: 'friend', players: members, error: '' } });
    expect(port.room.language).toBe('vi');
    const count = socket.sent.length; port.setLanguage('en');
    expect(socket.sent).toHaveLength(count); expect(port.room.language).toBe('vi');
    socket.receive({ type: 'room', room: { status: 'lobby', language: 'vi', pin: '123456', selfId: 'self', hostId: 'self', players: members, error: '' } });
    port.setLanguage('en');
    expect(socket.sent.at(-1)).toEqual({ type: 'language', language: 'en' });
    expect(port.room.language).toBe('vi');
    socket.receive({ type: 'room', room: { status: 'lobby', language: 'en', pin: '123456', selfId: 'self', hostId: 'self', players: members, error: '' } });
    expect(port.room.language).toBe('en');
  });

  it('clears a pending language request on disconnect and adopts the restored room language', () => {
    const port = client(); port.connect(); const socket = StubSocket.instances[0]; socket.open();
    const room = { status: 'lobby', language: 'vi', pin: '123456', selfId: 'self', hostId: 'self', players: members, error: '' };
    socket.receive({ type: 'session', token: 'language-reconnect-token' }); socket.receive({ type: 'room', room });
    port.setLanguage('en'); expect(port.room.languagePending).toBe(true);
    socket.close(1006); expect(port.room.languagePending).toBe(false);
    port.connect(); const restored = StubSocket.instances[1]; restored.open(); restored.receive({ type: 'room', room });
    expect(port.room).toMatchObject({ status: 'lobby', language: 'vi', languagePending: false });
    port.setLanguage('en'); expect(restored.sent.at(-1)).toEqual({ type: 'language', language: 'en' });
  });

  it('plays with English clues offline and retains seen words when switching back to Vietnamese', () => {
    const bank = WORDS.slice(0, 5).map(word => ({ ...word, englishMeaning: `A test definition for the ${word.partOfSpeech}.` }));
    const initial = { highScore: 0, runs: 0, totalWords: 0, words: {}, seenWords: { [bank[0].answer]: 1 } };
    const port = new RoomClient(initial, () => {}, bank, 'en'); clients.push(port); port.playOffline(); port.start();
    expect(port.snapshot().vocabulary.total).toBe(5);
    expect(port.enemies.length).toBeGreaterThan(0);
    expect(port.enemies.every(enemy => enemy.challenge.word.meaning.startsWith('A test definition'))).toBe(true);
    expect(port.enemies.some(enemy => enemy.challenge.word.answer === bank[0].answer)).toBe(false);
    const remaining = port.snapshot().vocabulary.remaining;
    port.setLanguage('vi'); expect(port.room.language).toBe('en');
    port.toMenu(); port.setLanguage('vi');
    expect(port.room.language).toBe('vi'); expect(port.snapshot().vocabulary.remaining).toBe(remaining);
    port.start();
    expect(port.enemies.every(enemy => !enemy.challenge.word.meaning.startsWith('A test definition'))).toBe(true);
  });

  it('retains the latest language intent through intermediate room acknowledgements', () => {
    const port = client(); port.connect();
    const socket = StubSocket.instances[0]; socket.open();
    const lobby = { status: 'lobby', language: 'vi', pin: '123456', selfId: 'self', hostId: 'self', players: members, error: '' };
    socket.receive({ type: 'room', room: lobby });
    port.setLanguage('en'); port.setLanguage('vi');
    expect(socket.sent.filter(message => message.type === 'language')).toEqual([
      { type: 'language', language: 'en' }, { type: 'language', language: 'vi' },
    ]);
    expect(port.room).toMatchObject({ language: 'vi', languagePending: true });
    socket.receive({ type: 'room', room: { ...lobby, language: 'en' } });
    expect(port.room).toMatchObject({ language: 'en', languagePending: true });
    socket.receive({ type: 'room', room: lobby });
    expect(port.room).toMatchObject({ language: 'vi', languagePending: false });
  });

  it('releases a rejected language intent while preserving the server-acknowledged language', () => {
    const port = client(); port.connect();
    const socket = StubSocket.instances[0]; socket.open();
    socket.receive({ type: 'room', room: { status: 'lobby', language: 'vi', pin: '123456', selfId: 'self', hostId: 'self', players: members, error: '' } });
    port.setLanguage('en');
    expect(port.room.languagePending).toBe(true);
    socket.receive({ type: 'error', error: 'Kho từ tiếng Anh chưa sẵn sàng.' });
    expect(port.room).toMatchObject({ language: 'vi', languagePending: false, error: 'Kho từ tiếng Anh chưa sẵn sàng.' });
    port.setLanguage('en');
    expect(socket.sent.filter(message => message.type === 'language')).toHaveLength(2);
    expect(port.room).toMatchObject({ languagePending: true, error: '' });
  });
});
