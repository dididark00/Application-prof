// Découpage syllabique du français écrit (usage scolaire), par règles, sans dictionnaire :
//  1. le mot est découpé en graphèmes : voyelles (a, é, ou, eau, ai, oi, an, on, in…) et consonnes (ch, ph, gn, qu…) ;
//  2. chaque voyelle est le noyau d'une syllabe ; entre deux noyaux, les consonnes se répartissent :
//     V-CV, VC-CV, V-CCV si le groupe est inséparable (bl, br, cl, cr, dr, fl, fr, gl, gr, pl, pr, tr, vr) ;
//  3. i, u, ou, y devant une voyelle font une seule syllabe avec elle (pia-no, nua-ge, cra-yon) ;
//  4. lettres muettes (facultatif) : consonne finale s, t, d, x, z, p, h initial.
// C'est une aide : quelques mots peuvent être mal coupés. On force un découpage en écrivant « li|on ».

const V1 = 'aeiouyéèêëàâîïôûùüœæ';
const isV = (c) => V1.includes(c);
const VOWEL_GROUPS = ['oeu', 'œu', 'eau', 'aie', 'au', 'ou', 'où', 'oû', 'oi', 'oî', 'ai', 'aî', 'ei', 'eu', 'eû', 'œ', 'ue'];
const NASALS = ['ain', 'aim', 'ein', 'eim', 'oin', 'an', 'am', 'en', 'em', 'on', 'om', 'in', 'im', 'un', 'um', 'yn', 'ym'];
const CONS_GROUPS = ['sch', 'ch', 'ph', 'th', 'gn', 'qu', 'rh'];
const INSEP = new Set(['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr', 'vr', 'kl', 'kr', 'chr', 'chl', 'phr', 'phl', 'thr']);

/** Graphèmes d'un mot (minuscules) : [{ s: début, e: fin, v: voyelle ? }] */
export function graphemes(w) {
  const out = []; let i = 0;
  while (i < w.length) {
    const rest = w.slice(i);
    let m = null;
    // gu + e/i/y : « gu » est une consonne (guitare, bague)
    if (rest.startsWith('gu') && /^[eiyéèê]/.test(w[i + 2] || '')) m = { len: 2, v: false };
    if (!m) for (const g of CONS_GROUPS) if (rest.startsWith(g)) { m = { len: g.length, v: false }; break; }
    if (!m) for (const g of NASALS) if (rest.startsWith(g)) {
      const next = w[i + g.length] || '';
      // Nasale seulement si elle n'est pas suivie d'une voyelle ni d'un autre n/m (ananas, bonne, immense).
      if (!isV(next) && next !== 'n' && next !== 'm') { m = { len: g.length, v: true }; break; }
    }
    if (!m) for (const g of VOWEL_GROUPS) if (rest.startsWith(g)) {
      if (g === 'ue' && !/[qg]/.test(w[i - 1] || '')) continue;
      m = { len: g.length, v: true }; break;
    }
    if (!m) m = { len: 1, v: isV(w[i]) };
    out.push({ s: i, e: i + m.len, v: m.v });
    i += m.len;
  }
  const txt = (g) => w.slice(g.s, g.e);
  // e final (ou es, ent) après une voyelle : muet, pas de syllabe (pluie, joue, Marie).
  const last = out.length - 1;
  const tail = txt(out[last]) === 's' || (txt(out[last]) === 't' && txt(out[last - 1] || { s: 0, e: 0 }) === 'n') ? (txt(out[last]) === 's' ? last - 1 : last - 2) : last;
  if (tail > 0 && txt(out[tail]) === 'e' && out[tail - 1].v) out[tail].v = false;
  // i devant l/ll final après une voyelle : consonne (soleil, feuille, grenouille).
  for (let k = 1; k < out.length - 1; k++) if (txt(out[k]) === 'i' && out[k - 1].v && txt(out[k + 1]) === 'l') { out[k].v = false; out[k].glide = false; }
  // i, u, ou, y suivis d'une voyelle : semi-voyelle, rattachée à la syllabe suivante (pia-no, ca-mion, nua-ge).
  for (let k = 0; k < out.length - 1; k++) {
    const g = txt(out[k]);
    if (out[k].v && ['i', 'u', 'ou', 'y', 'ï'].includes(g) && out[k + 1].v && !(g === 'y' && k === 0)) { out[k].v = false; out[k].glide = true; }
  }
  return out;
}

/** Découpe un mot en syllabes : tableau de [début, fin] dans le mot. */
export function syllabify(word) {
  const w = word.toLowerCase();
  if (w.includes('|')) { const parts = []; let p = 0; for (const s of word.split('|')) { parts.push([p, p + s.length]); p += s.length; } return parts; }
  const gs = graphemes(w);
  const nuclei = gs.map((g, i) => (g.v ? i : -1)).filter(i => i >= 0);
  if (nuclei.length <= 1) return [[0, w.length]];
  const cuts = [];
  for (let n = 0; n < nuclei.length - 1; n++) {
    const a = nuclei[n], b = nuclei[n + 1];
    const cons = gs.slice(a + 1, b);
    // k = nombre de graphèmes consonnes qui partent avec la syllabe suivante
    const glide = cons.length && cons[cons.length - 1].glide ? 1 : 0;
    const base = cons.slice(0, cons.length - glide);
    let k;
    if (base.length === 0) k = 0;
    else if (base.length === 1) k = 1;
    else k = INSEP.has(base.slice(-2).map(g => w.slice(g.s, g.e)).join('')) ? 2 : 1;
    k += glide;
    const cutAt = k === 0 ? (cons.length ? cons[cons.length - 1].e : gs[b].s) : cons[cons.length - k].s;
    cuts.push(cutAt);
  }
  const parts = []; let p = 0;
  for (const c of cuts) { parts.push([p, c]); p = c; }
  parts.push([p, w.length]);
  return parts;
}

/** Lettres muettes probables (indices dans le mot). */
export function silent(word) {
  const w = word.toLowerCase(); const out = new Set();
  if (w.length > 2) {
    let i = w.length - 1;
    if ('stdxzp'.includes(w[i]) && !['bus', 'ours', 'as', 'os', 'fils', 'tennis', 'cactus', 'net', 'sept', 'huit', 'est', 'ouest', 'sud', 'août'].includes(w)) {
      out.add(i);
      if ('st'.includes(w[i]) && 'tdp'.includes(w[i - 1]) && isV(w[i - 2])) out.add(i - 1); // « longs », « temps »
    }
  }
  if (w[0] === 'h') out.add(0);
  return out;
}

/** Découpe un texte : [{ text, word: bool, syl: [[s,e]], silent: Set }] */
export function analyse(text) {
  const out = [];
  const re = /[A-Za-zÀ-ÖØ-öø-ÿœŒæÆ|]+/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), word: false });
    const raw = m[0];
    out.push({ text: raw.replace(/\|/g, ''), raw, word: true, syl: syllabify(raw), silent: raw.includes('|') ? new Set() : silent(raw) });
    last = m.index + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false });
  return out;
}
export const hyphenate = (word) => syllabify(word).map(([s, e]) => word.replace(/\|/g, '').slice(s, e)).join('-');
