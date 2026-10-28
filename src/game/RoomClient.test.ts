import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomClient, roomSocketUrl } from './RoomClient';
import { WORDS } from './vocabulary';
import type { Snapshot, Word } from './types';
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
  receive(message: object) { this.onmessage?.({ data: JSON.stringify(message) }); }
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
    const port = new RoomClient({ highScore: 999, runs: 9, totalWords: 99, words: {}, seenWords: { water: 1 } }, onSeen, WORDS, 'vi', deck);
    clients.push(port); return { port, deck, onSeen };
  };

  it('isolates a custom pack from global history and scopes its resume token', () => {
    sessionStorage.setItem('zvs-room-session-v1', 'normal-token');
    const { port, deck, onSeen } = deckClient(); port.connect();
    const socket = StubSocket.instances[0]; socket.open();
    expect(socket.sent[0]).toMatchObject({ type: 'hello', resumeToken: '', seen: [], language: 'en', deckId: deck.id });
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

  it('ends offline play and stops reconnecting when a custom link expires', () => {
    const { port } = deckClient(vi.fn(), { expiresAt: Date.now() + 1000 });
    port.playOffline(); port.start(); expect(port.snapshot().phase).toBe('playing');
    vi.advanceTimersByTime(1000);
    expect(port.room.status).toBe('expired'); expect(port.snapshot().phase).toBe('menu');
    port.start(); port.playOffline(); port.createRoom(); port.connect();
    expect(port.room.status).toBe('expired'); expect(StubSocket.instances).toHaveLength(0);
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
