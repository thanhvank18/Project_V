import { createServer, request } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createRequestHandler } from './server.mjs';
import { CustomDeckStore, CUSTOM_DECK_TTL } from './custom-decks.mjs';

const input = { title: 'Shared pack', language: 'vi', entries: [{ answer: 'apple', meaning: 'Quả táo', partOfSpeech: 'noun', level: 1, type: 'translate' }] };
const servers = [], stores = [], directories = [];
async function fixture(options = {}) {
  let now = Date.now();
  const directory = await mkdtemp(path.join(tmpdir(), 'project-v-deck-http-')); directories.push(directory);
  const store = await new CustomDeckStore(directory, { now: () => now }).init(); stores.push(store);
  const server = createServer(createRequestHandler({ wordCount: 1, sha256: 'fixture' }, { customDecks: store, now: () => now, ...options }));
  servers.push(server);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, port: server.address().port, store, advance: ms => { now += ms; } };
}
function call(port, url, { body, ...options } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: url, ...options }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('error', reject);
      response.on('end', () => { const body = Buffer.concat(chunks).toString('utf8'); resolve({ status: response.statusCode, headers: response.headers, body: body ? JSON.parse(body) : null }); });
    });
    req.on('error', reject); req.end(body);
  });
}
const post = (port, body = JSON.stringify(input), headers = {}) => call(port, '/api/custom-decks', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) {
    const relative = path.relative(path.resolve(tmpdir()), path.resolve(directory));
    if (!relative.startsWith('project-v-deck-http-') || relative.includes(path.sep)) throw new Error('Unsafe test cleanup');
    await rm(directory, { recursive: true, force: true });
  }
});

describe('public custom deck HTTP API', () => {
  it('creates and fetches immutable public packs without cache and checks hard expiry', async () => {
    const { port, store, advance } = await fixture();
    const created = await post(port, JSON.stringify({ ...input, damageMode: 'one-hit' }));
    expect(created.status).toBe(201); expect(created.body.deck).toMatchObject(input);
    expect(created.body.deck.damageMode).toBe('one-hit');
    expect((await post(port)).body.deck.damageMode).toBe('health');
    expect(created.body.deck.expiresAt - created.body.deck.createdAt).toBe(CUSTOM_DECK_TTL);
    const url = created.headers.location;
    const fetched = await call(port, url); expect(fetched.status).toBe(200); expect(fetched.body).toEqual(created.body);
    expect(fetched.headers['cache-control']).toBe('no-store');
    const head = await call(port, url, { method: 'HEAD' }); expect(head.status).toBe(200); expect(head.body).toBeNull();
    advance(CUSTOM_DECK_TTL);
    expect((await call(port, url)).status).toBe(410);
    await store.cleanup(); expect((await call(port, url)).status).toBe(404);
    expect((await call(port, '/api/custom-decks/..%2Fserver.mjs')).status).toBe(404);
  });

  it('rejects invalid JSON, rows, types and both declared and streamed oversized requests', async () => {
    const { port, store } = await fixture();
    expect((await post(port, '{bad')).status).toBe(400);
    const invalid = await post(port, JSON.stringify({ ...input, entries: [{ ...input.entries[0], answer: 'bad word' }] }));
    expect(invalid.status).toBe(422); expect(invalid.body.errors[0]).toMatchObject({ row: 1, field: 'answer' });
    expect((await post(port, '{}', { 'Content-Type': 'text/plain' })).status).toBe(415);
    const huge = 'x'.repeat(1024 * 1024 + 1);
    expect((await post(port, huge, { 'Content-Length': String(Buffer.byteLength(huge)) })).status).toBe(413);
    expect((await post(port, huge, { 'Transfer-Encoding': 'chunked' })).status).toBe(413);
    expect(store.decks.size).toBe(0);
  });

  it('serves per-link rankings without cache and never accepts client-submitted scores', async () => {
    const { port, store, advance } = await fixture();
    const created = await post(port), deck = created.body.deck;
    const url = `${created.headers.location}/leaderboard`;
    const empty = await call(port, url);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ deckId: deck.id, expiresAt: deck.expiresAt, entries: [] });
    expect(empty.headers['cache-control']).toBe('no-store');
    const run = { id: randomUUID(), players: ['Người chơi'], score: 120, words: 1, accuracy: 100,
      durationMs: 2500, endedAt: deck.createdAt, reason: 'vocabulary-complete' };
    await store.recordRun(deck.id, run);
    expect((await call(port, url)).body.entries).toEqual([run]);
    const head = await call(port, url, { method: 'HEAD' });
    expect(head.status).toBe(200); expect(head.body).toBeNull();
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const rejected = await call(port, url, { method, body: JSON.stringify(run), headers: { 'Content-Type': 'application/json' } });
      expect(rejected.status).toBe(405); expect(rejected.headers.allow).toBe('GET, HEAD, OPTIONS');
    }
    expect((await call(port, url, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST' } })).status).toBe(405);
    expect((await call(port, `/api/custom-decks/${'0'.repeat(32)}/leaderboard`)).status).toBe(404);
    expect((await call(port, '/api/custom-decks/..%2Fserver.mjs/leaderboard')).status).toBe(404);
    advance(CUSTOM_DECK_TTL);
    expect((await call(port, url)).status).toBe(410);
    await store.cleanup(); expect((await call(port, url)).status).toBe(404);
  });

  it('permits only the configured origin and methods and bounds anonymous creation rate', async () => {
    const { port } = await fixture({ corsOrigins: new Set(['https://game.example']) });
    const preflight = await call(port, '/api/custom-decks', { method: 'OPTIONS', headers: { Origin: 'https://game.example', 'Access-Control-Request-Method': 'POST' } });
    expect(preflight.status).toBe(204); expect(preflight.headers['access-control-allow-methods']).toContain('POST');
    expect((await post(port, JSON.stringify(input), { Origin: 'https://evil.example' })).status).toBe(403);
    expect((await call(port, '/api/custom-decks', { method: 'GET' })).status).toBe(405);
    for (let i = 0; i < 10; i++) expect((await post(port, '{}')).status).toBe(422);
    const limited = await post(port); expect(limited.status).toBe(429); expect(limited.headers['retry-after']).toBe('600');
  });

  it('returns a bounded generic error on storage failure and remains healthy', async () => {
    const { port } = await fixture({ customDecks: { create: async () => { throw new Error('private filesystem details'); } } });
    const failed = await post(port); expect(failed.status).toBe(500); expect(JSON.stringify(failed.body)).not.toContain('private');
    expect((await call(port, '/health')).status).toBe(200);
  });

  it('trusts Railway client IP only in the explicitly enabled ingress mode', async () => {
    const local = await fixture();
    for (let i = 0; i < 10; i++) await post(local.port, '{}', { 'X-Real-IP': `203.0.113.${i + 1}` });
    expect((await post(local.port, '{}', { 'X-Real-IP': '203.0.113.99' })).status).toBe(429);
    const railway = await fixture({ trustRailwayProxy: true });
    for (let i = 0; i < 10; i++) await post(railway.port, '{}', { 'X-Real-IP': '203.0.113.1' });
    expect((await post(railway.port, '{}', { 'X-Real-IP': '203.0.113.2' })).status).toBe(422);
    expect((await post(railway.port, '{}', { 'X-Real-IP': '203.0.113.1' })).status).toBe(429);
  });

  it('does not save a partial pack when its uploader disconnects', async () => {
    const { server, port, store } = await fixture();
    const received = new Promise(resolve => server.once('request', resolve));
    const upload = request({ hostname: '127.0.0.1', port, path: '/api/custom-decks', method: 'POST', headers: { 'Content-Type': 'application/json' } });
    upload.on('error', () => {});
    const closed = new Promise(resolve => upload.once('close', resolve));
    upload.write('{"title":"unfinished'); await received; upload.destroy(); await closed;
    expect((await call(port, '/health')).status).toBe(200); expect(store.decks.size).toBe(0);
  });
});
