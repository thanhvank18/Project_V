import type { DamageMode, LearningLevel, PartOfSpeech, Word } from './types';

export const CUSTOM_DECK_MAX_ENTRIES = 500;
export const CUSTOM_DECK_TTL_MS = 24 * 60 * 60 * 1000;
export type CustomQuestionType = 'mixed' | 'translate' | 'missing' | 'scramble' | 'fill';
export interface CustomDeckEntry {
  answer: string; meaning: string; partOfSpeech: PartOfSpeech; level: LearningLevel;
  type: CustomQuestionType; sentence?: string;
}
export interface CustomDeckInput { title: string; language: 'vi' | 'en'; entries: CustomDeckEntry[]; damageMode?: DamageMode }
export interface CustomDeck extends CustomDeckInput { id: string; createdAt: number; expiresAt: number }
export interface CustomDeckError { row?: number; field: string; message: string }

const PARTS = new Set<PartOfSpeech>(['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun',
  'conjunction', 'interjection', 'determiner', 'numeral', 'prefix', 'suffix', 'abbreviation', 'unspecified']);
const TYPES = new Set<CustomQuestionType>(['mixed', 'translate', 'missing', 'scramble', 'fill']);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const invalidControl = (value: string): boolean => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);

function validateEntries(input: unknown, rows?: number[]): { entries: CustomDeckEntry[]; errors: CustomDeckError[] } {
  const errors: CustomDeckError[] = [], entries: CustomDeckEntry[] = [];
  if (!Array.isArray(input) || input.length < 1 || input.length > CUSTOM_DECK_MAX_ENTRIES) {
    return { entries, errors: [{ field: 'entries', message: 'Use between 1 and 500 questions.' }] };
  }
  const answers = new Map<string, number>();
  for (const [index, value] of input.entries()) {
    const row = rows?.[index] ?? index + 1, before = errors.length;
    const error = (field: string, message: string) => errors.push({ row, field, message });
    if (!object(value)) { error('entry', 'Question must be an object.'); continue; }
    const answer = text(value.answer).toLowerCase(), meaning = text(value.meaning), sentence = text(value.sentence);
    if (!/^[a-z]{1,18}$/.test(answer)) error('answer', 'Answer must contain 1–18 English letters, with no spaces.');
    else if (answers.has(answer)) error('answer', `Duplicate answer; first used in row ${answers.get(answer)}.`);
    else answers.set(answer, row);
    if (typeof value.meaning !== 'string' && value.meaning !== undefined) error('meaning', 'Meaning must be text.');
    if (meaning.length > 400 || invalidControl(meaning)) error('meaning', 'Meaning must be at most 400 characters with no control characters.');
    if (!PARTS.has(value.partOfSpeech as PartOfSpeech)) error('partOfSpeech', 'Choose a valid part of speech.');
    if (!Number.isInteger(value.level) || Number(value.level) < 1 || Number(value.level) > 10) error('level', 'Level must be a whole number from 1 to 10.');
    if (!TYPES.has(value.type as CustomQuestionType)) error('type', 'Type must be mixed, translate, missing, scramble, or fill.');
    if (value.sentence !== undefined && typeof value.sentence !== 'string') error('sentence', 'Sentence must be text.');
    if (sentence.length > 300 || invalidControl(sentence)) error('sentence', 'Sentence must be at most 300 characters with no control characters.');
    if (value.type === 'fill') {
      const blanks = sentence.match(/_+/g) ?? [];
      if (blanks.length !== 1 || blanks[0] !== '___') error('sentence', 'Fill-in-the-blank questions need exactly one ___ placeholder.');
      if (!sentence.replace('___', '').trim()) error('sentence', 'Add sentence context around the blank.');
    } else if (!meaning) error('meaning', 'Add a meaning or definition.');
    if (errors.length === before) entries.push({ answer, meaning: meaning || sentence, partOfSpeech: value.partOfSpeech as PartOfSpeech,
      level: value.level as LearningLevel, type: value.type as CustomQuestionType, ...(sentence ? { sentence } : {}) });
  }
  return { entries: errors.length ? [] : entries, errors };
}

/** Shared by browser and API; malformed content is rejected as a whole, never silently dropped. */
export function validateCustomDeck(input: unknown): { data?: CustomDeckInput; errors: CustomDeckError[] } {
  if (!object(input)) return { errors: [{ field: 'deck', message: 'Deck must be an object.' }] };
  const title = text(input.title), validated = validateEntries(input.entries);
  const errors = [...validated.errors];
  if (!title || title.length > 80 || invalidControl(title)) errors.unshift({ field: 'title', message: 'Title must contain 1–80 characters with no control characters.' });
  if (input.language !== 'vi' && input.language !== 'en') errors.unshift({ field: 'language', message: 'Language must be vi or en.' });
  if (input.damageMode !== undefined && input.damageMode !== 'health' && input.damageMode !== 'one-hit') errors.unshift({ field: 'damageMode', message: 'Damage mode must be health or one-hit.' });
  return errors.length ? { errors } : { data: { title, language: input.language as 'vi' | 'en', entries: validated.entries,
    damageMode: input.damageMode as DamageMode | undefined ?? 'health' }, errors };
}

/** UTF-8 BOM lets common spreadsheet apps preserve Vietnamese. Examples never start with formula markers. */
export const CUSTOM_DECK_CSV_TEMPLATE = '\uFEFFanswer,meaning,partOfSpeech,level,type,sentence\r\n'
  + 'apple,Quả táo,noun,1,mixed,\r\n'
  + 'happy,Vui vẻ,adjective,1,translate,\r\n'
  + 'water,Nước,noun,1,fill,I drink ___ every day.\r\n'
  + 'book,Quyển sách,noun,1,missing,\r\n'
  + 'garden,Khu vườn,noun,2,scramble,\r\n';

export function customDeckCsvTemplate(language: 'vi' | 'en'): string {
  return language === 'vi' ? CUSTOM_DECK_CSV_TEMPLATE : '\uFEFFanswer,meaning,partOfSpeech,level,type,sentence\r\n'
    + 'apple,A round fruit that can be red or green,noun,1,mixed,\r\n'
    + 'happy,Feeling pleasure or joy,adjective,1,translate,\r\n'
    + 'water,A clear liquid that people drink,noun,1,fill,I drink ___ every day.\r\n'
    + 'book,A set of pages bound together for reading,noun,1,missing,\r\n'
    + 'garden,A place where flowers or vegetables are grown,noun,2,scramble,\r\n';
}

interface CsvRecord { fields: string[]; row: number }
function readCsv(source: string): { records: CsvRecord[]; errors: CustomDeckError[] } {
  const records: CsvRecord[] = [], errors: CustomDeckError[] = [];
  let fields: string[] = [], cell = '', quoted = false, closed = false, line = 1, row = 1;
  const emit = () => {
    fields.push(cell);
    if (fields.some(field => field.trim())) records.push({ fields, row });
    fields = []; cell = ''; closed = false;
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; closed = true; }
      } else {
        cell += char;
        if (char === '\n' || char === '\r' && source[index + 1] !== '\n') line++;
      }
      continue;
    }
    if (char === ',') { fields.push(cell); cell = ''; closed = false; }
    else if (char === '\n' || char === '\r') {
      emit(); if (char === '\r' && source[index + 1] === '\n') index++;
      line++; row = line;
    } else if (char === '"' && cell === '' && !closed) quoted = true;
    else if (char === '"' || closed) { errors.push({ row: line, field: 'csv', message: 'Invalid quote or text after a closing quote.' }); return { records: [], errors }; }
    else cell += char;
  }
  if (quoted) return { records: [], errors: [{ row, field: 'csv', message: 'Unclosed quoted field.' }] };
  if (cell || fields.length || closed) emit();
  return { records, errors };
}

/** RFC 4180-style comma-separated input, including escaped quotes and multiline cells. */
export function parseCustomDeckCsv(text: string): { entries: CustomDeckEntry[]; errors: CustomDeckError[] } {
  if (text.length > 1_000_000) return { entries: [], errors: [{ field: 'csv', message: 'CSV must be at most 1 MB of text.' }] };
  const csv = readCsv(text.replace(/^\uFEFF/, ''));
  if (csv.errors.length) return { entries: [], errors: csv.errors };
  const [header, ...records] = csv.records;
  if (!header) return { entries: [], errors: [{ field: 'csv', message: 'CSV is empty.' }] };
  const names: Record<string, string> = { answer: 'answer', meaning: 'meaning', partofspeech: 'partOfSpeech', level: 'level', type: 'type', sentence: 'sentence' };
  const columns = header.fields.map(field => names[field.trim().toLowerCase().replace(/[_ -]/g, '')]);
  const errors: CustomDeckError[] = [];
  if (columns.some(column => !column)) errors.push({ row: header.row, field: 'csv', message: 'Unknown column. Use the downloadable CSV template headers.' });
  if (new Set(columns).size !== columns.length) errors.push({ row: header.row, field: 'csv', message: 'Duplicate column header.' });
  if (!columns.includes('answer')) errors.push({ row: header.row, field: 'answer', message: 'CSV needs an answer column.' });
  const values = records.map(record => {
    if (record.fields.length !== columns.length) errors.push({ row: record.row, field: 'csv', message: 'Column count differs from the header; quote values containing commas.' });
    const value: Record<string, unknown> = { meaning: '', partOfSpeech: 'unspecified', level: 1, type: 'mixed' };
    columns.forEach((column, index) => { if (column) value[column] = record.fields[index]?.trim() ?? ''; });
    value.partOfSpeech = value.partOfSpeech || 'unspecified'; value.type = value.type || 'mixed';
    value.level = value.level === '' ? 1 : Number(value.level);
    return value;
  });
  if (errors.length) return { entries: [], errors };
  return validateEntries(values, records.map(record => record.row));
}

/** The pack's authored language is preserved even when a visitor uses a different interface language. */
export function customDeckWords(deck: CustomDeckInput): Word[] {
  return deck.entries.map(entry => ({ id: `custom-${entry.answer}`, answer: entry.answer, meaning: entry.meaning,
    englishMeaning: entry.meaning, category: deck.title, partOfSpeech: entry.partOfSpeech,
    difficulty: entry.level <= 3 ? 1 : entry.level <= 6 ? 2 : 3, learningLevel: entry.level,
    customQuestion: { type: entry.type, language: deck.language, ...(entry.sentence ? { sentence: entry.sentence } : {}) } }));
}
