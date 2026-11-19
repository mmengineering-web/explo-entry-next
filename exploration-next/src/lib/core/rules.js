// Declarative form rules. A form says WHAT changes with what; this file does the changing.
// No eval: a condition is plain JSON, so rules can later come from the database (exp_form_def) unchanged.
//
//   cond  = { field, eq | ne | in | gt | gte | lt | lte | filled }   compare one field
//         | { fn: 'name', arg? }                                      call a named predicate from `preds`
//         | { all: [cond] } | { any: [cond] } | { not: cond }
//   rule  = { target: '#corebox', showIf?: cond, requiredIf?: cond, enableIf?: cond }
//
// Hidden targets collapse with a height animation, are made inert (no focus, no tab stop) and lose
// `required`, so a hidden field can never block saving. Their values are kept, never cleared.

const toNum = v => (v === '' || v == null) ? null : Number(String(v).replace(',', '.'));

export function evalCond(c, get, preds = {}) {
  if (!c) return true;
  if (c.all) return c.all.every(x => evalCond(x, get, preds));
  if (c.any) return c.any.some(x => evalCond(x, get, preds));
  if (c.not) return !evalCond(c.not, get, preds);
  if (c.fn) return !!preds[c.fn]?.(get, c.arg);
  const v = get(c.field), s = String(v ?? '').trim(), n = toNum(v);
  if ('eq' in c) return s === String(c.eq);
  if ('ne' in c) return s !== String(c.ne);
  if ('in' in c) return c.in.map(String).includes(s);
  if ('filled' in c) return (s !== '') === !!c.filled;
  if ('gt' in c) return n != null && n > c.gt;
  if ('gte' in c) return n != null && n >= c.gte;
  if ('lt' in c) return n != null && n < c.lt;
  if ('lte' in c) return n != null && n <= c.lte;
  return true;
}

const controlsOf = el => el.matches('input,select,textarea') ? [el] : [...el.querySelectorAll('input,select,textarea')];

function wrap(el) {
  if (el.parentElement?.classList.contains('dyn-in')) return el.parentElement.parentElement;
  const w = document.createElement('div'), inner = document.createElement('div');
  w.className = 'dyn'; w.dataset.open = 'true'; inner.className = 'dyn-in';
  el.replaceWith(w); w.append(inner); inner.append(el);
  return w;
}

/** Wire `rules` to `form`. Returns { run, isOpen(selector) }. Call run() after you change values by code. */
export function bindRules(form, rules, { preds = {} } = {}) {
  const get = name => { const e = form.elements[name]; if (!e) return ''; return e.type === 'checkbox' ? e.checked : e.value; };
  const items = rules.map(r => {
    const el = form.querySelector(r.target); if (!el) return null;
    const box = r.showIf ? wrap(el) : null;
    controlsOf(el).forEach(c => { c.dataset.req0 = c.required ? '1' : ''; });
    return { r, el, box };
  }).filter(Boolean);

  function run() {
    for (const { r, el, box } of items) {
      const open = r.showIf ? evalCond(r.showIf, get, preds) : true;
      if (box && (box.dataset.open === 'true') !== open) {
        box.dataset.open = String(open);
        box.toggleAttribute('inert', !open);
        box.setAttribute('aria-hidden', String(!open));
      }
      const need = open && (r.requiredIf ? evalCond(r.requiredIf, get, preds) : null);
      for (const c of controlsOf(el)) {
        if (r.requiredIf || box) {
          const base = c.dataset.req0 === '1';
          const req = !open ? false : (r.requiredIf ? !!need : base);
          c.required = req; req ? c.setAttribute('aria-required', 'true') : c.removeAttribute('aria-required');
        }
        if (r.enableIf) c.disabled = !evalCond(r.enableIf, get, preds);
      }
    }
  }
  form.addEventListener('input', run); form.addEventListener('change', run);
  run();
  // transitions start only after the first pass, so a form never animates on its own first paint
  requestAnimationFrame(() => items.forEach(i => i.box?.classList.add('dyn-anim')));
  return { run, isOpen: sel => { const it = items.find(i => i.r.target === sel); return !it?.box || it.box.dataset.open === 'true'; } };
}
