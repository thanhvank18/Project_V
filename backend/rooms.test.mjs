import { describe, it, expect } from 'vitest';
import { RoomHub } from './rooms.mjs';
import { WORDS } from '../src/game/vocabulary';

function fixture(count = 1) {
  let clock = 1000;
  const hub = new RoomHub(WORDS, { now: () => clock });
  const clients = Array.from({ length: count }, () => {
    const messages = []; const send = message => messages.push(JSON.parse(JSON.stringify(message)));
    const session = hub.hello({ seen: [], heroId: 'soldier' }, send);
    return { session, messages, send };
  });
  return { hub, clients, advance: ms => { clock += ms; hub.step(ms); } };
}
const join = (hub, guest, host) => hub.receive(guest.session, { type: 'join', pin: host.session.pin });
const start = (hub, host) => hub.receive(host.session, { type: 'start', mode: 'survival' });

describe('authoritative PIN rooms', () => {
  it('shares the host language, rejects guest/mid-match changes and uses real English definitions', () => {
    const bank = WORDS.slice(0, 10).map(word => ({ ...word, englishMeaning: `An English definition for ${word.partOfSpeech}.` }));
    const hub = new RoomHub(bank);
    const host = { session: hub.hello({ seen: [bank[0].answer], language: 'en' }, () => {}) };
    const guest = { session: hub.hello({ seen: [], language: 'vi' }, () => {}) };
    join(hub, guest, host);
    const room = hub.rooms.get(host.session.pin);
    expect(hub.lobby(room, guest.session).language).toBe('en');
    expect(() => hub.receive(guest.session, { type: 'language', language: 'vi' })).toThrow('Chỉ chủ phòng');
    expect(() => hub.receive(host.session, { type: 'language', language: 'fr' })).toThrow('không hợp lệ');
    start(hub, host);
    expect(room.engine.enemies.length).toBeGreaterThan(0);
    expect(room.engine.enemies.every(enemy => enemy.challenge.word.meaning.startsWith('An English definition'))).toBe(true);
    expect(room.engine.enemies.some(enemy => enemy.challenge.word.answer === bank[0].answer)).toBe(false);
    expect(() => hub.receive(host.session, { type: 'language', language: 'vi' })).toThrow('trước trận');
    hub.disconnect(host.session, host.session.send);
    expect(room.hostId).toBe(guest.session.id);
    expect(hub.lobby(room, guest.session).language).toBe('en');
  });

  it('broadcasts lobby language changes and retains the room language on session resume', () => {
    const hub = new RoomHub(WORDS.map(word => ({ ...word, englishMeaning: 'A genuine fixture definition.' })));
    const messages = [];
    const host = hub.hello({ seen: [], language: 'vi' }, message => messages.push(message));
    hub.receive(host, { type: 'language', language: 'en' });
    expect(messages.at(-1).room.language).toBe('en');
    const restored = hub.hello({ seen: [], language: 'vi', resumeToken: host.token }, message => messages.push(message));
    expect(restored.id).toBe(host.id); expect(messages.at(-1).room.language).toBe('en');
    expect(() => hub.hello({ seen: [], language: 'unknown' }, () => {})).toThrow('không hợp lệ');
  });

  it('creates a distinct six-digit PIN on entry, caps rooms at four and prevents duplicate heroes', () => {
    const { hub, clients } = fixture(5);
    const [host, ...guests] = clients;
    expect(new Set(clients.map(client => client.session.pin)).size).toBe(5);
    expect(host.session.pin).toMatch(/^\d{6}$/);
    for (const guest of guests.slice(0, 3)) join(hub, guest, host);
    const room = hub.rooms.get(host.session.pin);
    expect(room.members).toHaveLength(4);
    expect(new Set(room.members.map(member => member.heroId)).size).toBe(4);
    expect(() => join(hub, guests[3], host)).toThrow('đủ 4 người');
    expect(() => hub.receive(guests[0].session, { type: 'hero', heroId: host.session.heroId })).toThrow('đã có người chọn');
  });

  it('only lets the host start and refuses joining an active match', () => {
    const { hub, clients: [host, guest, late] } = fixture(3);
    join(hub, guest, host);
    expect(() => start(hub, guest)).toThrow('Chỉ chủ phòng');
    start(hub, host);
    expect(() => join(hub, late, host)).toThrow('đang chơi');
    expect(() => hub.receive(host.session, { type: 'hero', heroId: 'wizard' })).toThrow('trước trận');
  });

  it('shares enemies and reserves distinct selected words before a single letter is typed', () => {
    const { hub, clients: [host, guest] } = fixture(2);
    join(hub, guest, host); start(hub, host);
    const room = hub.rooms.get(host.session.pin), engine = room.engine;
    const a = engine.snapshotFor(host.session.id), b = engine.snapshotFor(guest.session.id);
    expect(a.target).not.toBeNull(); expect(b.target).not.toBeNull();
    expect(a.target.id).not.toBe(b.target.id);
    for (let seq = 0; seq < 5; seq++) hub.receive(guest.session, { type: 'command', seq, command: { kind: 'cycle', direction: 1 } });
    expect(engine.snapshotFor(guest.session.id).target?.id).not.toBe(a.target.id);
    const enemy = engine.enemies.find(enemy => enemy.id === a.target.id);
    let seq = 0;
    for (const key of enemy.challenge.word.answer) hub.receive(host.session, { type: 'command', seq: seq++, command: { kind: 'type', key } });
    expect(engine.snapshotFor(host.session.id).words).toBe(1);
    expect(engine.snapshotFor(guest.session.id).words).toBe(1);
    expect(engine.snapshotFor(guest.session.id).input).toBe('');
    hub.broadcastFrame(room);
    expect(guest.messages.some(message => message.type === 'seen' && message.words.includes(enemy.challenge.word.answer))).toBe(true);
  });

  it('rejects replayed commands and arbitrary client state mutations', () => {
    const { hub, clients: [host] } = fixture(); start(hub, host);
    const engine = hub.rooms.get(host.session.pin).engine;
    const enemy = engine.enemies.find(enemy => enemy.id === engine.snapshotFor(host.session.id).target.id);
    const message = { type: 'command', seq: 1, command: { kind: 'type', key: enemy.challenge.word.answer[0] } };
    hub.receive(host.session, message); hub.receive(host.session, message);
    expect(engine.snapshotFor(host.session.id).input).toHaveLength(1);
    expect(() => hub.receive(host.session, { type: 'command', seq: 2, command: { kind: 'damage', hp: -100 } })).toThrow('không hợp lệ');
    expect(engine.enemies).toContain(enemy);
  });

  it('unions every member history before allocating new words', () => {
    const { hub, clients: [host, guest] } = fixture(2);
    const allowed = WORDS.slice(0, 8).map(word => word.answer);
    for (const word of WORDS) if (!allowed.includes(word.answer)) guest.session.seen.add(word.answer);
    join(hub, guest, host); start(hub, host);
    const room = hub.rooms.get(host.session.pin);
    expect(room.engine.enemies.every(enemy => allowed.includes(enemy.challenge.word.answer))).toBe(true);
  });

  it('releases locks on disconnect, transfers host, resumes within grace and removes expired seats', () => {
    const { hub, clients: [host, guest], advance } = fixture(2);
    join(hub, guest, host); start(hub, host);
    const room = hub.rooms.get(host.session.pin);
    hub.disconnect(host.session, host.send);
    expect(room.hostId).toBe(guest.session.id);
    expect(room.engine.players.find(player => player.id === host.session.id).targetId).toBeNull();
    const messages = [], send = value => messages.push(value);
    const resumed = hub.hello({ seen: [], resumeToken: host.session.token }, send);
    expect(resumed.id).toBe(host.session.id);
    expect(messages.some(message => message.type === 'frame')).toBe(true);
    hub.disconnect(resumed, send); advance(20_001);
    expect(room.members).toHaveLength(1);
    expect(room.engine.players).toHaveLength(1);
  });

  it('does not destroy the current room when a join fails', () => {
    const { hub, clients: [host] } = fixture();
    const pin = host.session.pin;
    expect(() => hub.receive(host.session, { type: 'join', pin: '123' })).toThrow('6 chữ số');
    expect(host.session.pin).toBe(pin); expect(hub.rooms.has(pin)).toBe(true);
  });
});
