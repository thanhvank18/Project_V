import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { attachRooms } from './rooms.mjs';
import { WORDS } from '../src/game/vocabulary';

const resources = [];

async function fixture(options = {}) {
  const server = createServer((_request, response) => response.end('test'));
  const runtime = attachRooms(server, WORDS, options);
  const sockets = [];
  resources.push({ server, runtime, sockets });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = `ws://127.0.0.1:${server.address().port}/api/rooms`;
  async function connect(resumeToken = '', hello = {}) {
    const socket = new WebSocket(url);
    sockets.push(socket);
    const messages = [];
    const waiting = new Set();
    socket.on('message', data => {
      const message = JSON.parse(data.toString()); messages.push(message);
      for (const waiter of waiting) {
        if (messages.length > waiter.after && waiter.predicate(message)) {
          clearTimeout(waiter.timer); waiting.delete(waiter); waiter.resolve(message);
        }
      }
    });
    socket.on('error', () => {});
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    const client = {
      socket, messages, seq: 0,
      send(message) { socket.send(JSON.stringify(message)); },
      command(command) { socket.send(JSON.stringify({ type: 'command', seq: this.seq++, command })); },
      wait(predicate, after = 0) {
        const found = messages.slice(after).find(predicate);
        if (found) return Promise.resolve(found);
        return new Promise((resolve, reject) => {
          const waiter = { predicate, after, resolve, timer: undefined };
          waiter.timer = setTimeout(() => { waiting.delete(waiter); reject(new Error(`Timed out waiting for a room packet; last types: ${messages.slice(-5).map(message => message.type).join(', ')}`)); }, 5000);
          waiting.add(waiter);
        });
      },
      async close() {
        if (socket.readyState === WebSocket.CLOSED) return;
        const closed = new Promise(resolve => socket.once('close', resolve));
        socket.close(); await closed;
      },
    };
    client.send({ type: 'hello', seen: [], heroId: 'soldier', resumeToken, ...hello });
    client.session = await client.wait(message => message.type === 'session');
    client.seq = client.session.nextSeq ?? 0;
    client.room = (await client.wait(message => message.type === 'room')).room;
    return client;
  }
  return { server, runtime, connect };
}

afterEach(async () => {
  for (const { server, runtime, sockets } of resources.splice(0)) {
    for (const socket of sockets) socket.terminate();
    runtime.close();
    await new Promise(resolve => server.close(resolve));
  }
});

describe('real WebSocket room transport', () => {
  it('shares custom questions through real sockets and closes all peers when the link expires', async () => {
    let now = Date.now();
    const deck = { id: 'a'.repeat(32), title: 'Our pack', language: 'en', damageMode: 'one-hit', createdAt: now, expiresAt: now + 86_400_000,
      entries: [{ answer: 'water', meaning: 'A clear liquid.', partOfSpeech: 'noun', level: 1, type: 'fill', sentence: 'I drink ___.' },
        { answer: 'apple', meaning: 'A round fruit.', partOfSpeech: 'noun', level: 1, type: 'translate' }] };
    const { connect, runtime } = await fixture({ now: () => now, customDecks: { get: () => structuredClone(deck) } });
    const host = await connect('', { deckId: deck.id, playerName: 'An', seen: ['water', 'apple'] });
    const guest = await connect('', { deckId: deck.id, playerName: 'Bình' });
    expect(host.room.customDeck).toMatchObject({ id: deck.id, entryCount: 2 });
    guest.send({ type: 'join', pin: host.room.pin });
    await guest.wait(message => message.type === 'room' && message.room.players.length === 2);
    host.send({ type: 'start', mode: 'survival' });
    const [a, b] = await Promise.all([host, guest].map(peer => peer.wait(message => message.type === 'frame')));
    expect(host.room.customDeck.damageMode).toBe('one-hit');
    expect(a.snapshot).toMatchObject({ hp: 1, maxHp: 1 }); expect(b.snapshot).toMatchObject({ hp: 1, maxHp: 1 });
    expect(a.snapshot.target.id).not.toBe(b.snapshot.target.id);
    expect(a.enemies.map(enemy => enemy.challenge.word.answer).sort()).toEqual(['apple', 'water']);
    expect(a.enemies.find(enemy => enemy.challenge.word.answer === 'water').challenge).toMatchObject({ kind: 'fill', prompt: 'I drink ___.' });
    expect(host.messages.some(message => message.type === 'seen')).toBe(false);
    const closed = [host, guest].map(peer => new Promise(resolve => peer.socket.once('close', code => resolve(code))));
    now = deck.expiresAt; runtime.hub.step(25);
    const expired = await Promise.all([host, guest].map(peer => peer.wait(message => message.type === 'room' && message.room.status === 'expired')));
    expect(expired.every(message => message.room.players.length === 0)).toBe(true);
    expect(await Promise.all(closed)).toEqual([4004, 4004]);
    expect(runtime.hub.rooms.size).toBe(0); expect(runtime.hub.sessions.size).toBe(0);
  });

  it('joins four peers with unique heroes, rejects a fifth peer and non-host start, and protects state', async () => {
    const { connect } = await fixture();
    const host = await connect();
    const peers = await Promise.all([connect(), connect(), connect(), connect()]);
    const pin = host.room.pin;
    expect(pin).toMatch(/^\d{6}$/);
    for (const peer of peers.slice(0, 3)) {
      const cursor = peer.messages.length;
      peer.send({ type: 'join', pin });
      peer.room = (await peer.wait(message => message.type === 'room' && message.room.pin === pin, cursor)).room;
    }
    const lobby = (await host.wait(message => message.type === 'room' && message.room.players.length === 4)).room;
    expect(new Set(lobby.players.map(player => player.heroId)).size).toBe(4);
    expect(lobby.players.every(player => player.connected)).toBe(true);
    const rejected = peers[3];
    rejected.send({ type: 'join', pin });
    expect((await rejected.wait(message => message.type === 'error')).code).toBe('full');
    const guest = peers[0];
    let cursor = guest.messages.length;
    guest.send({ type: 'hero', heroId: lobby.players.find(player => player.id === host.room.selfId).heroId });
    expect((await guest.wait(message => message.type === 'error', cursor)).code).toBe('hero-taken');
    cursor = guest.messages.length;
    guest.send({ type: 'start', mode: 'survival' });
    expect((await guest.wait(message => message.type === 'error', cursor)).code).toBe('host-only');
    host.send({ type: 'start', mode: 'survival' });
    const frames = await Promise.all([host, ...peers.slice(0, 3)].map(peer => peer.wait(message => message.type === 'frame' && message.snapshot.phase === 'playing')));
    expect(frames.every(frame => frame.snapshot.party.players.length === 4)).toBe(true);
    const targets = frames.map(frame => frame.snapshot.target?.id).filter(id => id !== undefined);
    expect(targets.length).toBeGreaterThan(0);
    expect(new Set(targets).size).toBe(targets.length);
    expect(frames.map(frame => frame.enemies.map(enemy => enemy.id))).toEqual(Array.from({ length: 4 }, () => frames[0].enemies.map(enemy => enemy.id)));

    cursor = guest.messages.length;
    guest.command({ kind: 'overwrite', hp: 999, playerX: -9999, score: 1000000 });
    expect((await guest.wait(message => message.type === 'error', cursor)).code).toBe('invalid');
    const afterInvalid = await guest.wait(message => message.type === 'frame', cursor);
    expect(afterInvalid.snapshot.hp).toBe(100);
    expect(afterInvalid.snapshot.playerX).toBeGreaterThan(0);
    expect(afterInvalid.snapshot.score).toBe(0);

    const targetOwner = frames.findIndex(frame => frame.snapshot.target);
    const actor = [host, ...peers.slice(0, 3)][targetOwner];
    const targetFrame = frames[targetOwner];
    const word = targetFrame.enemies.find(enemy => enemy.id === targetFrame.snapshot.target.id).challenge.word.answer;
    const beforeWord = host.messages.length;
    for (const key of word) actor.command({ kind: 'type', key });
    const completed = await host.wait(message => message.type === 'frame' && message.snapshot.words >= 1, beforeWord);
    expect(completed.snapshot.words).toBe(1);
    await Promise.all([host, ...peers.slice(0, 3)].map(peer => peer.wait(message => message.type === 'seen' && message.words.includes(word))));
  }, 20000);

  it('restores a disconnected peer and transfers host authority without creating a duplicate player', async () => {
    const { connect } = await fixture();
    const host = await connect();
    const guest = await connect();
    guest.send({ type: 'join', pin: host.room.pin });
    const lobby = (await guest.wait(message => message.type === 'room' && message.room.players.length === 2)).room;
    const cursor = guest.messages.length;
    await host.close();
    const disconnected = (await guest.wait(message => message.type === 'room' && message.room.players.some(player => player.id === host.room.selfId && !player.connected), cursor)).room;
    expect(disconnected.hostId).toBe(guest.room.selfId);
    const restored = await connect(host.session.token);
    expect(restored.room.pin).toBe(host.room.pin);
    expect(restored.room.selfId).toBe(host.room.selfId);
    expect(restored.room.players).toHaveLength(2);
    expect(new Set(restored.room.players.map(player => player.id)).size).toBe(2);
    expect(restored.room.hostId).toBe(guest.room.selfId);
    expect(restored.room.players.find(player => player.id === host.room.selfId).heroId).toBe(lobby.players.find(player => player.id === host.room.selfId).heroId);
    expect(restored.room.players.every(player => player.connected)).toBe(true);
  }, 15000);

  it('closes an old socket when the same session reconnects and removes empty rooms after grace', async () => {
    const { connect, runtime } = await fixture();
    const first = await connect();
    const oldClosed = new Promise(resolve => first.socket.once('close', code => resolve(code)));
    const second = await connect(first.session.token);
    expect(await oldClosed).toBe(4001);
    expect(second.room.selfId).toBe(first.room.selfId);
    expect(second.room.players).toHaveLength(1);
    await second.close();
    const session = runtime.hub.sessions.get(second.session.token);
    await expect.poll(() => session.connected, { timeout: 1000, interval: 10 }).toBe(false);
    // Advance only cleanup time; gameplay state is still reached over real sockets above.
    session.disconnectedAt = Date.now() - 20_001;
    runtime.hub.step(1);
    expect(runtime.hub.rooms.has(first.room.pin)).toBe(false);
    expect(runtime.hub.sessions.has(second.session.token)).toBe(false);
  }, 15000);
});
