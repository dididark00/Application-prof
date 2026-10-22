// Bouton « Ajouter » : raccourcis vers les créations réellement disponibles.
import * as model from './model.js';
import { h, modal, pickFiles, toast } from './ui.js';
import { studentDialog } from './pages/students.js';
import { noteDialog, depositFiles } from './pages/inbox.js';
import { addFiles, linkDialog } from './pages/files.js';

export function openQuickAdd() {
  let m;
  const go = (fn) => () => { m.close(); fn(); };
  const cls = model.currentClass();
  const items = [
    ['Note dans la boîte de réception', 'À classer plus tard', go(noteDialog)],
    ['Photo ou PDF dans la boîte de réception', 'Depuis l’appareil photo ou les fichiers', go(async () => depositFiles(await pickFiles({ accept: 'image/*,application/pdf,*/*' })))],
    ['Élève', cls ? `Dans ${cls.name}` : 'Créez d’abord une classe', go(() => (cls ? studentDialog(cls) : toast('Créez d’abord une classe dans Réglages › Classes.', { kind: 'error' })))],
    ['Fichier', 'Dans Fichiers et ressources', go(async () => addFiles(await pickFiles()))],
    ['Lien (Drive, Canva, site…)', 'Dans Fichiers et ressources', go(() => linkDialog(null))],
  ];
  m = modal({ title: 'Ajouter', body: h('div', { class: 'quick-list' },
    items.map(([t, d, fn]) => h('button', { class: 'quick-item', type: 'button', onclick: fn }, h('strong', {}, t), h('span', { class: 'muted' }, d))),
    h('p', { class: 'muted small' }, 'D’autres raccourcis (séance, tâche, rendez-vous, absence…) apparaîtront avec leurs modules.')) });
}
