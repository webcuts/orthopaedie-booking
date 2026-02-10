import { useTranslation, type Language } from './LanguageContext';
import styles from './LanguageSelector.module.css';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
  { code: 'tr', label: 'TR' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useTranslation();

  return (
    <div className={styles.container}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          className={`${styles.button} ${language === code ? styles.active : ''}`}
          onClick={() => setLanguage(code)}
          aria-label={label}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
