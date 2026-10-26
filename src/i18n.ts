import messages from './ui/messages.en.json';

export type Language = 'vi' | 'en';
const storageKey = 'zvs-language-v1';
const english = messages as Record<string, string>;

export function readLanguage(): Language {
  try { return localStorage.getItem(storageKey) === 'en' ? 'en' : 'vi'; } catch { return 'vi'; }
}

export function saveLanguage(language: Language): void {
  try { localStorage.setItem(storageKey, language); } catch { /* Keep the choice for this session. */ }
}

export function localeFor(language: Language): string { return language === 'en' ? 'en-US' : 'vi-VN'; }

/** Only presentation text is translated; vocabulary definitions are supplied by the dictionary. */
export function translate(language: Language, text: string, values: readonly (string | number)[] = []): string {
  let result = language === 'en' ? english[text] ?? text.split(/(?<=\.) /).map(sentence => english[sentence] ?? sentence).join(' ') : text;
  if (language === 'en') {
    result = result.replace(/^Người chơi (\d+)$/, 'Player $1').replace(/^Đang đọc (.+)$/, 'Speaking $1')
      .replace(/^Tank chuyển phase (\d+)! Quan sát đòn đập đất\.$/, 'Tank enters phase $1! Watch its ground slam.');
  }
  return result.replace(/\{(\d+)\}/g, (token, index: string) => values[Number(index)] === undefined ? token : String(values[Number(index)]));
}

export function localizeText(text: string, language: Language): string { return translate(language, text); }
