// Aide à la rédaction des appréciations : phrases-types assemblées et accordées, sans IA ni connexion.
// Les phrases sont des propositions : l'enseignante choisit, modifie et reste l'autrice du texte.
// Syntaxe : {P} = prénom ; [masculin|féminin] = accord selon l'élève.

export const POINTS = [
  ['bon', 'bon élève', ['{P} est [un élève sérieux|une élève sérieuse] et [investi|investie] dans son travail.', '{P} fournit un travail de qualité tout au long de la période.', 'Les résultats de {P} sont solides : c’est un très bon trimestre.']],
  ['progres', 'en progrès', ['{P} a fait de réels progrès ce trimestre.', 'Les efforts de {P} commencent à porter leurs fruits.', 'On note une belle évolution dans le travail de {P}.']],
  ['regulier', 'travail régulier', ['{P} travaille avec régularité.', 'Le travail de {P} est régulier et soigné.', '{P} se montre [constant|constante] dans ses efforts.']],
  ['participation', 'bonne participation', ['{P} participe volontiers et avec pertinence à l’oral.', 'Ses interventions à l’oral enrichissent la classe.', '{P} s’implique activement dans les échanges collectifs.']],
  ['concentration', 'manque de concentration', ['{P} a encore du mal à rester [concentré|concentrée] sur la durée.', 'L’attention de {P} est parfois fragile, ce qui freine ses apprentissages.', '{P} se laisse facilement distraire ; il faudra rester [attentif|attentive] en classe.']],
  ['diffmaths', 'difficultés en mathématiques', ['Les mathématiques demandent encore beaucoup d’efforts à {P}.', 'En mathématiques, certaines notions restent à consolider.']],
  ['difffr', 'difficultés en français', ['En français, la lecture et l’écriture demandent encore des efforts.', 'Certaines notions de français restent à consolider pour {P}.']],
  ['faciliteconj', 'facilités en conjugaison', ['{P} est très à l’aise en conjugaison.', 'La conjugaison est un point fort pour {P}.']],
  ['facilitemaths', 'facilités en mathématiques', ['{P} montre de belles facilités en mathématiques.', 'Les mathématiques sont un point fort pour {P}.']],
  ['lecture', 'bon lecteur', ['{P} est [un bon lecteur|une bonne lectrice].', 'La lecture de {P} est fluide et bien comprise.']],
  ['soin', 'soin à améliorer', ['La présentation et le soin des cahiers restent à améliorer.', '{P} doit apporter davantage de soin à son travail écrit.']],
  ['autonomie', 'autonome', ['{P} est [autonome|autonome] et organisé[|e] dans son travail.', '{P} sait travailler seul[|e] et s’organiser.']],
  ['comportement', 'comportement agréable', ['{P} est [un élève agréable|une élève agréable], [respectueux|respectueuse] des autres.', 'Le comportement de {P} en classe est très positif.']],
  ['conflits', 'conflits en récréation', ['Les temps de récréation sont parfois source de conflits pour {P}.', '{P} doit apprendre à régler les désaccords avec ses camarades par le dialogue.']],
  ['bavard', 'bavardages', ['Les bavardages de {P} gênent parfois son travail et celui des autres.', '{P} doit veiller à limiter ses bavardages.']],
  ['timide', 'réservé', ['{P} est encore [réservé|réservée] à l’oral : nous l’encourageons à oser prendre la parole.', '{P}, plus [discret|discrète], gagnerait à participer davantage.']],
];
export const ADVICE = [
  ['oral', 'participer plus à l’oral', ['Il faut oser participer davantage à l’oral.', 'Nous encourageons {P} à prendre la parole plus souvent.']],
  ['lecons', 'apprendre ses leçons', ['Les leçons doivent être apprises plus régulièrement à la maison.', 'Un travail régulier des leçons l’aidera à progresser.']],
  ['autonomie', 'gagner en autonomie', ['Le prochain objectif est de gagner en autonomie.', '{P} doit maintenant apprendre à travailler plus seul[|e].']],
  ['continuer', 'continuer comme ça', ['Continue ainsi, {P} !', 'Il faut poursuivre dans cette voie.', 'Bravo, continue comme ça !']],
  ['concentration', 'rester concentré', ['Il faudra rester [concentré|concentrée] jusqu’au bout des activités.', 'L’objectif est de maintenir son attention plus longtemps.']],
  ['soin', 'soigner son travail', ['Il faut prendre le temps de soigner son travail.']],
  ['lecture', 'lire chaque jour', ['Lire un peu chaque jour à la maison l’aidera beaucoup.']],
];
export const AIDS = [
  ['tutorat', 'tutorat', ['Un tutorat entre élèves a été mis en place.', '{P} bénéficie de l’aide d’un camarade tuteur.']],
  ['ppre', 'PPRE', ['Un programme personnalisé de réussite éducative (PPRE) accompagne {P}.']],
  ['diff', 'différenciation', ['Le travail est adapté pour l’aider à progresser à son rythme.', 'Des supports adaptés lui sont proposés.']],
  ['aesh', 'accompagnement AESH', ['{P} est [accompagné|accompagnée] par une AESH, ce qui l’aide à gagner en confiance.']],
  ['apc', 'APC', ['{P} participe aux activités pédagogiques complémentaires (APC).']],
];

/** Accorde une phrase : {P} → prénom, [m|f] → la forme voulue. */
export function agree(text, firstName, gender) {
  return String(text).replace(/\{P\}/g, firstName || 'L’élève').replace(/\[([^|\]]*)\|([^\]]*)\]/g, (_, m, f) => (gender === 'f' ? f : m));
}

/** Tirage reproductible d'une variante. */
function pick(list, seed, salt) { const x = Math.abs(Math.sin((seed + 1) * 9301 + salt * 49297)) * 233280; return list[Math.floor(x) % list.length]; }

/**
 * Assemble l'appréciation : éléments importants, aides, conseils, puis textes libres.
 * opts = { firstName, gender: 'f'|'m', points: [id], advice: [id], aids: [id], free: { points, advice, aids }, seed, tone: 'court'|'complet' }
 */
export function compose(opts) {
  const { firstName, gender = 'm', points = [], advice = [], aids = [], free = {}, seed = 1, tone = 'complet' } = opts;
  const out = [];
  let first = true;
  const add = (bank, ids, salt) => ids.forEach((id, i) => {
    const e = bank.find(b => b[0] === id); if (!e) return;
    let s = agree(pick(e[2], seed, salt + i), firstName, gender);
    // Évite de répéter le prénom à chaque phrase : seule la première le garde.
    if (!first && s.startsWith(`${firstName} `) && firstName) s = (gender === 'f' ? 'Elle ' : 'Il ') + s.slice(firstName.length + 1);
    first = false;
    out.push(s);
  });
  const freeSentence = (t) => { const x = String(t || '').trim(); if (!x) return; out.push(/[.!?…]$/.test(x) ? x[0].toUpperCase() + x.slice(1) : `${x[0].toUpperCase()}${x.slice(1)}.`); };
  add(POINTS, tone === 'court' ? points.slice(0, 2) : points, 1);
  freeSentence(free.points);
  add(AIDS, aids, 30);
  freeSentence(free.aids);
  add(ADVICE, tone === 'court' ? advice.slice(0, 1) : advice, 60);
  freeSentence(free.advice);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}
