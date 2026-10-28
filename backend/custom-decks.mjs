import { randomBytes } from 'node:crypto';
import { mkdir, readdir, lstat, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { validateCustomDeck } from '../src/game/customDeck.ts';
import { compareLeaderboardEntries, parseLeaderboardEntry, LEADERBOARD_CATEGORY_LIMIT } from '../src/game/customDeckLeaderboard.ts';

export const CUSTOM_DECK_TTL = 24 * 60 * 60 * 1000;
export const CUSTOM_DECK_BODY_LIMIT = 1024 * 1024;
const ID = /^[a-f0-9]{32}$/;
const error = (message, code, status, details) => Object.assign(new Error(message), { code, status, ...(details ? { errors: details } : {}) });

function boundedLeaderboard(entries, deck, now) {
  if (!Array.isArray(entries)) return [];
  const ids = new Set(), counts = [0, 0];
  return entries.map(parseLeaderboardEntry).filter(entry => entry
    && entry.endedAt >= deck.createdAt && entry.endedAt < deck.expiresAt && entry.endedAt <= now
    && entry.durationMs <= CUSTOM_DECK_TTL).sort(compareLeaderboardEntries).filter(entry => {
      const mode = entry.players.length === 1 ? 0 : 1;
      if (ids.has(entry.id) || counts[mode] >= LEADERBOARD_CATEGORY_LIMIT) return false;
      ids.add(entry.id); counts[mode]++; return true;
    });
}

/** Immutable 24-hour decks with bounded match results. Room lookups stay synchronous. */
export class CustomDeckStore {
  constructor(directory, { now = Date.now, maxDecks = 1000, maxBytes = 100 * 1024 * 1024, cleanupMs = 60_000 } = {}) {
    this.directory = path.resolve(directory); this.now = now; this.maxDecks = maxDecks; this.maxBytes = maxBytes;
    this.cleanupMs = cleanupMs; this.decks = new Map(); this.bytes = 0; this.pending = Promise.resolve();
  }

  async init() {
    await mkdir(this.directory, { recursive: true });
    for (const entry of await readdir(this.directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{32}\.json$/.test(entry.name)) continue;
      const file = path.join(this.directory, entry.name);
      try {
        const info = await lstat(file);
        if (!info.isFile() || info.size > CUSTOM_DECK_BODY_LIMIT) continue;
        const deck = JSON.parse(await readFile(file, 'utf8'));
        const parsed = validateCustomDeck(deck);
        if (!parsed.data || !ID.test(deck.id) || `${deck.id}.json` !== entry.name
          || !Number.isSafeInteger(deck.createdAt) || !Number.isSafeInteger(deck.expiresAt)
          || deck.expiresAt - deck.createdAt !== CUSTOM_DECK_TTL || deck.createdAt > this.now()) continue;
        if (deck.expiresAt <= this.now()) { await rm(file, { force: true }); continue; }
        if (this.decks.size >= this.maxDecks || this.bytes + info.size > this.maxBytes) continue;
        const cleanDeck = { ...parsed.data, id: deck.id, createdAt: deck.createdAt, expiresAt: deck.expiresAt };
        this.decks.set(deck.id, { deck: cleanDeck, leaderboard: boundedLeaderboard(deck.leaderboard, cleanDeck, this.now()), bytes: info.size });
        this.bytes += info.size;
      } catch (cause) { if (cause.code !== 'ENOENT' && !(cause instanceof SyntaxError)) throw cause; }
    }
    this.timer = setInterval(() => { this.cleanup().catch(() => {}); }, this.cleanupMs);
    this.timer.unref();
    return this;
  }

  create(input) {
    // Serialize quota checks and commits so simultaneous POSTs cannot exceed the disk budget.
    return this.enqueue(async () => {
      const parsed = validateCustomDeck(input);
      if (!parsed.data) throw error('Bộ từ chưa hợp lệ.', 'validation', 422, parsed.errors);
      await this.cleanupNow();
      const createdAt = this.now();
      const deck = { ...parsed.data, id: randomBytes(16).toString('hex'), createdAt, expiresAt: createdAt + CUSTOM_DECK_TTL };
      const body = JSON.stringify(deck), bytes = Buffer.byteLength(body);
      if (bytes > CUSTOM_DECK_BODY_LIMIT) throw error('Bộ từ vượt giới hạn 1 MiB.', 'too-large', 413);
      if (this.decks.size >= this.maxDecks || this.bytes + bytes > this.maxBytes) throw error('Kho bộ từ đang đầy. Hãy thử lại sau.', 'capacity', 503);
      await this.persist(deck.id, body);
      this.decks.set(deck.id, { deck, leaderboard: [], bytes }); this.bytes += bytes;
      return structuredClone(deck);
    });
  }

  enqueue(work) {
    const operation = this.pending.then(work);
    this.pending = operation.catch(() => {});
    return operation;
  }

  async persist(id, body) {
    const temporary = path.join(this.directory, `${id}.tmp`), file = path.join(this.directory, `${id}.json`);
    try { await writeFile(temporary, body, { flag: 'wx', mode: 0o600 }); await rename(temporary, file); }
    catch (cause) { await rm(temporary, { force: true }).catch(() => {}); throw cause; }
  }

  get(id) {
    if (typeof id !== 'string' || !ID.test(id)) throw error('Không tìm thấy bộ từ.', 'deck-missing', 404);
    const stored = this.decks.get(id);
    if (!stored) throw error('Không tìm thấy bộ từ hoặc liên kết đã hết hạn.', 'deck-missing', 404);
    if (stored.deck.expiresAt <= this.now()) {
      this.remove(id).catch(() => {});
      throw error('Liên kết bộ từ đã hết hạn sau 24 giờ.', 'deck-expired', 410);
    }
    return structuredClone(stored.deck);
  }

  getLeaderboard(id) {
    const deck = this.get(id);
    return { deckId: deck.id, expiresAt: deck.expiresAt, entries: structuredClone(this.decks.get(id).leaderboard) };
  }

  recordRun(id, value) {
    return this.enqueue(async () => {
      const deck = this.get(id), stored = this.decks.get(id);
      const entry = parseLeaderboardEntry(value);
      if (!entry || entry.endedAt < deck.createdAt || entry.endedAt >= deck.expiresAt || entry.endedAt > this.now()
        || entry.durationMs > CUSTOM_DECK_TTL) throw error('Kết quả chưa hợp lệ.', 'validation', 422);
      if (stored.leaderboard.some(previous => previous.id === entry.id)) return;
      const leaderboard = boundedLeaderboard([...stored.leaderboard, entry], deck, this.now());
      // A result outside the retained top 50 in its mode requires no disk write.
      if (!leaderboard.some(previous => previous.id === entry.id)) return;
      const body = JSON.stringify({ ...deck, leaderboard }), bytes = Buffer.byteLength(body);
      if (bytes > CUSTOM_DECK_BODY_LIMIT || this.bytes - stored.bytes + bytes > this.maxBytes) {
        throw error('Kho kết quả đang đầy. Hãy thử lại sau.', 'capacity', 503);
      }
      await this.persist(id, body);
      // A read can expire a link while the atomic write is in flight. Never restore it.
      if (deck.expiresAt <= this.now() || this.decks.get(id) !== stored) {
        if (this.decks.get(id) === stored) { this.decks.delete(id); this.bytes -= stored.bytes; }
        await rm(path.join(this.directory, `${id}.json`), { force: true });
        throw error('Liên kết bộ từ đã hết hạn sau 24 giờ.', 'deck-expired', 410);
      }
      this.bytes += bytes - stored.bytes;
      stored.bytes = bytes; stored.leaderboard = leaderboard;
    });
  }

  remove(id) {
    const stored = this.decks.get(id);
    if (!stored) return Promise.resolve();
    // Drop from playable memory immediately; failed disk cleanup is retried by the next sweep.
    this.decks.delete(id); this.bytes -= stored.bytes;
    return this.enqueue(() => rm(path.join(this.directory, `${id}.json`), { force: true }));
  }

  cleanup() { return this.enqueue(() => this.cleanupNow()); }

  async cleanupNow() {
    for (const [id, stored] of this.decks) if (stored.deck.expiresAt <= this.now()) {
      this.decks.delete(id); this.bytes -= stored.bytes;
      await rm(path.join(this.directory, `${id}.json`), { force: true });
    }
    // Also remove expired/uncommitted files after a crash or a previous failed unlink.
    for (const entry of await readdir(this.directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{32}\.(json|tmp)$/.test(entry.name)) continue;
      const id = entry.name.slice(0, 32);
      if (this.decks.has(id)) continue;
      const file = path.join(this.directory, entry.name);
      const info = await lstat(file).catch(() => null);
      if (info?.isFile() && this.now() - info.mtimeMs > CUSTOM_DECK_TTL) await rm(file, { force: true });
    }
  }

  close() { clearInterval(this.timer); }
}
