import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
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
export async function loadVocabulary(root = PROJECT_ROOT) {
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
  const body = await readFile(target);
  let catalog;
  try { catalog = JSON.parse(body.toString('utf8')); } catch { throw new Error('Dictionary is not valid JSON'); }
  if (catalog?.version !== 1 || !Array.isArray(catalog.words) || !catalog.words.length
    || !catalog.source || typeof catalog.source.name !== 'string') {
    throw new Error('Dictionary must contain a nonempty version 1 catalog');
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

export function createRequestHandler(vocabulary, { corsOrigins = '*' } = {}) {
  return (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Vary', 'Origin, Accept-Encoding');
    const origin = request.headers.origin;
    const allowed = corsOrigins === '*' || !origin || corsOrigins.has(origin);
    if (allowed && (corsOrigins === '*' || origin)) {
      response.setHeader('Access-Control-Allow-Origin', corsOrigins === '*' ? '*' : origin);
      response.setHeader('Access-Control-Expose-Headers', 'ETag, X-Dictionary-Words');
    }
    const sendJson = (status, value) => {
      const body = Buffer.from(JSON.stringify(value));
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store', 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!allowed) { sendJson(403, { error: 'Origin not allowed' }); return; }
    let pathname;
    try { pathname = new URL(request.url ?? '/', 'http://vocabulary.invalid').pathname; }
    catch { sendJson(400, { error: 'Invalid request URL' }); return; }
    if (pathname !== '/health' && pathname !== '/api/vocabulary') {
      sendJson(404, { error: 'Not found' }); return;
    }
    if (request.method === 'OPTIONS') {
      const requested = request.headers['access-control-request-method'];
      if (requested && !['GET', 'HEAD'].includes(requested.toUpperCase())) {
        response.setHeader('Allow', METHODS);
        sendJson(405, { error: 'Method not allowed' }); return;
      }
      response.writeHead(204, {
        'Access-Control-Allow-Methods': METHODS,
        'Access-Control-Allow-Headers': 'If-None-Match, Content-Type',
        'Access-Control-Max-Age': '86400',
        'Cache-Control': 'no-store',
      });
      response.end(); return;
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
  corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS) } = {}) {
  const vocabulary = await loadVocabulary(root);
  const handle = createRequestHandler(vocabulary, { corsOrigins });
  const server = createServer((request, response) => {
    try { handle(request, response); }
    catch (error) {
      console.error('[vocabulary-api] Request failed:', error.message);
      if (response.headersSent) response.destroy();
      else { response.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end('{"error":"Request failed"}'); }
    }
  });
  const rooms = roomRuntime.attachRooms(server, JSON.parse(vocabulary.body.toString('utf8')).words, { corsOrigins });
  server.roomHub = rooms.hub;
  server.closeRooms = rooms.close;
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => { server.off('error', reject); resolve(); });
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
