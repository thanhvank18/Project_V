import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { applyVietnameseCorrections, applySourceRepairs, buildSourceRepairs, cleanSourceMarkup, isMetadataOnly, auditVietnameseDictionary, sourceIndex, suggestSourceSenseRecoveries } from './audit-vietnamese-dictionary.mjs';

const entry = (answer, meaning, partOfSpeech = 'noun') => ({ id: `csv-${answer}`, answer, meaning, partOfSpeech, category: 'Danh từ', difficulty: 1, learningLevel: 1 });
const data = words => ({ source: { sha256: 'source' }, words });
const edition = { version: 1, sourceSha256: 'source', entries: { could: {
  before: { meaning: 'bình đựng nước', partOfSpeech: 'noun' }, meaning: 'có thể', partOfSpeech: 'verb',
  englishMeaning: 'Used to express a possibility.', reason: 'Copied noun sense of can.', references: ['https://dictionary.cambridge.org/dictionary/english/could'],
} } };

describe('Vietnamese dictionary audit and guarded corrections', () => {
  it('updates only a reviewed meaning and POS, retains identity/progress and can be safely reapplied', () => {
    const input = data([{ ...entry('could', 'bình đựng nước'), historyAliases: ['old-could'] }, entry('rose', 'hoa hồng'), entry('constructor', 'người xây dựng')]);
    const output = applyVietnameseCorrections(input, edition);
    expect(output.words[0]).toMatchObject({ id: 'csv-could', answer: 'could', meaning: 'có thể', partOfSpeech: 'verb', category: 'Động từ', historyAliases: ['old-could'], learningLevel: 1 });
    expect(input.words[0].meaning).toBe('bình đựng nước');
    expect(output.words[1]).toBe(input.words[1]);
    expect(output.words[2]).toBe(input.words[2]);
    expect(applyVietnameseCorrections(output, edition)).toEqual(output);
  });
  it('refuses a different source or stale before-value instead of silently overwriting later edits', () => {
    expect(() => applyVietnameseCorrections(data([entry('could', 'đã sửa')]), edition)).toThrow('Stale');
    expect(() => applyVietnameseCorrections({ ...data([]), source: { sha256: 'changed' } }, edition)).toThrow('source mismatch');
  });
  it('finds grammar-only clues and metadata without declaring valid homographs incorrect', () => {
    const result = auditVietnameseDictionary(data([
      entry('fed', 'thời quá khứ & động tính từ quá khứ của fee', 'unspecified'),
      entry('actin', 'cách viết khác : actino'), entry('bracket', '(tech) nghĩa [tq],'),
      entry('broken', 'bị vỡ, bị hỏng', 'adjective'), entry('rose', 'hoa hồng'),
      entry('beat', 'nhịp (âm nhạc'), entry('antimagnetic', 'phản từ, kháng từ', 'adjective'),
    ]));
    expect(result.findings.find(item => item.answer === 'fed').reasons).toEqual(['missing-part-of-speech', 'grammar-note-instead-of-definition']);
    expect(result.findings.find(item => item.answer === 'actin').reasons).toContain('unresolved-cross-reference');
    expect(result.findings.find(item => item.answer === 'bracket').reasons).toContain('editorial-code-in-definition');
    expect(result.findings.find(item => item.answer === 'beat').reasons).toContain('unbalanced-delimiters');
    expect(result.findings.some(item => ['broken', 'rose', 'antimagnetic'].includes(item.answer))).toBe(false);
  });
  it('locates original CSV records including quoted multiline rows', () => {
    const index = sourceIndex('English,Vietnamese_Analytics\n"could","danh từ|\n- bình đựng nước"\nrose [rəuz],danh từ|- hoa hồng');
    expect(index.get('could')[0].row).toBe(2);
    expect(index.get('rose')[0].row).toBe(4);
  });
  it('proposes a later source meaning only within the same headword and POS, never through another headword', () => {
    const words = data([entry('amigo', 'số nhiều amigos'), entry('copied', 'số nhiều copies')]);
    const sources = sourceIndex('English,Vietnamese_Analytics\namigo,danh từ|- số nhiều amigos|- bạn\ncopied,danh từ|- số nhiều copies|@other|danh từ|- điều khác');
    expect(suggestSourceSenseRecoveries(words, sources)).toEqual([expect.objectContaining({ answer: 'amigo', after: { meaning: 'bạn', partOfSpeech: 'noun' } })]);
    expect(words.words[0].meaning).toBe('số nhiều amigos');
  });
  it('applies source recovery and known label cleanup, preserving unknown tags and lexical definitions', () => {
    const input = data([entry('amigo', 'số nhiều amigos'), entry('anemia', '<y> bệnh thiếu máu'), entry('rose', 'hoa hồng')]);
    const sources = sourceIndex('English,Vietnamese_Analytics\namigo,danh từ|- số nhiều amigos|- người bạn\nanemia,danh từ|- <y> bệnh thiếu máu\nrose,danh từ|- hoa hồng');
    const patches = buildSourceRepairs(input, { entries: {} }, sources), output = applySourceRepairs(input, patches);
    expect(output.words.map(word => word.meaning)).toEqual(['người bạn', '(y học) bệnh thiếu máu', 'hoa hồng']);
    expect(applySourceRepairs(output, patches)).toEqual(output);
    expect(cleanSourceMarkup('<unknown> text')).toBe('<unknown> text');
    expect(cleanSourceMarkup('(tech) 1 + 1 = 2')).toBe('(tech) 1 + 1 = 2');
    expect(Object.hasOwn(patches.entries, 'rose')).toBe(false);
    expect(input.words[0].meaning).toBe('số nhiều amigos');
  });
  it('rejects an accidental rewrite of an existing lexical sense in the source repair layer', () => {
    const input = data([entry('rose', 'hoa hồng')]);
    for (const kind of ['source-sense-recovery', 'source-markup']) {
      const patch = { version: 1, sourceSha256: 'source', entries: { rose: { before: { meaning: 'hoa hồng', partOfSpeech: 'noun' }, meaning: 'cây khác', partOfSpeech: 'noun', kind, sourceRows: [2], reason: 'Accidental replacement' } } };
      expect(() => applySourceRepairs(input, patch)).toThrow(/overwrite|lexical/);
    }
  });
  it('never presents usage labels alone as repaired definitions', () => {
    const input = data([entry('teen', '<mỹ> <thgt>')]);
    const sources = sourceIndex('English,Vietnamese_Analytics\nteen,<mỹ> <thgt>');
    expect(buildSourceRepairs(input, { entries: {} }, sources).entries).toEqual({});
    expect(auditVietnameseDictionary(input).findings[0].reasons).toContain('usage-label-instead-of-definition');
    expect(isMetadataOnly('(thường) (nghĩa bóng)')).toBe(true);
    expect(isMetadataOnly('(người nhổ răng)')).toBe(false);
    const patch = { version: 1, sourceSha256: 'source', entries: { teen: { before: { meaning: '<mỹ> <thgt>', partOfSpeech: 'noun' }, meaning: '(Mỹ) (thông tục)', partOfSpeech: 'noun', kind: 'source-markup', sourceRows: [2], reason: 'Only labels' } } };
    expect(() => applySourceRepairs(input, patch)).toThrow('Invalid source repair');
  });
  it('keeps every checked-in correction valid against the real bank', async () => {
    const dictionary = JSON.parse(await readFile('public/vocabulary/en-vi.json', 'utf8'));
    const corrections = JSON.parse(await readFile('scripts/data/vietnamese-corrections.json', 'utf8'));
    const corrected = applyVietnameseCorrections(dictionary, corrections);
    const sourceRepairs = JSON.parse(await readFile('scripts/data/vietnamese-source-repairs.json', 'utf8'));
    const repaired = applySourceRepairs(corrected, sourceRepairs);
    expect(corrected.words).toHaveLength(dictionary.words.length);
    expect(repaired.words).toHaveLength(dictionary.words.length);
    expect(applySourceRepairs(repaired, sourceRepairs)).toEqual(repaired);
    for (const patch of Object.values(sourceRepairs.entries)) expect(isMetadataOnly(patch.meaning)).toBe(false);
    expect(corrected.words.find(word => word.answer === 'bled')).toMatchObject({ partOfSpeech: 'verb' });
    expect(corrected.words.find(word => word.answer === 'could').meaning).not.toContain('bình');
    expect(corrected.words.find(word => word.answer === 'rose')).toEqual(dictionary.words.find(word => word.answer === 'rose'));
  });
});
