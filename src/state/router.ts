import { signal } from '@preact/signals';

export const path = signal(location.pathname + location.search);

export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search) return;
  if (replace) history.replaceState(null, '', to); else history.pushState(null, '', to);
  path.value = to;
  window.scrollTo({ top: 0 });
}

window.addEventListener('popstate', () => { path.value = location.pathname + location.search; });

/** Intercept same-origin <a href="/..."> clicks so navigation is instant (no reload). */
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest('a');
  if (!a || a.target || a.hasAttribute('download')) return;
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return;
  e.preventDefault();
  navigate(href);
});

export function match(pattern: string, p: string): Record<string, string> | null {
  const [pathname] = p.split('?');
  const a = pattern.split('/').filter(Boolean);
  const b = pathname.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}
