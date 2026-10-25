import { createServer, request } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequestHandler, loadVocabulary, parseCorsOrigins, parsePort, selectEncoding } from './server.mjs';

const catalog = { version: 1, source: { name: 'Fixture CSV' }, words: [
  { id: 'csv-water', answer: 'water', meaning: 'Nước', category: 'CSV', partOfSpeech: 'noun', difficulty: 1, learningLevel: 1 },
] };
let root;
let vocabulary;
const servers = [];

async function listen(options) {
  const server = createServer(createRequestHandler(vocabulary, options));
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

function get(port, url, options = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = request({ hostname: '127.0.0.1', port, path: url, ...options }, incoming => {
      const chunks = [];
      incoming.on('data', chunk => chunks.push(chunk));
      incoming.on('end', () => resolve({ status: incoming.statusCode, headers: incoming.headers, body: Buffer.concat(chunks) }));
      incoming.on('error', reject);
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'project-v-vocabulary-test-'));
  await mkdir(path.join(root, 'public', 'vocabulary'), { recursive: true });
  await writeFile(path.join(root, 'public', 'vocabulary', 'en-vi.json'), JSON.stringify(catalog));
  vocabulary = await loadVocabulary(root);
});

afterAll(async () => {
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  const relative = path.relative(path.resolve(tmpdir()), path.resolve(root));
  if (!relative.startsWith('project-v-vocabulary-test-') || relative.includes(path.sep)) throw new Error('Unsafe test cleanup');
  await rm(root, { recursive: true, force: true });
});

describe('dictionary service configuration', () => {
  it('validates PORT and explicit CORS origins before the server listens', () => {
    expect(parsePort()).toBe(3001);
    expect(parsePort('8080')).toBe(8080);
    for (const value of ['', '0', '-1', '1.2', '65536', '80oops', 'Infinity']) expect(() => parsePort(value)).toThrow('PORT');
    expect(parseCorsOrigins()).toBe('*');
    expect([...parseCorsOrigins('https://project-v.vercel.app,http://127.0.0.1:5174/')]).toEqual(['https://project-v.vercel.app', 'http://127.0.0.1:5174']);
    for (const value of ['', '*.vercel.app', 'https://example.com/path', 'https://user:pass@example.com', 'https://example.com?query=1']) {
      expect(() => parseCorsOrigins(value)).toThrow('CORS_ORIGINS');
    }
  });

  it('honors content-encoding preferences, explicit q=0 and identity refusal', () => {
    expect(selectEncoding()).toBe('identity');
    expect(selectEncoding('gzip, br')).toBe('gzip');
    expect(selectEncoding('gzip;q=0, *;q=1')).toBe('identity');
    expect(selectEncoding('gzip;q=0.5,identity;q=1')).toBe('identity');
    expect(selectEncoding('gzip;q=0.5,identity;q=0')).toBe('gzip');
    expect(selectEncoding('*;q=0')).toBeNull();
  });

  it('fails before readiness when the fixed catalog is missing, corrupt or an empty bank', async () => {
    const broken = path.join(root, 'broken');
    await mkdir(path.join(broken, 'public', 'vocabulary'), { recursive: true });
    await expect(loadVocabulary(broken)).rejects.toThrow();
    const target = path.join(broken, 'public', 'vocabulary', 'en-vi.json');
    await writeFile(target, '{broken');
    await expect(loadVocabulary(broken)).rejects.toThrow('not valid JSON');
    await writeFile(target, JSON.stringify({ ...catalog, words: [] }));
    await expect(loadVocabulary(broken)).rejects.toThrow('nonempty version 1');
  });

  it('rejects a dictionary-directory junction whose real path escapes its project', async () => {
    const escaped = path.join(root, 'escaped');
    await mkdir(path.join(escaped, 'public'), { recursive: true });
    await symlink(path.join(root, 'public', 'vocabulary'), path.join(escaped, 'public', 'vocabulary'), 'junction');
    await expect(loadVocabulary(escaped)).rejects.toThrow('real path must stay inside the project');
  });
});

describe('HTTP dictionary routes', () => {
  it('serves health and the unchanged catalog, with gzip, ETag revalidation and correct HEAD semantics', async () => {
    const port = await listen();
    const health = await get(port, '/health');
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body)).toMatchObject({ status: 'ok', dictionary: { words: 1, sha256: vocabulary.sha256 } });
    expect(health.headers['cache-control']).toBe('no-store');
    const plain = await get(port, '/api/vocabulary');
    expect(plain.status).toBe(200);
    expect(JSON.parse(plain.body)).toEqual(catalog);
    expect(plain.body.equals(vocabulary.body)).toBe(true);
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.headers['cache-control']).toContain('public, max-age=300');
    const zipped = await get(port, '/api/vocabulary', { headers: { 'Accept-Encoding': 'gzip' } });
    expect(zipped.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(zipped.body).equals(plain.body)).toBe(true);
    expect(zipped.headers.etag).not.toBe(plain.headers.etag);
    expect(zipped.headers.vary).toContain('Accept-Encoding');
    const fresh = await get(port, '/api/vocabulary', { headers: { 'Accept-Encoding': 'gzip', 'If-None-Match': `W/${zipped.headers.etag}` } });
    expect(fresh.status).toBe(304);
    expect(fresh.body.length).toBe(0);
    const head = await get(port, '/api/vocabulary', { method: 'HEAD', headers: { 'Accept-Encoding': 'gzip' } });
    expect(head.status).toBe(200);
    expect(head.body.length).toBe(0);
    expect(head.headers['content-length']).toBe(String(zipped.body.length));
    expect(head.headers.etag).toBe(zipped.headers.etag);
  });

  it('allows exact configured frontend origins, rejects others and answers browser preflight', async () => {
    const origin = 'https://project-v.vercel.app';
    const port = await listen({ corsOrigins: parseCorsOrigins(origin) });
    const valid = await get(port, '/api/vocabulary', { headers: { Origin: origin } });
    expect(valid.headers['access-control-allow-origin']).toBe(origin);
    expect(valid.headers.vary).toContain('Origin');
    const denied = await get(port, '/api/vocabulary', { headers: { Origin: 'https://other.example' } });
    expect(denied.status).toBe(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    const options = await get(port, '/api/vocabulary', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } });
    expect(options.status).toBe(204);
    expect(options.headers['access-control-allow-methods']).toBe('GET, HEAD, OPTIONS');
    expect(options.headers['access-control-allow-origin']).toBe(origin);
    expect(options.body.length).toBe(0);
  });

  it('keeps routing fixed, rejects writes and does not compress when gzip is forbidden', async () => {
    const port = await listen();
    expect((await get(port, '/health', { method: 'POST' })).status).toBe(405);
    const missing = await get(port, '/vocabulary/../../server.mjs');
    expect(missing.status).toBe(404);
    expect(JSON.parse(missing.body)).toEqual({ error: 'Not found' });
    expect((await get(port, '/api/vocabulary', { headers: { 'Accept-Encoding': '*;q=0' } })).status).toBe(406);
    const uncompressed = await get(port, '/api/vocabulary', { headers: { 'Accept-Encoding': 'gzip;q=0' } });
    expect(uncompressed.status).toBe(200);
    expect(uncompressed.headers['content-encoding']).toBeUndefined();
    expect(uncompressed.headers['access-control-allow-origin']).toBe('*');
  });
});
