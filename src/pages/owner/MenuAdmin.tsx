import { useSignal } from '@preact/signals';
import type { Menu, MenuItem } from '../../data/types';
import { rupees } from '../../lib/format';
import { bulkPrice, LOW_STOCK, stockLeft } from '../../lib/pricing';
import { cleanText } from '../../lib/validate';
import { menu, store } from '../../state/app';
import { Btn, Field, Sheet, Switch, VegMark } from '../../ui/kit';
import { act } from './OrderSheet';

const blank = (category: string): MenuItem => ({ id: '', name: '', nameOr: '', desc: '', price: 0, veg: true, category, tag: '', available: true, stock: null, hidden: false });

export type StockState = 'ok' | 'low' | 'out' | 'hidden';
export function stockState(i: MenuItem): StockState {
  if (i.hidden) return 'hidden';
  const left = stockLeft(i);
  if (!i.available || left === 0) return 'out';
  if (left !== null && left <= LOW_STOCK) return 'low';
  return 'ok';
}
export const lowStockCount = (m: Menu) => m.items.filter(i => stockState(i) === 'low').length;

const FILTERS: { k: 'all' | StockState; label: string }[] = [
  { k: 'all', label: 'All' }, { k: 'out', label: 'Sold out' }, { k: 'low', label: 'Low stock' }, { k: 'hidden', label: 'Hidden' },
];

const save = (next: Menu, ok?: string) => act(() => store.value!.saveMenu(next), ok);
const patchItem = (id: string, p: Partial<MenuItem>, ok?: string) => {
  const m = menu.value;
  return save({ ...m, items: m.items.map(i => (i.id === id ? { ...i, ...p } : i)) }, ok);
};

export function MenuAdmin() {
  const editing = useSignal<MenuItem | null>(null);
  const cats = useSignal(false);
  const bulk = useSignal(false);
  const q = useSignal('');
  const filter = useSignal<'all' | StockState>('all');
  const m = menu.value;
  const count = (k: StockState) => m.items.filter(i => stockState(i) === k).length;
  const term = q.value.trim().toLowerCase();
  const shown = (i: MenuItem) => (filter.value === 'all' || stockState(i) === filter.value) && (!term || `${i.name} ${i.desc}`.toLowerCase().includes(term));
  const anyShown = m.items.some(shown);

  const resetDay = () => save({ ...m, items: m.items.map(i => (i.available ? i : { ...i, available: true })) }, 'All dishes switched back on');

  return (
    <div class="stack lg">
      <div class="row between">
        <div>
          <h2 style={{ fontSize: '20px' }}>Menu &amp; stock</h2>
          <div class="muted small">{m.items.length} dishes · {count('out')} sold out · {count('low')} low · {count('hidden')} hidden</div>
        </div>
        <div class="row">
          <Btn variant="ghost" small onClick={() => { cats.value = true; }}>Categories</Btn>
          <Btn variant="ghost" small onClick={() => { bulk.value = true; }}>Change prices</Btn>
          <Btn small onClick={() => { editing.value = blank(m.categories[0] ?? 'Menu'); }}>+ Add dish</Btn>
        </div>
      </div>

      {m.items.some(i => !i.available) && (
        <div class="banner warn"><div class="grow"><b>{m.items.filter(i => !i.available).length} dishes switched off</b>Starting a new night? Switch them all back on in one tap.</div><Btn variant="ghost" small onClick={resetDay}>Reset sold out</Btn></div>
      )}

      <div class="segtabs" role="group" aria-label="Show dishes">
        {FILTERS.map(f => (
          <button key={f.k} type="button" aria-pressed={filter.value === f.k} onClick={() => { filter.value = f.k; }}>
            {f.label}{f.k !== 'all' && count(f.k) > 0 && <span class="count">{count(f.k)}</span>}
          </button>
        ))}
      </div>
      <input type="search" placeholder="Find a dish" aria-label="Find a dish" value={q.value} onInput={e => { q.value = (e.target as HTMLInputElement).value; }} />
      <p class="muted small" style={{ margin: '-6px 0 0' }}>Type a new price or stock and it saves by itself. Leave stock empty if you don't want to count portions. Counted stock goes down when you accept an order and the dish turns sold out at 0.</p>

      {!anyShown && <div class="empty"><b>No dishes here</b><button type="button" class="linkbtn" onClick={() => { q.value = ''; filter.value = 'all'; }}>Show all dishes</button></div>}

      {m.categories.map(cat => {
        const all = m.items.filter(i => i.category === cat);
        const items = all.filter(shown);
        if (!items.length && (term || filter.value !== 'all')) return null;
        return (
          <section class="card" key={cat}>
            <h2>{cat} <span class="muted small">({all.length})</span></h2>
            <div>
              {items.length === 0 && <div class="muted small">No dishes yet.</div>}
              {items.map(it => <AdminRow key={it.id} it={it} onEdit={() => { editing.value = { ...it }; }} />)}
            </div>
          </section>
        );
      })}
      {editing.value && <ItemEditor key={editing.value.id || 'new'} item={editing.value} onClose={() => { editing.value = null; }} />}
      <CategoryEditor open={cats.value} onClose={() => { cats.value = false; }} />
      {bulk.value && <BulkPrices onClose={() => { bulk.value = false; }} />}
    </div>
  );
}

function AdminRow({ it, onEdit }: { it: MenuItem; onEdit: () => void }) {
  const st = stockState(it);
  const left = stockLeft(it);
  const commitPrice = (el: HTMLInputElement) => {
    const n = Math.round(Number(el.value));
    if (!el.value.trim() || !Number.isFinite(n) || n < 1 || n > 10000) { el.value = String(it.price); return; }
    if (n !== it.price) void patchItem(it.id, { price: n }, `${it.name}: ${rupees(it.price)} → ${rupees(n)}`);
  };
  const commitStock = (el: HTMLInputElement) => {
    const t = el.value.trim();
    const n = t === '' ? null : Math.max(0, Math.min(9999, Math.floor(Number(t))));
    if (n !== null && !Number.isFinite(n)) { el.value = left === null ? '' : String(left); return; }
    if (n === left) return;
    // Restocking a dish that was switched off puts it back on sale.
    void patchItem(it.id, { stock: n, ...(n && !it.available ? { available: true } : {}) }, n === null ? `${it.name}: not counting stock` : `${it.name}: ${n} left`);
  };
  return (
    <div class={`menu-admin-row s-${st}`} data-testid="admin-row">
      <button type="button" class="ma-name" onClick={onEdit} aria-label={`Edit ${it.name}`}>
        <span class="row" style={{ gap: '8px' }}><VegMark veg={it.veg} /><b>{it.name}</b>{it.tag && <span class="tag">{it.tag}</span>}</span>
        <span class="muted small">
          {st === 'out' && <span class="stk out">Sold out</span>}
          {st === 'low' && <span class="stk low">Only {left} left</span>}
          {st === 'hidden' && <span class="stk hid">Hidden from customers</span>}
          {st === 'ok' && (left === null ? 'In stock' : `${left} in stock`)}
        </span>
      </button>
      <Switch id={`av-${it.id}`} checked={it.available} onChange={v => { void patchItem(it.id, { available: v }, v ? `${it.name} back on menu` : `${it.name} marked sold out`); }} label={it.available ? 'On' : 'Off'} />
      <div class="ma-inputs">
        <label class="ma-in"><span>₹</span>
          <input key={`p${it.price}`} type="number" inputMode="numeric" min={1} max={10000} defaultValue={String(it.price)} aria-label={`Price of ${it.name}`}
            onChange={e => commitPrice(e.target as HTMLInputElement)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        </label>
        <label class="ma-in"><span>Stock</span>
          <input key={`s${left}`} type="number" inputMode="numeric" min={0} max={9999} placeholder="∞" defaultValue={left === null ? '' : String(left)} aria-label={`Stock of ${it.name}`}
            onChange={e => commitStock(e.target as HTMLInputElement)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        </label>
      </div>
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
  const left = stockLeft(d);

  const doSave = async () => {
    const e: Record<string, string> = {};
    const name = cleanText(d.name, 60);
    if (name.length < 2) e.name = 'Enter a dish name';
    else if (m.items.some(i => i.id !== d.id && i.name.toLowerCase() === name.toLowerCase())) e.name = 'A dish with this name already exists';
    if (!Number.isFinite(d.price) || d.price <= 0 || d.price > 10000) e.price = 'Enter a price between ₹1 and ₹10,000';
    if (d.oldPrice && (!Number.isFinite(d.oldPrice) || d.oldPrice <= d.price)) e.oldPrice = 'Must be more than the price, or leave empty';
    const img = (d.imageUrl ?? '').trim();
    if (img && !/^https:\/\/\S+$/.test(img)) e.imageUrl = 'Paste a link starting with https://';
    err.value = e;
    if (Object.keys(e).length) return;
    const it: MenuItem = {
      ...d, name, nameOr: cleanText(d.nameOr ?? '', 60), desc: cleanText(d.desc, 160), tag: cleanText(d.tag ?? '', 20),
      price: Math.round(d.price), oldPrice: d.oldPrice ? Math.round(d.oldPrice) : undefined, imageUrl: img || undefined,
      stock: left, id: d.id || slugId(name, m.items),
    };
    const items = d.id ? m.items.map(i => (i.id === d.id ? it : i)) : [...m.items, it];
    await act(() => store.value!.saveMenu({ ...m, items }), d.id ? 'Dish updated' : 'Dish added');
    close();
  };

  return (
    <Sheet open onClose={close} title={d.id ? 'Edit dish' : 'Add dish'}>
      <Field id="it-name" label="Dish name" error={err.value.name}><input id="it-name" type="text" maxLength={60} value={d.name} onInput={e => set({ name: (e.target as HTMLInputElement).value })} /></Field>
      <Field id="it-desc" label="Short description" hint="(optional)"><textarea id="it-desc" maxLength={160} value={d.desc} onInput={e => set({ desc: (e.target as HTMLTextAreaElement).value })} /></Field>
      <div class="grid2">
        <Field id="it-price" label="Price (₹)" error={err.value.price}><input id="it-price" type="number" inputMode="numeric" min={1} max={10000} value={d.price || ''} onInput={e => set({ price: Number((e.target as HTMLInputElement).value) })} /></Field>
        <Field id="it-cat" label="Category"><select id="it-cat" value={d.category} onChange={e => set({ category: (e.target as HTMLSelectElement).value })}>{m.categories.map(c => <option key={c}>{c}</option>)}</select></Field>
      </div>
      <div class="grid2">
        <Field id="it-old" label="Old price (₹)" hint="(optional, shows as offer)" error={err.value.oldPrice}><input id="it-old" type="number" inputMode="numeric" min={1} max={10000} value={d.oldPrice || ''} onInput={e => set({ oldPrice: Number((e.target as HTMLInputElement).value) || undefined })} /></Field>
        <Field id="it-stock" label="Stock (portions)" hint="(empty = don't count)"><input id="it-stock" type="number" inputMode="numeric" min={0} max={9999} placeholder="∞" value={left ?? ''} onInput={e => { const v = (e.target as HTMLInputElement).value.trim(); set({ stock: v === '' ? null : Math.max(0, Math.floor(Number(v)) || 0) }); }} /></Field>
      </div>
      <Field id="it-tag" label="Label" hint="(optional, e.g. Bestseller, Spicy, New)"><input id="it-tag" type="text" maxLength={20} value={d.tag} onInput={e => set({ tag: (e.target as HTMLInputElement).value })} /></Field>
      <Field id="it-img" label="Photo link" hint="(optional)" error={err.value.imageUrl}><input id="it-img" type="url" inputMode="url" placeholder="https://…" value={d.imageUrl ?? ''} onInput={e => set({ imageUrl: (e.target as HTMLInputElement).value })} /></Field>
      {d.imageUrl && /^https:\/\//.test(d.imageUrl) && <img class="ma-preview" src={d.imageUrl} alt="" loading="lazy" />}
      <Field id="it-or" label="Odia name" hint="(optional)"><input id="it-or" type="text" maxLength={60} value={d.nameOr} onInput={e => set({ nameOr: (e.target as HTMLInputElement).value })} /></Field>
      <div class="row" style={{ flexWrap: 'wrap' }}>
        <Switch id="it-veg" checked={d.veg} onChange={v => set({ veg: v })} label={d.veg ? 'Veg' : 'Non-veg'} />
        <Switch id="it-av" checked={d.available} onChange={v => set({ available: v })} label={d.available ? 'Available' : 'Sold out'} />
        <Switch id="it-show" checked={!d.hidden} onChange={v => set({ hidden: !v })} label={d.hidden ? 'Hidden' : 'Shown on menu'} />
      </div>
      <Btn block onClick={doSave}>Save dish</Btn>
      {d.id && !confirmDel.value && <Btn variant="danger" block onClick={() => { confirmDel.value = true; }}>Delete dish</Btn>}
      {confirmDel.value && (
        <div class="banner crit"><div class="grow"><b>Delete {d.name}?</b>Customers won't see it any more. Past orders keep their details. To take it off for a while, use "Hidden" instead.
          <div class="row" style={{ marginTop: '8px' }}>
            <Btn variant="danger" small onClick={async () => { await act(() => store.value!.saveMenu({ ...m, items: m.items.filter(i => i.id !== d.id) }), 'Dish deleted'); close(); }}>Yes, delete</Btn>
            <Btn variant="quiet" small onClick={() => { confirmDel.value = false; }}>Keep it</Btn>
          </div></div></div>
      )}
    </Sheet>
  );
}

function BulkPrices({ onClose }: { onClose: () => void }) {
  const m = menu.value;
  const scope = useSignal('__all');
  const mode = useSignal<'pct' | 'rs'>('pct');
  const dir = useSignal<1 | -1>(1);
  const amount = useSignal(10);
  const round = useSignal(5);
  const amt = Number.isFinite(amount.value) ? Math.abs(amount.value) * dir.value : 0;
  const targets = m.items.filter(i => scope.value === '__all' || i.category === scope.value);
  const changes = targets.map(i => ({ i, to: bulkPrice(i.price, mode.value, amt, round.value) })).filter(c => c.to !== c.i.price);
  const apply = async () => {
    const next = new Map(changes.map(c => [c.i.id, c.to]));
    await act(() => store.value!.saveMenu({ ...m, items: m.items.map(i => (next.has(i.id) ? { ...i, price: next.get(i.id)! } : i)) }), `Updated ${changes.length} prices`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Change prices">
      <Field id="bp-scope" label="Which dishes"><select id="bp-scope" value={scope.value} onChange={e => { scope.value = (e.target as HTMLSelectElement).value; }}>
        <option value="__all">All dishes ({m.items.length})</option>
        {m.categories.map(c => <option key={c} value={c}>{c} ({m.items.filter(i => i.category === c).length})</option>)}
      </select></Field>
      <div class="segtabs" role="group" aria-label="Increase or decrease">
        <button type="button" aria-pressed={dir.value === 1} onClick={() => { dir.value = 1; }}>Increase</button>
        <button type="button" aria-pressed={dir.value === -1} onClick={() => { dir.value = -1; }}>Decrease</button>
      </div>
      <div class="grid2">
        <Field id="bp-amt" label={mode.value === 'pct' ? 'By percent (%)' : 'By rupees (₹)'}><input id="bp-amt" type="number" inputMode="decimal" min={0} max={1000} value={amount.value} onInput={e => { amount.value = Number((e.target as HTMLInputElement).value); }} /></Field>
        <Field id="bp-mode" label="Change by"><select id="bp-mode" value={mode.value} onChange={e => { mode.value = (e.target as HTMLSelectElement).value as 'pct' | 'rs'; }}><option value="pct">Percent</option><option value="rs">Rupees</option></select></Field>
      </div>
      <Field id="bp-round" label="Round to"><select id="bp-round" value={round.value} onChange={e => { round.value = Number((e.target as HTMLSelectElement).value); }}><option value={1}>Nearest ₹1</option><option value={5}>Nearest ₹5</option><option value={10}>Nearest ₹10</option></select></Field>
      <div class="card tight" aria-live="polite">
        <b>{changes.length ? `${changes.length} prices will change` : 'No prices change'}</b>
        {changes.slice(0, 6).map(c => <div key={c.i.id} class="row between small"><span>{c.i.name}</span><span class="num">{rupees(c.i.price)} → <b>{rupees(c.to)}</b></span></div>)}
        {changes.length > 6 && <div class="muted small">…and {changes.length - 6} more</div>}
      </div>
      <Btn block disabled={!changes.length} onClick={apply} id="bp-apply">Apply to {changes.length} dishes</Btn>
    </Sheet>
  );
}

function CategoryEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const name = useSignal('');
  const renaming = useSignal<{ old: string; value: string } | null>(null);
  if (!open) return null;
  const m = menu.value;
  const saveCats = (categories: string[], items = m.items, ok?: string) => save({ ...m, categories, items }, ok);
  const move = (i: number, d: number) => { const c = m.categories.slice(); const j = i + d; if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; void saveCats(c); };
  const commitRename = () => {
    const r = renaming.value;
    renaming.value = null;
    if (!r) return;
    const n = cleanText(r.value, 30);
    if (!n || n === r.old || m.categories.includes(n)) return;
    void saveCats(m.categories.map(c => (c === r.old ? n : c)), m.items.map(i => (i.category === r.old ? { ...i, category: n } : i)), 'Category renamed');
  };
  const rename = (old: string) => { renaming.value = { old, value: old }; };
  const setAll = (c: string, available: boolean) => saveCats(m.categories, m.items.map(i => (i.category === c ? { ...i, available } : i)), available ? `${c}: all on` : `${c}: all sold out`);
  return (
    <Sheet open onClose={onClose} title="Categories">
      <p class="muted small" style={{ margin: 0 }}>This order is the order customers see.</p>
      {m.categories.map((c, i) => {
        const n = m.items.filter(it => it.category === c).length;
        const allOff = n > 0 && m.items.every(it => it.category !== c || !it.available);
        return (
          <div class="cat-row" key={c}>
            {renaming.value?.old === c ? (
              <span class="row grow">
                <input type="text" aria-label={`New name for ${c}`} maxLength={30} value={renaming.value.value} style={{ flex: 1 }}
                  onInput={e => { renaming.value = { old: c, value: (e.target as HTMLInputElement).value }; }}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') renaming.value = null; }} />
                <Btn small onClick={commitRename}>Save</Btn>
              </span>
            ) : <span><b>{c}</b> <span class="muted small">{n} dishes</span></span>}
            <span class="row" style={{ flexWrap: 'wrap' }}>
              <Btn variant="quiet" small onClick={() => move(i, -1)} aria-label={`Move ${c} up`} disabled={i === 0}>↑</Btn>
              <Btn variant="quiet" small onClick={() => move(i, 1)} aria-label={`Move ${c} down`} disabled={i === m.categories.length - 1}>↓</Btn>
              <Btn variant="quiet" small onClick={() => rename(c)}>Rename</Btn>
              {n > 0 && <Btn variant="quiet" small onClick={() => setAll(c, allOff)}>{allOff ? 'All on' : 'All sold out'}</Btn>}
              <Btn variant="danger" small disabled={n > 0} title={n ? 'Move or delete its dishes first' : ''} onClick={() => saveCats(m.categories.filter(x => x !== c), m.items, 'Category removed')}>Remove</Btn>
            </span>
          </div>
        );
      })}
      <div class="row">
        <input type="text" class="grow" style={{ flex: 1 }} placeholder="New category" aria-label="New category name" maxLength={30} value={name.value} onInput={e => { name.value = (e.target as HTMLInputElement).value; }} />
        <Btn onClick={() => { const n = cleanText(name.value, 30); if (n && !m.categories.includes(n)) { void saveCats([...m.categories, n], m.items, 'Category added'); name.value = ''; } }}>Add</Btn>
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
