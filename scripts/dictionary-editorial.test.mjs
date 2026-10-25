import { expect, it } from 'vitest';
import { applyEditorialCorrections } from './dictionary-editorial.mjs';

const word = (answer, meaning, partOfSpeech = 'noun') => ({ id: `dict-${answer}`, answer, meaning, partOfSpeech,
  category: 'Danh từ', difficulty: 2, sourceUrl: `https://vi.wiktionary.org/wiki/${answer}` });
const base = { version: 1, source: { sha256: 'source-hash', changes: 'Source text.', stats: { words: 3 } }, words: [
  word('brownish', 'Hơi nâu.'), word('falschood', 'Sự sai.'), word('falsehood', 'Điều giả dối.'),
] };
const edition = { version: 1, revision: 'test', sourceSha256: 'source-hash', corrections: [
  { answer: 'brownish', before: { meaning: 'Hơi nâu.', partOfSpeech: 'noun' }, after: { partOfSpeech: 'adjective' }, reason: 'Wrong POS.' },
  { answer: 'falschood', before: { meaning: 'Sự sai.', partOfSpeech: 'noun' }, after: { answer: 'falsehood' }, reason: 'Misspelled headword.' },
] };

it('corrects POS and merges a misspelled headword while retaining its history and canonical sense', () => {
  const before = structuredClone(base);
  const result = applyEditorialCorrections(base, edition);
  expect(base).toEqual(before);
  expect(result.words.find(item => item.answer === 'brownish')).toMatchObject({ partOfSpeech: 'adjective', category: 'Tính từ' });
  expect(result.words.find(item => item.answer === 'falsehood')).toMatchObject({ meaning: 'Điều giả dối.', historyAliases: ['falschood'] });
  expect(result.words.some(item => item.answer === 'falschood')).toBe(false);
  expect(result.source.stats).toMatchObject({ words: 2, byPartOfSpeech: { adjective: 1, noun: 1 } });
  expect(result.source.editorial).toMatchObject({ mergedHeadwords: 1, corrections: 2 });
});

it('refuses stale source definitions, duplicate edits, wrong source hashes and chained renames', () => {
  const patch = edition.corrections[0];
  for (const bad of [
    { ...edition, sourceSha256: 'new-source' },
    { ...edition, corrections: [patch, patch] },
    { ...edition, corrections: [{ ...patch, before: { ...patch.before, meaning: 'Changed upstream.' } }] },
    { ...edition, corrections: [{ ...patch, after: { meaning: 'x'.repeat(121) } }] },
    { ...edition, corrections: [edition.corrections[1], { answer: 'falsehood', before: { meaning: 'Điều giả dối.', partOfSpeech: 'noun' }, after: { answer: 'falseness' }, reason: 'Chain.' }] },
  ]) expect(() => applyEditorialCorrections(base, bad)).toThrow();
});

it('removes only explicitly evidenced exclusions and rejects stale or conflicting decisions', () => {
  const entry = word('obligatorisch', 'Bắt buộc.', 'adjective');
  const data = { ...base, words: [...base.words, entry] };
  const exclusion = { answer: entry.answer, before: { meaning: entry.meaning, partOfSpeech: entry.partOfSpeech },
    reason: 'German word incorrectly tagged as English.', references: ['https://www.duden.de/rechtschreibung/obligatorisch'] };
  const result = applyEditorialCorrections(data, { ...edition, exclusions: [exclusion] });
  expect(result.words.some(item => item.answer === entry.answer)).toBe(false);
  expect(result.source.editorial.excludedEntries).toBe(1);
  expect(data.words).toHaveLength(4);
  for (const exclusions of [[{ ...exclusion, references: [] }], [{ ...exclusion, before: {} }], [exclusion, exclusion]]) {
    expect(() => applyEditorialCorrections(data, { ...edition, exclusions })).toThrow();
  }
  expect(() => applyEditorialCorrections(data, { ...edition, exclusions: [exclusion], corrections: [
    { answer: entry.answer, before: exclusion.before, after: { meaning: 'Khác.' }, reason: 'Conflicting edit.' },
  ] })).toThrow();
});

it('rejects conflicting definitions for merged spellings regardless of patch order', () => {
  const renamed = { ...edition.corrections[1], after: { answer: 'falsehood', meaning: 'Lời giả dối.' } };
  const canonical = { answer: 'falsehood', before: { meaning: 'Điều giả dối.', partOfSpeech: 'noun' },
    after: { meaning: 'Sự giả dối.' }, reason: 'Canonical definition.' };
  for (const corrections of [[renamed, canonical], [canonical, renamed]]) {
    expect(() => applyEditorialCorrections(base, { ...edition, corrections })).toThrow(/Conflicting merged/);
  }
  const corrections = [renamed, { ...canonical, after: { meaning: renamed.after.meaning } }];
  const forward = applyEditorialCorrections(base, { ...edition, corrections });
  const backward = applyEditorialCorrections(base, { ...edition, corrections: corrections.toReversed() });
  expect(forward.words).toEqual(backward.words);
});
