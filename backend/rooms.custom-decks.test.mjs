import { describe, expect, it } from 'vitest';
import { RoomHub } from './rooms.mjs';
import { WORDS } from '../src/game/vocabulary';

const deck = { id: 'a'.repeat(32), title: 'Our classroom', language: 'en', createdAt: 1000, expiresAt: 1000 + 86_400_000,
  entries: [{ answer: 'water', meaning: 'A clear liquid.', partOfSpeech: 'noun', level: 1, type: 'fill', sentence: 'I drink ___.' },
    { answer: 'book', meaning: 'Pages for reading.', partOfSpeech: 'noun', level: 1, type: 'translate' }] };
function fixture() {
  let clock = 1000;
  const customDecks = { get(id) {
    if (id !== deck.id) throw Object.assign(new Error('Không tìm thấy bộ từ.'), { code: 'deck-missing' });
    if (clock >= deck.expiresAt) throw Object.assign(new Error('Liên kết đã hết hạn.'), { code: 'deck-expired' });
    return structuredClone(deck);
  } };
  const hub = new RoomHub(WORDS, { now: () => clock, customDecks });
  const connect = (options = {}) => {
    const messages = [], send = value => messages.push(structuredClone(value));
    const session = hub.hello({ seen: ['water', 'book'], heroId: 'soldier', deckId: deck.id, ...options }, send);
    return { session, messages, send };
  };
  return { hub, connect, advance: ms => { clock += ms; hub.step(ms); } };
}

describe('custom deck authoritative rooms', () => {
  it('uses the published damage mode for every co-op hero and ignores client overrides', () => {
    const hub = new RoomHub(WORDS, { now: () => 1000, customDecks: { get: () => ({ ...structuredClone(deck), damageMode: 'one-hit' }) } });
    const host = hub.hello({ deckId: deck.id, seen: [], heroId: 'swordsman', damageMode: 'health' }, () => {});
    const guest = hub.hello({ deckId: deck.id, seen: [], heroId: 'wizard', damageMode: 'health' }, () => {});
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
