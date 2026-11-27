// Vie de classe projetée (dans l'esprit ClassroomScreen / Digiscreen) : tirage au sort d'élèves,
// pictogrammes de travail, feu tricolore du bruit, rituels du matin (date, jour d'école, météo).
// Tout est calculé sur l'appareil ; l'écran projeté ne reçoit que des prénoms.
import * as store from './store.js';
import * as model from './model.js';
import * as PL from './planning.js';
import * as G from './groups.js';

/** Pictogrammes de consigne de travail, affichés en grand. */
export const PICTOS = [
  ['silence', '🤫', 'Silence'], ['chuchoter', '🔉', 'On chuchote'], ['parler', '💬', 'On peut parler'],
  ['ecouter', '👂', 'On écoute'], ['regarder', '👀', 'On regarde le tableau'], ['doigt', '✋', 'Je lève le doigt'],
  ['seul', '👤', 'Travail seul'], ['deux', '👥', 'Travail à deux'], ['groupe', '👪', 'Travail en groupe'],
  ['fini', '📖', 'J’ai fini : je lis'], ['ranger', '🧺', 'On range'], ['rang', '🚶', 'On se met en rang'],
];
export const pictoOf = (k) => { const p = PICTOS.find(x => x[0] === k); return p ? { key: p[0], emoji: p[1], label: p[2] } : null; };

export const FEUX = [['vert', 'Vert : on peut parler doucement'], ['orange', 'Orange : on chuchote'], ['rouge', 'Rouge : silence']];
/** Zone du sonomètre → couleur du feu. */
export const feuOfZone = (z) => ({ calme: 'vert', moyen: 'orange', fort: 'rouge' }[z] || null);

export const METEO = [['soleil', '☀️', 'Il fait beau'], ['nuages', '⛅', 'Il y a des nuages'], ['couvert', '☁️', 'Le ciel est couvert'], ['pluie', '🌧️', 'Il pleut'],
  ['orage', '⛈️', 'Il y a de l’orage'], ['brouillard', '🌫️', 'Il y a du brouillard'], ['neige', '❄️', 'Il neige'], ['vent', '💨', 'Il y a du vent']];
export const meteoOf = (k) => { const m = METEO.find(x => x[0] === k); return m ? { key: m[0], emoji: m[1], label: m[2] } : null; };

const cap = (s) => s.replace(/^./, c => c.toUpperCase());

/** Numéro du jour d'école dans l'année (jours de classe effectifs depuis la rentrée, celui-ci compris). */
export function schoolDayNumber(cls, date) {
  const year = cls && store.get(cls.yearId);
  const first = model.periodsOf(year)[0]?.start || year?.start;
  if (!first || date < first || !PL.isSchoolDay(cls, date).ok) return null;
  let n = 0;
  for (let d = first, i = 0; d <= date && i < 400; d = model.addDays(d, 1), i++) if (PL.isSchoolDay(cls, d).ok) n++;
  return n;
}

/** Décomposition affichée au rituel (CE2) : centaines, dizaines, unités. */
export function decompose(n) {
  const c = Math.floor(n / 100), d = Math.floor((n % 100) / 10), u = n % 10;
  return [c ? `${c} centaine${c > 1 ? 's' : ''}` : null, d ? `${d} dizaine${d > 1 ? 's' : ''}` : null, u ? `${u} unité${u > 1 ? 's' : ''}` : null].filter(Boolean).join(', ');
}

/** Texte du rituel de la date. */
export function ritual(cls, date, { meteo = null, birthdays = false } = {}) {
  const long = (d) => model.frDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const n = schoolDayNumber(cls, date);
  const md = date.slice(5);
  const anniv = birthdays ? model.studentsOfClass(cls.id, { date }).map(x => x.student).filter(s => s.birthDate?.slice(5) === md).map(s => s.firstName) : [];
  return {
    today: `Aujourd’hui, nous sommes ${long(date)}.`,
    yesterday: `Hier, c’était ${model.frDate(model.addDays(date, -1), { weekday: 'long', day: 'numeric', month: 'long' })}.`,
    tomorrow: `Demain, ce sera ${model.frDate(model.addDays(date, 1), { weekday: 'long', day: 'numeric', month: 'long' })}.`,
    dayNumber: n, dayNumberText: n ? `C’est notre ${n}${n === 1 ? 'er' : 'e'} jour d’école : ${decompose(n)}.` : '',
    meteo: meteoOf(meteo), birthdays: anniv, title: cap(model.frDate(date, { weekday: 'long' })),
  };
}

/** Élèves pouvant être tirés : inscrits ce jour, sans les absents de la journée. */
export function drawPool(cls, date) {
  const abs = G.absentsOn(cls, date);
  return model.studentsOfClass(cls.id, { date }).map(x => x.student).filter(s => !abs.has(s.id));
}

/**
 * Tire `count` élèves. Sans remise : ceux déjà passés ne sont pas retirés avant que tout le monde soit passé
 * (le tour recommence alors automatiquement). Renvoie { picked, drawn, newRound }.
 */
export function draw(pool, { count = 1, drawn = [], noRepeat = true, rnd = Math.random } = {}) {
  const ids = pool.map(s => s.id);
  let done = noRepeat ? drawn.filter(id => ids.includes(id)) : [];
  let left = ids.filter(id => !done.includes(id));
  let newRound = false;
  const picked = [];
  const take = (arr) => arr.splice(Math.floor(rnd() * arr.length), 1)[0];
  while (picked.length < Math.min(count, ids.length)) {
    if (!left.length) { newRound = true; done = []; left = ids.filter(id => !picked.includes(id)); if (!left.length) break; }
    const id = take(left); picked.push(id); done.push(id);
  }
  return { picked, drawn: noRepeat ? done : [], newRound };
}
