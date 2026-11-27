import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { toast } from '../state/app';

export function VegMark({ veg }: { veg: boolean }) {
  return <span class={`vmark ${veg ? '' : 'nv'}`} role="img" aria-label={veg ? 'Veg' : 'Non-veg'} title={veg ? 'Veg' : 'Non-veg'} />;
}

export function Stepper({ qty, onChange, label }: { qty: number; onChange: (q: number) => void; label: string }) {
  return (
    <div class="stepper" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" onClick={() => onChange(qty - 1)} aria-label={`Remove one ${label}`}>−</button>
      <span aria-live="polite">{qty}</span>
      <button type="button" onClick={() => onChange(qty + 1)} aria-label={`Add one more ${label}`} disabled={qty >= 20}>+</button>
    </div>
  );
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('noscroll');
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.sheet-x)')?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('noscroll'); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div class="sheet-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div class="sheet-h">
          <h2>{title}</h2>
          <button type="button" class="sheet-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div class="sheet-b">{children}</div>
      </div>
    </div>
  );
}

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return <div key={t.id} class={`toast ${t.kind}`} role="status" aria-live="polite">{t.msg}</div>;
}

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: ComponentChildren; id: string }) {
  return (
    <div class={`field ${error ? 'has-err' : ''}`}>
      <label for={id}>{label}{hint && <span class="hint"> {hint}</span>}</label>
      {children}
      {error && <div class="err" id={`${id}-err`} role="alert">{error}</div>}
    </div>
  );
}

export function Btn(p: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; small?: boolean; busy?: boolean; block?: boolean }) {
  const { variant = 'primary', small, busy, block, class: cls, children, disabled, ...rest } = p;
  return (
    <button type="button" {...rest} disabled={disabled || busy} class={`btn ${variant} ${small ? 'small' : ''} ${block ? 'block' : ''} ${cls ?? ''}`} aria-busy={busy}>
      {busy && <span class="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Empty({ title, children }: { title: string; children?: ComponentChildren }) {
  return <div class="empty"><b>{title}</b>{children && <div>{children}</div>}</div>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div class="skel" aria-hidden="true">{Array.from({ length: lines }, (_, i) => <div key={i} />)}</div>;
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <label class="switch" for={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={e => onChange((e.target as HTMLInputElement).checked)} />
      <span class="track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

/** Copy with a fallback for browsers that refuse clipboard access. */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
