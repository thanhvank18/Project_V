import { randomInt, randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { GameEngine } from '../src/game/engine.ts';
import { HERO_CHARACTERS } from '../src/game/characterCatalog.ts';
import { vocabularyForLanguage } from '../src/game/englishDictionary.ts';
export { mergeEnglishDefinitions } from '../src/game/englishDictionary.ts';

const HEROES = HERO_CHARACTERS.map(hero => hero.id);
const ITEMS = new Set(['health', 'freeze', 'damage', 'shield']);
const GRACE_MS = 20_000;
const wire = value => JSON.stringify(value, (_key, item) => item instanceof Set ? [...item] : item);
const fail = (message, code = 'invalid') => { throw Object.assign(new Error(message), { code }); };

/** A single authoritative simulation per room. Browser packets contain intentions only. */
export class RoomHub {
  constructor(words, { now = Date.now, Engine = GameEngine, maxRooms = 32 } = {}) {
    this.words = words; this.now = now; this.Engine = Engine; this.maxRooms = maxRooms;
    this.rooms = new Map(); this.sessions = new Map(); this.allowedWords = new Set(words.map(word => word.answer));
  }

  hello(message, send) {
    if (message.language !== undefined && !['vi', 'en'].includes(message.language)) fail('Ngôn ngữ không hợp lệ.');
    if (!Array.isArray(message.seen) || message.seen.length > 100_000
      || message.seen.some(word => typeof word !== 'string' || !/^[a-z]{3,18}$/.test(word))) fail('Lịch sử từ không hợp lệ.');
    const old = typeof message.resumeToken === 'string' ? this.sessions.get(message.resumeToken) : undefined;
    const session = old && this.rooms.has(old.pin) ? old : {
      id: randomUUID(), token: randomUUID(), heroId: HEROES.includes(message.heroId) ? message.heroId : 'soldier',
      language: message.language ?? 'vi',
      seen: new Set(), pin: '', connected: true, disconnectedAt: 0, attempts: [], tokens: 100, rateAt: this.now(), lastMoveAt: 0,
    };
    if (session.connected && session.send) session.send({ type: 'replaced', error: 'Phiên này đã được mở ở kết nối khác.' });
    session.send = send; session.connected = true; session.disconnectedAt = 0;
    for (const word of message.seen) if (this.allowedWords.has(word)) session.seen.add(word);
    this.sessions.set(session.token, session);
    send({ type: 'session', token: session.token, selfId: session.id, nextSeq: (session.lastSeq ?? -1) + 1 });
    if (!session.pin) {
      try { this.createRoom(session); }
      catch (error) { this.sessions.delete(session.token); session.connected = false; throw error; }
    }
    else {
      const room = this.rooms.get(session.pin);
      room.engine?.setPartyConnected(session.id, true);
      if (room.seenDuring.size) send({ type: 'seen', words: [...room.seenDuring] });
      this.broadcastLobby(room); this.sendFrame(room, session, []);
    }
    return session;
  }

  lobby(room, session) {
    return { status: room.engine && room.engine.snapshotFor(session.id).phase !== 'menu' ? 'playing' : 'lobby',
      pin: room.pin, selfId: session.id, hostId: room.hostId, language: room.language,
      players: room.members.map(member => ({ id: member.id, name: member.name, heroId: member.heroId, connected: member.connected })), error: '' };
  }

  broadcastLobby(room) {
    for (const member of room.members) if (member.connected) member.send({ type: 'room', room: this.lobby(room, member) });
  }

  createRoom(session) {
    if (this.rooms.size >= this.maxRooms && !(this.rooms.get(session.pin)?.members.length === 1)) fail('Máy chủ đang đủ phòng. Hãy thử lại sau.', 'capacity');
    this.leave(session);
    let pin;
    do { pin = String(randomInt(100000, 1000000)); } while (this.rooms.has(pin));
    const room = { pin, hostId: session.id, language: session.language, members: [session], engine: null, seenDuring: new Set(),
      pendingSeen: [], touchedAt: this.now(), tickCount: 0, match: 0 };
    session.pin = pin; session.name = 'Người chơi 1';
    this.rooms.set(pin, room); this.broadcastLobby(room);
  }

  leave(session) {
    const room = this.rooms.get(session.pin);
    if (!room) return;
    room.engine?.removePartyPlayer(session.id);
    room.members = room.members.filter(member => member !== session);
    session.pin = '';
    if (!room.members.length) this.rooms.delete(room.pin);
    else {
      if (room.hostId === session.id) room.hostId = (room.members.find(member => member.connected) ?? room.members[0]).id;
      this.broadcastLobby(room);
    }
  }

  receive(session, message) {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') fail('Lệnh không hợp lệ.');
    const now = this.now();
    session.tokens = Math.min(100, session.tokens + Math.max(0, now - session.rateAt) * .08); session.rateAt = now;
    if (session.tokens < 1) fail('Bạn gửi thao tác quá nhanh.', 'rate');
    session.tokens--;
    let room = this.rooms.get(session.pin);
    if (!room) fail('Phòng đã đóng. Hãy tạo phòng mới.', 'missing');
    room.touchedAt = now;
    if (message.type === 'create' || message.type === 'join') {
      session.attempts = session.attempts.filter(time => now - time < 60_000);
      if (session.attempts.length >= 10) fail('Đã thử vào phòng nhiều lần. Chờ một phút rồi thử lại.', 'rate');
      session.attempts.push(now);
      if (message.type === 'create') { this.createRoom(session); return; }
      if (typeof message.pin !== 'string' || !/^\d{6}$/.test(message.pin)) fail('Mã phòng phải gồm 6 chữ số.');
      const next = this.rooms.get(message.pin);
      if (!next) fail('Không tìm thấy phòng với mã này.', 'missing');
      if (next === room) return;
      if (next.engine && next.engine.snapshot().phase !== 'menu') fail('Phòng đang chơi. Hãy đợi trận kết thúc.', 'started');
      if (next.members.length >= 4) fail('Phòng đã đủ 4 người.', 'full');
      const taken = new Set(next.members.map(member => member.heroId));
      const heroId = taken.has(session.heroId) ? HEROES.find(id => !taken.has(id)) : session.heroId;
      this.leave(session);
      session.pin = next.pin; session.heroId = heroId; session.language = next.language;
      const usedNames = new Set(next.members.map(member => member.name));
      session.name = [1, 2, 3, 4].map(number => `Người chơi ${number}`).find(name => !usedNames.has(name));
      next.members.push(session); this.broadcastLobby(next); return;
    }
    if (message.type === 'hero') {
      if (room.engine && room.engine.snapshot().phase !== 'menu') fail('Chỉ đổi anh hùng trước trận.');
      if (!HEROES.includes(message.heroId)) fail('Anh hùng không hợp lệ.');
      if (room.members.some(member => member !== session && member.heroId === message.heroId)) fail('Anh hùng này đã có người chọn.', 'hero-taken');
      session.heroId = message.heroId; this.broadcastLobby(room); return;
    }
    if (message.type === 'language') {
      if (room.hostId !== session.id) fail('Chỉ chủ phòng đổi ngôn ngữ.', 'host-only');
      if (room.engine && room.engine.snapshot().phase !== 'menu') fail('Chỉ đổi ngôn ngữ trước trận.');
      if (!['vi', 'en'].includes(message.language)) fail('Ngôn ngữ không hợp lệ.');
      if (message.language === 'en' && !this.words.some(word => word.englishMeaning)) fail('Kho từ tiếng Anh chưa sẵn sàng.');
      room.language = message.language;
      for (const member of room.members) member.language = room.language;
      this.broadcastLobby(room); return;
    }
    if (message.type === 'start') {
      if (room.hostId !== session.id) fail('Chỉ chủ phòng có thể bắt đầu.', 'host-only');
      if (!['survival', 'boss'].includes(message.mode)) fail('Chế độ không hợp lệ.');
      if (room.engine && ['playing', 'paused', 'countdown'].includes(room.engine.snapshot().phase)) fail('Trận đang diễn ra.');
      if (room.members.some(member => !member.connected)) fail('Hãy đợi đồng đội kết nối lại.');
      const bank = vocabularyForLanguage(this.words, room.language);
      if (!bank.length) fail('Kho từ tiếng Anh chưa sẵn sàng.');
      const seen = Object.fromEntries([...new Set(room.members.flatMap(member => [...member.seen]))].map(word => [word, 1]));
      room.seenDuring.clear(); room.pendingSeen = []; room.match++;
      room.engine = new this.Engine(Math.random, { highScore: 0, runs: 0, totalWords: 0, words: {}, seenWords: seen }, word => {
        room.seenDuring.add(word.answer); room.pendingSeen.push(word.answer);
        for (const member of room.members) member.seen.add(word.answer);
      }, bank);
      room.engine.configureParty(room.members.map(member => ({ id: member.id, name: member.name, heroId: member.heroId })));
      room.engine.start(message.mode); this.broadcastLobby(room); this.broadcastFrame(room); return;
    }
    if (message.type === 'lobby') {
      if (room.hostId !== session.id) fail('Chỉ chủ phòng mở lại sảnh.', 'host-only');
      if (room.engine?.snapshot().phase !== 'over') fail('Trận chưa kết thúc.');
      room.engine = null; this.broadcastLobby(room); return;
    }
    if (message.type !== 'command' || !room.engine) fail('Chưa có trận đang chơi.');
    if (!Number.isSafeInteger(message.seq) || message.seq < 0 || message.seq <= (session.lastSeq ?? -1)) return;
    const command = message.command;
    if (!command || typeof command !== 'object') fail('Thao tác không hợp lệ.');
    let action;
    if (command.kind === 'type' && typeof command.key === 'string' && (/^[a-z]$/i.test(command.key) || command.key === 'Backspace')) action = () => room.engine.typeKey(command.key);
    else if (command.kind === 'move' && [-1, 0, 1].includes(command.direction)) {
      session.lastMoveAt = now; action = () => room.engine.setMovement(command.direction);
    } else if (command.kind === 'cycle' && [-1, 1].includes(command.direction)) action = () => room.engine.cycleTarget(command.direction);
    else if (command.kind === 'item' && ITEMS.has(command.item)) action = () => room.engine.useItem(command.item);
    else if (command.kind === 'interact') action = () => room.engine.interactWorld();
    else fail('Thao tác không hợp lệ.');
    session.lastSeq = message.seq;
    room.engine.commandAs(session.id, action);
  }

  disconnect(session, send) {
    if (session.send !== send) return;
    session.connected = false; session.disconnectedAt = this.now();
    const room = this.rooms.get(session.pin);
    room?.engine?.setPartyConnected(session.id, false);
    if (room) {
      if (room.hostId === session.id) room.hostId = (room.members.find(member => member.connected) ?? session).id;
      this.broadcastLobby(room);
    }
  }

  sendFrame(room, member, events) {
    if (!room.engine || !member.connected) return;
    const snapshot = room.engine.snapshotFor(member.id);
    // Run IDs must stay unique across rooms, server restarts, and newly constructed engines.
    if (snapshot.summary) snapshot.summary = { ...snapshot.summary, id: `${room.pin}:${room.match}:${snapshot.summary.id}` };
    member.send({ type: 'frame', clock: room.engine.clock, snapshot,
      enemies: room.engine.enemies, worldObjects: room.engine.worldObjects ?? [], events, ack: member.lastSeq ?? -1 });
  }

  broadcastFrame(room) {
    if (!room.engine) return;
    const events = room.engine.drainEvents();
    for (const member of room.members) if (member.connected) {
      if (room.pendingSeen.length) member.send({ type: 'seen', words: room.pendingSeen });
      this.sendFrame(room, member, events);
    }
    room.pendingSeen = [];
  }

  step(delta = 25) {
    const now = this.now();
    for (const session of this.sessions.values()) {
      if (!session.connected && now - session.disconnectedAt >= GRACE_MS) { this.leave(session); this.sessions.delete(session.token); }
    }
    for (const room of this.rooms.values()) {
      if (!room.engine) continue;
      for (const member of room.members) if (now - member.lastMoveAt > 1200) room.engine.commandAs(member.id, () => room.engine.setMovement(0));
      room.engine.step(Math.min(100, Math.max(0, delta)));
      if (++room.tickCount % 2 === 0) this.broadcastFrame(room);
    }
  }
}

export function attachRooms(server, words, { corsOrigins = '*', now = Date.now } = {}) {
  const hub = new RoomHub(words, { now });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024, perMessageDeflate: false });
  const connectionRates = new Map();
  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    const ip = socket.remoteAddress ?? 'unknown';
    const record = connectionRates.get(ip) ?? { at: now(), count: 0 };
    if (now() - record.at > 60_000) { record.at = now(); record.count = 0; }
    record.count++; connectionRates.set(ip, record);
    if (request.url !== '/api/rooms' || (corsOrigins !== '*' && origin && !corsOrigins.has(origin)) || wss.clients.size >= 128 || record.count > 30) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    let session, alive = true;
    const send = value => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 1024 * 1024) { ws.close(1013, 'Connection too slow'); return; }
      ws.send(wire(value));
      if (value.type === 'replaced') ws.close(4001, 'Session replaced');
    };
    const helloTimeout = setTimeout(() => { if (!session) ws.close(1008, 'Hello required'); }, 10_000);
    helloTimeout.unref();
    ws.on('pong', () => { alive = true; });
    ws.on('message', (data, binary) => {
      try {
        if (session && session.send !== send) return;
        if (binary) fail('Chỉ nhận dữ liệu văn bản.');
        const message = JSON.parse(data.toString());
        if (!session) {
          if (message?.type !== 'hello') fail('Cần kết nối vào phòng trước.');
          session = hub.hello(message, send); clearTimeout(helloTimeout);
        } else hub.receive(session, message);
      } catch (error) {
        send({ type: 'error', error: error.code ? error.message : 'Không xử lý được thao tác. Hãy thử lại.', code: error.code ?? 'invalid' });
        if (!session) ws.close(1008, 'Unable to join');
      }
    });
    const heartbeat = setInterval(() => { if (!alive) { ws.terminate(); return; } alive = false; ws.ping(); }, 15_000);
    heartbeat.unref();
    ws.on('error', () => {});
    ws.on('close', () => { clearTimeout(helloTimeout); clearInterval(heartbeat); if (session) hub.disconnect(session, send); });
  });
  let previous = now();
  const timer = setInterval(() => {
    const current = now(); hub.step(current - previous); previous = current;
    for (const [ip, record] of connectionRates) if (current - record.at > 60_000) connectionRates.delete(ip);
  }, 25);
  timer.unref();
  const close = () => { clearInterval(timer); for (const ws of wss.clients) ws.close(1001, 'Server restarting'); wss.close(); };
  server.once('close', close);
  return { hub, close };
}
