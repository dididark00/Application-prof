// Générateurs d'exercices sans IA : calculs, problèmes, dictées de mots par son, fiches de fluence.
// Tirages reproductibles (graine) : la même graine redonne exactement la même fiche et son corrigé.

export function rng(seed) {
  let s = (Number(seed) >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, list) => list[Math.floor(r() * list.length)];
export const fr = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ───── Calculs
const noCarry = (a, b) => { while (a || b) { if ((a % 10) + (b % 10) > 9) return false; a = Math.floor(a / 10); b = Math.floor(b / 10); } return true; };
const noBorrow = (a, b) => { while (b) { if ((a % 10) < (b % 10)) return false; a = Math.floor(a / 10); b = Math.floor(b / 10); } return true; };
/**
 * o = { ops: ['+','-','×','÷'], min, max, count, seed, sansRetenue, tables: [2..10] }
 * Renvoie [{ a, b, op, res, text }].
 */
export function calculs(o) {
  const r = rng(o.seed); const out = []; const ops = o.ops?.length ? o.ops : ['+'];
  const min = Math.max(0, Number(o.min) || 0), max = Math.max(min + 1, Number(o.max) || 20);
  let guard = 0;
  while (out.length < (o.count || 10) && guard++ < 5000) {
    const op = pick(r, ops); let a, b, res;
    if (op === '+') { a = int(r, min, max); b = int(r, min, max); if (o.sansRetenue && !noCarry(a, b)) continue; res = a + b; }
    else if (op === '-') { a = int(r, min, max); b = int(r, min, max); if (b > a) [a, b] = [b, a]; if (o.sansRetenue && !noBorrow(a, b)) continue; res = a - b; }
    else if (op === '×') { const t = o.tables?.length ? o.tables : null; a = t ? pick(r, t) : int(r, Math.max(min, 1), max); b = t ? int(r, 1, 10) : int(r, 1, 10); if (r() < 0.5) [a, b] = [b, a]; res = a * b; }
    else { const t = o.tables?.length ? o.tables : [2, 3, 4, 5, 6, 7, 8, 9]; b = pick(r, t); res = int(r, 1, 10); a = b * res; }
    const text = `${fr(a)} ${op === '-' ? '−' : op} ${fr(b)}`;
    if (out.some(x => x.text === text)) continue;
    out.push({ a, b, op, res, text });
  }
  return out;
}

// ───── Problèmes (modèles à trous, nombres tirés selon le niveau)
const PRENOMS = ['Léa', 'Tom', 'Inès', 'Hugo', 'Jade', 'Nathan', 'Lina', 'Adam', 'Zoé', 'Malo', 'Rose', 'Sacha'];
const FILLES = ['Léa', 'Inès', 'Jade', 'Lina', 'Zoé', 'Rose'];
const de = (w) => (/^[aeiouyéèêh]/i.test(w) ? 'd’' : 'de ');
const que = (w) => (/^[aeiouyéèêh]/i.test(w) ? 'qu’' : 'que ');
const pron = (p) => (FILLES.includes(p) ? 'elle' : 'il');
const OBJETS = [['billes', 'bille'], ['images', 'image'], ['cartes', 'carte'], ['crayons', 'crayon'], ['timbres', 'timbre'], ['coquillages', 'coquillage']];
export const PROBLEM_TYPES = {
  ajout: { label: 'Addition : ajout', make: (r, m) => { const p = pick(r, PRENOMS), [o] = pick(r, OBJETS), a = int(r, 2, m), b = int(r, 2, m); return { q: `${p} a ${fr(a)} ${o}. On lui en donne ${fr(b)}. Combien ${de(o)}${o} a-t-${pron(p)} maintenant ?`, c: `${fr(a)} + ${fr(b)} = ${fr(a + b)}`, rep: `${fr(a + b)} ${o}` }; } },
  retrait: { label: 'Soustraction : retrait', make: (r, m) => { const p = pick(r, PRENOMS), [o] = pick(r, OBJETS), a = int(r, 5, m), b = int(r, 1, a - 1); return { q: `${p} avait ${fr(a)} ${o}. ${p} en perd ${fr(b)}. Combien ${de(o)}${o} lui reste-t-il ?`, c: `${fr(a)} − ${fr(b)} = ${fr(a - b)}`, rep: `${fr(a - b)} ${o}` }; } },
  comparaison: { label: 'Soustraction : comparaison', make: (r, m) => { const p1 = pick(r, PRENOMS); const p2 = pick(r, PRENOMS.filter(x => x !== p1)); const [o] = pick(r, OBJETS); const a = int(r, 5, m), b = int(r, 1, a - 1); return { q: `${p1} a ${fr(a)} ${o} et ${p2} en a ${fr(b)}. Combien ${de(o)}${o} ${p1} a-t-${pron(p1)} de plus ${que(p2)}${p2} ?`, c: `${fr(a)} − ${fr(b)} = ${fr(a - b)}`, rep: `${fr(a - b)} ${o} de plus` }; } },
  groupes: { label: 'Multiplication : groupes égaux', make: (r, m) => { const n = int(r, 2, Math.min(10, Math.max(3, Math.floor(m / 5)))), k = int(r, 2, 10); const [o] = pick(r, OBJETS); return { q: `Il y a ${n} boîtes de ${k} ${o}. Combien y a-t-il ${de(o)}${o} en tout ?`, c: `${n} × ${k} = ${n * k}`, rep: `${n * k} ${o}` }; } },
  partage: { label: 'Division : partage', make: (r) => { const n = int(r, 2, 9), k = int(r, 2, 10); const [o] = pick(r, OBJETS); return { q: `On partage ${n * k} ${o} entre ${n} enfants. Combien ${de(o)}${o} chaque enfant reçoit-il ?`, c: `${n * k} ÷ ${n} = ${k}`, rep: `${k} ${o} chacun` }; } },
  groupement: { label: 'Division : groupement', make: (r) => { const n = int(r, 2, 9), k = int(r, 2, 10); return { q: `On range ${n * k} œufs dans des boîtes de ${k}. Combien de boîtes faut-il ?`, c: `${n * k} ÷ ${k} = ${n}`, rep: `${n} boîtes` }; } },
  monnaie: { label: 'Monnaie', make: (r, m) => { const p = pick(r, PRENOMS); const a = int(r, 2, Math.min(m, 50)), b = int(r, 1, Math.min(m, 50)); const t = a + b; const paye = Math.ceil((t + 1) / 10) * 10; return { q: `${p} achète un livre à ${a} € et un jeu à ${b} €. ${p} paie avec ${paye} €. Combien lui rend-on ?`, c: `${a} + ${b} = ${t} ; ${paye} − ${t} = ${paye - t}`, rep: `${paye - t} €` }; } },
  duree: { label: 'Durées', make: (r) => { const h1 = int(r, 8, 15), m1 = pick(r, [0, 15, 30, 45]); const d = pick(r, [15, 30, 45, 60, 75, 90]); const end = h1 * 60 + m1 + d; const f = (x) => `${Math.floor(x / 60)} h ${String(x % 60).padStart(2, '0')}`; return { q: `Le film commence à ${f(h1 * 60 + m1)} et dure ${d} minutes. À quelle heure se termine-t-il ?`, c: `${f(h1 * 60 + m1)} + ${d} min = ${f(end)}`, rep: f(end) }; } },
  deuxetapes: { label: 'Deux étapes', make: (r, m) => { const p = pick(r, PRENOMS); const [o] = pick(r, OBJETS); const a = int(r, 10, m), b = int(r, 2, Math.floor(a / 2)), c = int(r, 2, m); return { q: `${p} a ${fr(a)} ${o}. ${p} en donne ${fr(b)} à un ami, puis en gagne ${fr(c)}. Combien ${de(o)}${o} a ${p} à la fin ?`, c: `${fr(a)} − ${fr(b)} = ${fr(a - b)} ; ${fr(a - b)} + ${fr(c)} = ${fr(a - b + c)}`, rep: `${fr(a - b + c)} ${o}` }; } },
};
export function problemes({ types, count = 5, max = 50, seed = 1 }) {
  const r = rng(seed); const ts = types?.length ? types : Object.keys(PROBLEM_TYPES); const out = [];
  for (let i = 0; i < count; i++) out.push({ type: ts[i % ts.length], ...PROBLEM_TYPES[ts[i % ts.length]].make(r, Math.max(10, Number(max) || 50)) });
  return out;
}

// ───── Dictées de mots classés par son (banque écrite pour l'application, niveau CP–CE2)
export const SONS = {
  '[ou]': ['loup', 'roue', 'poule', 'bouche', 'route', 'mouton', 'genou', 'nounours', 'soupe', 'trousse', 'journal', 'fourmi'],
  '[on]': ['bonbon', 'maison', 'pont', 'ballon', 'monde', 'ombre', 'concombre', 'salon', 'poisson', 'garçon', 'montagne', 'nombre'],
  '[an] (an, en)': ['maman', 'enfant', 'dent', 'chanson', 'jambe', 'vent', 'pantalon', 'tempête', 'éléphant', 'orange', 'lampe', 'temps'],
  '[in] (in, ain, ein)': ['lapin', 'pain', 'sapin', 'main', 'jardin', 'peinture', 'train', 'timbre', 'matin', 'demain', 'dessin', 'plein'],
  '[oi]': ['roi', 'poisson', 'étoile', 'boîte', 'noisette', 'voiture', 'mouchoir', 'armoire', 'bois', 'soir', 'trois', 'oiseau'],
  '[ch]': ['chat', 'chemise', 'cheval', 'chocolat', 'vache', 'bouche', 'niche', 'chapeau', 'chaise', 'marché', 'mouche', 'cloche'],
  '[j] (j, g, ge)': ['jardin', 'jupe', 'girafe', 'page', 'genou', 'pigeon', 'nageur', 'bougie', 'orange', 'jouet', 'gilet', 'neige'],
  '[gn]': ['montagne', 'araignée', 'champignon', 'ligne', 'peigne', 'signe', 'agneau', 'cygne', 'campagne', 'gagner', 'baignoire', 'vigne'],
  '[eu]': ['feu', 'bleu', 'jeudi', 'cheveu', 'fleur', 'neuf', 'peur', 'beurre', 'docteur', 'œuf', 'cœur', 'heure'],
  '[é] (é, er, ez)': ['bébé', 'école', 'été', 'nez', 'chanter', 'café', 'épée', 'vélo', 'boulanger', 'clé', 'assez', 'dîner'],
  '[è] (è, ê, ai, ei, et)': ['mère', 'fête', 'lait', 'neige', 'forêt', 'chaise', 'reine', 'jouet', 'tête', 'balai', 'poulet', 'rivière'],
  '[s] (s, ss, c, ç)': ['sac', 'poisson', 'ciel', 'glaçon', 'tasse', 'cerise', 'leçon', 'salade', 'police', 'garçon', 'brosse', 'pouce'],
  '[z] (s, z)': ['zèbre', 'rose', 'cousin', 'maison', 'zoo', 'oiseau', 'chemise', 'douze', 'valise', 'musique', 'ciseaux', 'onze'],
  '[k] (c, qu, k)': ['canard', 'quatre', 'kiwi', 'coq', 'requin', 'lac', 'képi', 'question', 'école', 'masque', 'kangourou', 'sucre'],
  '[f] (f, ph)': ['farine', 'phoque', 'fusée', 'éléphant', 'girafe', 'photo', 'café', 'dauphin', 'fenêtre', 'phare', 'neuf', 'fourmi'],
};
export function dictee({ sons, count = 10, seed = 1 }) {
  const r = rng(seed); const pool = (sons?.length ? sons : Object.keys(SONS)).flatMap(s => SONS[s].map(w => ({ w, s })));
  const out = []; const seen = new Set();
  for (let g = 0; out.length < Math.min(count, pool.length) && g < 2000; g++) { const x = pick(r, pool); if (!seen.has(x.w)) { seen.add(x.w); out.push(x); } }
  return out;
}

// ───── Fluence : nombre de mots cumulé en fin de ligne
export const wordCount = (line) => (line.match(/[A-Za-zÀ-ÖØ-öø-ÿœŒ0-9]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿœŒ]+)*/g) || []).length;
export function fluence(text) {
  let total = 0;
  return String(text || '').split('\n').filter(l => l.trim()).map(l => { const n = wordCount(l); total += n; return { line: l.trim(), n, total }; });
}
export const mcm = (words, errors, seconds) => (seconds > 0 ? Math.round(Math.max(0, words - errors) * 60 / seconds) : 0);
