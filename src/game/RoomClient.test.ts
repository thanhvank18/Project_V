import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomClient, roomSocketUrl } from './RoomClient';
import { WORDS } from './vocabulary';
import type { Snapshot, Word } from './types';
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
    expect(socket.sent.at(-1)).toMatchObject({ type: 'command', command: { kind: 'move', direction: 0 } });
    expect(port.snapshot()).toMatchObject({ phase: 'paused', hp: 64, party: snapshot.party });
    const sent = socket.sent.length;
    port.typeKey('a'); port.cycleTarget(); port.useItem('health'); port.interactWorld();
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
});
