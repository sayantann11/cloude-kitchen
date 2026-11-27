/**
 * Admin portal entry (served at /admin from admin.html).
 * A separate page from the customer app: customers never load this code, and
 * nothing in the customer app links here. Data is protected by firestore.rules
 * (only accounts listed in owners/{uid} can see orders or change the menu).
 */
import { render } from 'preact';
import { createStore } from './data';
import { KitchenApp } from './pages/owner/Kitchen';
import { boot } from './state/app';
import { setScope } from './state/router';
import { Toast } from './ui/kit';
import './styles.css';

setScope(p => p === '/admin' || p.startsWith('/admin/'));

const root = document.getElementById('app')!;
root.textContent = '';
render(<><KitchenApp /><Toast /></>, root);
void boot(createStore);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
