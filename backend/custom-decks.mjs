import { randomBytes } from 'node:crypto';
import { mkdir, readdir, lstat, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { validateCustomDeck } from '../src/game/customDeck.ts';

export const CUSTOM_DECK_TTL = 24 * 60 * 60 * 1000;
export const CUSTOM_DECK_BODY_LIMIT = 1024 * 1024;
const ID = /^[a-f0-9]{32}$/;
const error = (message, code, status, details) => Object.assign(new Error(message), { code, status, ...(details ? { errors: details } : {}) });

/** Bounded, immutable 24-hour decks. Room lookups are synchronous after startup. */
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
        this.decks.set(deck.id, { deck: { ...parsed.data, id: deck.id, createdAt: deck.createdAt, expiresAt: deck.expiresAt }, bytes: info.size });
        this.bytes += info.size;
      } catch (cause) { if (cause.code !== 'ENOENT' && !(cause instanceof SyntaxError)) throw cause; }
    }
    this.timer = setInterval(() => { this.cleanup().catch(() => {}); }, this.cleanupMs);
    this.timer.unref();
    return this;
  }

  create(input) {
    // Serialize quota checks and commits so simultaneous POSTs cannot exceed the disk budget.
    const operation = this.pending.then(async () => {
      const parsed = validateCustomDeck(input);
      if (!parsed.data) throw error('Bộ từ chưa hợp lệ.', 'validation', 422, parsed.errors);
      await this.cleanup();
      const createdAt = this.now();
      const deck = { ...parsed.data, id: randomBytes(16).toString('hex'), createdAt, expiresAt: createdAt + CUSTOM_DECK_TTL };
      const body = JSON.stringify(deck), bytes = Buffer.byteLength(body);
      if (bytes > CUSTOM_DECK_BODY_LIMIT) throw error('Bộ từ vượt giới hạn 1 MiB.', 'too-large', 413);
      if (this.decks.size >= this.maxDecks || this.bytes + bytes > this.maxBytes) throw error('Kho bộ từ đang đầy. Hãy thử lại sau.', 'capacity', 503);
      const temporary = path.join(this.directory, `${deck.id}.tmp`), file = path.join(this.directory, `${deck.id}.json`);
      try { await writeFile(temporary, body, { flag: 'wx', mode: 0o600 }); await rename(temporary, file); }
      catch (cause) { await rm(temporary, { force: true }).catch(() => {}); throw cause; }
      this.decks.set(deck.id, { deck, bytes }); this.bytes += bytes;
      return structuredClone(deck);
    });
    this.pending = operation.catch(() => {});
    return operation;
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

  async remove(id) {
    const stored = this.decks.get(id);
    if (!stored) return;
    // Drop from playable memory immediately; failed disk cleanup is retried by the next sweep.
    this.decks.delete(id); this.bytes -= stored.bytes;
    await rm(path.join(this.directory, `${id}.json`), { force: true });
  }

  async cleanup() {
    for (const [id, stored] of this.decks) if (stored.deck.expiresAt <= this.now()) await this.remove(id);
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
