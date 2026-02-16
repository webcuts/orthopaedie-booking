import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// DEBUG: Build-Marker (nicht-blockierend)
console.log('%c[BUILD] v3 - d8c06a7', 'background: red; color: white; font-size: 16px;');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
