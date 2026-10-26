/** Reproducible English clues from the pinned, openly licensed OEWN release. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';

export const WORDNET_SOURCE = Object.freeze({
  name: 'Open English WordNet 2025',
  url: 'https://en-word.net/',
  downloadUrl: 'https://en-word.net/static/english-wordnet-2025-json.zip',
  license: 'CC-BY-4.0; underlying Princeton WordNet License',
  snapshot: '2025-edition',
  sha256: '7d749f6e2c39e6970e4997839dcf6e42fd281f3c2fae0171d2192bae8cfa4b51',
});
export const MAX_DEFINITION_LENGTH = 240;
const POS = { noun: ['n'], verb: ['v'], adjective: ['a', 's'], adverb: ['r'] };
const SOURCE_POS = { n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' };
const CACHE = '.cache/english-wordnet/english-wordnet-2025-json.zip';
const text = value => typeof value === 'string' ? value.normalize('NFC').replace(/\s+/gu, ' ').trim() : '';

/** Read expected JSON entries in memory; never extract archive paths onto disk. */
export function readWordnetArchive(archive) {
  if (!Buffer.isBuffer(archive) || archive.length > 30_000_000 || archive.length < 22) throw new Error('Invalid WordNet archive');
  let footer = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset--) {
    if (archive.readUInt32LE(offset) === 0x06054b50) { footer = offset; break; }
  }
  if (footer < 0) throw new Error('Missing ZIP directory');
  if (archive.readUInt16LE(footer + 4) || archive.readUInt16LE(footer + 6)) throw new Error('Multi-volume ZIP is unsupported');
  let offset = archive.readUInt32LE(footer + 16);
  const count = archive.readUInt16LE(footer + 10);
  const entries = Object.create(null), synsets = Object.create(null);
  for (let index = 0; index < count; index++) {
    if (offset + 46 > footer || archive.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP entry');
    const flags = archive.readUInt16LE(offset + 8), method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20), size = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28), extraLength = archive.readUInt16LE(offset + 30), commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    offset += 46 + nameLength + extraLength + commentLength;
    if (!/^(?:entries-[a-z0]|(?:noun|verb|adj|adv)\.[A-Za-z]+)\.json$/u.test(name)) continue;
    if ((flags & 1) || ![0, 8].includes(method) || size > 12_000_000 || localOffset + 30 > archive.length
      || archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Unsupported ZIP payload');
    const start = localOffset + 30 + archive.readUInt16LE(localOffset + 26) + archive.readUInt16LE(localOffset + 28);
    if (start + compressedSize > archive.length) throw new Error('Truncated ZIP payload');
    const compressed = archive.subarray(start, start + compressedSize);
    const contents = method === 8 ? inflateRawSync(compressed, { maxOutputLength: 12_000_000 }) : compressed;
    if (contents.length !== size) throw new Error('Incorrect ZIP payload size');
    const values = JSON.parse(contents.toString('utf8'));
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Invalid WordNet JSON');
    const destination = name.startsWith('entries-') ? entries : synsets;
    for (const [key, value] of Object.entries(values)) {
      if (Object.hasOwn(destination, key)) throw new Error(`Duplicate WordNet key: ${key}`);
      destination[key] = value;
    }
  }
  if (!Object.keys(entries).length || !Object.keys(synsets).length) throw new Error('Missing WordNet entries or synsets');
  return { entries, synsets };
}

/** Preserve whole source definitions, masking only a literal answer token. */
export function prepareEnglishClue(definition, answer) {
  if (!/^[a-z]{3,18}$/u.test(answer)) return undefined;
  const value = text(definition);
  if (value.length < 3 || value.length > MAX_DEFINITION_LENGTH || /[<>{}\[\]\u0000-\u001f]/u.test(value)) return undefined;
  const masked = value.replace(new RegExp(`\\b${answer}\\b`, 'giu'), '_____');
  // Bare cross-references and placeholders do not teach a meaning.
  if (masked.length > MAX_DEFINITION_LENGTH || (masked.match(/[a-z]{3,}/giu) ?? []).length < 1
    || /^(?:see|plural of|past tense of|alternative (?:spelling|form) of|variant of)\b/iu.test(masked)) return undefined;
  return masked;
}

export function buildEnglishDefinitions(words, wordnet) {
  const entries = {}, missing = { noLemma: 0, noMatchingPartOfSpeech: 0, noUsableDefinition: 0 };
  const byLevel = {}, byPartOfSpeech = {};
  for (const word of [...words].sort((a, b) => a.answer.localeCompare(b.answer, 'en'))) {
    const level = word.learningLevel ?? 1;
    byLevel[level] ??= { total: 0, covered: 0 };
    byPartOfSpeech[word.partOfSpeech] ??= { total: 0, covered: 0 };
    byLevel[level].total++;
    byPartOfSpeech[word.partOfSpeech].total++;
    const lexical = wordnet.entries[word.answer];
    if (!lexical) { missing.noLemma++; continue; }
    const senses = (POS[word.partOfSpeech] ?? []).flatMap(pos => lexical[pos]?.sense ?? []);
    if (!senses.length) { missing.noMatchingPartOfSpeech++; continue; }
    let selected;
    for (const sense of senses) {
      const synset = wordnet.synsets[sense.synset];
      if (!synset || SOURCE_POS[synset.partOfSpeech] !== word.partOfSpeech) continue;
      for (const definition of synset.definition ?? []) {
        const meaning = prepareEnglishClue(definition, word.answer);
        if (meaning) { selected = { meaning, partOfSpeech: word.partOfSpeech, synset: sense.synset }; break; }
      }
      if (selected) break;
    }
    if (!selected) { missing.noUsableDefinition++; continue; }
    entries[word.answer] = selected;
    byLevel[level].covered++;
    byPartOfSpeech[word.partOfSpeech].covered++;
  }
  const covered = Object.keys(entries).length;
  return {
    catalog: { version: 1, source: WORDNET_SOURCE, entries },
    report: {
      version: 1, source: WORDNET_SOURCE, total: words.length, covered,
      coveragePercent: Number((covered / Math.max(1, words.length) * 100).toFixed(2)),
      excluded: words.length - covered, exclusions: missing, byLevel, byPartOfSpeech,
      selection: 'First usable OEWN sense matching the CSV part of speech; English and Vietnamese senses are not asserted equivalent.',
      modifications: ['Restrict to game lemmas and matching part of speech.', 'Normalize whitespace and Unicode NFC.', 'Reject overlong, markup, bare cross-reference or empty clues.', 'Replace literal answer tokens with five underscores.'],
      maximumDefinitionLength: MAX_DEFINITION_LENGTH,
    },
  };
}

async function getArchive(download) {
  let archive;
  try { archive = await readFile(CACHE); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!archive) {
    if (!download) throw new Error(`Missing ${CACHE}; run with --download once.`);
    const response = await fetch(WORDNET_SOURCE.downloadUrl, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`OEWN download failed (${response.status})`);
    archive = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(archive).digest('hex') !== WORDNET_SOURCE.sha256) throw new Error('OEWN archive checksum mismatch');
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, archive);
  return archive;
}

export async function importEnglishDefinitions({ download = false } = {}) {
  const bankFile = await readFile('public/vocabulary/en-vi.json');
  const words = JSON.parse(bankFile.toString('utf8')).words;
  const { catalog, report } = buildEnglishDefinitions(words, readWordnetArchive(await getArchive(download)));
  report.baseCatalogSha256 = createHash('sha256').update(bankFile).digest('hex');
  const contents = JSON.stringify(catalog) + '\n';
  report.outputBytes = Buffer.byteLength(contents);
  report.outputSha256 = createHash('sha256').update(contents).digest('hex');
  await writeFile('public/vocabulary/english-definitions.json', contents);
  await writeFile('public/vocabulary/english-definition-report.json', JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await importEnglishDefinitions({ download: process.argv.includes('--download') });
  console.log(JSON.stringify({ total: report.total, covered: report.covered, exclusions: report.exclusions, bytes: report.outputBytes }));
}
