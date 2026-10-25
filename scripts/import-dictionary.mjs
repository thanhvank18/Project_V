/** Import Vietnamese Wiktionary definitions into the offline game bank.
 * Source text and this adapted dataset: CC BY-SA 4.0. See DICTIONARY_SOURCES.md.
 * Node 20+: node scripts/import-dictionary.mjs --input path/to/raw.jsonl.gz
 * Or: node scripts/import-dictionary.mjs --download
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { applyEditorialCorrections } from './dictionary-editorial.mjs';

export const SOURCE = {
  name: 'Vietnamese Wiktionary via Kaikki / Wiktextract',
  url: 'https://kaikki.org/viwiktionary/Ti%E1%BA%BFng%20Anh/index.html',
  downloadUrl: 'https://kaikki.org/viwiktionary/raw-wiktextract-data.jsonl.gz',
  rawDataPage: 'https://kaikki.org/viwiktionary/rawdata.html',
  license: 'CC-BY-SA-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  copyright: 'Wiktionary contributors; extraction by Tatu Ylonen and Wiktextract contributors.',
  snapshot: '2026-10-02',
  extractedAt: '2026-10-21',
  attributionUrl: 'https://vi.wiktionary.org/wiki/Wiktionary:Quy%E1%BB%81n_t%C3%A1c_gi%E1%BA%A3',
  changes: 'Filtered English lowercase single-word nouns, verbs and adjectives; selected one substantive Vietnamese sense per answer; normalized whitespace and leading separators; removed cross-references, inflections, malformed glosses and a limited explicit profanity list; assigned length-based game difficulty and POS category. No examples, images or audio copied.',
};
export const PINNED_SOURCE_SHA256 = 'dcdaf93d642ae1d1c4d495b68d90eb572fac86d00281044cf804e0d98147a25e';

const POS = { noun: 'noun', verb: 'verb', adj: 'adjective' };
const CATEGORIES = { noun: 'Danh từ', verb: 'Động từ', adjective: 'Tính từ' };
// Supplement incomplete upstream vulgar/offensive tags; not a comprehensive age-rating filter.
const EXCLUDED_ANSWERS = new Set(['fuck', 'fucks', 'fucked', 'fucking', 'fucker', 'fuckers', 'motherfucker', 'motherfuckers', 'cocksucker', 'cocksuckers', 'asshole', 'assholes', 'arsehole', 'arseholes', 'shit', 'shits', 'shitty', 'bullshit', 'bullshitter', 'cunt', 'cunts', 'nigger', 'niggers']);
const BAD_TAGS = new Set(['form-of', 'alt-of', 'no-gloss', 'obsolete', 'archaic', 'dated', 'abbreviation', 'initialism', 'acronym', 'proper-noun', 'misspelling', 'nonstandard', 'vulgar', 'offensive', 'derogatory', 'error-lua-exec']);
const BAD_LABEL = /(?:từ cổ|cổ ngữ|không còn dùng|lỗi thời|viết tắt|tên riêng|tên người|tên địa danh|tục tĩu|thô tục|xúc phạm|miệt thị|\bthgt\b|\btục\b)/iu;
const CROSS_REFERENCE = /^(?:\([^)]*\)\s*)*(?:xem|như|cũng|(?:từ )?đồng nghĩa (?:với|của)|biến thể|dạng (?:thay thế|biến đổi|số nhiều|so sánh|quá khứ)|số nhiều (?:của|ở)|quá khứ|phân từ|hiện tại phân từ|động từ chia|chia ở ngôi|cách chia|ngôi thứ|cách viết|viết tắt|plural|past participle|alternative (?:form|spelling))(?=$|[^\p{L}])/iu;
const VIETNAMESE_MARK = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu;
const GRAMMATICAL_REFERENCE = /^(?:\([^)]*\)\s*)*(?:dạng viết|chính tả|của\s|rút gọn|ngôi\s*\d|(?:động|đồng) từ (?:quá khứ|hiện tại|ngôi)|danh từ,? số nhiều|tính từ sở hữu)/iu;

function badMetadata(value) {
  return (value.tags ?? []).some(tag => BAD_TAGS.has(tag)) || BAD_LABEL.test((value.raw_tags ?? []).join(' '));
}

export function cleanGloss(raw, answer) {
  if (typeof raw !== 'string') return null;
  const meaning = raw.normalize('NFC').replace(/\s+/gu, ' ').replace(/^[\s,;:•*]+/u, '').trim();
  if (meaning.length < 2 || meaning.length > 120) return null;
  // Do not truncate a definition: that could silently change its meaning.
  if (/[{}\[\]|<>#]|https?:|Lua|mô.?đun|bản mẫu|chưa có nội dung/iu.test(meaning)) return null;
  if (BAD_LABEL.test(meaning) || CROSS_REFERENCE.test(meaning) || GRAMMATICAL_REFERENCE.test(meaning)) return null;
  if (/^(?:\([^)]*\)\s*)*(?:thuộc|có nghĩa như|giống như)\s+[a-z]+[.!]?$/iu.test(meaning)) return null;
  // A raw Vietnamese-edition record occasionally contains an untranslated English gloss.
  const plainMeaning = meaning.replace(/\([^)]*\)/gu, '').trim();
  if (!VIETNAMESE_MARK.test(plainMeaning)) return null;
  if (new RegExp(`\\b${answer}\\b`, 'i').test(meaning)) return null;
  return meaning;
}

export function candidateFromEntry(entry) {
  if (entry?.lang_code !== 'en' || !/^[a-z]{3,18}$/.test(entry.word ?? '') || !POS[entry.pos]) return null;
  if (badMetadata(entry) || EXCLUDED_ANSWERS.has(entry.word)) return null;
  for (const sense of entry.senses ?? []) {
    if (badMetadata(sense) || sense.form_of?.length || sense.alt_of?.length) continue;
    // The final gloss in a path is the actual sense; previous glosses are parent headings.
    const meaning = cleanGloss(sense.glosses?.at(-1), entry.word);
    if (!meaning) continue;
    const partOfSpeech = POS[entry.pos];
    return {
      id: `dict-${entry.word}`, answer: entry.word, meaning,
      category: CATEGORIES[partOfSpeech], partOfSpeech,
      difficulty: entry.word.length <= 5 ? 1 : entry.word.length <= 8 ? 2 : 3,
      sourceUrl: `https://vi.wiktionary.org/wiki/${encodeURIComponent(entry.word)}#Ti%E1%BA%BFng_Anh`,
    };
  }
  return null;
}

export async function importDictionary(inputPath, outputPath, expectedSha256, editorial) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(inputPath)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  if (expectedSha256 && sha256 !== expectedSha256) throw new Error(`Source checksum mismatch: ${sha256}`);
  const stream = createReadStream(inputPath);
  const lines = createInterface({ input: inputPath.endsWith('.gz') ? stream.pipe(createGunzip()) : stream, crlfDelay: Infinity });
  const bank = new Map();
  const stats = { sourceRecords: 0, englishRecords: 0, eligibleRecords: 0, duplicateAnswers: 0, words: 0, longWords: 0, byPartOfSpeech: {}, byDifficulty: {} };
  for await (const line of lines) {
    if (!line.trim()) continue;
    stats.sourceRecords++;
    // A broken source is an import failure, not an apparently valid but silently incomplete bank.
    const entry = JSON.parse(line);
    if (entry.lang_code === 'en') stats.englishRecords++;
    const word = candidateFromEntry(entry);
    if (!word) continue;
    stats.eligibleRecords++;
    if (bank.has(word.answer)) { stats.duplicateAnswers++; continue; }
    bank.set(word.answer, word);
  }
  const words = [...bank.values()].sort((a, b) => a.answer < b.answer ? -1 : a.answer > b.answer ? 1 : 0);
  if (!words.length) throw new Error('No playable English–Vietnamese words found; refusing to replace bank.');
  for (const word of words) {
    stats.words++;
    if (word.answer.length >= 7) stats.longWords++;
    stats.byPartOfSpeech[word.partOfSpeech] = (stats.byPartOfSpeech[word.partOfSpeech] ?? 0) + 1;
    stats.byDifficulty[word.difficulty] = (stats.byDifficulty[word.difficulty] ?? 0) + 1;
  }
  const source = { ...SOURCE, sha256, downloadedBytes: (await stat(inputPath)).size, importedAt: new Date().toISOString(), stats };
  const original = { version: 1, source, words };
  const result = editorial ? applyEditorialCorrections(original, editorial) : original;
  await mkdir(dirname(outputPath), { recursive: true });
  // Only write after the entire source parses and validates successfully.
  await writeFile(outputPath, `${JSON.stringify(result)}\n`, 'utf8');
  await writeFile(join(dirname(outputPath), 'source-manifest.json'), `${JSON.stringify({ version: 1, ...result.source, outputBytes: (await stat(outputPath)).size }, null, 2)}\n`, 'utf8');
  if (editorial) await writeFile(join(dirname(outputPath), 'editorial-corrections.json'), `${JSON.stringify(editorial, null, 2)}\n`, 'utf8');
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const option = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const output = resolve(option('--output') ?? join(projectRoot, 'public/vocabulary/en-vi.json'));
  let input = option('--input');
  if (!input && args.includes('--download')) {
    input = join(tmpdir(), 'project-v-viwiktionary.jsonl.gz');
    const response = await fetch(SOURCE.downloadUrl);
    if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(input));
  }
  if (!input) throw new Error('Use --input path/to/raw.jsonl.gz or --download. See DICTIONARY_SOURCES.md.');
  // The pinned source metadata must be deliberately updated when importing a newer upstream snapshot.
  const editorial = JSON.parse(await readFile(join(projectRoot, 'public/vocabulary/editorial-corrections.json'), 'utf8'));
  const result = await importDictionary(resolve(input), output, option('--expected-sha256') ?? PINNED_SOURCE_SHA256, editorial);
  console.log(JSON.stringify({ output, sourceSha256: result.source.sha256, ...result.source.stats }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
