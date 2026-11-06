import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { LegalPage } from './components/LegalPage.tsx';
import './index.css';

const route = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
const page = route === '/privacypolicy'
  ? <LegalPage document="privacy" />
  : route === '/termsofservice'
    ? <LegalPage document="terms" />
    : route === '/'
      ? <LandingPage />
      : <App />;
createRoot(document.getElementById('root')!).render(page);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
