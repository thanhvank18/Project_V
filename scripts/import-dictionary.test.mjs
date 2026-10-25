import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { candidateFromEntry, cleanGloss, importDictionary } from './import-dictionary.mjs';

const entry = (word, gloss, extra = {}) => ({ word, lang_code: 'en', pos: 'noun', senses: [{ glosses: [gloss] }], ...extra });

test('keeps source provenance and actual POS with a complete Vietnamese definition', () => {
  const word = candidateFromEntry(entry('beautiful', 'Đẹp; hay.', { pos: 'adj' }));
  assert.equal(word.answer, 'beautiful');
  assert.equal(word.partOfSpeech, 'adjective');
  assert.equal(word.meaning, 'Đẹp; hay.');
  assert.match(word.sourceUrl, /vi\.wiktionary\.org\/wiki\/beautiful#/);
  assert.equal(cleanGloss('; (hoá học) Lưỡng tính.', 'amphoteric'), '(hoá học) Lưỡng tính.');
});

test('rejects proper names, phrases, abbreviations, foreign entries and malformed answers', () => {
  for (const item of [entry('London', 'Luân Đôn.'), entry('good morning', 'Chào buổi sáng.'), entry('abc', 'Chữ cái.', { pos: 'abbrev' }), entry('bonjour', 'Xin chào.', { lang_code: 'fr' }), entry('123', 'Một hai ba.')]) assert.equal(candidateFromEntry(item), null);
  assert.equal(candidateFromEntry(entry('cocksucker', 'Tên nịnh hót.')), null);
});

test('rejects form-only, obsolete, cross-reference, English, answer-leaking and broken glosses', () => {
  for (const gloss of ['Dạng số nhiều của apple.', 'Động từ chia ở ngôi thứ ba số ít của calcimine', 'động từ quá khứ của go.', 'Dạng viết khác của adrenaline.', 'Của ammunition.', 'Như apple.', 'Từ đồng nghĩa của red-tailed tropicbird.', 'Thuộc semicentenary.', '(từ cổ) Con mèo.', '[[thgt><đùa|trần truồng]]', 'A small animal.', 'Con mèo (cat).', 'Á'.repeat(121)]) assert.equal(cleanGloss(gloss, 'cat'), null, gloss);
  assert.equal(candidateFromEntry(entry('cats', 'Những con mèo.', { senses: [{ glosses: ['Những con mèo.'], tags: ['form-of'], form_of: [{ word: 'cat' }] }] })), null);
});

test('uses a later substantive sense when an initial sense is a cross-reference', () => {
  const word = candidateFromEntry(entry('example', '', { senses: [{ glosses: ['Như sample.'] }, { glosses: ['Ví dụ minh họa.'] }] }));
  assert.equal(word.meaning, 'Ví dụ minh họa.');
});

test('deduplicates canonical answers and fails malformed input before replacing a bank', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'project-v-dictionary-test-'));
  try {
    const input = join(dir, 'raw.jsonl');
    const output = join(dir, 'en-vi.json');
    await writeFile(input, [entry('cat', 'Con mèo.'), entry('cat', 'Động vật họ mèo.'), entry('learn', 'Học hỏi.', { pos: 'verb' })].map(x => JSON.stringify(x)).join('\n'));
    const result = await importDictionary(input, output);
    assert.deepEqual(result.words.map(x => x.answer), ['cat', 'learn']);
    assert.equal(result.words[0].meaning, 'Con mèo.');
    const before = await readFile(output, 'utf8');
    await writeFile(input, '{invalid json');
    await assert.rejects(importDictionary(input, output));
    assert.equal(await readFile(output, 'utf8'), before);
    await assert.rejects(importDictionary(input, output, 'bad-sha256'), /checksum mismatch/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
