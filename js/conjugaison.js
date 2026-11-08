// Petit conjugueur pour les exercices (cycle 2 – début cycle 3) : présent, imparfait, futur, passé composé.
// 1er groupe (avec ç / ge, è, ll / tt, y → i), 2e groupe (finir), verbes en -dre (attendre), et les irréguliers
// les plus fréquents (être, avoir, aller, faire, dire, venir, prendre, pouvoir, voir, vouloir…).
// Toujours vérifier la correction : l'enseignante peut forcer une réponse avec [infinitif=forme].

export const TENSES = [['présent', 'présent'], ['imparfait', 'imparfait'], ['futur', 'futur'], ['passé composé', 'passé composé']];
const V = 'aeiouyéèêëàâîïôûù';
const IMP = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
const FUT = ['ai', 'as', 'a', 'ons', 'ez', 'ont'];
const AVOIR = ['ai', 'as', 'a', 'avons', 'avez', 'ont'];
const ETRE = ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'];
const ETRE_VERBS = new Set(['arriver', 'entrer', 'rentrer', 'rester', 'tomber', 'retomber', 'monter', 'remonter', 'retourner', 'descendre', 'redescendre', 'naître', 'décéder']);

// Irréguliers : présent (6 formes), radical de l'imparfait, radical du futur, participe passé, auxiliaire être ?
const IRR = {
  'être': [['suis', 'es', 'est', 'sommes', 'êtes', 'sont'], 'ét', 'ser', 'été'],
  avoir: [AVOIR, 'av', 'aur', 'eu'],
  aller: [['vais', 'vas', 'va', 'allons', 'allez', 'vont'], 'all', 'ir', 'allé', true],
  faire: [['fais', 'fais', 'fait', 'faisons', 'faites', 'font'], 'fais', 'fer', 'fait'],
  dire: [['dis', 'dis', 'dit', 'disons', 'dites', 'disent'], 'dis', 'dir', 'dit'],
  venir: [['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'], 'ven', 'viendr', 'venu', ['', 're', 'de', 'sur', 'par']],
  tenir: [['tiens', 'tiens', 'tient', 'tenons', 'tenez', 'tiennent'], 'ten', 'tiendr', 'tenu'],
  pouvoir: [['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'], 'pouv', 'pourr', 'pu'],
  voir: [['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'], 'voy', 'verr', 'vu'],
  vouloir: [['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'], 'voul', 'voudr', 'voulu'],
  savoir: [['sais', 'sais', 'sait', 'savons', 'savez', 'savent'], 'sav', 'saur', 'su'],
  devoir: [['dois', 'dois', 'doit', 'devons', 'devez', 'doivent'], 'dev', 'devr', 'dû'],
  prendre: [['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'], 'pren', 'prendr', 'pris'],
  mettre: [['mets', 'mets', 'met', 'mettons', 'mettez', 'mettent'], 'mett', 'mettr', 'mis'],
  lire: [['lis', 'lis', 'lit', 'lisons', 'lisez', 'lisent'], 'lis', 'lir', 'lu'],
  'écrire': [['écris', 'écris', 'écrit', 'écrivons', 'écrivez', 'écrivent'], 'écriv', 'écrir', 'écrit'],
  boire: [['bois', 'bois', 'boit', 'buvons', 'buvez', 'boivent'], 'buv', 'boir', 'bu'],
  croire: [['crois', 'crois', 'croit', 'croyons', 'croyez', 'croient'], 'croy', 'croir', 'cru'],
  courir: [['cours', 'cours', 'court', 'courons', 'courez', 'courent'], 'cour', 'courr', 'couru'],
  mourir: [['meurs', 'meurs', 'meurt', 'mourons', 'mourez', 'meurent'], 'mour', 'mourr', 'mort', true],
  ouvrir: [['ouvre', 'ouvres', 'ouvre', 'ouvrons', 'ouvrez', 'ouvrent'], 'ouvr', 'ouvrir', 'ouvert'],
  couvrir: [['couvre', 'couvres', 'couvre', 'couvrons', 'couvrez', 'couvrent'], 'couvr', 'couvrir', 'couvert'],
  offrir: [['offre', 'offres', 'offre', 'offrons', 'offrez', 'offrent'], 'offr', 'offrir', 'offert'],
  cueillir: [['cueille', 'cueilles', 'cueille', 'cueillons', 'cueillez', 'cueillent'], 'cueill', 'cueiller', 'cueilli'],
  rire: [['ris', 'ris', 'rit', 'rions', 'riez', 'rient'], 'ri', 'rir', 'ri'],
  'connaître': [['connais', 'connais', 'connaît', 'connaissons', 'connaissez', 'connaissent'], 'connaiss', 'connaîtr', 'connu'],
  'naître': [['nais', 'nais', 'naît', 'naissons', 'naissez', 'naissent'], 'naiss', 'naîtr', 'né', true],
  souffrir: [['souffre', 'souffres', 'souffre', 'souffrons', 'souffrez', 'souffrent'], 'souffr', 'souffrir', 'souffert'],
  falloir: [[null, null, 'faut', null, null, null], 'fall', 'faudr', 'fallu'],
  pleuvoir: [[null, null, 'pleut', null, null, 'pleuvent'], 'pleuv', 'pleuvr', 'plu'],
  envoyer: [['envoie', 'envoies', 'envoie', 'envoyons', 'envoyez', 'envoient'], 'envoy', 'enverr', 'envoyé'],
};
// Verbes comme partir : je pars, nous partons.
const LIKE_PARTIR = { partir: true, sortir: true, dormir: false, mentir: false, sentir: false, servir: false };
const PREFIXES = ['', 're', 'ré', 'r', 'de', 'dé', 'd', 'com', 'ap', 'sur', 'pro', 'per', 'ad', 'con', 'pré', 'ob', 'sou', 'main', 'appar', 'entre', 'par', 'res', 'en', 'dis', 'sous', 'trans', 'inter', 'pour', 'dé', 'ac', 'at', 'ré', 'mé', 'em'];

function findBase(inf, table) {
  for (const k of Object.keys(table).sort((a, b) => b.length - a.length)) {
    if (!inf.endsWith(k)) continue;
    const pre = inf.slice(0, -k.length);
    if (PREFIXES.includes(pre)) return [k, pre];
  }
  return null;
}

/** Changement de radical devant un e muet (je lève, j'appelle, je nettoie, je pénètre). */
function muteStem(stem, inf, { future = false } = {}) {
  if (/(appel|jet)$/.test(stem)) return stem + stem.at(-1);
  if (/[ou]y$|ay$/.test(stem)) return stem.slice(0, -1) + 'i';
  let m = stem.match(new RegExp(`e([^${V}])$`));
  if (m) return stem.slice(0, -2) + 'è' + m[1];
  if (!future && (m = stem.match(new RegExp(`é([^${V}]+)$`)))) return stem.slice(0, stem.length - m[0].length) + 'è' + m[1];
  void inf; return stem;
}
const soft = (stem, ending) => (/^[ao]/.test(ending) ? stem.replace(/c$/, 'ç').replace(/g$/, 'ge') : stem);

/** Description d'un verbe : formes du présent, radicaux, participe, auxiliaire. null si inconnu. */
export function verb(infinitive) {
  const inf = String(infinitive || '').trim().toLowerCase().replace(/^s['’]\s*|^se\s+/, '');
  if (!inf) return null;
  const irr = findBase(inf, IRR);
  if (irr) {
    const [k, pre] = irr; const [pres, imp, fut, pp, aux] = IRR[k];
    const etre = Array.isArray(aux) ? aux.includes(pre) : !!aux;
    return { inf, present: pres.map(f => (f ? pre + f : null)), imp: pre + imp, fut: pre + fut, pp: pre + pp, etre };
  }
  const part = findBase(inf, LIKE_PARTIR);
  if (part) {
    const base = inf.slice(0, -2); const short = base.slice(0, -1);
    return { inf, present: [short + 's', short + 's', short + 't', base + 'ons', base + 'ez', base + 'ent'], imp: base, fut: inf, pp: base + 'i', etre: LIKE_PARTIR[part[0]] && ['', 're', 'res'].includes(part[1]) };
  }
  if (inf.endsWith('er')) {
    const stem = inf.slice(0, -2);
    const present = ['e', 'es', 'e', 'ons', 'ez', 'ent'].map((e, i) => ([0, 1, 2, 5].includes(i) ? muteStem(stem, inf) : soft(stem, e)) + e);
    return { inf, present, imp: stem, fut: muteStem(stem, inf, { future: true }) + 'er', pp: stem + 'é', etre: ETRE_VERBS.has(inf), first: true };
  }
  if (inf.endsWith('ir')) {
    const stem = inf.slice(0, -2);
    return { inf, present: ['is', 'is', 'it', 'issons', 'issez', 'issent'].map(e => stem + e), imp: stem + 'iss', fut: inf, pp: stem + 'i', etre: false };
  }
  if (/[aeo]indre$/.test(inf)) { // peindre, éteindre, craindre, joindre
    const base = inf.slice(0, -3); const g = base.slice(0, -1) + 'gn';
    return { inf, present: [base + 's', base + 's', base + 't', g + 'ons', g + 'ez', g + 'ent'], imp: g, fut: inf.slice(0, -1), pp: base + 't', etre: false };
  }
  if (inf.endsWith('dre')) {
    const stem = inf.slice(0, -2);
    return { inf, present: [stem + 's', stem + 's', stem, stem + 'ons', stem + 'ez', stem + 'ent'], imp: stem, fut: inf.slice(0, -1), pp: stem + 'u', etre: ETRE_VERBS.has(inf) };
  }
  return null;
}

/**
 * Conjugue un verbe. person : 0 je, 1 tu, 2 il/elle/on, 3 nous, 4 vous, 5 ils/elles.
 * Retourne null si le verbe n'est pas reconnu.
 */
export function conjugate(infinitive, tense, person, { fem = false, reflexive = false } = {}) {
  const v = verb(infinitive); if (!v) return null;
  const p = Math.max(0, Math.min(5, person | 0));
  if (tense === 'présent') return v.present[p];
  if (tense === 'imparfait') { const e = IMP[p]; return (v.first ? soft(v.imp, e) : v.imp) + e; }
  if (tense === 'futur') return v.fut + FUT[p];
  if (tense === 'passé composé') {
    const etre = v.etre || reflexive;
    const pp = etre ? v.pp + (fem ? 'e' : '') + (p >= 3 && !v.pp.endsWith('s') ? 's' : '') : v.pp;
    return `${(etre ? ETRE : AVOIR)[p]} ${pp}`;
  }
  return null;
}

const SUBJECTS = { "j'": 0, je: 0, tu: 1, il: 2, elle: 2, on: 2, nous: 3, vous: 4, ils: 5, elles: 5 };
const SKIP = new Set(['ne', "n'", 'le', 'la', 'les', "l'", 'lui', 'leur', 'y', 'en']);
const REFL = new Set(['me', "m'", 'te', "t'", 'se', "s'"]);
const PLURAL = /^(les|des|mes|tes|ses|nos|vos|leurs|ces|plusieurs|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|\d+)$/;
const FEMININE = /^(la|une|cette|ma|ta|sa|elle|elles)$/;

/** Trouve la personne grammaticale d'après les mots qui précèdent le trou (dans la même phrase). */
export function personBefore(textBefore) {
  const sentence = String(textBefore).replace(/’/g, "'").split(/[.!?;:\n]/).at(-1).toLowerCase();
  const words = sentence.match(/[a-zà-ÿœæ0-9]+'?/g) || [];
  let reflexive = false;
  for (let i = words.length - 1; i >= 0 && i >= words.length - 5; i--) {
    const w = words[i];
    if ((w === 'nous' || w === 'vous') && words[i - 1] === w) { reflexive = true; continue; }
    if (w in SUBJECTS) return { person: SUBJECTS[w], fem: w.startsWith('elle'), reflexive, guessed: false };
    if (REFL.has(w)) { reflexive = true; continue; }
    if (SKIP.has(w)) continue;
    break;
  }
  const plural = words.some(w => PLURAL.test(w)) || (words.includes('et') && words.length > 2);
  return { person: plural ? 5 : 2, fem: words.some(w => FEMININE.test(w)), reflexive, guessed: true };
}

/**
 * Analyse un texte à trous. Chaque [ ... ] devient un trou :
 *  - [mot] : le mot est à trouver (mode « mots ») ou l'infinitif à conjuguer (mode « conjugaison ») ;
 *  - [indice=réponse] : l'indice est écrit entre parenthèses, la réponse est imposée ;
 *  - [infinitif:futur] : un autre temps pour ce verbe seulement.
 */
export function parseBlanks(source, { mode = 'mots', tense = 'présent' } = {}) {
  const blanks = []; let last = 0; const parts = [];
  const src = String(source || '');
  for (const m of src.matchAll(/\[([^\]]+)\]/g)) {
    parts.push(src.slice(last, m.index));
    let raw = m[1].trim(); let answer = null; let hint = null; let t = tense;
    const eq = raw.indexOf('=');
    if (eq >= 0) { answer = raw.slice(eq + 1).trim(); raw = raw.slice(0, eq).trim(); hint = raw; }
    const tm = raw.match(/^(.*?)\s*:\s*(présent|imparfait|futur|passé composé)$/i);
    if (tm) { raw = tm[1].trim(); t = tm[2].toLowerCase(); }
    const b = { raw, hint, answer, tense: t, guessed: false, unknown: false };
    if (mode === 'conjugaison') {
      b.hint = raw;
      if (!answer) {
        const who = personBefore(src.slice(0, m.index));
        const pronominal = /^s(e\s+|['’]\s*)/i.test(raw) && !who.reflexive;
        let ans = conjugate(raw, t, who.person, { ...who, reflexive: who.reflexive || pronominal });
        if (ans && pronominal) { const r = ['me', 'te', 'se', 'nous', 'vous', 'se'][who.person]; ans = who.person < 3 || who.person === 5 ? (/^[aeiouyéèêh]/i.test(ans) ? `${r[0]}’${ans}` : `${r} ${ans}`) : `${r} ${ans}`; }
        b.guessed = who.guessed; b.unknown = !ans; b.answer = ans || '?';
      }
      if (t !== tense) b.hint = `${raw}, ${t}`;
    } else if (!answer) b.answer = raw;
    blanks.push(b); parts.push(b);
    last = m.index + m[0].length;
  }
  parts.push(src.slice(last));
  return { blanks, parts };
}
