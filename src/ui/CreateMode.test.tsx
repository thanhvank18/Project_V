import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreateMode, CreatedDeckPanel, customDeckErrorText, customDeckShareUrl } from './CreateMode';
import { LanguageProvider } from './LanguageContext';
import { translate } from '../i18n';
import { customDeckCsvTemplate, parseCustomDeckCsv, type CustomDeck } from '../game/customDeck';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const language = (value: 'vi' | 'en') => vi.stubGlobal('localStorage', { getItem: () => value });
const deck: CustomDeck = { id: 'a-safe-shared-deck-id', title: '<Classroom vocabulary>', language: 'en', createdAt: 1000, expiresAt: 86_401_000,
  entries: [{ answer: 'apple', meaning: 'A round fruit.', partOfSpeech: 'noun', level: 1, type: 'mixed' }] };

describe('custom word pack editor', () => {
  it('provides a labeled empty editor and both import paths in Vietnamese and English', () => {
    for (const locale of ['vi', 'en'] as const) {
      language(locale);
      const markup = renderToStaticMarkup(<LanguageProvider><CreateMode onClose={() => {}} onCreated={() => {}} /></LanguageProvider>);
      expect(markup).toContain(locale === 'vi' ? 'Tạo bộ từ của bạn' : 'Create your word pack');
      expect(markup).toContain(locale === 'vi' ? 'Tải mẫu CSV' : 'Download CSV template');
      expect(markup).toContain(locale === 'vi' ? 'Điền từ vào câu' : 'Fill in the blank');
      expect(markup).toContain('for="create-answer-1"');
      expect(markup).toContain('for="create-meaning-1"');
      expect(markup).toContain('for="create-language"');
      expect(markup).toContain('for="create-damageMode"');
      expect(markup).toContain('aria-describedby="create-damage-help"');
      expect(markup).toContain('value="health" selected=""');
      expect(markup).toContain(locale === 'vi' ? 'Một chạm là chết' : 'One hit, game over');
      expect(markup).toContain('accept=".csv,text/csv"');
      expect(markup).toContain('maxLength="18"');
      expect(markup).toContain('value=""');
      expect(markup).not.toContain('role="dialog"');
    }
  });

  it('creates a share URL containing only the new pack, never the editor, old room or hash', () => {
    const url = new URL(customDeckShareUrl('new_pack-123', 'https://game.example/play?create=1&room=123456&deck=old#debug'));
    expect(url.origin + url.pathname).toBe('https://game.example/play');
    expect([...url.searchParams]).toEqual([['deck', 'new_pack-123']]);
    expect(url.hash).toBe('');
  });

  it('shows a selectable share link, localized expiry and escaped author content', () => {
    vi.useFakeTimers(); vi.setSystemTime(1000); language('en');
    const markup = renderToStaticMarkup(<LanguageProvider><CreatedDeckPanel deck={deck} shareUrl="https://game.example/?deck=abc" onClose={() => {}} onPlay={() => {}} /></LanguageProvider>);
    expect(markup).toContain('Word pack link');
    expect(markup).toContain('readOnly=""');
    expect(markup).toContain('Automatically deleted on');
    expect(markup).toContain('&lt;Classroom vocabulary&gt;');
    expect(markup).not.toContain('<Classroom vocabulary>');
    expect(markup).toContain('Play this word pack');
    expect(markup).not.toContain('disabled=""');
  });

  it('prevents playing a pack whose expiry has passed while the success page was open', () => {
    vi.useFakeTimers(); vi.setSystemTime(deck.expiresAt); language('vi');
    const markup = renderToStaticMarkup(<LanguageProvider><CreatedDeckPanel deck={deck} shareUrl="https://game.example/?deck=abc" onClose={() => {}} onPlay={() => {}} /></LanguageProvider>);
    expect(markup).toContain('Link đã hết hạn và không thể chơi tiếp.');
    expect(markup).toContain('disabled="">Chơi bộ từ này');
  });

  it('shows the published survival rule in both languages and defaults legacy packs to normal health', () => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    for (const locale of ['vi', 'en'] as const) {
      language(locale);
      const markup = renderToStaticMarkup(<LanguageProvider><CreatedDeckPanel deck={{ ...deck, damageMode: 'one-hit' }} shareUrl="https://game.example/?deck=abc" onClose={() => {}} onPlay={() => {}} /></LanguageProvider>);
      expect(markup).toContain(locale === 'vi' ? 'Luật sinh tồn' : 'Survival rule');
      expect(markup).toContain(locale === 'vi' ? '<strong>Một chạm là chết</strong>' : '<strong>One hit, game over</strong>');
    }
    const legacy = renderToStaticMarkup(<LanguageProvider><CreatedDeckPanel deck={deck} shareUrl="https://game.example/?deck=abc" onClose={() => {}} onPlay={() => {}} /></LanguageProvider>);
    expect(legacy).toContain('<strong>Hearts</strong>');
  });

  it('translates row validation and preserves the referenced duplicate row number', () => {
    const viText = (text: string, values?: readonly (string | number)[]) => translate('vi', text, values);
    const enText = (text: string, values?: readonly (string | number)[]) => translate('en', text, values);
    expect(customDeckErrorText('Duplicate answer; first used in row 17.', viText)).toBe('Đáp án bị trùng với dòng 17.');
    expect(customDeckErrorText('Duplicate answer; first used in row 17.', enText)).toBe('Duplicate answer; first used in row 17.');
    expect(customDeckErrorText('Fill-in-the-blank questions need exactly one ___ placeholder.', viText)).toContain('3 dấu gạch dưới');
    expect(customDeckErrorText('CSV is empty.', viText)).toBe('File CSV đang trống.');
    expect(customDeckErrorText('CSV is empty.', enText)).toBe('The CSV file is empty.');
  });

  it('downloads BOM-marked templates that validate and match the authored language', () => {
    const viCsv = customDeckCsvTemplate('vi'), enCsv = customDeckCsvTemplate('en');
    expect(viCsv.charCodeAt(0)).toBe(0xfeff); expect(enCsv.charCodeAt(0)).toBe(0xfeff);
    const viPack = parseCustomDeckCsv(viCsv), enPack = parseCustomDeckCsv(enCsv);
    expect(viPack.errors).toEqual([]); expect(enPack.errors).toEqual([]);
    expect(viPack.entries[0].meaning).toBe('Quả táo');
    expect(enPack.entries[0].meaning).not.toMatch(/[\u1e00-\u1eff]/);
    expect(enPack.entries.some(entry => entry.type === 'fill' && entry.sentence?.includes('___'))).toBe(true);
  });
});
