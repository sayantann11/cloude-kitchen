import { useSignal } from '@preact/signals';
import type { Menu, MenuItem } from '../../data/types';
import { rupees } from '../../lib/format';
import { cleanText } from '../../lib/validate';
import { menu, store } from '../../state/app';
import { Btn, Field, Sheet, Switch, VegMark } from '../../ui/kit';
import { act } from './OrderSheet';

const blank = (category: string): MenuItem => ({ id: '', name: '', nameOr: '', desc: '', price: 0, veg: true, category, tag: '', available: true });

export function MenuAdmin() {
  const editing = useSignal<MenuItem | null>(null);
  const cats = useSignal(false);
  const q = useSignal('');
  const m = menu.value;
  const save = (next: Menu, ok?: string) => act(() => store.value!.saveMenu(next), ok);
  const toggle = (it: MenuItem, v: boolean) => save({ ...m, items: m.items.map(i => (i.id === it.id ? { ...i, available: v } : i)) }, v ? `${it.name} back on menu` : `${it.name} marked sold out`);
  const soldOut = m.items.filter(i => !i.available).length;
  const term = q.value.toLowerCase();

  return (
    <div class="stack lg">
      <div class="row between">
        <div><h2 style={{ fontSize: '20px' }}>Menu</h2><div class="muted small">{m.items.length} dishes · {soldOut} sold out today</div></div>
        <div class="row">
          <Btn variant="ghost" small onClick={() => { cats.value = true; }}>Categories</Btn>
          {soldOut > 0 && <Btn variant="ghost" small onClick={() => save({ ...m, items: m.items.map(i => ({ ...i, available: true })) }, 'All dishes available')}>Reset sold out</Btn>}
          <Btn small onClick={() => { editing.value = blank(m.categories[0] ?? 'Menu'); }}>+ Add dish</Btn>
        </div>
      </div>
      <input type="search" placeholder="Find a dish" aria-label="Find a dish" value={q.value} onInput={e => { q.value = (e.target as HTMLInputElement).value; }} />
      {m.categories.map(cat => {
        const items = m.items.filter(i => i.category === cat && (!term || i.name.toLowerCase().includes(term)));
        if (!items.length && term) return null;
        return (
          <section class="card" key={cat}>
            <h2>{cat} <span class="muted small">({items.length})</span></h2>
            <div>
              {items.length === 0 && <div class="muted small">No dishes yet.</div>}
              {items.map(it => (
                <div class="menu-admin-row" key={it.id}>
                  <button type="button" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, minWidth: 0 }} onClick={() => { editing.value = { ...it }; }}>
                    <div class="row" style={{ gap: '8px' }}><VegMark veg={it.veg} /><b>{it.name}</b>{it.tag && <span class="tag">{it.tag}</span>}</div>
                    <div class="muted small">{rupees(it.price)} · tap to edit</div>
                  </button>
                  <Switch id={`av-${it.id}`} checked={it.available} onChange={v => toggle(it, v)} label={it.available ? 'On' : 'Sold out'} />
                  <span />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {editing.value && <ItemEditor key={editing.value.id || 'new'} item={editing.value} onClose={() => { editing.value = null; }} />}
      <CategoryEditor open={cats.value} onClose={() => { cats.value = false; }} />
    </div>
  );
}

function ItemEditor({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const err = useSignal<Record<string, string>>({});
  const confirmDel = useSignal(false);
  const draft = useSignal<MenuItem>({ ...item });
  const d = draft.value;
  const m = menu.value;
  const set = (p: Partial<MenuItem>) => { draft.value = { ...d, ...p }; };
  const close = () => onClose();

  const save = async () => {
    const e: Record<string, string> = {};
    const name = cleanText(d.name, 60);
    if (name.length < 2) e.name = 'Enter a dish name';
    if (!Number.isFinite(d.price) || d.price <= 0 || d.price > 10000) e.price = 'Enter a price between ₹1 and ₹10,000';
    err.value = e;
    if (Object.keys(e).length) return;
    const it: MenuItem = { ...d, name, nameOr: cleanText(d.nameOr ?? '', 60), desc: cleanText(d.desc, 160), tag: cleanText(d.tag ?? '', 20), price: Math.round(d.price), id: d.id || slugId(name, m.items) };
    const items = d.id ? m.items.map(i => (i.id === d.id ? it : i)) : [...m.items, it];
    await act(() => store.value!.saveMenu({ ...m, items }), d.id ? 'Dish updated' : 'Dish added');
    close();
  };

  return (
    <Sheet open onClose={close} title={d.id ? 'Edit dish' : 'Add dish'}>
      <Field id="it-name" label="Dish name" error={err.value.name}><input id="it-name" type="text" maxLength={60} value={d.name} onInput={e => set({ name: (e.target as HTMLInputElement).value })} /></Field>
      <Field id="it-or" label="Odia name" hint="(optional)"><input id="it-or" type="text" maxLength={60} value={d.nameOr} onInput={e => set({ nameOr: (e.target as HTMLInputElement).value })} /></Field>
      <Field id="it-desc" label="Short description"><textarea id="it-desc" maxLength={160} value={d.desc} onInput={e => set({ desc: (e.target as HTMLTextAreaElement).value })} /></Field>
      <div class="grid2">
        <Field id="it-price" label="Price (₹)" error={err.value.price}><input id="it-price" type="number" inputMode="numeric" min={1} max={10000} value={d.price || ''} onInput={e => set({ price: Number((e.target as HTMLInputElement).value) })} /></Field>
        <Field id="it-cat" label="Category"><select id="it-cat" value={d.category} onChange={e => set({ category: (e.target as HTMLSelectElement).value })}>{m.categories.map(c => <option key={c}>{c}</option>)}</select></Field>
      </div>
      <Field id="it-tag" label="Label" hint="(optional, e.g. Bestseller, Spicy)"><input id="it-tag" type="text" maxLength={20} value={d.tag} onInput={e => set({ tag: (e.target as HTMLInputElement).value })} /></Field>
      <div class="row">
        <Switch id="it-veg" checked={d.veg} onChange={v => set({ veg: v })} label={d.veg ? 'Veg' : 'Non-veg'} />
        <Switch id="it-av" checked={d.available} onChange={v => set({ available: v })} label={d.available ? 'Available' : 'Sold out'} />
      </div>
      <Btn block onClick={save}>Save dish</Btn>
      {d.id && !confirmDel.value && <Btn variant="danger" block onClick={() => { confirmDel.value = true; }}>Delete dish</Btn>}
      {confirmDel.value && (
        <div class="banner crit"><div class="grow"><b>Delete {d.name}?</b>Customers won't see it any more. Past orders keep their details.
          <div class="row" style={{ marginTop: '8px' }}>
            <Btn variant="danger" small onClick={async () => { await act(() => store.value!.saveMenu({ ...m, items: m.items.filter(i => i.id !== d.id) }), 'Dish deleted'); close(); }}>Yes, delete</Btn>
            <Btn variant="quiet" small onClick={() => { confirmDel.value = false; }}>Keep it</Btn>
          </div></div></div>
      )}
    </Sheet>
  );
}

function CategoryEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const name = useSignal('');
  const renaming = useSignal<{ old: string; value: string } | null>(null);
  if (!open) return null;
  const m = menu.value;
  const save = (categories: string[], items = m.items, ok?: string) => act(() => store.value!.saveMenu({ ...m, categories, items }), ok);
  const move = (i: number, d: number) => { const c = m.categories.slice(); const j = i + d; if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; void save(c); };
  const commitRename = () => {
    const r = renaming.value;
    renaming.value = null;
    if (!r) return;
    const n = cleanText(r.value, 30);
    if (!n || n === r.old || m.categories.includes(n)) return;
    void save(m.categories.map(c => (c === r.old ? n : c)), m.items.map(i => (i.category === r.old ? { ...i, category: n } : i)), 'Category renamed');
  };
  const rename = (old: string) => { renaming.value = { old, value: old }; };
  return (
    <Sheet open onClose={onClose} title="Categories">
      <p class="muted small" style={{ margin: 0 }}>This order is the order customers see.</p>
      {m.categories.map((c, i) => {
        const n = m.items.filter(it => it.category === c).length;
        return (
          <div class="row between" key={c}>
            {renaming.value?.old === c ? (
              <span class="row grow">
                <input type="text" aria-label={`New name for ${c}`} maxLength={30} value={renaming.value.value} style={{ flex: 1 }}
                  onInput={e => { renaming.value = { old: c, value: (e.target as HTMLInputElement).value }; }}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') renaming.value = null; }} />
                <Btn small onClick={commitRename}>Save</Btn>
              </span>
            ) : <span><b>{c}</b> <span class="muted small">{n} dishes</span></span>}
            <span class="row">
              <Btn variant="quiet" small onClick={() => move(i, -1)} aria-label={`Move ${c} up`} disabled={i === 0}>↑</Btn>
              <Btn variant="quiet" small onClick={() => move(i, 1)} aria-label={`Move ${c} down`} disabled={i === m.categories.length - 1}>↓</Btn>
              <Btn variant="quiet" small onClick={() => rename(c)}>Rename</Btn>
              <Btn variant="danger" small disabled={n > 0} title={n ? 'Move or delete its dishes first' : ''} onClick={() => save(m.categories.filter(x => x !== c), m.items, 'Category removed')}>Remove</Btn>
            </span>
          </div>
        );
      })}
      <div class="row">
        <input type="text" class="grow" style={{ flex: 1 }} placeholder="New category" aria-label="New category name" maxLength={30} value={name.value} onInput={e => { name.value = (e.target as HTMLInputElement).value; }} />
        <Btn onClick={() => { const n = cleanText(name.value, 30); if (n && !m.categories.includes(n)) { void save([...m.categories, n], m.items, 'Category added'); name.value = ''; } }}>Add</Btn>
      </div>
    </Sheet>
  );
}

function slugId(name: string, items: MenuItem[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'dish';
  let id = base; let n = 2;
  while (items.some(i => i.id === id)) id = `${base}-${n++}`;
  return id;
}
