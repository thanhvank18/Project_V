import { describe, expect, it } from 'vitest';
import { classifyWords, FREQUENCY_SOURCE, getDefaultFrequency, gradeWord, lootDifficultyForLevel, parseFrequencyData, preferredBasicSourceSense } from './grade-csv-vocabulary.mjs';

const word = (answer, meaning = 'nghĩa từ nguồn', partOfSpeech = 'noun') => ({ id: `csv-${answer}`, answer, meaning, partOfSpeech, category: 'Nguồn CSV', difficulty: 2 });
const ranks = entries => new Map(entries.map(([answer, rank]) => [answer, { rank, count: 1000 }]));

describe('verified local English commonness data', () => {
  it('loads exactly the checksum-pinned 50k source with its content license distinct from the CSV', () => {
    const frequency = getDefaultFrequency();
    expect(frequency.size).toBe(50_000);
    expect(FREQUENCY_SOURCE.license).toBe('CC-BY-SA-4.0');
    expect(FREQUENCY_SOURCE.commit).toHaveLength(40);
    expect(frequency.get('water').rank).toBe(378);
    expect(frequency.get('apple').rank).toBe(2628);
    expect(frequency.has('demilune')).toBe(false);
  });

  it('retains original row ranks and fails malformed frequency rows', () => {
    expect(parseFrequencyData('you 100\nhello 50\nword 2').get('hello')).toEqual({ rank: 2, count: 50 });
    expect(() => parseFrequencyData('word not-a-count')).toThrow('Invalid frequency');
    expect(() => parseFrequencyData('word 0')).toThrow('Invalid frequency');
  });
});

describe('source-sense learning levels', () => {
  it('starts familiar basic senses before a short but rare military word', () => {
    for (const basic of [word('apple', 'quả táo'), word('water', 'nước'), word('learn', 'học, học tập, nghiên cứu', 'verb')]) {
      expect(gradeWord(basic).learningLevel).toBe(1);
    }
    const rare = gradeWord(word('demilune', '(quân sự) luỹ bán nguyệt', 'unspecified'));
    expect(rare.learningLevel).toBe(10);
    expect(rare.frequencyRank).toBeNull();
    expect(rare.frequencyCount).toBeNull();
    expect(rare.reasons.some(reason => reason.code === 'outside-frequency-top-50000')).toBe(true);
  });

  it('does not make familiar long words hard just because they are long', () => {
    expect(gradeWord(word('understand', 'hiểu, nắm được ý, biết', 'verb')).learningLevel).toBe(1);
    expect(gradeWord(word('everything', 'mọi vật, tất cả', 'pronoun')).learningLevel).toBe(1);
    expect(gradeWord(word('communication'), ranks([['communication', 1000]])).learningLevel).toBe(2);
    expect(gradeWord(word('unfamiliarword'), new Map()).learningLevel).toBe(10);
    expect(gradeWord(word('rare'), new Map()).learningLevel).toBe(9);
  });

  it('does not promote an unrelated or technical sense with a familiar headword to starter level', () => {
    const anatomicalApple = gradeWord(word('apple', '(giải phẫu) lồi thanh quản'));
    expect(anatomicalApple.learningLevel).toBeGreaterThanOrEqual(4);
    expect(anatomicalApple.reasons.some(reason => reason.code === 'authored-basic-sense-guard')).toBe(false);
    const chemicalWater = gradeWord(word('water', '(hoá học) dung dịch nước'));
    expect(chemicalWater.learningLevel).toBeGreaterThanOrEqual(4);
    expect(gradeWord(word('apple', 'công ty kỹ thuật'), ranks([['apple', 8000]])).learningLevel).toBeGreaterThan(1);
  });

  it('does not let a common starter headword hide a non-basic selected sense', () => {
    const school = gradeWord(word('school', 'đàn cá, bầy cá'));
    expect(school.learningLevel).toBeGreaterThanOrEqual(4);
    expect(school.reasons.some(reason => reason.code === 'known-starter-non-basic-source-sense')).toBe(true);
    expect(gradeWord(word('bridge', '(đánh bài) brit')).learningLevel).toBeGreaterThanOrEqual(4);
    for (const basic of [word('table', 'cái bàn'), word('sleep', 'giấc ngủ; sự ngủ'), word('school', 'trường học, học đường'), word('bridge', 'cái cầu')]) {
      expect(gradeWord(basic).learningLevel).toBe(1);
    }
  });

  it('only prefers an existing basic source sense with the correct explicit POS', () => {
    const rare = { meaning: 'đàn cá', partOfSpeech: 'noun' };
    const wrongPos = { meaning: 'trường học', partOfSpeech: 'verb' };
    const unknownPos = { meaning: 'trường học', partOfSpeech: 'unspecified' };
    const basic = { meaning: 'trường học, học đường', partOfSpeech: 'noun' };
    expect(preferredBasicSourceSense('school', [rare, wrongPos, unknownPos])).toBeUndefined();
    expect(preferredBasicSourceSense('school', [rare, wrongPos, basic])).toBe(basic);
    expect(preferredBasicSourceSense('school', [rare])).toBeUndefined();
    expect(preferredBasicSourceSense('school', [{ meaning: '(toán học) trường học', partOfSpeech: 'noun' }])).toBeUndefined();
    expect(preferredBasicSourceSense('unlisted', [basic])).toBeUndefined();
  });

  it('permits a guarded basic animal/plant sense without suppressing genuinely technical labels', () => {
    expect(gradeWord(word('cat', '(động vật học) con mèo')).learningLevel).toBe(1);
    expect(gradeWord(word('banana', '(thực vật học) cây chuối')).learningLevel).toBe(1);
    expect(gradeWord(word('cat', '(kỹ thuật) thiết bị nâng')).learningLevel).toBeGreaterThanOrEqual(4);
  });

  it('raises archaic usage, abbreviations, affixes and unknown POS without inventing a POS', () => {
    const frequency = ranks([['moon', 100], ['usa', 100], ['ness', 100], ['unknown', 100]]);
    expect(gradeWord(word('moon', '(từ cổ) tháng'), frequency).learningLevel).toBeGreaterThanOrEqual(7);
    expect(gradeWord(word('usa', 'hợp chúng quốc', 'abbreviation'), frequency).learningLevel).toBeGreaterThanOrEqual(6);
    expect(gradeWord(word('ness', 'hậu tố', 'suffix'), frequency).learningLevel).toBeGreaterThanOrEqual(7);
    const unknown = gradeWord(word('unknown', 'nghĩa chưa ghi từ loại', 'unspecified'), frequency);
    expect(unknown.learningLevel).toBeGreaterThanOrEqual(4);
    expect(unknown.partOfSpeech).toBe('unspecified');
  });

  it('uses retained complete source-sense labels even when the gameplay gloss was shortened', () => {
    const full = new Map([['sample', 'một nghĩa được rút ngắn; (toán học) phần chuyên ngành của cùng nghĩa']]);
    const raw = word('sample', 'một nghĩa được rút ngắn');
    const result = classifyWords([raw], { frequency: ranks([['sample', 100]]), fullMeanings: full });
    expect(result.words[0].learningLevel).toBeGreaterThanOrEqual(4);
    expect(result.words[0].meaning).toBe(raw.meaning);
  });

  it('handles dictionary headwords that coincide with Object prototype properties', () => {
    expect(gradeWord(word('constructor'), new Map()).learningLevel).toBe(10);
    expect(gradeWord(word('tostring'), new Map()).learningLevel).toBe(9);
  });

  it.each([[1, 1], [3, 1], [4, 2], [6, 2], [7, 3], [10, 3]])('maps learning level %i to loot difficulty %i', (level, difficulty) => {
    expect(lootDifficultyForLevel(level)).toBe(difficulty);
  });

  it('preserves every word, meaning, source POS and history while recording a reproducible reason per word', () => {
    const original = [word('demilune', '(quân sự) luỹ bán nguyệt'), { ...word('water', 'nước'), historyAliases: ['waterr'] }, word('learn', 'học', 'verb')];
    const before = structuredClone(original);
    const first = classifyWords(original, { sourceRows: new Map([['water', 100]]) });
    const second = classifyWords(original, { sourceRows: new Map([['water', 100]]) });
    expect(first).toEqual(second);
    expect(original).toEqual(before);
    expect(first.words).toHaveLength(original.length);
    for (let index = 0; index < original.length; index++) {
      expect(first.words[index]).toMatchObject({ answer: original[index].answer, meaning: original[index].meaning, partOfSpeech: original[index].partOfSpeech });
    }
    expect(first.words[1].historyAliases).toEqual(['waterr']);
    expect(first.grades.find(grade => grade.answer === 'water').sourceRow).toBe(100);
    expect(first.grades.every(grade => grade.reasons.length && Number.isInteger(grade.learningLevel) && grade.learningLevel >= 1 && grade.learningLevel <= 10)).toBe(true);
    expect(Object.values(first.stats.byLevel).reduce((sum, count) => sum + count, 0)).toBe(original.length);
    expect(first.grades.map(grade => grade.learningLevel)).toEqual([...first.grades.map(grade => grade.learningLevel)].sort((a, b) => a - b));
  });
});
