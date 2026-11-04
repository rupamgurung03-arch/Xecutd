import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import './index.css';

const isJournalRoute = window.location.pathname !== '/';
createRoot(document.getElementById('root')!).render(isJournalRoute ? <App /> : <LandingPage />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
