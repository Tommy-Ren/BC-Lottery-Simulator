import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { App } from './app/App';
import { I18nProvider } from './i18n/I18nContext';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <App />
      <Analytics />
    </I18nProvider>
  </StrictMode>,
);
