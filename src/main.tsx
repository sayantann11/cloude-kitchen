import { render } from 'preact';
import { App } from './app';
import { createStore } from './data';
import { boot } from './state/app';
import './styles.css';

const root = document.getElementById('app')!;
root.textContent = ''; // drop the inline loading skeleton
render(<App />, root);
void boot(createStore);

// Offline + instant repeat visits. Skipped in dev so hot reload isn't cached.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
