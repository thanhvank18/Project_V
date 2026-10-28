import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import roomRuntime from './rooms.bundle.cjs';

const compress = promisify(gzip);
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const METHODS = 'GET, HEAD, OPTIONS';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function parsePort(value = '3001') {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

/** Public read-only data defaults to wildcard CORS; optionally restrict to exact frontend origins. */
export function parseCorsOrigins(value = '*') {
  if (value.trim() === '*') return '*';
  const origins = new Set();
  for (const entry of value.split(',')) {
    let url;
    try { url = new URL(entry.trim()); } catch { throw new Error('CORS_ORIGINS must contain HTTP(S) origins or *'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('CORS_ORIGINS must contain HTTP(S) origins without paths or credentials');
    }
    origins.add(url.origin);
  }
  if (!origins.size) throw new Error('CORS_ORIGINS must not be empty');
  return origins;
}

/** Validate the real target before reading: this service exposes one fixed catalog, no file browser. */
export async function loadVocabulary(root = PROJECT_ROOT, { englishDefinitions } = {}) {
  const realRoot = await realpath(root);
  const base = await realpath(path.join(realRoot, 'public', 'vocabulary'));
  const relativeBase = path.relative(realRoot, base);
  if (!relativeBase || relativeBase.startsWith(`..${path.sep}`) || relativeBase === '..' || path.isAbsolute(relativeBase)) {
    throw new Error('Dictionary directory real path must stay inside the project');
  }
  const target = await realpath(path.join(base, 'en-vi.json'));
  const relative = path.relative(base, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('Dictionary real path must stay inside public/vocabulary');
  }
  const info = await stat(target);
  if (!info.isFile() || info.size > 64 * 1024 * 1024) {
    throw new Error('Dictionary must be a regular JSON file smaller than 64 MiB');
  }
  let body = await readFile(target);
  let catalog;
  try { catalog = JSON.parse(body.toString('utf8')); } catch { throw new Error('Dictionary is not valid JSON'); }
  if (catalog?.version !== 1 || !Array.isArray(catalog.words) || !catalog.words.length
    || !catalog.source || typeof catalog.source.name !== 'string') {
    throw new Error('Dictionary must contain a nonempty version 1 catalog');
  }
  if (englishDefinitions) {
    catalog = { ...catalog, words: roomRuntime.mergeEnglishDefinitions(catalog.words, englishDefinitions), englishSource: englishDefinitions.source };
    if (!catalog.words.some(word => word.englishMeaning)) throw new Error('English dictionary contains no playable definitions');
    body = Buffer.from(JSON.stringify(catalog));
  }
  const zipped = await compress(body, { level: 6 });
  const sha256 = hash(body);
  return {
    body, zipped, wordCount: catalog.words.length, sha256,
    modified: info.mtime.toUTCString(),
    etag: `"sha256-${sha256}"`, gzipEtag: `"sha256-${hash(zipped)}"`,
  };
}

function encodingQuality(header, name) {
  if (!header) return name === 'identity' ? 1 : 0;
  const values = new Map();
  for (const token of header.toLowerCase().split(',')) {
    const [coding, ...parameters] = token.trim().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    const value = quality === undefined ? 1 : Number(quality.trim().slice(2));
    values.set(coding.trim(), Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0);
  }
  if (values.has(name)) return values.get(name);
  if (name === 'identity') return values.get('*') === 0 ? 0 : 1;
  return values.get('*') ?? 0;
}

export function selectEncoding(header) {
  const gzipQuality = encodingQuality(header, 'gzip');
  const identityQuality = encodingQuality(header, 'identity');
  if (gzipQuality > 0 && gzipQuality >= identityQuality) return 'gzip';
  return identityQuality > 0 ? 'identity' : null;
}

function matchesEtag(header, etag) {
  return !!header && header.split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag);
}

async function readDeckBody(request) {
  const limit = roomRuntime.CUSTOM_DECK_BODY_LIMIT;
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
    request.resume();
    throw Object.assign(new Error('Cần gửi dữ liệu JSON.'), { status: 415, code: 'content-type' });
  }
  if (Number(request.headers['content-length']) > limit) {
    request.resume();
    throw Object.assign(new Error('Bộ từ vượt giới hạn 1 MiB.'), { status: 413, code: 'too-large' });
  }
  const body = await new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    const clean = () => { request.off('data', data); request.off('end', end); request.off('aborted', aborted); request.off('error', failed); };
    const failed = cause => { clean(); reject(cause); };
    const aborted = () => failed(Object.assign(new Error('Yêu cầu đã bị hủy.'), { status: 400, code: 'aborted' }));
    const data = chunk => {
      size += chunk.length;
      if (size > limit) { failed(Object.assign(new Error('Bộ từ vượt giới hạn 1 MiB.'), { status: 413, code: 'too-large' })); request.resume(); return; }
      chunks.push(chunk);
    };
    const end = () => { clean(); resolve(Buffer.concat(chunks).toString('utf8')); };
    request.on('data', data); request.once('end', end); request.once('aborted', aborted); request.once('error', failed);
  });
  try { return JSON.parse(body); }
  catch { throw Object.assign(new Error('Dữ liệu JSON chưa hợp lệ.'), { status: 400, code: 'invalid-json' }); }
}

export function createRequestHandler(vocabulary, { corsOrigins = '*', customDecks, now = Date.now, trustRailwayProxy = false } = {}) {
  const rates = new Map(); let window = now(), total = 0;
  const allowCreate = request => {
    const current = now();
    if (current - window >= 60_000) { window = current; total = 0; }
    for (const [key, record] of rates) if (current - record.at >= 10 * 60_000) rates.delete(key);
    // Railway replaces X-Real-IP at its ingress. Never trust caller-supplied forwarding headers elsewhere.
    const forwarded = request.headers['x-real-ip'];
    const ip = trustRailwayProxy && typeof forwarded === 'string' && isIP(forwarded)
      ? forwarded : request.socket.remoteAddress ?? 'unknown';
    const record = rates.get(ip) ?? { at: current, count: 0 };
    if (total >= 30 || record.count >= 10 || rates.size >= 10_000 && !rates.has(ip)) return false;
    total++; record.count++; rates.set(ip, record); return true;
  };
  return async (request, response) => {
    request.on('error', () => {}); // An aborted/oversized body may emit an error after the parser has detached.
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Vary', 'Origin, Accept-Encoding');
    const origin = request.headers.origin;
    const allowed = corsOrigins === '*' || !origin || corsOrigins.has(origin);
    if (allowed && (corsOrigins === '*' || origin)) {
      response.setHeader('Access-Control-Allow-Origin', corsOrigins === '*' ? '*' : origin);
      response.setHeader('Access-Control-Expose-Headers', 'ETag, X-Dictionary-Words');
    }
    const sendJson = (status, value) => {
      if (response.destroyed || response.writableEnded) return;
      const body = Buffer.from(JSON.stringify(value));
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store', 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!allowed) { sendJson(403, { error: 'Origin not allowed' }); return; }
    let pathname;
    try { pathname = new URL(request.url ?? '/', 'http://vocabulary.invalid').pathname; }
    catch { sendJson(400, { error: 'Invalid request URL' }); return; }
    const createDeck = pathname === '/api/custom-decks';
    const deckMatch = /^\/api\/custom-decks\/([a-f0-9]{32})$/.exec(pathname);
    const leaderboardMatch = /^\/api\/custom-decks\/([a-f0-9]{32})\/leaderboard$/.exec(pathname);
    if (pathname !== '/health' && pathname !== '/api/vocabulary' && !createDeck && !deckMatch && !leaderboardMatch) {
      sendJson(404, { error: 'Not found' }); return;
    }
    if (request.method === 'OPTIONS') {
      const requested = request.headers['access-control-request-method'];
      const methods = createDeck ? ['POST'] : ['GET', 'HEAD'];
      if (requested && !methods.includes(requested.toUpperCase())) {
        response.setHeader('Allow', createDeck ? 'POST, OPTIONS' : METHODS);
        sendJson(405, { error: 'Method not allowed' }); return;
      }
      response.writeHead(204, {
        'Access-Control-Allow-Methods': createDeck ? 'POST, OPTIONS' : METHODS,
        'Access-Control-Allow-Headers': 'If-None-Match, Content-Type',
        'Access-Control-Max-Age': '86400',
        'Cache-Control': 'no-store',
      });
      response.end(); return;
    }
    if (createDeck || deckMatch || leaderboardMatch) {
      if (createDeck ? request.method !== 'POST' : !['GET', 'HEAD'].includes(request.method)) {
        response.setHeader('Allow', createDeck ? 'POST, OPTIONS' : METHODS);
        sendJson(405, { error: 'Method not allowed' }); return;
      }
      if (!customDecks) { sendJson(503, { error: 'Kho bộ từ chưa sẵn sàng.', code: 'unavailable' }); return; }
      try {
        if (leaderboardMatch) { sendJson(200, customDecks.getLeaderboard(leaderboardMatch[1])); return; }
        if (createDeck && !allowCreate(request)) {
          request.resume(); response.setHeader('Retry-After', '600');
          sendJson(429, { error: 'Bạn tạo bộ từ quá nhanh. Hãy thử lại sau.', code: 'rate' }); return;
        }
        const deck = createDeck ? await customDecks.create(await readDeckBody(request)) : customDecks.get(deckMatch[1]);
        if (createDeck) response.setHeader('Location', `/api/custom-decks/${deck.id}`);
        sendJson(createDeck ? 201 : 200, { deck });
      } catch (cause) {
        sendJson(cause.status ?? 500, { error: cause.status ? cause.message : 'Không lưu được bộ từ. Hãy thử lại.',
          code: cause.code ?? 'storage', ...(cause.errors ? { errors: cause.errors } : {}) });
      }
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', METHODS);
      sendJson(405, { error: 'Method not allowed' }); return;
    }
    if (pathname === '/health') {
      sendJson(200, { status: 'ok', service: 'zombie-vocabulary-api',
        dictionary: { words: vocabulary.wordCount, sha256: vocabulary.sha256 } });
      return;
    }
    const encoding = selectEncoding(request.headers['accept-encoding']);
    if (!encoding) { sendJson(406, { error: 'No supported content encoding accepted' }); return; }
    const compressed = encoding === 'gzip';
    const etag = compressed ? vocabulary.gzipEtag : vocabulary.etag;
    const body = compressed ? vocabulary.zipped : vocabulary.body;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    response.setHeader('ETag', etag);
    response.setHeader('Last-Modified', vocabulary.modified);
    response.setHeader('X-Dictionary-Words', vocabulary.wordCount);
    if (compressed) response.setHeader('Content-Encoding', 'gzip');
    if (matchesEtag(request.headers['if-none-match'], etag)) {
      response.writeHead(304); response.end(); return;
    }
    response.setHeader('Content-Length', body.length);
    response.writeHead(200);
    response.end(request.method === 'HEAD' ? undefined : body);
  };
}

export async function startServer({ port = parsePort(process.env.PORT), root = PROJECT_ROOT,
  corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS), customDeckDir = process.env.CUSTOM_DECK_DIR ?? path.join(root, 'data', 'custom-decks') } = {}) {
  const english = JSON.parse(await readFile(path.join(root, 'public', 'vocabulary', 'english-definitions.json'), 'utf8'));
  const vocabulary = await loadVocabulary(root, { englishDefinitions: english });
  const customDecks = await new roomRuntime.CustomDeckStore(customDeckDir).init();
  const handle = createRequestHandler(vocabulary, { corsOrigins, customDecks, trustRailwayProxy: !!process.env.RAILWAY_ENVIRONMENT_ID });
  const server = createServer((request, response) => {
    Promise.resolve(handle(request, response)).catch(error => {
      console.error('[vocabulary-api] Request failed:', error.message);
      if (response.headersSent) response.destroy();
      else { response.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end('{"error":"Request failed"}'); }
    });
  });
  const words = JSON.parse(vocabulary.body.toString('utf8')).words;
  const rooms = roomRuntime.attachRooms(server, words, { corsOrigins, customDecks });
  server.roomHub = rooms.hub;
  server.closeRooms = rooms.close;
  server.customDecks = customDecks;
  server.once('close', () => customDecks.close());
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  await new Promise((resolve, reject) => {
    const failed = error => { customDecks.close(); rooms.close(); reject(error); };
    server.once('error', failed);
    server.listen(port, '0.0.0.0', () => { server.off('error', failed); resolve(); });
  });
  console.log(`[vocabulary-api] Listening on ${server.address().port}; ${vocabulary.wordCount} words ready`);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().then(server => {
    const shutdown = () => {
      server.closeRooms();
      server.close(error => { if (error) process.exitCode = 1; });
      const deadline = setTimeout(() => server.closeAllConnections(), 10_000);
      deadline.unref();
      server.once('close', () => clearTimeout(deadline));
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }).catch(error => {
    console.error(`[vocabulary-api] Startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
