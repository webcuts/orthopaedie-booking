import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// DEBUG: Prüft ob neuer Build geladen wird
alert('BUILD v2 - 3848f73');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
