import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import de from '../locales/de.json';
import en from '../locales/en.json';
import tr from '../locales/tr.json';
import ru from '../locales/ru.json';
import ar from '../locales/ar.json';

export type Language = 'de' | 'en' | 'tr' | 'ru' | 'ar';

type Translations = Record<string, string | string[]>;

const locales: Record<Language, Translations> = { de, en, tr, ru, ar };

function detectLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('ar')) return 'ar';
  if (browserLang.startsWith('ru')) return 'ru';
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

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

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
  item: { name: string; name_en?: string | null; name_tr?: string | null; name_ru?: string | null; name_ar?: string | null },
  language: Language
): string {
  if (language === 'en' && item.name_en) return item.name_en;
  if (language === 'tr' && item.name_tr) return item.name_tr;
  if (language === 'ru' && item.name_ru) return item.name_ru;
  if (language === 'ar' && item.name_ar) return item.name_ar;
  return item.name;
}

/** Gibt die lokalisierte Beschreibung eines DB-Eintrags zurück */
export function getLocalizedDescription(
  item: { description: string | null; description_en?: string | null; description_tr?: string | null; description_ru?: string | null; description_ar?: string | null },
  language: Language
): string | null {
  if (language === 'en' && item.description_en) return item.description_en;
  if (language === 'tr' && item.description_tr) return item.description_tr;
  if (language === 'ru' && item.description_ru) return item.description_ru;
  if (language === 'ar' && item.description_ar) return item.description_ar;
  return item.description;
}
