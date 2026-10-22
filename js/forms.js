// Champs à enregistrement automatique (à la sortie du champ) et sélecteurs réutilisables.
import * as store from './store.js';
import { h, modal, field, icon, toast } from './ui.js';

function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight + 2, 600)}px`; }

/**
 * Champ lié : value initiale + onSave(valeur). Enregistre à la sortie du champ.
 * type : text | textarea | number | date | time | select | checkbox
 */
export function bound({ label, value, onSave, type = 'textarea', placeholder = '', options = [], hint, testid, compact = false }) {
  let input;
  const save = async (v) => {
    try { await onSave(v); input.classList.add('saved'); setTimeout(() => input.classList.remove('saved'), 700); }
    catch (e) { toast(`Non enregistré : ${e.message}`, { kind: 'error' }); }
  };
  if (type === 'textarea') {
    input = h('textarea', { rows: compact ? 1 : 2, placeholder, 'data-testid': testid }, value ?? '');
    input.addEventListener('input', () => autoGrow(input));
    requestAnimationFrame(() => autoGrow(input));
    input.addEventListener('change', () => save(input.value));
  } else if (type === 'select') {
    input = h('select', { 'data-testid': testid }, options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o || '—']; return h('option', { value: v, selected: (value ?? '') === v }, l); }));
    input.addEventListener('change', () => save(input.value));
  } else if (type === 'checkbox') {
    input = h('input', { type: 'checkbox', checked: !!value, 'data-testid': testid });
    input.addEventListener('change', () => save(input.checked));
    return h('label', { class: 'chip' }, input, label);
  } else {
    input = h('input', { type, value: value ?? '', placeholder, 'data-testid': testid, min: type === 'number' ? 0 : null });
    input.addEventListener('change', () => save(type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value));
  }
  return label ? field(label, input, hint) : input;
}

/** Champ lié directement à une propriété d'un enregistrement. */
export function recField(id, key, def, labelPrefix = '') {
  const rec = store.get(id);
  return bound({ ...def, label: def.label, value: rec?.[key], testid: def.testid || `f-${key}`,
    onSave: (v) => store.update(id, { [key]: v }, `${labelPrefix}${def.label || key}`, { quiet: true }) });
}

/** Sélection multiple avec filtre texte. items = [{id, label, detail, group}] */
export function pickMany({ title, items, selected = [], emptyText = 'Aucun élément disponible.', single = false }) {
  return new Promise((resolve) => {
    const chosen = new Set(selected);
    let answered = false;
    const q = h('input', { type: 'search', placeholder: 'Filtrer…', 'aria-label': 'Filtrer' });
    const list = h('div', { class: 'pick-list' });
    const draw = () => {
      const t = q.value.toLowerCase();
      const shown = items.filter(i => !t || `${i.label} ${i.detail || ''} ${i.group || ''}`.toLowerCase().includes(t));
      let lastGroup = null;
      list.replaceChildren(...(shown.length ? shown.flatMap(i => {
        const out = [];
        if (i.group && i.group !== lastGroup) { out.push(h('p', { class: 'pick-group' }, i.group)); lastGroup = i.group; }
        out.push(h('label', { class: 'pick-item' },
          h('input', { type: single ? 'radio' : 'checkbox', name: 'pick', checked: chosen.has(i.id), onchange: (e) => {
            if (single) { chosen.clear(); chosen.add(i.id); } else e.target.checked ? chosen.add(i.id) : chosen.delete(i.id);
          } }),
          h('span', {}, h('strong', {}, i.label), i.detail ? h('span', { class: 'muted small' }, ` — ${i.detail}`) : null)));
        return out;
      }) : [h('p', { class: 'muted' }, emptyText)]));
    };
    q.addEventListener('input', draw);
    draw();
    modal({ title, wide: true, body: h('div', { class: 'form' }, items.length > 6 ? q : null, list), onClose: () => { if (!answered) resolve(null); },
      actions: [{ label: 'Annuler', onClick: () => { answered = true; resolve(null); } },
        { label: 'Valider', primary: true, onClick: () => { answered = true; resolve([...chosen]); } }] });
  });
}

/** Petit bouton icône. */
export function iconBtn(name, label, onclick, extra = {}) {
  return h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onclick, ...extra }, icon(name, 16));
}

/** Section repliable. */
export function section(title, open, ...children) {
  return h('details', { class: 'section', open: open ? true : null }, h('summary', {}, h('h2', {}, title)), h('div', { class: 'section-body' }, children));
}
