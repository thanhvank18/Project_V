/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { localizeText, localeFor, readLanguage, saveLanguage, translate } from './i18n';
import messages from './ui/messages.en.json';
import { HERO_SKILLS } from './game/heroSkills';
import { CHARACTERS } from './game/characterCatalog';
import { PART_OF_SPEECH_LABELS } from './game/vocabulary';

afterEach(() => vi.unstubAllGlobals());

describe('language preferences and translation', () => {
  it('persists only the supported local preference and tolerates unavailable storage', () => {
    const entries = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key), setItem: (key: string, value: string) => entries.set(key, value) });
    expect(readLanguage()).toBe('vi');
    saveLanguage('en');
    expect(entries.get('zvs-language-v1')).toBe('en');
    expect(readLanguage()).toBe('en');
    entries.set('zvs-language-v1', 'unsupported');
    expect(readLanguage()).toBe('vi');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(readLanguage()).toBe('vi');
    expect(() => saveLanguage('en')).not.toThrow();
  });

  it('keeps Vietnamese intact and substitutes parameter values literally in both languages', () => {
    expect(translate('vi', 'Bậc {0}: {1}', [2, 'Dễ'])).toBe('Bậc 2: Dễ');
    expect(translate('en', 'Bậc {0}: {1}', [2, 'Easy'])).toBe('Level 2: Easy');
    expect(translate('en', 'Ôn từ {0}', ['$&'])).toBe('Review $&');
    expect(localizeText('Khiên thép', 'en')).toBe('Steel Guard');
    expect(localeFor('en')).toBe('en-US');
    expect(localeFor('vi')).toBe('vi-VN');
  });

  it('localizes dynamic room names, speech, boss phase and combined storage warnings', () => {
    expect(translate('en', 'Người chơi 4')).toBe('Player 4');
    expect(translate('en', 'Đang đọc apple')).toBe('Speaking apple');
    expect(translate('en', 'Tank chuyển phase 3! Quan sát đòn đập đất.')).toBe('Tank enters phase 3! Watch its ground slam.');
    expect(translate('en', 'Trình duyệt không cho lưu. Kết quả chỉ được giữ đến khi đóng trang.'))
      .toBe('Browser storage is unavailable. Results are kept only until this page closes.');
    expect(translate('en', 'A custom player name')).toBe('A custom player name');
  });

  it('has an English entry for every static UI translation key and retains interpolation parameters', () => {
    const catalog = messages as Record<string, string>;
    const files = import.meta.glob<string>(['./ui/*.tsx', './main.tsx'], { query: '?raw', import: 'default', eager: true });
    const keys = new Set<string>();
    for (const [file, text] of Object.entries(files)) {
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
          const collect = (arg: ts.Node) => { if (ts.isStringLiteral(arg)) keys.add(arg.text); else if (ts.isConditionalExpression(arg)) { collect(arg.whenTrue); collect(arg.whenFalse); } };
          if (node.arguments[0]) collect(node.arguments[0]);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    for (const key of keys) expect(catalog[key], key).toBeTruthy();
    for (const [key, text] of Object.entries(catalog)) {
      expect([...key.matchAll(/\{\d+\}/g)].map(match => match[0]).sort(), key)
        .toEqual([...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort());
    }
  });

  it('covers every hero tactic, character label and part of speech', () => {
    const labels = [...HERO_SKILLS.flatMap(skill => [skill.name, skill.description, skill.tactics]), ...CHARACTERS.map(character => character.label), ...Object.values(PART_OF_SPEECH_LABELS)];
    for (const label of labels) expect(/[\u1e00-\u1eff]/.test(translate('en', label)), label).toBe(false);
  });
});
