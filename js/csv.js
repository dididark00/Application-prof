// CSV compatible avec Excel/LibreOffice en français (séparateur « ; », encodage UTF-8 avec BOM).

export function toCsv(rows, sep = ';') {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r,\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map(r => r.map(esc).join(sep)).join('\r\n');
}

/** Analyse un texte CSV ; détecte le séparateur (; , tabulation). */
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const counts = { ';': (firstLine.match(/;/g) || []).length, ',': (firstLine.match(/,/g) || []).length, '\t': (firstLine.match(/\t/g) || []).length };
  const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ';';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c !== ''));
}

/** Convertit une date saisie (JJ/MM/AAAA, AAAA-MM-JJ) en AAAA-MM-JJ, ou null si invalide. */
export function parseDateFr(s) {
  if (!s) return '';
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  let y, mo, d;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

/** Repère les colonnes prénom / nom / naissance / niveau dans une ligne d'en-tête. */
export function detectColumns(header) {
  const map = {};
  header.forEach((hd, i) => {
    const n = norm(hd);
    if (map.firstName == null && /^prenom/.test(n)) map.firstName = i;
    else if (map.lastName == null && /^nom/.test(n) && !/prenom/.test(n)) map.lastName = i;
    else if (map.birthDate == null && /(naissance|^ne|datenais)/.test(n)) map.birthDate = i;
    else if (map.level == null && /(niveau|classe)/.test(n)) map.level = i;
  });
  return map;
}
