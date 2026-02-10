import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import de from '../locales/de.json';
import en from '../locales/en.json';
import tr from '../locales/tr.json';

export type Language = 'de' | 'en' | 'tr';

type Translations = Record<string, string | string[]>;

const locales: Record<Language, Translations> = { de, en, tr };

function detectLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('tr')) return 'tr';
  if (browserLang.startsWith('en')) return 'en';
  return 'de';
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(detectLanguage);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let value = locales[language]?.[key] ?? locales.de[key] ?? key;

    // Arrays werden nicht als Translation zurückgegeben (nur für Wochentage etc.)
    if (Array.isArray(value)) return key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = (value as string).replace(`{${k}}`, String(v));
      });
    }

    return value as string;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider');
  return ctx;
}

/** Gibt ein Array aus den Locales zurück (z.B. Wochentage) */
export function useTranslationArray(key: string): string[] {
  const { language } = useTranslation();
  const value = locales[language]?.[key] ?? locales.de[key];
  return Array.isArray(value) ? value : [];
}

/** Gibt den lokalisierten Namen eines DB-Eintrags zurück */
export function getLocalizedName(
  item: { name: string; name_en?: string | null; name_tr?: string | null },
  language: Language
): string {
  if (language === 'en' && item.name_en) return item.name_en;
  if (language === 'tr' && item.name_tr) return item.name_tr;
  return item.name;
}
