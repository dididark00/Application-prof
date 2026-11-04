// Lecture d'un classeur Excel (.xlsx) dans le navigateur, sans bibliothèque externe :
// un .xlsx est une archive ZIP de fichiers XML ; on décompresse avec DecompressionStream
// (intégré aux navigateurs récents) puis on lit les feuilles avec DOMParser.
// Valeurs renvoyées en texte, telles qu'affichées (formules : dernier résultat enregistré).

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Fichiers d'une archive ZIP : nom → { method, data (compressée), size }. */
function unzipIndex(bytes) {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Ce fichier n’est pas un classeur Excel (.xlsx) lisible.');
  const count = u16(bytes, eocd + 10); let p = u32(bytes, eocd + 16);
  const dec = new TextDecoder();
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (u32(bytes, p) !== 0x02014b50) break;
    const method = u16(bytes, p + 10), csize = u32(bytes, p + 20), nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commentLen = u16(bytes, p + 32), local = u32(bytes, p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const lNameLen = u16(bytes, local + 26), lExtraLen = u16(bytes, local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    out.set(name, { method, data: bytes.subarray(start, start + csize) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
async function readEntry(index, name) {
  const e = index.get(name); if (!e) return null;
  if (e.method === 0) return new TextDecoder().decode(e.data);
  if (e.method !== 8) throw new Error('Compression non prise en charge dans ce classeur.');
  const stream = new Blob([e.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
const xml = (t) => new DOMParser().parseFromString(t, 'application/xml');
const colIndex = (ref) => { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return null; let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
const textOf = (el) => [...el.getElementsByTagName('t')].map(t => t.textContent).join('');

/** Toutes les feuilles du classeur : [{ name, rows: [[cellules en texte]] }]. */
export async function readXlsx(fileOrBuffer) {
  const buf = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
  const index = unzipIndex(new Uint8Array(buf));
  const shared = []; const ss = await readEntry(index, 'xl/sharedStrings.xml');
  if (ss) for (const si of xml(ss).getElementsByTagName('si')) shared.push(textOf(si));
  const wb = xml(await readEntry(index, 'xl/workbook.xml') || '<workbook/>');
  const rels = xml(await readEntry(index, 'xl/_rels/workbook.xml.rels') || '<Relationships/>');
  const target = {}; for (const r of rels.getElementsByTagName('Relationship')) target[r.getAttribute('Id')] = r.getAttribute('Target');
  const sheets = [];
  for (const s of wb.getElementsByTagName('sheet')) {
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let path = target[rid] || ''; path = path.startsWith('/') ? path.slice(1) : `xl/${path.replace(/^\.\//, '')}`;
    const txt = await readEntry(index, path); if (!txt) continue;
    const rows = [];
    for (const row of xml(txt).getElementsByTagName('row')) {
      const cells = [];
      let k = 0;
      for (const c of row.getElementsByTagName('c')) {
        const i = colIndex(c.getAttribute('r')) ?? k; k = i + 1;
        const t = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        cells[i] = t === 's' ? (shared[Number(v)] ?? '') : t === 'inlineStr' ? textOf(c) : t === 'b' ? (v === '1' ? 'VRAI' : 'FAUX') : v;
      }
      rows.push(Array.from(cells, x => x ?? ''));
    }
    sheets.push({ name: s.getAttribute('name') || `Feuille ${sheets.length + 1}`, rows });
  }
  return sheets;
}
