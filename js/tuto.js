// Tutoriel : astuces affichées en haut de chaque page (désactivables) et visite guidée pas à pas.
import * as store from './store.js';
import { h } from './ui.js';

/** Astuce par page : [titre, lignes]. */
export const TIPS = {
  aujourdhui: ['Votre page d’accueil', ['« À faire aujourd’hui » : tapez une tâche puis Entrée. Cochez-la quand c’est fait.', 'À droite, la semaine (tâches et rendez-vous, « + » pour ajouter) et le plan du jour.', 'Pendant la classe, la carte « Maintenant » et le bouton « Mode en classe » ; le soir, « Pour demain ».']],
  enclasse: ['Mode en classe', ['Gros boutons pour la tablette ou le téléphone : appel, timer, projeter.', 'Pour noter au carnet : touchez un prénom, puis le motif. C’est tout.']],
  taches: ['Mes tâches', ['Calendrier de la semaine, Liste ou Archives ; deux listes : « À faire » et « À imprimer ».', 'Dans une tâche : durée estimée, priorité, « important » (remonte sur Aujourd’hui).']],
  appel: ['Appel', ['Touchez un élève pour changer son statut (présent, absent, retard).', 'Validez l’appel : il alimente le registre, la cantine et le radar.']],
  registre: ['Registre d’appel', ['Statistiques, grille du mois, absences à justifier (alerte à 4 demi-journées non justifiées).']],
  cahier: ['Cahier journal', ['« Préparer la semaine » pose l’emploi du temps et pré-remplit avec vos fiches et vos progressions.', '« Détaillé » montre programme, compétences, déroulé ; « Compact » la vue courte.', '« + Activité » ou « Plus › Modifier l’activité » pour tout renseigner ; « Vider… » pour effacer un jour, une semaine, un mois.']],
  edt: ['Emploi du temps', ['Onglets P1 à P5 ; si l’emploi du temps change en cours de période (piscine…), « + Changement à partir d’une date ».', 'Vous pouvez aussi l’importer : Préparer › Importer un tableau.']],
  sorties: ['Sorties et natation', ['Un cycle de natation crée toutes ses séances (hors vacances) dans l’agenda et le cahier journal.', 'Adultes, groupes, autorisations, check-list, appel au départ et au retour, fiche à imprimer.']],
  avancement: ['Où j’en suis', ['Avancement par discipline comparé au temps écoulé (trait vertical) et suggestions pour la suite.', 'Plus vous cochez « faite » au cahier journal, plus c’est juste.']],
  referentiels: ['Programmes et référentiels', ['Les compétences officielles se relient à vos séquences et fiches : leur couverture se suit toute seule.']],
  programmations: ['Programmations', ['Les notions par période ; leur état (prévue, commencée, terminée) se déduit du cahier journal.']],
  progressions: ['Progressions', ['Semaine par semaine, reliées aux séquences : elles servent à pré-remplir le cahier journal.']],
  sequences: ['Séquences', ['Une séquence regroupe ses séances ; reliez les compétences et la méthode de la classe.']],
  preparations: ['Fiches de séance', ['Déroulé en phases (durée, consigne), matériel, différenciation : tout s’affiche ensuite au cahier journal.']],
  methodes: ['Disciplines et méthodes', ['Notez le manuel ou la méthode de chaque discipline : proposé dans les fiches et repris pour une remplaçante.']],
  importer: ['Importer un tableau', ['Téléchargez le modèle, remplissez-le dans votre tableur, importez : aperçu avant, annulable après.']],
  atelier: ['Atelier pédagogique', ['Fiches à imprimer en taille réelle (écriture, géométrie, cartes…), avec correction.', '« Afficher en grand » : écrire au doigt, règle et rapporteur virtuels.']],
  exercices: ['Générateurs d’exercices', ['Calculs, problèmes, dictées (banque par son ou « Mes mots »), fluence ; corrigé séparé.']],
  eleves: ['Élèves', ['Une fiche par élève : contacts, documents, suivi, besoins, vie scolaire, échanges.']],
  radar: ['Radar élèves', ['Repère un élève qui cumule plusieurs signaux (absences, carnet, non acquis…). Rien n’est montré ailleurs.']],
  plan: ['Plan de classe', ['« + Ajouter » : tables, rangements, espaces ; taille avec L et P ou le coin orange ; taille de la salle en cm.']],
  messages: ['Carnet et comportement', ['« Noter » : un ou plusieurs élèves, un motif, et si un mot est écrit dans le carnet.', 'Les mots à faire signer et le bilan par élève se font tout seuls.']],
  recreation: ['Surveillances', ['Récréations et accueils (8 h 20, 13 h 20) ; « Répartir équitablement » ; cochez « c’est moi ».']],
  missions: ['Mes remplacements', ['Un remplacement crée une classe à part (élèves tapés ou lus sur une photo) ; « Terminer » la range.']],
  reglages: ['Réglages', ['Sauvegarde, synchronisation (Nuage), classes, années, apparence. Les astuces se désactivent dans Général.']],
};

/** Visite guidée : les grandes étapes, une page à la fois. */
export const TOUR = [
  ['#/aujourdhui', 'Bienvenue', 'Voici votre espace : à faire aujourd’hui, important, matériel à préparer, notes, la semaine et le plan du jour.'],
  ['#/reglages/classes', 'Votre classe', 'Commencez par l’année, la classe (niveaux, jours, binôme) et les élèves. Les données de démonstration s’enlèvent dans Réglages.'],
  ['#/edt', 'L’emploi du temps', 'Créez-le ou importez-le. Il donne les créneaux du cahier journal, période par période.'],
  ['#/importer', 'Importer vos documents', 'Programmation, progression, séquences et séances, emploi du temps : depuis un tableur, sans tout ressaisir.'],
  ['#/cahier', 'Le cahier journal', '« Préparer la semaine » le pré-remplit ; ensuite vous ajustez, cochez « faite », écrivez un bilan.'],
  ['#/avancement', 'Où j’en suis', 'L’avancement dans les programmes et des suggestions pour la suite, calculés à partir de ce que vous faites.'],
  ['#/appel', 'L’appel', 'Chaque demi-journée ; il alimente le registre, la cantine et le radar.'],
  ['#/messages', 'Carnet et comportement', 'Noter en deux gestes, suivre les mots à faire signer, faire le bilan par élève.'],
  ['#/enclasse', 'Le mode en classe', 'Un écran simple pour la tablette pendant la journée.'],
  ['#/sorties', 'Sorties et natation', 'Tout pour une sortie ou un cycle : dates, adultes, groupes, autorisations, appel.'],
  ['#/taches', 'Mes tâches', 'Calendrier, listes « À faire » et « À imprimer », durée estimée et priorité.'],
  ['#/recherche', 'La recherche', 'Tapez « noter », « natation », « appel »… : le bon formulaire s’ouvre directement.'],
  ['#/reglages/sauvegarde', 'Sauvegarder', 'Vos données restent sur l’appareil : exportez une sauvegarde régulièrement, ou synchronisez avec Nuage.'],
];

const tipsOn = () => store.getSettings().tips !== false;
const dismissed = () => new Set(store.getSettings().tipsDismissed || []);

/** Carte d'astuce pour la page (null si désactivé ou déjà vu). */
export function tipFor(route) {
  const t = TIPS[route];
  if (!t || !tipsOn() || dismissed().has(route) || tourStep() != null) return null;
  return h('aside', { class: 'tip-card', 'data-testid': 'tip-card', role: 'note' },
    h('strong', {}, `💡 ${t[0]}`), h('ul', {}, t[1].map(x => h('li', {}, x))),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-small', type: 'button', 'data-testid': 'tip-ok', onclick: () => store.setSettings({ tipsDismissed: [...dismissed(), route] }) }, 'Compris'),
      h('button', { class: 'btn btn-small btn-link', type: 'button', 'data-testid': 'tip-off', onclick: () => store.setSettings({ tips: false }) }, 'Ne plus afficher les astuces'),
      h('button', { class: 'btn btn-small btn-link', type: 'button', onclick: () => startTour() }, 'Visite guidée')));
}

// ───── Visite guidée (l'étape en cours est gardée sur l'appareil)
const KEY = 'classeur.tour';
export function tourStep() { try { const v = localStorage.getItem(KEY); return v == null ? null : Number(v); } catch { return null; } }
function setStep(i) { try { if (i == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(i)); } catch { /* */ } }
export function startTour(i = 0) { setStep(i); location.hash = TOUR[i][0]; mountTour(); }
export function stopTour() { setStep(null); document.getElementById('tour-panel')?.remove(); }
export function mountTour() {
  const i = tourStep(); document.getElementById('tour-panel')?.remove();
  if (i == null || !TOUR[i]) return;
  const [, title, text] = TOUR[i];
  const go = (k) => { if (k < 0 || k >= TOUR.length) { stopTour(); return; } startTour(k); };
  document.body.append(h('div', { id: 'tour-panel', class: 'tour-panel', role: 'dialog', 'aria-label': 'Visite guidée', 'data-testid': 'tour-panel' },
    h('div', { class: 'muted small' }, `Visite guidée · ${i + 1} / ${TOUR.length}`), h('strong', {}, title), h('p', {}, text),
    h('div', { class: 'row' },
      i > 0 ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => go(i - 1) }, 'Précédent') : null,
      i < TOUR.length - 1 ? h('button', { class: 'btn btn-small btn-primary', type: 'button', 'data-testid': 'tour-next', onclick: () => go(i + 1) }, 'Suivant') : h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: stopTour }, 'Terminer'),
      h('button', { class: 'btn btn-small btn-link', type: 'button', 'data-testid': 'tour-stop', onclick: stopTour }, 'Quitter la visite'))));
}
