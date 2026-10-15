import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jua/400.css';
import './styles.css';
import { App } from './App';
import { SessionProvider } from './auth/SessionProvider';
createRoot(document.getElementById('root')!).render(
  <SessionProvider>
    <App />
  </SessionProvider>,
);
