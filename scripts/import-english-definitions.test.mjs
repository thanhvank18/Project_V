import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { buildEnglishDefinitions, prepareEnglishClue, readWordnetArchive } from './import-english-definitions.mjs';

describe('English clues from an explicit WordNet sense', () => {
  const words = [
    { answer: 'run', partOfSpeech: 'noun', learningLevel: 1 },
    { answer: 'walk', partOfSpeech: 'verb', learningLevel: 2 },
    { answer: 'unknownword', partOfSpeech: 'noun', learningLevel: 10 },
    { answer: 'bad', partOfSpeech: 'noun', learningLevel: 1 },
  ];
  const source = {
    entries: {
      run: { v: { sense: [{ synset: 'run-v' }] }, n: { sense: [{ synset: 'run-n' }] } },
      walk: { v: { sense: [{ synset: 'missing' }, { synset: 'walk-v' }] } },
      bad: { a: { sense: [{ synset: 'bad-a' }] } },
    },
    synsets: {
      'run-v': { partOfSpeech: 'v', definition: ['move quickly on foot'] },
      'run-n': { partOfSpeech: 'n', definition: ['a short trip or excursion'] },
      'walk-v': { partOfSpeech: 'v', definition: ['use the feet to advance at a moderate pace'] },
      'bad-a': { partOfSpeech: 'a', definition: ['having undesirable or negative qualities'] },
    },
  };
  it('matches noun and verb senses without silently switching the CSV part of speech', () => {
    const { catalog, report } = buildEnglishDefinitions(words, source);
    expect(catalog.entries.run).toEqual({ meaning: 'a short trip or excursion', partOfSpeech: 'noun', synset: 'run-n' });
    expect(catalog.entries.walk.partOfSpeech).toBe('verb');
    expect(catalog.entries.bad).toBeUndefined();
    expect(catalog.entries.unknownword).toBeUndefined();
    expect(report.exclusions).toEqual({ noLemma: 1, noMatchingPartOfSpeech: 1, noUsableDefinition: 0 });
    expect(report.byLevel[1]).toEqual({ total: 2, covered: 1 });
  });
  it('accepts satellite adjectives, skips unusable clues and records the chosen synset', () => {
    const { catalog } = buildEnglishDefinitions([{ answer: 'happy', partOfSpeech: 'adjective' }], {
      entries: { happy: { a: { sense: [{ synset: 'bad-a' }, { synset: 'happy-s' }] } } },
      synsets: { 'bad-a': { partOfSpeech: 'a', definition: ['x'.repeat(250)] }, 'happy-s': { partOfSpeech: 's', definition: ['enjoying or showing pleasure'] } },
    });
    expect(catalog.entries.happy.synset).toBe('happy-s');
    expect(catalog.entries.happy.meaning).toBe('enjoying or showing pleasure');
  });
  it('masks the answer token without corrupting other words or inventing a replacement definition', () => {
    expect(prepareEnglishClue('A cat near a cathedral', 'cat')).toBe('A _____ near a cathedral');
    expect(prepareEnglishClue('See cat', 'cat')).toBeUndefined();
    expect(prepareEnglishClue('<b>a feline animal</b>', 'cat')).toBeUndefined();
    expect(prepareEnglishClue('a'.repeat(241), 'cat')).toBeUndefined();
    expect(prepareEnglishClue('cat', 'cat')).toBeUndefined();
  });
  it('does not accept a mismatched or missing synset as a definition', () => {
    const { catalog, report } = buildEnglishDefinitions([{ answer: 'run', partOfSpeech: 'noun' }], {
      entries: { run: { n: { sense: [{ synset: 'missing' }, { synset: 'run-v' }] } } }, synsets: source.synsets,
    });
    expect(catalog.entries).toEqual({});
    expect(report.exclusions.noUsableDefinition).toBe(1);
  });
  it('rejects malformed ZIP data rather than extracting or interpreting it', () => {
    expect(() => readWordnetArchive(Buffer.alloc(30))).toThrow('Missing ZIP directory');
    const zip = Buffer.alloc(22); zip.writeUInt32LE(0x06054b50, 0); zip.writeUInt16LE(1, 10);
    expect(() => readWordnetArchive(zip)).toThrow('Invalid ZIP entry');
  });
});

describe('bundled English catalog integrity', () => {
  const definitions = JSON.parse(readFileSync('public/vocabulary/english-definitions.json', 'utf8'));
  const report = JSON.parse(readFileSync('public/vocabulary/english-definition-report.json', 'utf8'));
  const bank = new Map(JSON.parse(readFileSync('public/vocabulary/en-vi.json', 'utf8')).words.map(word => [word.answer, word]));
  const corrections = existsSync('scripts/data/vietnamese-corrections.json') ? JSON.parse(readFileSync('scripts/data/vietnamese-corrections.json', 'utf8')).entries : {};
  const sourceRepairs = existsSync('scripts/data/vietnamese-source-repairs.json') ? JSON.parse(readFileSync('scripts/data/vietnamese-source-repairs.json', 'utf8')).entries : {};
  const verifiedPos = new Map((report.verifiedPosCorrections ?? []).map(item => [item.answer, item.after]));
  const supplements = Object.assign({}, ...['english-long-clues', 'english-variant-clues', 'english-pos-repairs', 'english-supplement'].map(name => existsSync(`scripts/data/${name}.json`) ? JSON.parse(readFileSync(`scripts/data/${name}.json`, 'utf8')).entries : {}));
  const expectedPos = answer => Object.hasOwn(supplements, answer) ? supplements[answer].partOfSpeech : verifiedPos.get(answer) ?? (Object.hasOwn(corrections, answer) ? corrections[answer].partOfSpeech : Object.hasOwn(sourceRepairs, answer) ? sourceRepairs[answer].partOfSpeech : bank.get(answer)?.partOfSpeech);
  it('has sourced English clues with original or explicitly reviewed parts of speech and complete coverage accounting', () => {
    expect(Object.keys(definitions.entries).length).toBe(report.covered);
    expect(report.covered).toBeGreaterThan(40_000);
    const invalid = Object.entries(definitions.entries).filter(([answer, entry]) =>
      expectedPos(answer) !== entry.partOfSpeech || entry.meaning.length > 240
      || new RegExp(`\\b${answer}\\b`, 'i').test(entry.meaning)
      || (entry.synset !== undefined && !/^\d{8}-[nvasr]$/u.test(entry.synset))
      || (!entry.synset && !['wiktionary', 'authored-correction', 'editorial-supplement'].includes(entry.source)));
    expect(invalid).toEqual([]);
    expect(report.originalCovered + definitions.excluded.length + definitions.quarantined.filter(item => bank.has(item.answer)).length).toBe(bank.size);
    expect(report.originalCovered + report.newCanonicalWords.length).toBe(report.covered);
    const states = [...Object.keys(definitions.entries), ...definitions.excluded.map(item => item.answer), ...definitions.quarantined.map(item => item.answer)];
    expect(new Set(states).size).toBe(states.length);
    for (const answer of report.newCanonicalWords) {
      expect(definitions.entries[answer].vietnameseMeaning).toBeTruthy();
      expect(definitions.excluded.some(item => item.canonical === answer)).toBe(true);
    }
  });
});
