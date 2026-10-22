// Programmes officiels en vigueur — année scolaire 2026-2027.
// Sources : Éduscol, pages « Enseigner au cycle 1 / 2 / 3 » (tableaux « programmes en application »),
// consultées le 22 octobre 2026. Les liens renvoient aux textes officiels (BO) et à leurs annexes PDF.
// Ce fichier ne contient que les références (quel texte pour quel niveau) : les intitulés détaillés
// des compétences sont importés depuis le texte officiel puis vérifiés avant validation.

export const YEAR = '2026-2027';
export const CHECKED_AT = '2026-10-22';
export const EDUSCOL = {
  1: 'https://eduscol.education.gouv.fr/4341/enseigner-au-cycle-1',
  2: 'https://eduscol.education.gouv.fr/4347/enseigner-au-cycle-2',
  3: 'https://eduscol.education.gouv.fr/4356/enseigner-au-cycle-3',
};

const PDF2020_C2 = 'https://cache.media.education.gouv.fr/file/31/88/5/ensel714_annexe1_1312885.pdf';
const PDF2020_C3 = 'https://eduscol.education.gouv.fr/media/100806/download?attachment';

/** Textes officiels (référence BO). */
export const TEXTS = {
  mat2026: { title: 'Programme de l’école maternelle (cycle 1)', bo: 'BO n° 19 du 7 mai 2026', date: '2026-05-07', boUrl: 'https://www.education.gouv.fr/bo/2026/Hebdo19/MENE2608627A', pdf: 'https://eduscol.education.gouv.fr/sites/default/files/document/programme-cycle-1-consolide-127565.pdf', note: 'Version consolidée (intègre aussi le BO n° 41 du 31 octobre 2024).' },
  fm2024: { title: 'Programmes de français et de mathématiques des cycles 1 et 2', bo: 'BO n° 41 du 31 octobre 2024', date: '2024-10-31', boUrl: 'https://www.education.gouv.fr/bo/2024/Hebdo41/MENE2415135A' },
  fm2025: { title: 'Programmes de français et de mathématiques du cycle 3', bo: 'BO n° 16 du 17 avril 2025', date: '2025-04-17', boUrl: 'https://www.education.gouv.fr/bo/2025/Hebdo16/MENE2504620A' },
  eps_hg2026: { title: 'Programmes d’EPS et d’histoire-géographie des cycles 2 et 3', bo: 'BO n° 22 du 28 mai 2026', date: '2026-05-28', boUrl: 'https://www.education.gouv.fr/bo/2026/Hebdo22/MENE2608631A' },
  sciences2026: { title: 'Programmes de sciences et technologie des cycles 2 et 3', bo: 'BO n° 24 du 11 juin 2026', date: '2026-06-11', boUrl: 'https://www.education.gouv.fr/bo/2026/Hebdo24/MENE2611650A' },
  lv2026: { title: 'Programmes de langues vivantes étrangères et régionales de l’école élémentaire', bo: 'BO n° 12 du 19 mars 2026', date: '2026-03-19', boUrl: 'https://www.education.gouv.fr/bo/2026/Hebdo12/MENE2602911A' },
  emc2024: { title: 'Programme d’enseignement moral et civique', bo: 'BO n° 24 du 13 juin 2024', date: '2024-06-13', boUrl: 'https://www.education.gouv.fr/bo/2024/Hebdo24/MENE2413934A', pdf: 'https://www.education.gouv.fr/sites/default/files/document/Annexe%20%E2%80%94%20Programme%20d%E2%80%99enseignement%20moral%20et%20civique%20du%20cours%20pr%C3%A9paratoire%20%C3%A0%20la%20classe%20terminale%20des%20voies%20g%C3%A9n%C3%A9rale%2C%20technologique%20et%20professionnelle%20et%20des%20classes%20pr%C3%A9parant%20au%20CAP-402159.pdf' },
  evar2025: { title: 'Programme d’éducation à la vie affective et relationnelle', bo: 'BO n° 6 du 6 février 2025', date: '2025-02-06', boUrl: 'https://www.education.gouv.fr/bo/2025/Hebdo6/MENE2503064A', pdf: 'https://www.education.gouv.fr/sites/default/files/document/Programme%20d%E2%80%99%C3%A9ducation%20%C3%A0%20la%20vie%20affective%20et%20relationnelle%20%C3%A0%20l%E2%80%99%C3%A9cole%20%C3%A9l%C3%A9mentaire-405261.pdf' },
  c2_2020: { title: 'Programme du cycle 2 (version consolidée 2020)', bo: 'BO n° 31 du 30 juillet 2020', date: '2020-07-30', boUrl: 'https://www.education.gouv.fr/bo/20/Hebdo31/MENE2018714A.htm', pdf: PDF2020_C2 },
  c3_2020: { title: 'Programme du cycle 3 (version consolidée 2020)', bo: 'BO n° 31 du 30 juillet 2020', date: '2020-07-30', boUrl: 'https://www.education.gouv.fr/bo/20/Hebdo31/MENE2018714A.htm', pdf: PDF2020_C3 },
  sciences2023: { title: 'Programme de sciences et technologie du cycle 3 (2023)', bo: 'BO n° 25 du 22 juin 2023', date: '2023-06-22', boUrl: 'https://www.education.gouv.fr/bo/2023/Hebdo25/MENE2314101A', pdf: 'https://www.education.gouv.fr/sites/default/files/document/Annexe%20%E2%80%93%20Programme%20de%20sciences%20et%20technologie%20du%20cycle%203-365166.pdf' },
};

// Annexes PDF propres à une discipline (quand un texte en regroupe plusieurs).
const PDF = {
  fr_c2: 'https://www.education.gouv.fr/sites/default/files/document/Annexe%203%20%E2%80%93%20Programme%20de%20fran%C3%A7ais%20du%20cycle%202-403818.pdf',
  ma_c2: 'https://www.education.gouv.fr/sites/default/files/document/Annexe%204%20%E2%80%93%20Programme%20de%20math%C3%A9matiques%20du%20cycle%202-403821.pdf',
  fr_c3: 'https://www.education.gouv.fr/sites/default/files/programme-de-fran-ais-pour-le-cycle-3-439824.pdf',
  ma_c3: 'https://www.education.gouv.fr/sites/default/files/programme-de-math-matiques-pour-le-cycle-3-439827.pdf',
  eps_c2: 'https://www.education.gouv.fr/sites/default/files/document/annexe-1-programme-d-education-physique-et-sportive-cycle-2-516770.pdf',
  eps_c3: 'https://www.education.gouv.fr/sites/default/files/document/annexe-2-programme-d-education-physique-et-sportive-cycle-3-516773.pdf',
  hg_c2: 'https://www.education.gouv.fr/sites/default/files/document/annexe-3-programme-d-histoire-geographie-cycle-2-516776.pdf',
  hg_c3: 'https://www.education.gouv.fr/sites/default/files/document/annexe-4-programme-d-histoire-geographie-cycle-3-516779.pdf',
  st_c2: 'https://www.education.gouv.fr/sites/default/files/document/annexe-1-programme-de-sciences-et-technologie-du-cycle-2-517289.pdf',
  st_c3: 'https://www.education.gouv.fr/sites/default/files/document/annexe-2-programme-de-sciences-et-technologie-du-cycle-3-517292.pdf',
  lv_c2: 'https://www.education.gouv.fr/sites/default/files/document/Annexe%201%20%E2%80%93%20Programme%20de%20langues%20vivantes%20%C3%A9trang%C3%A8res%20et%20r%C3%A9gionales%20pour%20le%20cycle%202%20-481187.pdf',
  lv_c3: 'https://www.education.gouv.fr/sites/default/files/document/Annexe%202%20%E2%80%93%20Programme%20de%20langues%20vivantes%20%C3%A9trang%C3%A8res%20et%20r%C3%A9gionales%20pour%20les%20classes%20de%20cours%20moyen%20%28cycle%203%29-481190.pdf',
};

const e = (subject, text, pdf, extra = {}) => ({ subject, text, pdf: pdf || TEXTS[text].pdf, ...extra });

const MATERNELLE = [
  e('Langage oral et écrit', 'mat2026', null, { label: 'Mobiliser le langage dans toutes ses dimensions (oral et écrit)' }),
  e('Premiers outils mathématiques', 'mat2026'),
  e('Activités physiques', 'mat2026', null, { label: 'Agir, s’exprimer, comprendre à travers les activités physiques' }),
  e('Activités artistiques', 'mat2026'),
  e('Se repérer dans le temps et l’espace', 'mat2026'),
  e('Découvrir le vivant, la matière et les objets', 'mat2026'),
  e('Vie affective et relationnelle', 'evar2025', null, { note: 'Le programme d’EVAR comprend des objectifs pour l’école maternelle : à vérifier dans le texte.' }),
];
const COMMUN_ELEM = [e('Enseignement moral et civique', 'emc2024'), e('Vie affective et relationnelle', 'evar2025')];

/** Pour chaque niveau : discipline → texte en vigueur en 2026-2027. */
export const APPLY = {
  TPS: MATERNELLE, PS: MATERNELLE, MS: MATERNELLE, GS: MATERNELLE,
  CP: [
    e('Français', 'fm2024', PDF.fr_c2), e('Mathématiques', 'fm2024', PDF.ma_c2), ...COMMUN_ELEM,
    e('Histoire-géographie', 'eps_hg2026', PDF.hg_c2, { nouveau: true }), e('Sciences et technologie', 'sciences2026', PDF.st_c2, { nouveau: true }),
    e('Langues vivantes', 'lv2026', PDF.lv_c2, { nouveau: true }), e('EPS', 'eps_hg2026', PDF.eps_c2, { nouveau: true }),
    e('Arts plastiques et éducation musicale', 'c2_2020'),
  ],
  CE1: null, CE2: null,
  CM1: [
    e('Français', 'fm2025', PDF.fr_c3), e('Mathématiques', 'fm2025', PDF.ma_c3), ...COMMUN_ELEM,
    e('Histoire-géographie', 'eps_hg2026', PDF.hg_c3, { nouveau: true }), e('Sciences et technologie', 'sciences2026', PDF.st_c3, { nouveau: true }),
    e('Langues vivantes', 'lv2026', PDF.lv_c3, { nouveau: true }), e('EPS', 'eps_hg2026', PDF.eps_c3, { nouveau: true }),
    e('Arts plastiques, éducation musicale, histoire des arts', 'c3_2020'),
  ],
  CM2: [
    e('Français', 'fm2025', PDF.fr_c3, { nouveau: true }), e('Mathématiques', 'fm2025', PDF.ma_c3, { nouveau: true }), ...COMMUN_ELEM,
    e('Histoire-géographie', 'c3_2020'), e('Sciences et technologie', 'sciences2023'),
    e('Langues vivantes', 'c3_2020'), e('EPS', 'c3_2020'),
    e('Arts plastiques, éducation musicale, histoire des arts', 'c3_2020'),
  ],
};
APPLY.CE1 = APPLY.CE2 = [
  e('Français', 'fm2024', PDF.fr_c2), e('Mathématiques', 'fm2024', PDF.ma_c2), ...COMMUN_ELEM,
  e('Questionner le monde — l’espace et le temps', 'c2_2020'), e('Questionner le monde — le vivant, la matière et les objets', 'c2_2020'),
  e('Langues vivantes', 'c2_2020'), e('EPS', 'c2_2020'), e('Arts plastiques et éducation musicale', 'c2_2020'),
];
APPLY.CE2 = APPLY.CE2.map(x => (x.text === 'emc2024' ? { ...x, nouveau: true } : x));

/** Lignes (discipline, texte, niveaux concernés) pour une liste de niveaux, en regroupant les niveaux identiques. */
export function forLevels(levels) {
  const rows = new Map();
  for (const lvl of levels) for (const x of APPLY[lvl] || []) {
    const key = `${x.subject}|${x.text}|${x.pdf}`;
    const r = rows.get(key) || { ...x, t: TEXTS[x.text], levels: [], nouveauFor: [] };
    r.levels.push(lvl); if (x.nouveau) r.nouveauFor.push(lvl);
    rows.set(key, r);
  }
  return [...rows.values()];
}
