import type { Progress, RunSummary, Word } from './types';
import { historyKeysFor } from './vocabulary';

const DATABASE = 'zombie-vocabulary-survival';
const KEY = 'progress-v1';
const FALLBACK_KEY = 'zvs-progress-v1';
const SEEN_KEY = 'zvs-seen-words-v1';
const SEEN_BUCKET_KEY = 'zvs-seen-words-v2:';
const LETTERS = [...'abcdefghijklmnopqrstuvwxyz'];
const SEEN_PREFIXES = LETTERS.flatMap(first => [first, ...LETTERS.map(second => first + second)]);
// Keep optional statistics mirrors from consuming space needed by the immediate seen-word journal.
const MAX_MIRROR_CHARS = 500_000;
interface StoredProgress { version: 1; progress: Progress; savedRuns: string[]; savedAt: number }
const IO_TIMEOUT_MS = 2000;
let warning = '';
let seenWarning = '';
let seenMemory: Record<string, number> = {};
const seenBuckets = new Map<string, Record<string, number>>();
const unpersistedBuckets = new Set<string>();
let seenInitialized = false;
let memory: StoredProgress | null = null;
let saveQueue: Promise<unknown> = Promise.resolve();

export function emptyProgress(): Progress {
  return { highScore: 0, runs: 0, totalWords: 0, words: {}, seenWords: {} };
}

export function getStorageWarning(): string { return [warning, seenWarning].filter(Boolean).join(' '); }

/** Seen history is a union, independent of which copy contains the newest run statistics. */
function mergeSeen(...sources: unknown[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [answer, timestamp] of Object.entries(source)) {
      if (!/^[a-z]+$/.test(answer) || typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp < 0) continue;
      merged[answer] = Object.hasOwn(merged, answer) ? Math.min(merged[answer], timestamp) : timestamp;
    }
  }
  return merged;
}

function seenFromProgress(progress: Progress): Record<string, number> {
  const legacy = Object.fromEntries(Object.entries(progress.words).map(([answer, result]) => [answer, result.lastSeen]));
  return mergeSeen(legacy, progress.seenWords);
}

function parseSeen(raw: string | null, version: number, prefix?: string): Record<string, number> {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as { version?: number; seenWords?: unknown } | null;
    if (!data || data.version !== version || !data.seenWords || typeof data.seenWords !== 'object' || Array.isArray(data.seenWords)) {
      throw new Error('Invalid seen-word journal');
    }
    const valid = mergeSeen(data.seenWords);
    if (prefix) for (const answer of Object.keys(valid)) if (answer.slice(0, 2) !== prefix) delete valid[answer];
    if (Object.keys(valid).length !== Object.keys(data.seenWords).length) {
      seenWarning = 'Một phần danh sách từ đã gặp không hợp lệ; chỉ dữ liệu hợp lệ được khôi phục.';
    }
    return valid;
  } catch {
    seenWarning = 'Không đọc được danh sách từ đã gặp bị lỗi; vẫn giữ lịch sử hợp lệ từ tiến trình đã lưu.';
    return {};
  }
}

function rememberSeen(source: Record<string, number>): void {
  for (const [answer, timestamp] of Object.entries(source)) {
    const firstSeen = Object.hasOwn(seenMemory, answer) ? Math.min(seenMemory[answer], timestamp) : timestamp;
    seenMemory[answer] = firstSeen;
    const prefix = answer.slice(0, 2);
    let bucket = seenBuckets.get(prefix);
    if (!bucket) { bucket = {}; seenBuckets.set(prefix, bucket); }
    bucket[answer] = firstSeen;
  }
  if (memory) memory.progress.seenWords = seenMemory;
}

/** Full history reads happen at load/save boundaries, never for each newly displayed word. */
function loadSeenHistory(): void {
  seenInitialized = true;
  let legacyRaw: string | null;
  try {
    legacyRaw = localStorage.getItem(SEEN_KEY);
    rememberSeen(parseSeen(legacyRaw, 1));
    for (const prefix of SEEN_PREFIXES) rememberSeen(parseSeen(localStorage.getItem(SEEN_BUCKET_KEY + prefix), 2, prefix));
  } catch {
    seenWarning = 'Không đọc được nhật ký từ vừa gặp. Tải lại giữa trận có thể khiến từ chưa lưu trong kết quả xuất hiện lại.';
    return;
  }
  if (!legacyRaw) return;
  // Preserve the old journal unless every replacement bucket was durably written.
  try {
    for (const [prefix, bucket] of seenBuckets) {
      const merged = mergeSeen(bucket, parseSeen(localStorage.getItem(SEEN_BUCKET_KEY + prefix), 2, prefix));
      rememberSeen(merged);
      localStorage.setItem(SEEN_BUCKET_KEY + prefix, JSON.stringify({ version: 2, seenWords: merged }));
    }
    if (localStorage.getItem(SEEN_KEY) === legacyRaw) localStorage.removeItem(SEEN_KEY);
  } catch {
    seenWarning = 'Chưa chuyển được toàn bộ nhật ký từ sang định dạng mới; lịch sử cũ vẫn được giữ.';
  }
}

function mergeCurrentSeen(progress: Progress, ...otherProgress: Progress[]): void {
  rememberSeen(seenFromProgress(progress));
  for (const other of otherProgress) rememberSeen(seenFromProgress(other));
  progress.seenWords = seenMemory;
}

/** Persist at spawn time, before a run finishes or an asynchronous statistics save completes. */
export function markWordSeen(word: Word): void {
  if (!seenInitialized) loadSeenHistory();
  const timestamp = Date.now();
  const answers = Object.fromEntries(historyKeysFor(word).filter((answer) => /^[a-z]+$/.test(answer))
    .map((answer) => [answer, timestamp]));
  if (!Object.keys(answers).length) return;
  const prefixes = new Set(Object.keys(answers).map(answer => answer.slice(0, 2)));
  rememberSeen(answers);
  for (const prefix of prefixes) {
    try {
      // A fresh read preserves sequential updates made in another tab. localStorage
      // read/modify/write is not a cross-tab transaction; simultaneous writes can race.
      const merged = mergeSeen(seenBuckets.get(prefix), parseSeen(localStorage.getItem(SEEN_BUCKET_KEY + prefix), 2, prefix));
      rememberSeen(merged);
      localStorage.setItem(SEEN_BUCKET_KEY + prefix, JSON.stringify({ version: 2, seenWords: merged }));
      unpersistedBuckets.delete(prefix);
    } catch { unpersistedBuckets.add(prefix); }
  }
  seenWarning = unpersistedBuckets.size ? 'Trình duyệt không cho lưu ngay từ mới gặp. Tải lại giữa trận có thể khiến từ xuất hiện lại.' : '';
}

function validate(value: unknown): StoredProgress | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<StoredProgress>;
  const progress = data.progress;
  if (data.version !== 1 || !progress || !Number.isFinite(progress.highScore)
    || !Number.isFinite(progress.runs) || !Number.isFinite(progress.totalWords)
    || !progress.words || typeof progress.words !== 'object' || Array.isArray(progress.words)) return null;
  const safe = emptyProgress();
  safe.highScore = Math.max(0, progress.highScore);
  safe.runs = Math.max(0, progress.runs);
  safe.totalWords = Math.max(0, progress.totalWords);
  for (const [key, result] of Object.entries(progress.words)) {
    if (!/^[a-z]+$/.test(key) || !result || typeof result !== 'object'
      || typeof result.word !== 'string' || typeof result.meaning !== 'string') continue;
    const numbers = [result.encounters, result.completed, result.mistakes, result.assisted, result.totalResponseMs,
      result.lastSeen, result.nextReview];
    if (numbers.every((number) => Number.isFinite(number) && number >= 0)) safe.words[key] = result;
  }
  safe.seenWords = mergeSeen(seenFromProgress(safe), progress.seenWords);
  return { version: 1, progress: safe, savedRuns: Array.isArray(data.savedRuns) ? data.savedRuns.filter((id) => typeof id === 'string') : [],
    savedAt: Number.isFinite(data.savedAt) ? data.savedAt! : 0 };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    let settled = false;
    const fail = (reason: unknown) => { if (!settled) { settled = true; clearTimeout(timeout); reject(reason); } };
    const timeout = setTimeout(() => fail(new Error('Database open timed out')), IO_TIMEOUT_MS);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE, 1); }
    catch (reason) { fail(reason); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('data')) request.result.createObjectStore('data');
    };
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = () => fail(request.error);
    request.onblocked = () => fail(new Error('Database blocked by another tab'));
  });
}

async function readStored(): Promise<StoredProgress> {
  let database: IDBDatabase | undefined;
  let primary: StoredProgress | null = null;
  let backup: StoredProgress | null = null;
  let primaryAvailable = false;
  try {
    database = await openDatabase();
    const raw = await new Promise<unknown>((resolve, reject) => {
      const transaction = database!.transaction('data', 'readonly');
      const timeout = setTimeout(() => { reject(new Error('Database read timed out')); transaction.abort(); }, IO_TIMEOUT_MS);
      const request = transaction.objectStore('data').get(KEY);
      request.onsuccess = () => { clearTimeout(timeout); resolve(request.result); };
      request.onerror = () => { clearTimeout(timeout); reject(request.error); };
      transaction.onabort = () => { clearTimeout(timeout); reject(transaction.error); };
    });
    primaryAvailable = true;
    if (raw != null) {
      primary = validate(raw);
      if (!primary) throw new Error('Invalid saved progress');
    }
    warning = '';
  } catch {
    warning = 'IndexedDB chưa khả dụng; đang dùng bộ nhớ dự phòng trên trình duyệt.';
  } finally { database?.close(); }
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) {
      backup = validate(JSON.parse(raw));
      if (!backup) throw new Error('Invalid fallback');
    }
  } catch {
    if (!primaryAvailable) warning = 'Không đọc được dữ liệu trên máy. Tiến trình tạm giữ trong phiên này.';
  }
  // A previously failed primary write must not overwrite a newer fallback or in-memory result.
  const candidates = [primary, backup, memory].filter((candidate): candidate is StoredProgress => !!candidate);
  memory = candidates.sort((a, b) => b.savedAt - a.savedAt || b.progress.runs - a.progress.runs)[0]
    ?? { version: 1, progress: emptyProgress(), savedRuns: [], savedAt: 0 };
  mergeCurrentSeen(memory.progress, ...candidates.map((candidate) => candidate.progress));
  loadSeenHistory();
  return memory;
}

async function writeStored(stored: StoredProgress): Promise<void> {
  mergeCurrentSeen(stored.progress);
  memory = stored;
  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction('data', 'readwrite');
      const timeout = setTimeout(() => { reject(new Error('Database write timed out')); transaction.abort(); }, IO_TIMEOUT_MS);
      transaction.objectStore('data').put(stored, KEY);
      transaction.oncomplete = () => { clearTimeout(timeout); resolve(); };
      transaction.onerror = () => { clearTimeout(timeout); reject(transaction.error); };
      transaction.onabort = () => { clearTimeout(timeout); reject(transaction.error); };
    });
    // Best effort mirror makes the fallback current if IndexedDB becomes unavailable later.
    try {
      const mirror = JSON.stringify(stored);
      if (mirror.length <= MAX_MIRROR_CHARS) localStorage.setItem(FALLBACK_KEY, mirror);
      else localStorage.removeItem(FALLBACK_KEY);
    } catch { /* Primary write already succeeded. */ }
    warning = '';
    return;
  } catch {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(stored));
      warning = 'Đã lưu bằng bộ nhớ dự phòng; IndexedDB chưa khả dụng.';
    } catch {
      warning = 'Trình duyệt không cho lưu. Kết quả chỉ được giữ đến khi đóng trang.';
    }
  } finally { database?.close(); }
}

export async function loadProgress(): Promise<Progress> {
  const stored = await readStored();
  return structuredClone(stored.progress);
}

export function saveRun(summary: RunSummary): Promise<Progress> {
  const operation = saveQueue.then(async () => {
    const stored = await readStored();
    if (stored.savedRuns.includes(summary.id)) return structuredClone(stored.progress);
    const progress = structuredClone(stored.progress);
    progress.highScore = Math.max(progress.highScore, summary.score);
    progress.runs += 1;
    progress.totalWords += summary.words;
    for (const result of summary.results) {
      const previous = progress.words[result.word];
      const encounters = (previous?.encounters ?? 0) + result.encounters;
      const clean = result.completed > 0 && result.completed >= result.encounters
        && result.mistakes === 0 && result.assisted === 0;
      const days = clean ? Math.min(14, [1, 1, 3, 7, 14][Math.min(4, previous?.completed ?? 0)]) : 0;
      progress.words[result.word] = {
        ...result, encounters, completed: (previous?.completed ?? 0) + result.completed,
        mistakes: (previous?.mistakes ?? 0) + result.mistakes,
        assisted: (previous?.assisted ?? 0) + result.assisted,
        totalResponseMs: (previous?.totalResponseMs ?? 0) + result.totalResponseMs,
        lastSeen: summary.endedAt, nextReview: summary.endedAt + (days ? days * 86_400_000 : 10 * 60_000),
      };
    }
    await writeStored({ version: 1, progress, savedRuns: [...stored.savedRuns.slice(-99), summary.id],
      savedAt: Math.max(Date.now(), stored.savedAt + 1) });
    mergeCurrentSeen(progress);
    return structuredClone(progress);
  });
  saveQueue = operation.catch(() => undefined);
  return operation;
}
