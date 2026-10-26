/** Extract only source examples attached to the exact sense/POS used by the game. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeCsv, normalizeHeadword, parseCsvRow, partOfSpeechFromHeading, shortenMeaning } from './import-csv-dictionary.mjs';

const clean = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();

export function examplesForSense(fullMeaning, word) {
  let pos = 'unspecified', matching = false, english;
  const examples = [];
  for (const raw of fullMeaning.split('|')) {
    const token = clean(raw);
    if (!token) continue;
    if (/^[@!]/u.test(token)) { matching = false; english = undefined; continue; }
    const heading = partOfSpeechFromHeading(token);
    if (heading || token.startsWith('*')) {
      pos = heading ?? 'unspecified'; matching = false; english = undefined; continue;
    }
    if (token.startsWith('=')) { english = matching ? clean(token.slice(1)) : undefined; continue; }
    if (token.startsWith('+')) {
      const vietnamese = clean(token.slice(1));
      if (english && english.length <= 180 && vietnamese.length <= 220
        && english.split(/\s+/u).length >= 4 && !/[<>{}\[\]|=]/u.test(english + vietnamese)
        && /^[\x20-\x7e’“”–—]+$/u.test(english)
        && new RegExp(`\\b${word.answer}\\b`, 'i').test(english)
        && /[àáạảãâăèéẹẻẽêìíịỉĩòóọỏõôơùúụủũưỳýỵỷỹđ]/iu.test(vietnamese)) {
        examples.push({ english: english[0].toUpperCase() + english.slice(1), vietnamese });
      }
      english = undefined;
      continue;
    }
    english = undefined;
    matching = pos === word.partOfSpeech && shortenMeaning(token.replace(/^[-•]+\s*/u, '')) === word.meaning;
  }
  // Prefer short complete examples over infinitive phrases, retaining source wording.
  return examples.sort((a, b) => Number(/^To /u.test(a.english)) - Number(/^To /u.test(b.english)) || a.english.length - b.english.length);
}

export function buildReviewExamples(input, words) {
  const bank = new Map(words.map(word => [word.answer, word]));
  const examples = {};
  const lines = decodeCsv(input).text.split(/\r?\n/u);
  for (let index = 1; index < lines.length; index++) {
    let row = lines[index];
    if (!row.trim()) continue;
    let parsed = parseCsvRow(row);
    while (parsed.incomplete && index + 1 < lines.length) { row += '\n' + lines[++index]; parsed = parseCsvRow(row); }
    if (parsed.error || parsed.incomplete) continue;
    const headword = normalizeHeadword(parsed.english, parsed.fullMeaning);
    if (headword.reason) continue;
    const word = bank.get(headword.answer);
    if (!word || examples[word.answer] || word.partOfSpeech === 'unspecified' || word.partOfSpeech === 'abbreviation') continue;
    const example = examplesForSense(parsed.fullMeaning, word)[0];
    if (example) examples[word.answer] = { ...example, meaning: word.meaning, partOfSpeech: word.partOfSpeech };
  }
  return Object.fromEntries(Object.entries(examples).sort(([a], [b]) => a.localeCompare(b, 'en')));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const words = JSON.parse(await readFile('public/vocabulary/en-vi.json', 'utf8')).words;
  const examples = buildReviewExamples(await readFile('Dic/English - Vietnamese.csv'), words);
  const output = JSON.stringify(examples);
  await writeFile('src/game/reviewExamples.generated.json', output + '\n');
  console.log(JSON.stringify({ examples: Object.keys(examples).length, words: words.length, bytes: Buffer.byteLength(output) }));
}
