import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './i18n';
import { CancelPage } from './components/CancelPage/CancelPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <CancelPage />
    </LanguageProvider>
  </StrictMode>
);
