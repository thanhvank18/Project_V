import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { buildCsvCatalog, CSV_LICENSE, decodeCsv, extractSenses, importCsvDictionary, normalizeHeadword, parseCsvRow, partOfSpeechFromHeading, shortenMeaning } from './import-csv-dictionary.mjs';

const csv = (...rows) => ['english, vietnamese_analytics ', ...rows].join('\r\n');
const utf16 = text => Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, 'utf16le')]);
const lookup = (catalog, answer) => catalog.words.find(word => word.answer === answer);

describe('local CSV field and encoding boundaries', () => {
  it('decodes BOM UTF-16 and UTF-8 without corrupting Vietnamese', () => {
    const text = csv('apple [æpl], danh từ|- quả táo');
    expect(decodeCsv(utf16(text))).toEqual({ text, encoding: 'utf-16le' });
    const bigEndian = Buffer.concat([Buffer.from([254, 255]), Buffer.from(text, 'utf16le').swap16()]);
    expect(decodeCsv(bigEndian)).toEqual({ text, encoding: 'utf-16be' });
    expect(lookup(buildCsvCatalog(utf16(text)), 'apple').meaning).toBe('quả táo');
    expect(decodeCsv(Buffer.from(text)).encoding).toBe('utf-8');
    expect(() => decodeCsv(Buffer.from([255, 254, 1]))).toThrow('Truncated');
    expect(() => decodeCsv(Buffer.from([255]))).toThrow();
  });

  it('keeps commas in IPA and all unquoted meaning commas', () => {
    expect(parseCsvRow('the [ði:, ði, ðə], mạo từ|- cái, con, người')).toMatchObject({ english: 'the [ði:, ði, ðə]', fullMeaning: ' mạo từ|- cái, con, người' });
    const bank = buildCsvCatalog(csv('abalone [,æbəlouni], danh từ|- (từ mỹ,nghĩa mỹ) bào ngư', 'the [ði:, ði, ðə], mạo từ|- cái, con, người'));
    expect(lookup(bank, 'abalone').meaning).toBe('(từ mỹ,nghĩa mỹ) bào ngư');
    expect(lookup(bank, 'the').partOfSpeech).toBe('determiner');
  });

  it('supports actual quoted CSV, escaped quotes and quoted multiline definitions', () => {
    const bank = buildCsvCatalog(csv('"apple [æpl]","danh từ|- quả táo, loại quả"', '"hello","thán từ|- lời chào ""xin chào"""', '"water","danh từ|- nước\ntrong tự nhiên"'));
    expect(lookup(bank, 'apple').meaning).toBe('quả táo, loại quả');
    expect(lookup(bank, 'hello').meaning).toBe('lời chào "xin chào"');
    expect(lookup(bank, 'water').meaning).toBe('nước trong tự nhiên');
    expect(bank.report.stats.sourceRecords).toBe(3);
    expect(() => buildCsvCatalog(csv('"apple","danh từ|- quả táo'))).toThrow('Unterminated');
  });

  it('does not turn bracketed model/phrase annotations into a different single word', () => {
    expect(normalizeHeadword('access [space trade - off model]').reason).toBe('non-phonetic-annotation');
    expect(normalizeHeadword('real [relative price]').reason).toBe('non-phonetic-annotation');
    expect(normalizeHeadword('present [preznt - prizent]')).toEqual({ answer: 'present' });
    expect(normalizeHeadword('trait [trei, (mỹ) treit]')).toEqual({ answer: 'trait' });
    const bank = buildCsvCatalog(csv('access [space trade - off model],#- mô hình đánh đổi', 'access [ækses], danh từ|- lối vào'));
    expect(lookup(bank, 'access').meaning).toBe('lối vào');
  });

  it('recovers damaged IPA fragments only with an explicit lexical POS and definition', () => {
    const bank = buildCsvCatalog(csv('wizard [wiz d], danh từ|- thầy phù thuỷ', 'within [wi in], giới từ|- bên trong', 'real [relative price],#- (econ) giá thực tế'), { includeRecords: true });
    expect(lookup(bank, 'wizard').meaning).toBe('thầy phù thuỷ');
    expect(lookup(bank, 'within').partOfSpeech).toBe('preposition');
    expect(lookup(bank, 'real')).toBeUndefined();
    expect(bank.report.stats.recoveredPronunciationRows).toBe(2);
    expect(bank.records[0].pronunciationRecovery).toBe(true);
  });
});

describe('source sense and POS selection', () => {
  it.each([
    ['danh từ', 'noun'], ['ngoại động từ', 'verb'], ['trợ động từ', 'verb'], ['tính từ & phó từ', 'adjective'],
    ['phó từ', 'adverb'], ['giới từ', 'preposition'], ['đại từ', 'pronoun'], ['liên từ', 'conjunction'],
    ['interj', 'interjection'], ['mạo từ', 'determiner'], ['số từ', 'numeral'], ['tiền tố', 'prefix'], ['hậu tố', 'suffix'], ['(viết tắt)', 'abbreviation'], ['n', 'noun'],
  ])('maps explicit source heading %s to %s', (heading, pos) => expect(partOfSpeechFromHeading(heading)).toBe(pos));

  it('keeps the current POS when skipping metadata, examples or reference-only sections', () => {
    const bank = buildCsvCatalog(csv('mixed, tính từ|- (như) other|=English example|+ bản dịch ví dụ|* danh từ|- vật mẫu'));
    expect(lookup(bank, 'mixed')).toMatchObject({ meaning: 'vật mẫu', partOfSpeech: 'noun' });
    expect(extractSenses('danh từ|- ví dụ|@extra|- nghĩa khác').senses[1].partOfSpeech).toBe('unspecified');
  });

  it('selects a known basic sense already present in CSV and audits the source selection and POS', () => {
    const bank = buildCsvCatalog(csv(
      'school [sku:l], danh từ|- đàn cá, bầy cá|* nội động từ|- bơi thành bầy|* danh từ|- trường học, học đường',
      'bridge [bridʤ], danh từ|- (đánh bài) brit|* danh từ|- cái cầu',
      'bread, ngoại động từ|- làm thủng|* danh từ|- bánh mì',
      'unlisted, danh từ|- nghĩa đầu tiên|* động từ|- nghĩa tiếp theo',
    ), { includeRecords: true });
    expect(lookup(bank, 'school')).toMatchObject({ meaning: 'trường học, học đường', partOfSpeech: 'noun', learningLevel: 1 });
    expect(lookup(bank, 'bridge')).toMatchObject({ meaning: 'cái cầu', partOfSpeech: 'noun', learningLevel: 1 });
    expect(lookup(bank, 'bread')).toMatchObject({ meaning: 'bánh mì', partOfSpeech: 'noun', category: 'Danh từ' });
    expect(lookup(bank, 'unlisted')).toMatchObject({ meaning: 'nghĩa đầu tiên', partOfSpeech: 'noun' });
    expect(bank.report.preferredSourceSenseSelections).toHaveLength(3);
    expect(bank.report.preferredSourceSenseSelections[0]).toMatchObject({
      answer: 'school', sourceRow: 2, oldSelected: { meaning: 'đàn cá, bầy cá', partOfSpeech: 'noun' },
      newSelected: { meaning: 'trường học, học đường', partOfSpeech: 'noun' },
    });
    expect(bank.records[0].rawRow).toContain('đàn cá, bầy cá');
    expect(bank.records[0].sourceSenseSelection.newSelected.meaning).toBe('trường học, học đường');
  });

  it('does not fabricate a basic meaning or infer a POS when the source has no qualifying sense', () => {
    const bank = buildCsvCatalog(csv('school,danh từ|- đàn cá, bầy cá|* động từ|- trường học', 'bridge,danh từ|- (đánh bài) brit'));
    expect(lookup(bank, 'school')).toMatchObject({ meaning: 'đàn cá, bầy cá', partOfSpeech: 'noun' });
    expect(lookup(bank, 'school').learningLevel).toBeGreaterThanOrEqual(4);
    expect(lookup(bank, 'bridge').meaning).toBe('(đánh bài) brit');
    expect(lookup(bank, 'bridge').learningLevel).toBeGreaterThanOrEqual(4);
    expect(bank.report.preferredSourceSenseSelections).toHaveLength(0);
  });

  it('retains a clear unlabelled meaning without inventing a POS', () => {
    const word = lookup(buildCsvCatalog(csv('abac,bàn tính, toán đồ, bản đồ tính')), 'abac');
    expect(word).toMatchObject({ meaning: 'bàn tính, toán đồ, bản đồ tính', partOfSpeech: 'unspecified' });
    expect(word.sourceUrl).toBeUndefined();
  });

  it('does not mistake IPA, inflection lists, aliases or example translations for meanings', () => {
    const bank = buildCsvCatalog(csv(
      'learn [lə:n], ngoại động từ learnt /lə:nt/|- học, học tập',
      'write [rait], ngoại động từ wrote, (từ cổ,nghĩa cổ) writ; written|- viết',
      'appendix [əpendiks], danh từ, số nhiều appendices |/əpendiksiz/, appendixes|/əpendiksiz/|- phụ lục',
      'alley [æli], danh từ,+ (alleyway)|- ngõ, đường đi',
      'abscissa, abscissae,hoành độ',
    ));
    expect(lookup(bank, 'learn').meaning).toBe('học, học tập');
    expect(lookup(bank, 'write').meaning).toBe('viết');
    expect(lookup(bank, 'appendix').meaning).toBe('phụ lục');
    expect(lookup(bank, 'alley').meaning).toBe('ngõ, đường đi');
    expect(lookup(bank, 'abscissa')).toBeUndefined();
  });

  it('skips qualifier-only senses but preserves a substantive parenthesized definition', () => {
    const bank = buildCsvCatalog(csv('comet, danh từ|- (thiên văn học)|- sao chổi', 'astern, phó từ|- (hàng hải)|- ở phía sau tàu', 'exodontist, danh từ|- (người nhổ răng)', 'asap,(viết tắt)|- càng sớm càng tốt (as soon as possible)', 'atm,(viết tắt)|- atmosphere'));
    expect(lookup(bank, 'comet').meaning).toBe('sao chổi');
    expect(lookup(bank, 'astern').meaning).toBe('ở phía sau tàu');
    expect(lookup(bank, 'exodontist').meaning).toBe('(người nhổ răng)');
    expect(lookup(bank, 'asap').meaning).toBe('càng sớm càng tốt (as soon as possible)');
    expect(lookup(bank, 'atm')).toBeUndefined();
  });

  it('ignores grammatical usage tags and inflected forms enclosed in parentheses', () => {
    const bank = buildCsvCatalog(csv('commensurable,tính từ|- (+ with, to)|- tương xứng', 'undraw,ngoại động từ|- (undrew, undrawn)|- kéo ra', 'dale,danh từ|- (thơ ca)|- thung lũng', 'gasplant,danh từ|- (danh từ)|- cây vân hương', 'www,(viết tắt)|- (world wide web)'));
    expect(lookup(bank, 'commensurable').meaning).toBe('tương xứng');
    expect(lookup(bank, 'undraw').meaning).toBe('kéo ra');
    expect(lookup(bank, 'dale').meaning).toBe('thung lũng');
    expect(lookup(bank, 'gasplant').meaning).toBe('cây vân hương');
    expect(lookup(bank, 'www')).toBeUndefined();
  });

  it('uses Unicode reference boundaries and does not copy related-headword meanings', () => {
    const bank = buildCsvCatalog(csv('abdicable,xem abdicate', 'abdicate, ngoại động từ|- nhường lại tài sản', 'barnacle, danh từ|- (như) barnacle_goose', 'hallow, động từ|- (như) halloo[hælou],'));
    expect(lookup(bank, 'abdicable')).toBeUndefined();
    expect(lookup(bank, 'barnacle')).toBeUndefined();
    expect(lookup(bank, 'hallow')).toBeUndefined();
    expect(lookup(bank, 'abdicate').meaning).toBe('nhường lại tài sản');
  });

  it('prefers a real lexical entry over a contraction/abbreviation with the same stripped headword', () => {
    const bank = buildCsvCatalog(csv('shun,interj|- ((viết tắt) của attention) nghiêm!', 'shun [ʃʌn], ngoại động từ|- tránh, xa lánh', 'twill,(viết tắt) của it will', 'twill [twil], danh từ|- vải chéo', 'ant [ɑ:nt], (viết tắt) của am not khoành is not, are not', 'ant [ænt], danh từ|- con kiến'), { includeRecords: true });
    expect(lookup(bank, 'shun')).toMatchObject({ meaning: 'tránh, xa lánh', partOfSpeech: 'verb' });
    expect(lookup(bank, 'twill')).toMatchObject({ meaning: 'vải chéo', partOfSpeech: 'noun' });
    expect(lookup(bank, 'ant')).toMatchObject({ meaning: 'con kiến', partOfSpeech: 'noun' });
    expect(bank.records.filter(row => row.status === 'accepted')).toHaveLength(bank.words.length);
  });

  it('recovers source POS/definitions embedded in a malformed bracket with an explicit audit flag', () => {
    const bank = buildCsvCatalog(csv('cup [* danh từ|- tách, chén|* ngoại động từ|- khum tay],#8746;'), { includeRecords: true });
    expect(lookup(bank, 'cup')).toMatchObject({ meaning: 'tách, chén', partOfSpeech: 'noun' });
    expect(bank.report.stats.syntaxRepairedRows).toBe(1);
    expect(bank.records[0].syntaxRepair).toBeTruthy();
  });

  it('shortens only at authored punctuation outside parentheses and never slices a word', () => {
    const long = 'khái niệm thứ nhất; ' + 'một nội dung giải thích rất dài '.repeat(8);
    expect(shortenMeaning(long)).toBe('khái niệm thứ nhất');
    expect(shortenMeaning('một định nghĩa (' + 'nội dung, ví dụ; '.repeat(10) + ')')).toBeNull();
    expect(shortenMeaning('á'.repeat(121))).toBeNull();
    const bank = buildCsvCatalog(csv('example, danh từ|- ' + 'á'.repeat(121) + '|- ví dụ'));
    expect(lookup(bank, 'example').meaning).toBe('ví dụ');
  });

  it('accounts for every nonempty source row under one accepted or excluded decision', () => {
    const bank = buildCsvCatalog(csv('apple,danh từ|- táo', 'apple,danh từ|- quả táo', 'red apple,danh từ|- táo đỏ', 'ab,danh từ|- chữ', 'bad-row', 'other,xem apple', 'empty,', ''), { includeRecords: true });
    const excluded = Object.values(bank.report.stats.exclusions).reduce((sum, count) => sum + count, 0);
    expect(bank.words.length + excluded).toBe(bank.report.stats.sourceRecords);
    expect(bank.records.filter(row => row.status === 'accepted')).toHaveLength(bank.words.length);
    expect(bank.report.stats.exclusions).toMatchObject({ 'duplicate-answer': 1, phrase: 1, length: 1, 'malformed-csv': 1, 'reference-only': 1, 'no-usable-meaning': 1 });
  });
});

describe('CSV import publication', () => {
  it('writes only CSV meanings with exact byte provenance, a full source archive and history-only migration', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'project-v-csv-import-'));
    try {
      const inputPath = join(folder, 'source.csv'); const outputPath = join(folder, 'en-vi.json'); const archivePath = join(folder, 'full.jsonl.gz');
      const bytes = utf16(csv('water [wɔ:tə], danh từ|- nước tinh khiết', 'bad-row', 'red apple,danh từ|- táo đỏ'));
      await writeFile(inputPath, bytes);
      const result = await importCsvDictionary({ inputPath, outputPath, archivePath, localFile: 'Dic/source.csv', editorial: {
        corrections: [{ answer: 'waterr', after: { answer: 'water', meaning: 'Nghĩa cũ không được chèn vào CSV', partOfSpeech: 'adjective' } }],
      } });
      expect(result.words[0].meaning).toBe('nước tinh khiết');
      expect(result.words[0].partOfSpeech).toBe('noun');
      expect(result.words[0].historyAliases).toEqual(['waterr']);
      expect(result.source).toMatchObject({ kind: 'local-csv', localFile: 'Dic/source.csv', encoding: 'utf-16le', license: CSV_LICENSE, sha256: createHash('sha256').update(bytes).digest('hex') });
      expect(result.source.url).toBeUndefined();
      const archived = gunzipSync(await readFile(archivePath)).toString('utf8').trim().split('\n').map(row => JSON.parse(row));
      expect(archived).toHaveLength(3);
      expect(archived[0].rawRow).toContain('danh từ');
      expect(archived[0].selectedFullMeaning).toBe('nước tinh khiết');
      expect(archived[0].classification.learningLevel).toBe(result.words[0].learningLevel);
      expect(archived[1]).toMatchObject({ status: 'excluded', reason: 'malformed-csv' });
      const grades = gunzipSync(await readFile(join(folder, 'word-grades.jsonl.gz'))).toString('utf8').trim().split('\n').map(row => JSON.parse(row));
      expect(grades).toHaveLength(1);
      expect(grades[0]).toMatchObject({ answer: 'water', partOfSpeech: 'noun', learningLevel: result.words[0].learningLevel, sourceRow: 2 });
      expect(grades[0].reasons.length).toBeGreaterThan(0);
      const spreadsheet = await readFile(join(folder, 'learning-levels.csv'), 'utf8');
      expect(spreadsheet).toContain('learningLevel,partOfSpeech,answer,meaning');
      expect(spreadsheet).toContain('"water","nước tinh khiết"');
      const before = await readFile(outputPath, 'utf8');
      await writeFile(inputPath, utf16('bad,header\nword,nghĩa'));
      await expect(importCsvDictionary({ inputPath, outputPath, archivePath })).rejects.toThrow('header');
      expect(await readFile(outputPath, 'utf8')).toBe(before);
      await writeFile(inputPath, bytes);
      await expect(importCsvDictionary({ inputPath, outputPath, archivePath, expectedSha256: 'bad' })).rejects.toThrow('checksum');
      expect(await readFile(outputPath, 'utf8')).toBe(before);
    } finally {
      expect(dirname(resolve(folder))).toBe(resolve(tmpdir()));
      await rm(folder, { recursive: true, force: true });
    }
  });
});
