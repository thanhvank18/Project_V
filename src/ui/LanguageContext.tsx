import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { localeFor, readLanguage, saveLanguage, translate, type Language } from '../i18n';

const LanguageContext = createContext({ language: 'vi' as Language, setLanguage: (_language: Language) => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(readLanguage);
  useEffect(() => { saveLanguage(language); document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  return { ...context, locale: localeFor(context.language), t: (text: string, values?: readonly (string | number)[]) => translate(context.language, text, values) };
}

export function LanguagePicker({ disabled = false, title }: { disabled?: boolean; title?: string }) {
  const { language, setLanguage, t } = useLanguage();
  return <div className="language-picker" role="group" aria-label={t('Ngôn ngữ')} title={title}>
    <button type="button" lang="vi" aria-label="Tiếng Việt" aria-pressed={language === 'vi'} disabled={disabled} onClick={() => setLanguage('vi')}>VI</button>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} disabled={disabled} onClick={() => setLanguage('en')}>EN</button>
  </div>;
}
