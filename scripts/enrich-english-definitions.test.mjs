import { describe, expect, it } from 'vitest';
import { applyBilingualQualityGate, applyEnglishSupplements, compactWiktionaryRow, enrichDefinitions, wiktionaryCandidates } from './enrich-english-definitions.mjs';

const compact = (word, pos, senses) => compactWiktionaryRow({ word, pos, lang_code: 'en', senses });
describe('sense-aware Wiktionary enrichment', () => {
  it('preserves nested senses and only their own Vietnamese translations', () => {
    const row = compact('cat', 'noun', [{ glosses: ['Terms relating to animals.', 'A domesticated feline animal.'], translations: [{ lang_code: 'vi', word: 'mèo' }, { lang_code: 'fr', word: 'chat' }] }]);
    const clues = wiktionaryCandidates({ answer: 'cat', partOfSpeech: 'noun', meaning: 'con mèo' }, { cat: [row] });
    expect(clues[0].meaning).toBe('A domesticated feline animal.');
    expect(clues[0].matchingTranslation).toBe(true);
    expect(row.senses[0].translations).toEqual(['mèo']);
  });
  it('ranks the sense with a matching Vietnamese translation before an unrelated sense', () => {
    const row = compact('bank', 'noun', [
      { glosses: ['A financial institution.'], translations: [{ lang_code: 'vi', word: 'ngân hàng' }] },
      { glosses: ['The land beside a river.'], translations: [{ lang_code: 'vi', word: 'bờ sông' }] },
    ]);
    const clues = wiktionaryCandidates({ answer: 'bank', partOfSpeech: 'noun', meaning: 'bờ sông' }, { bank: [row] });
    expect(clues[0].meaning).toBe('The land beside a river.');
  });
  it('resolves a plural to a meaningful base definition and rejects circular references', () => {
    const index = {
      children: [compact('children', 'noun', [{ glosses: ['plural of child'], tags: ['form-of', 'plural'], form_of: [{ word: 'child' }] }])],
      child: [compact('child', 'noun', [{ glosses: ['A young person.'] }])],
      loop: [compact('loop', 'noun', [{ glosses: ['Alternative form of loopy'], alt_of: [{ word: 'loopy' }] }])],
      loopy: [compact('loopy', 'noun', [{ glosses: ['Alternative form of loop'], alt_of: [{ word: 'loop' }] }])],
    };
    expect(wiktionaryCandidates({ answer: 'children', partOfSpeech: 'noun', meaning: 'trẻ em' }, index)[0].meaning).toBe('Plural form: A young person.');
    expect(wiktionaryCandidates({ answer: 'loop', partOfSpeech: 'noun', meaning: 'vòng' }, index)).toEqual([]);
  });
  it('never assigns a verb gloss to a noun and does not treat absence as proof of an invalid word', () => {
    const index = { test: [compact('test', 'verb', [{ glosses: ['To assess the abilities of a person.'] }])] };
    const result = enrichDefinitions([{ answer: 'test', partOfSpeech: 'noun', meaning: 'bài kiểm tra' }], { entries: {}, source: {} }, { entries: index, source: {} });
    expect(result.catalog.entries.test).toBeUndefined();
    expect(result.report.unresolved[0].reason).toBe('Part of speech needs editorial review');
    expect(result.catalog.excluded).toBeUndefined();
  });
  it('applies explicitly paired editorial corrections before either source', () => {
    const word = { answer: 'could', partOfSpeech: 'verb', meaning: 'đã có thể' };
    const result = enrichDefinitions([word], { entries: {}, source: {} }, { entries: {}, source: {} }, {
      could: { englishMeaning: 'Was able to do something.' },
    });
    expect(result.catalog.entries.could).toMatchObject({ meaning: 'Was able to do something.', vietnameseMeaning: 'đã có thể', partOfSpeech: 'verb', source: 'authored-correction' });
    expect(result.report.unresolved).toEqual([]);
  });
  it('rejects explicit misspellings but preserves legitimate uncommon definitions', () => {
    const row = compact('sample', 'noun', [
      { glosses: ['A wrong word.'], tags: ['misspelling'] },
      { glosses: ['An old specimen of a material.'], tags: ['archaic'] },
    ]);
    const clues = wiktionaryCandidates({ answer: 'sample', partOfSpeech: 'noun', meaning: 'mẫu' }, { sample: [row] });
    expect(clues.map(value => value.meaning)).toEqual(['An old specimen of a material.']);
  });
  it('does not replace a common noun clue with an unrelated proper name', () => {
    const row = compact('Tranquility', 'name', [{ glosses: ['A town in the United States.'] }]);
    expect(wiktionaryCandidates({ answer: 'tranquility', partOfSpeech: 'noun', meaning: 'sự yên tĩnh' }, { tranquility: [row] })).toEqual([]);
  });
  it('recovers a Vietnamese plural meaning only from an explicitly linked lexical base', () => {
    const words = [{ answer: 'oculi', partOfSpeech: 'noun', meaning: 'số nhiều' }, { answer: 'oculus', partOfSpeech: 'noun', meaning: 'mắt' }];
    const result = enrichDefinitions(words, { entries: {}, source: {} }, { entries: {
      oculi: [compact('oculi', 'noun', [{ id: 'oculi-n', glosses: ['plural of oculus'], tags: ['plural', 'form-of'], form_of: [{ word: 'oculus' }] }])],
      oculus: [compact('oculus', 'noun', [{ glosses: ['An eye or an opening resembling one.'] }])],
    }, source: {} });
    expect(result.catalog.entries.oculi.vietnameseMeaning).toBe('mắt (số nhiều)');
    expect(result.report.recoveredVietnameseForms).toHaveLength(1);
  });
  it('prefers a resolved full synonym to the original one-word gloss', () => {
    const index = { kitten: [compact('kitten', 'noun', [{ glosses: ['Cat.'] }])], cat: [compact('cat', 'noun', [{ glosses: ['A domesticated feline animal.'] }])] };
    expect(wiktionaryCandidates({ answer: 'kitten', partOfSpeech: 'noun', meaning: 'mèo con' }, index)[0].meaning).toBe('A domesticated feline animal.');
  });
  it('does not interpret a physiological contraction as an abbreviation cross-reference', () => {
    const index = { miosis: [compact('miosis', 'noun', [{ glosses: ['Contraction of the pupil of the eye.'], alt_of: [{ word: 'the pupil of the eye' }], tags: ['contraction', 'alt-of'] }])] };
    expect(wiktionaryCandidates({ answer: 'miosis', partOfSpeech: 'noun', meaning: 'co đồng tử' }, index)[0].meaning).toBe('Contraction of the pupil of the eye.');
  });
  it('resolves dated spelling references into the base definition', () => {
    const index = { gaolbird: [compact('gaolbird', 'noun', [{ glosses: ['Dated spelling of jailbird.'] }])], jailbird: [compact('jailbird', 'noun', [{ glosses: ['A prisoner or an ex-prisoner.'] }])] };
    expect(wiktionaryCandidates({ answer: 'gaolbird', partOfSpeech: 'noun', meaning: 'tù nhân' }, index)[0].meaning).toBe('A prisoner or an ex-prisoner.');
  });
  it('treats constructor as a dictionary word, never an inherited object property', () => {
    const result = enrichDefinitions([{ answer: 'constructor', partOfSpeech: 'noun', meaning: 'người xây dựng' }], { entries: {}, source: {} }, { entries: {}, source: {} });
    expect(Object.hasOwn(result.catalog.entries, 'constructor')).toBe(false);
    expect(result.report.unresolved).toHaveLength(1);
  });
});

describe('editorial and bilingual quality layers', () => {
  const words = [{ answer: 'typpo', partOfSpeech: 'noun', meaning: 'lỗi đánh máy' }, { answer: 'clear', partOfSpeech: 'adjective', meaning: 'rõ ràng' }];
  it('requires paired Vietnamese and evidence for a new canonical spelling and preserves migration data', () => {
    const edition = { version: 1, entries: { typo: { meaning: 'An error made while typing.', partOfSpeech: 'noun', vietnameseMeaning: 'lỗi đánh máy', reason: 'Confirmed spelling.', sourceUrl: 'https://en.wiktionary.org/wiki/typo' } }, excluded: [{ answer: 'typpo', canonical: 'typo', reason: 'Confirmed malformed spelling.' }] };
    const result = applyEnglishSupplements({ entries: {} }, words, [edition]);
    expect(result.catalog.entries.typo.vietnameseMeaning).toBe('lỗi đánh máy');
    expect(result.catalog.excluded).toEqual(edition.excluded);
    expect(result.catalog.entries.typpo).toBeUndefined();
    expect(() => applyEnglishSupplements({ entries: {} }, words, [{ ...edition, entries: { typo: { ...edition.entries.typo, vietnameseMeaning: undefined } } }])).toThrow('Missing paired Vietnamese meaning');
  });
  it('rejects stale editorial guards instead of overwriting an unrelated current sense', () => {
    const edition = { version: 1, entries: { clear: { before: { meaning: 'wrong' }, meaning: 'Easy to understand.', partOfSpeech: 'adjective', reason: 'Sense review.' } } };
    expect(() => applyEnglishSupplements({ entries: {} }, words, [edition])).toThrow('Stale English supplement');
  });
  it('quarantines missing definitions and bad Vietnamese clues separately from proven spelling exclusions', () => {
    const data = [...words, { answer: 'missing', meaning: 'thiếu', partOfSpeech: 'adjective' }, { answer: 'notes', meaning: 'số nhiều', partOfSpeech: 'noun' }];
    const result = applyBilingualQualityGate({ entries: { clear: { meaning: 'Easy to understand.', partOfSpeech: 'adjective' }, notes: { meaning: 'Written records.', partOfSpeech: 'noun' } }, excluded: [{ answer: 'typpo', reason: 'Confirmed malformed spelling.' }] }, data, [{ answer: 'missing', reason: 'No exact lemma in either source' }, { answer: 'typpo', reason: 'No exact lemma in either source' }]);
    expect(Object.keys(result.catalog.entries)).toEqual(['clear']);
    expect(result.catalog.quarantined.map(item => item.answer)).toEqual(['missing', 'notes']);
    expect(result.catalog.quarantined[0].reason).not.toContain('invalid');
  });
});
