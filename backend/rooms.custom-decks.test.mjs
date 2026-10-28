import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomHub } from './rooms.mjs';
import { WORDS } from '../src/game/vocabulary';

const deck = { id: 'a'.repeat(32), title: 'Our classroom', language: 'en', createdAt: 1000, expiresAt: 1000 + 86_400_000,
  entries: [{ answer: 'water', meaning: 'A clear liquid.', partOfSpeech: 'noun', level: 1, type: 'fill', sentence: 'I drink ___.' },
    { answer: 'book', meaning: 'Pages for reading.', partOfSpeech: 'noun', level: 1, type: 'translate' }] };
function fixture(options = {}) {
  let clock = 1000;
  const customDecks = { get(id) {
    if (id !== deck.id) throw Object.assign(new Error('Không tìm thấy bộ từ.'), { code: 'deck-missing' });
    if (clock >= deck.expiresAt) throw Object.assign(new Error('Liên kết đã hết hạn.'), { code: 'deck-expired' });
    return structuredClone(deck);
  }, recordRun: options.recordRun ?? vi.fn(async () => {}) };
  const hub = new RoomHub(WORDS, { now: () => clock, customDecks });
  const connect = (options = {}) => {
    const messages = [], send = value => messages.push(structuredClone(value));
    const session = hub.hello({ seen: ['water', 'book'], heroId: 'soldier', deckId: deck.id, playerName: 'An', ...options }, send);
    return { session, messages, send };
  };
  return { hub, connect, customDecks, advance: ms => { clock += ms; hub.step(ms); } };
}

afterEach(() => vi.useRealTimers());

function finishPack({ hub, advance }, host) {
  const room = hub.rooms.get(host.session.pin);
  let seq = (host.session.lastSeq ?? -1) + 1;
  for (let tick = 0; tick < 400 && room.engine.snapshot().phase !== 'over'; tick++) {
    const target = room.engine.enemies.find(enemy => enemy.id === room.engine.snapshotFor(host.session.id).target?.id);
    if (target && target.state !== 'resolving') for (const key of target.challenge.word.answer) {
      advance(25); hub.receive(host.session, { type: 'command', seq: seq++, command: { kind: 'type', key } });
    }
    advance(50);
  }
  hub.broadcastFrame(room);
  expect(room.engine.snapshot().summary?.reason).toBe('vocabulary-complete');
  return room;
}

describe('custom deck authoritative rooms', () => {
  it('requires a valid display name only for custom links and normalizes Unicode names', () => {
    const { hub, connect } = fixture();
    for (const playerName of [undefined, null, '', '   ', 'a'.repeat(25), 'An\nBình', 'An\u200b']) {
      expect(() => connect({ playerName })).toThrow(expect.objectContaining({ code: 'player-name-required' }));
    }
    expect(hub.sessions.size).toBe(0); expect(hub.rooms.size).toBe(0);
    const host = connect({ playerName: '  A\u0301nh   Mai  ' });
    expect(host.session.name).toBe('Ánh Mai');
    expect(connect({ deckId: '', playerName: undefined }).session.name).toBe('Người chơi 1');
  });

  it('preserves chosen names across rooms and freezes them during a resumed run', () => {
    const context = fixture(), { hub, connect } = context;
    const host = connect({ playerName: 'An' }), guest = connect({ playerName: 'Bình' });
    hub.receive(guest.session, { type: 'join', pin: host.session.pin, playerName: 'Impostor' });
    let room = hub.rooms.get(host.session.pin);
    expect(room.members.map(member => member.name)).toEqual(['An', 'Bình']);
    hub.receive(guest.session, { type: 'create' });
    expect(guest.session.name).toBe('Bình');
    const lobbyResume = connect({ resumeToken: host.session.token, playerName: 'Ánh' });
    expect(lobbyResume.session.name).toBe('Ánh');
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    const activeResume = connect({ resumeToken: host.session.token, playerName: 'Changed' });
    expect(activeResume.session.name).toBe('Ánh');
    room = hub.rooms.get(host.session.pin);
    expect(room.run.players).toEqual(['Ánh']);
    expect(room.engine.snapshotFor(host.session.id).party.players[0].name).toBe('Ánh');
    expect(() => hub.receive(host.session, { type: 'name', playerName: 'Changed' })).toThrow('Chưa có trận');
  });

  it('records one authoritative result per completed survival run and acknowledges successful saving', async () => {
    const context = fixture(), { hub, connect, customDecks } = context;
    const host = connect({ playerName: 'An', score: 999999 });
    hub.receive(host.session, { type: 'start', mode: 'survival', score: 999999 });
    expect(customDecks.recordRun).not.toHaveBeenCalled();
    expect(host.messages.at(-1).leaderboard).toBeUndefined();
    const room = finishPack(context, host), summary = room.engine.snapshot().summary;
    const saving = host.messages.at(-1).leaderboard;
    expect(saving).toEqual({ runId: room.run.id, status: 'saving' });
    await vi.waitFor(() => expect(room.run.status).toBe('saved'));
    expect(customDecks.recordRun).toHaveBeenCalledTimes(1);
    expect(customDecks.recordRun).toHaveBeenCalledWith(deck.id, {
      id: room.run.id, players: ['An'], score: summary.score, words: 2, accuracy: summary.accuracy,
      durationMs: summary.durationMs, endedAt: hub.now(), reason: 'vocabulary-complete',
    });
    expect(summary.score).not.toBe(999999);
    expect(host.messages.at(-1).leaderboard).toEqual({ runId: room.run.id, status: 'saved' });
    for (let tick = 0; tick < 10; tick++) context.advance(50);
    const restored = connect({ resumeToken: host.session.token });
    expect(restored.messages.at(-1).leaderboard.status).toBe('saved');
    expect(customDecks.recordRun).toHaveBeenCalledTimes(1);
  });

  it('keeps the starting co-op roster when teammates leave before the shared result', async () => {
    const context = fixture(), { hub, connect, customDecks } = context;
    const host = connect({ playerName: 'An' }), guest = connect({ playerName: 'Bình' });
    hub.receive(guest.session, { type: 'join', pin: host.session.pin });
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    hub.leave(guest.session);
    const room = finishPack(context, host);
    await vi.waitFor(() => expect(room.run.status).toBe('saved'));
    expect(customDecks.recordRun).toHaveBeenCalledTimes(1);
    expect(customDecks.recordRun.mock.calls[0][1].players).toEqual(['An', 'Bình']);
  });

  it('saves a defeat caused by the final disconnected member leaving even after the room is removed', async () => {
    const { hub, connect, customDecks, advance } = fixture(), host = connect();
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    const room = hub.rooms.get(host.session.pin);
    hub.disconnect(host.session, host.send);
    advance(20_000);
    expect(hub.rooms.has(room.pin)).toBe(false);
    await vi.waitFor(() => expect(customDecks.recordRun).toHaveBeenCalledTimes(1));
    expect(customDecks.recordRun.mock.calls[0][1]).toMatchObject({ players: ['An'], reason: 'defeat' });
  });

  it('never ranks boss practice and keeps regular-game frames unchanged', () => {
    const { hub, connect, customDecks } = fixture(), host = connect();
    hub.receive(host.session, { type: 'start', mode: 'boss' });
    const room = hub.rooms.get(host.session.pin);
    room.engine.finishRun('defeat'); hub.broadcastFrame(room);
    expect(host.messages.at(-1).leaderboard).toEqual({ runId: room.run.id, status: 'unranked' });
    expect(customDecks.recordRun).not.toHaveBeenCalled();
    const normal = connect({ deckId: '' });
    hub.receive(normal.session, { type: 'start', mode: 'survival' });
    const normalRoom = hub.rooms.get(normal.session.pin);
    normalRoom.engine.finishRun('defeat'); hub.broadcastFrame(normalRoom);
    expect(normal.messages.at(-1).leaderboard).toBeUndefined();
    expect(customDecks.recordRun).not.toHaveBeenCalled();
  });

  it('retries a transient write once with the same result and reports permanent failure without resubmitting each frame', async () => {
    vi.useFakeTimers();
    const recordRun = vi.fn().mockRejectedValue(new Error('Disk unavailable'));
    const context = fixture({ recordRun }), { hub, connect } = context, host = connect();
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    const room = finishPack(context, host);
    await vi.advanceTimersByTimeAsync(0);
    expect(recordRun).toHaveBeenCalledTimes(1);
    expect(room.run.status).toBe('saving');
    await vi.advanceTimersByTimeAsync(250);
    expect(recordRun).toHaveBeenCalledTimes(2);
    expect(recordRun.mock.calls[0]).toEqual(recordRun.mock.calls[1]);
    expect(host.messages.at(-1).leaderboard.status).toBe('failed');
    for (let tick = 0; tick < 10; tick++) context.advance(50);
    await vi.advanceTimersByTimeAsync(1000);
    expect(recordRun).toHaveBeenCalledTimes(2);
  });

  it('completes one retry after a transient error but never retries an expired deck', async () => {
    vi.useFakeTimers();
    const recordRun = vi.fn().mockRejectedValueOnce(new Error('Busy')).mockResolvedValue(undefined);
    const context = fixture({ recordRun }), host = context.connect();
    context.hub.receive(host.session, { type: 'start', mode: 'survival' });
    const room = finishPack(context, host);
    await vi.advanceTimersByTimeAsync(250);
    expect(recordRun).toHaveBeenCalledTimes(2); expect(room.run.status).toBe('saved');
    const expiredWrite = vi.fn().mockRejectedValue(Object.assign(new Error('Expired'), { code: 'deck-expired' }));
    const expired = fixture({ recordRun: expiredWrite }), peer = expired.connect();
    expired.hub.receive(peer.session, { type: 'start', mode: 'survival' });
    const expiredRoom = finishPack(expired, peer);
    await vi.advanceTimersByTimeAsync(1000);
    expect(expiredWrite).toHaveBeenCalledTimes(1); expect(expiredRoom.run.status).toBe('failed');
  });

  it('does not let an older persistence callback attach its status to a replay', async () => {
    let resolveWrite;
    const recordRun = vi.fn(() => new Promise(resolve => { resolveWrite = resolve; }));
    const context = fixture({ recordRun }), { hub, connect } = context, host = connect();
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    const room = finishPack(context, host), previousRun = room.run;
    await vi.waitFor(() => expect(recordRun).toHaveBeenCalledTimes(1));
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    expect(room.run.id).not.toBe(previousRun.id);
    resolveWrite();
    await vi.waitFor(() => expect(previousRun.status).toBe('saved'));
    expect(room.run.completed).toBe(false); expect(room.run.status).toBeNull();
    expect(host.messages.at(-1).leaderboard).toBeUndefined();
  });

  it('uses the published damage mode for every co-op hero and ignores client overrides', () => {
    const hub = new RoomHub(WORDS, { now: () => 1000, customDecks: { get: () => ({ ...structuredClone(deck), damageMode: 'one-hit' }) } });
    const host = hub.hello({ deckId: deck.id, playerName: 'An', seen: [], heroId: 'swordsman', damageMode: 'health' }, () => {});
    const guest = hub.hello({ deckId: deck.id, playerName: 'Bình', seen: [], heroId: 'wizard', damageMode: 'health' }, () => {});
    hub.receive(guest, { type: 'join', pin: host.pin });
    const room = hub.rooms.get(host.pin);
    expect(hub.lobby(room, guest).customDeck.damageMode).toBe('one-hit');
    hub.receive(host, { type: 'start', mode: 'survival', damageMode: 'health' });
    for (const session of [host, guest]) expect(room.engine.snapshotFor(session.id)).toMatchObject({ hp: 1, maxHp: 1 });
    expect(() => hub.receive(host, { type: 'command', seq: 0, command: { kind: 'damage-mode', damageMode: 'health' } })).toThrow('không hợp lệ');
    expect(room.engine.snapshotFor(host.id)).toMatchObject({ hp: 1, maxHp: 1 });

    const normal = hub.hello({ seen: [], heroId: 'swordsman', damageMode: 'one-hit' }, () => {});
    hub.receive(normal, { type: 'start', mode: 'survival', damageMode: 'one-hit' });
    expect(hub.rooms.get(normal.pin).engine.snapshotFor(normal.id)).toMatchObject({ hp: 150, maxHp: 150 });
  });

  it('uses the authored bank, ignores global history and locks the authored language', () => {
    const { hub, connect } = fixture(), host = connect();
    const room = hub.rooms.get(host.session.pin);
    expect(hub.lobby(room, host.session).customDeck).toMatchObject({ id: deck.id, title: deck.title, entryCount: 2 });
    expect(room.language).toBe('en');
    expect(() => hub.receive(host.session, { type: 'language', language: 'vi' })).toThrow('cố định');
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    expect(room.engine.snapshot().vocabulary.total).toBe(2);
    expect(room.engine.snapshot().phase).toBe('playing');
    expect(room.engine.enemies.every(enemy => ['water', 'book'].includes(enemy.challenge.word.answer))).toBe(true);
    const water = room.engine.enemies.find(enemy => enemy.challenge.word.answer === 'water');
    if (water) { expect(water.challenge.kind).toBe('fill'); expect(water.challenge.word.meaning).toBe('A clear liquid.'); }
    expect(host.session.seen.size).toBe(0);
    expect(host.messages.some(message => message.type === 'seen')).toBe(false);
    expect(host.messages.some(message => message.type === 'deck-seen')).toBe(true);
  });

  it('accepts peers on the same link but preserves rooms when a PIN belongs to another scope', () => {
    const { hub, connect } = fixture(), host = connect(), guest = connect(), normal = connect({ deckId: '' });
    const normalPin = normal.session.pin;
    expect(() => hub.receive(normal.session, { type: 'join', pin: host.session.pin })).toThrow('bộ từ khác');
    expect(normal.session.pin).toBe(normalPin);
    expect(() => hub.receive(host.session, { type: 'join', pin: normalPin })).toThrow('bộ từ khác');
    hub.receive(guest.session, { type: 'join', pin: host.session.pin });
    const room = hub.rooms.get(host.session.pin);
    expect(room.members).toHaveLength(2); expect(new Set(room.members.map(member => member.heroId)).size).toBe(2);
    expect(() => hub.receive(guest.session, { type: 'start', mode: 'survival' })).toThrow('chủ phòng');
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    expect(room.engine.snapshotFor(host.session.id).target?.id).not.toBe(room.engine.snapshotFor(guest.session.id).target?.id);
  });

  it('keeps resume tokens scoped and retains the deck when creating another room', () => {
    const { hub, connect } = fixture(), host = connect();
    const restored = connect({ resumeToken: host.session.token });
    expect(restored.session.id).toBe(host.session.id);
    const normal = connect({ deckId: '', resumeToken: host.session.token });
    expect(normal.session.id).not.toBe(host.session.id);
    expect(hub.rooms.get(normal.session.pin).customDeck).toBeNull();
    hub.receive(restored.session, { type: 'create' });
    expect(hub.rooms.get(restored.session.pin).customDeck.id).toBe(deck.id);
  });

  it('starts a new match with all questions available without broadcasting persistent seen history', () => {
    const { hub, connect, advance } = fixture(), host = connect();
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    const room = hub.rooms.get(host.session.pin); let seq = 0;
    for (let tick = 0; tick < 400 && room.engine.snapshot().phase !== 'over'; tick++) {
      const target = room.engine.enemies.find(enemy => enemy.id === room.engine.snapshotFor(host.session.id).target?.id);
      if (target && !target.resolving) for (const key of target.challenge.word.answer) {
        // Advance replenishes the authoritative token bucket during the short pack.
        advance(25); hub.receive(host.session, { type: 'command', seq: seq++, command: { kind: 'type', key } });
      }
      advance(50);
    }
    expect(room.engine.snapshot().summary?.reason).toBe('vocabulary-complete');
    expect(host.session.seen.size).toBe(0);
    expect(host.messages.some(message => message.type === 'seen')).toBe(false);
    hub.receive(host.session, { type: 'lobby' });
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    expect(room.engine.snapshot().phase).toBe('playing'); expect(room.engine.enemies.length).toBeGreaterThan(0);
    expect(room.engine.snapshot().vocabulary.total).toBe(2);
  });

  it('cuts off both running and idle rooms at exact expiry and invalidates reconnection', () => {
    const { hub, connect, advance } = fixture(), host = connect(), idle = connect();
    hub.receive(host.session, { type: 'start', mode: 'survival' });
    const pin = host.session.pin, token = host.session.token;
    advance(86_400_000);
    expect(hub.rooms.has(pin)).toBe(false); expect(hub.rooms.size).toBe(0); expect(hub.sessions.has(token)).toBe(false);
    for (const client of [host, idle]) expect(client.messages).toContainEqual(expect.objectContaining({ type: 'room', room: expect.objectContaining({ status: 'expired' }) }));
    expect(() => connect({ resumeToken: token })).toThrow('hết hạn');
    expect(() => hub.receive(host.session, { type: 'start', mode: 'survival' })).toThrow('đóng');
  });
});
