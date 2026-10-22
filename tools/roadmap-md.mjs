// Génère FEUILLE_DE_ROUTE.md depuis js/roadmap.js (source unique, aussi affichée dans Réglages).
import { writeFileSync } from 'node:fs';
import { ROADMAP, STATUTS } from '../js/roadmap.js';

const ETAPES = { 1: 'Socle', 2: 'Préparation liée', 3: 'Usage en classe', 4: 'Organisation', 5: 'Collaboration et connexions' };
const mark = { fait: '✅', partiel: '🟡', configurer: '⚙️', afaire: '⬜' };
const counts = {};
for (const r of ROADMAP) counts[r.statut] = (counts[r.statut] || 0) + 1;

let md = `# Feuille de route — suivi de tout le cahier des charges\n\n`;
md += `Fichier généré depuis \`js/roadmap.js\` (\`node tools/roadmap-md.mjs\`). La même liste est consultable dans l’application : Réglages › Feuille de route.\n\n`;
md += `Légende : ${Object.entries(STATUTS).map(([k, l]) => `${mark[k]} ${l} (${counts[k] || 0})`).join(' · ')} — ${ROADMAP.length} entrées.\n`;
for (const [n, t] of Object.entries(ETAPES)) {
  md += `\n## Étape ${n} — ${t}\n\n| | Section | Fonction | Note |\n|---|---|---|---|\n`;
  for (const r of ROADMAP.filter(x => String(x.etape) === n)) md += `| ${mark[r.statut]} | ${r.section} | ${r.titre.replace(/\|/g, '/')} | ${r.note.replace(/\|/g, '/')} |\n`;
}
writeFileSync(new URL('../FEUILLE_DE_ROUTE.md', import.meta.url), md);
console.log(`FEUILLE_DE_ROUTE.md : ${ROADMAP.length} entrées`);
