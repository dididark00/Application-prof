// Feuille de route : liste de suivi de TOUT le périmètre du cahier des charges.
// Statuts : 'fait' (réalisé et testé), 'partiel' (une partie réalisée, le reste précisé),
// 'configurer' (réalisé mais demande un réglage ou un service externe), 'afaire' (à développer).
// Aucune fonction n'est supprimée : on change seulement son statut.

export const STATUTS = {
  fait: 'Réalisé',
  partiel: 'Partiel',
  configurer: 'À configurer',
  afaire: 'À développer',
};

const R = (etape, section, titre, statut = 'afaire', note = '') => ({ etape, section, titre, statut, note });

export const ROADMAP = [
  // ── §2 Navigation
  R(1, '§2 Navigation', 'Six rubriques sur ordinateur (Aujourd’hui, Préparer, Planifier, Ma classe, Familles, Organisation)', 'fait'),
  R(1, '§2 Navigation', 'Réglages séparés', 'fait'),
  R(1, '§2 Navigation', 'Barre téléphone : Aujourd’hui, Planifier, Ma classe, Plus', 'fait'),
  R(1, '§2 Navigation', 'Favoris personnalisables', 'fait'),
  R(1, '§2 Navigation', 'Recherche globale', 'fait', 'Élèves, classes, fichiers, notes, pages. Les modules masqués sont exclus.'),
  R(1, '§2 Navigation', 'Bouton d’ajout rapide', 'fait', 'Élève, note, fichier, lien. S’enrichira à chaque étape.'),
  R(1, '§2 Navigation', 'Liens contextuels entre pages', 'partiel', 'Élèves, classes, fichiers, programmation ↔ progression ↔ séquence ↔ séance ↔ cahier journal ↔ leçons/devoirs. Suite avec les modules des étapes 3-5.'),
  R(1, '§2 Navigation', 'Modules masquables sans effacer les données', 'fait'),
  R(1, '§2 Navigation', 'Sélecteur d’année et de classe visible', 'fait'),
  R(1, '§2 Navigation', 'Boîte de réception (photo, PDF, note à classer plus tard)', 'fait'),

  // ── §3 Données et liens
  R(1, '§3 Données', 'Identifiants stables, liens par identifiant (jamais par nom)', 'fait'),
  R(1, '§3 Données', 'Historique auteur/date des modifications', 'fait'),
  R(2, '§3 Données', 'Chaîne programme → programmation → progression → séquence → séances/préparations', 'fait'),
  R(2, '§3 Données', 'Distinguer « lier » et « dupliquer » ; modèle réutilisable vs séance datée', 'fait'),
  R(2, '§3 Données', 'Distinguer prévu/réalisé, préparé/publié ; le futur ne réécrit pas le passé', 'partiel', 'Prévu/réalisé (instantané figé) et EDT versionné : faits. Publié : avec le portail familles (étape 5).'),
  R(3, '§3 Données', 'Distinguer remis/rattrapé, non évalué/non acquis, inscription/présence prévue', 'fait'),

  // ── §4 Années, niveaux, multiniveau
  R(1, '§4 Années', 'Créer plusieurs années (périodes datées) et classes', 'fait', 'Préréglage zone C 2026-2027 sourcé.'),
  R(1, '§4 Années', 'Niveaux multiples par classe et cycle déduit', 'fait'),
  R(1, '§4 Années', 'Ajouter, modifier, archiver, importer (CSV) les élèves', 'fait'),
  R(1, '§4 Années', 'Arrivées/départs en cours d’année sans altérer l’historique', 'fait', 'Inscriptions datées ; listes consultables à une date.'),
  R(2, '§4 Années', 'Reprendre modèles, séquences, ressources d’une année précédente (sans paiements, autorisations, résultats)', 'fait'),
  R(2, '§4 Années', 'Référentiels sourcés, datés, versionnés ; import vérifié avant intégration', 'fait', 'Aucun contenu officiel prérempli : import puis validation par l’enseignante.'),
  R(2, '§4 Années', 'Multiniveau : programmations/progressions par niveau, séquences communes, consignes distinctes', 'fait'),
  R(2, '§4 Années', 'Cahier journal en colonnes parallèles ; travail dirigé/autonomie/ateliers', 'fait'),
  R(2, '§4 Années', 'Signaler deux activités exigeant simultanément l’enseignant', 'fait'),
  R(3, '§4 Années', 'Groupes de besoin transversaux, ateliers et rotations', 'fait'),

  // ── §5 Préparation
  R(3, '§5 Préparation', 'Programmes officiels en vigueur par niveau (TPS–CM2), avec liens BO et PDF, et création d’un référentiel prérempli', 'fait', 'Références relevées sur Éduscol le 22/10/2026.'),
  R(4, '§5 Préparation', 'Compétences détaillées des programmes officiels pré-importées (à vérifier puis valider)', 'fait', '2 080 intitulés extraits des PDF officiels (TPS–CM2), page indiquée, contrôle automatique mot à mot ; EVAR maternelle non extrait.'),
  R(2, '§5 Préparation', 'Programmations annuelles et progressions (ajouter, déplacer, ordonner, suivre les notions)', 'fait', 'D’après les modèles de l’enseignante ; import d’un tableau de notions.'),
  R(2, '§5 Préparation', 'Bilans de période (notions réalisées et restantes)', 'fait'),
  R(2, '§5 Préparation', 'Fiche de séquence complète', 'fait'),
  R(2, '§5 Préparation', 'Fiche de préparation (phases minutées, différenciation, critères, bilan), modèles, duplication', 'fait', 'Phases typées du modèle de l’enseignante ; modes quotidien/visite ; version vierge.'),
  R(2, '§5 Préparation', 'Manuels (Picot, Accès, Retz… configurables, sans contenu prérempli), pages et pièces jointes', 'fait'),
  R(4, '§5 Préparation', 'OCR optionnel avec texte incertain signalé', 'afaire', 'Local et gratuit si possible ; OCR distant facultatif.'),
  R(5, '§5 Préparation', 'Génération assistée par IA (facultative, sources visibles, aucune donnée élève envoyée)'),
  R(2, '§5 Préparation', 'Leçons numérotées liées aux séances, devoirs, évaluations ; distribution réelle', 'fait'),
  R(2, '§5 Préparation', 'Photos du tableau et corrections ; suivi des apprentissages à reprendre', 'partiel', 'Photos du tableau et corrections : faites. Liste « à reprendre » par élève : avec le rattrapage (étape 3).'),

  // ── §6 Agenda, EDT, cahier journal
  R(2, '§6 Planifier', 'EDT de référence par période, duplication, récurrences', 'fait', 'Versions datées : une modification ne réécrit pas les journées passées.'),
  R(2, '§6 Planifier', 'Exceptions datées (sortie, absence, visite, réunion, report)', 'fait'),
  R(2, '§6 Planifier', 'Interventions (contact, lieu, dates, créneaux, groupes) ; « à planifier » sans bloquer', 'fait'),
  R(2, '§6 Planifier', 'Conflits et propositions de report ajustables, sans décalage automatique', 'fait'),
  R(2, '§6 Planifier', 'Vues jour/semaine/période ; temps par matière avec référentiel configurable', 'fait', 'Jour et semaine (cahier journal), semaine et mois (agenda), période (progression). Référence horaire saisie par l’enseignante.'),
  R(2, '§6 Planifier', 'Cahier journal depuis l’EDT : bilan express, faite/partielle/reportée, historique', 'fait'),
  R(2, '§6 Planifier', 'Rituels récurrents ; liste consolidée matériel/photocopies', 'fait'),
  R(2, '§6 Planifier', 'Agenda personnel et professionnel, tâches, échéances', 'fait'),
  R(4, '§6 Planifier', 'Répartition des préparations avec la binôme', 'fait', 'Vue « Qui prépare quoi » d’après le responsable de chaque séquence (Transmissions binôme).'),
  R(5, '§6 Planifier', 'Notifications configurables'),

  // ── §7 Appel et quotidien
  R(3, '§7 Quotidien', 'Appel matin/après-midi (absent, retard, départ, absence partielle), validation', 'fait'),
  R(3, '§7 Quotidien', 'Cantine, étude, périscolaire : semaine type, exceptions, listes imprimables', 'fait'),
  R(3, '§7 Quotidien', 'Départ seul/accompagné, personnes autorisées, exceptions', 'fait'),
  R(3, '§7 Quotidien', 'Responsabilités et rotations', 'fait'),
  R(3, '§7 Quotidien', 'Trombinoscope (photo ou silhouette), vues classe/niveau/groupe, impression', 'fait'),

  // ── §8 Fiches élèves
  R(1, '§8 Élèves', 'Fiche élève : identité, responsables multiples, téléphones/emails, contact prioritaire, urgence, personnes autorisées', 'fait'),
  R(3, '§8 Élèves', 'Statuts documentaires (à recevoir/reçu/à compléter, relance), assurance avec validité', 'fait'),
  R(3, '§8 Élèves', 'Droit à l’image par usage (autorisé/refusé/à renseigner), justificatif', 'fait'),
  R(3, '§8 Élèves', 'Observations datées par domaine, réussites, difficultés, actions', 'fait'),
  R(3, '§8 Élèves', 'Besoins particuliers (confirmé vs observation) ; PPRE/PAP/PPS/PAI/AESH à accès restreint', 'partiel', 'Masqués par défaut (code facultatif), hors recherche et projection. Contrôle d’accès par compte : étape 5.'),
  R(3, '§8 Élèves', 'Niveau par domaine daté ; aides efficaces et historique', 'fait'),
  R(3, '§8 Élèves', 'Différenciation dans les préparations (sans adaptation automatique sur diagnostic)', 'fait'),
  R(3, '§8 Élèves', 'Portfolio lié aux compétences ; historique des échanges', 'fait'),

  // ── §9 Listes
  R(3, '§9 Listes', 'Listes personnalisables (colonnes case/date/texte/montant/choix, filtres, tri, actions groupées)', 'fait'),
  R(3, '§9 Listes', 'Colonnes liées qui actualisent la donnée (assurance, autorisation, paiement)', 'partiel', 'Documents, autorisations et droit à l’image : faits. Paiements : avec le module Argent et projets (étape 4).'),
  R(3, '§9 Listes', 'Modèles réutilisables d’une année à l’autre ; impression vierge ou remplie', 'fait'),

  // ── §10 Devoirs, évaluations, rattrapage
  R(2, '§10 Suivi', 'Devoirs datés liés aux séances/leçons, destinataires, publication volontaire', 'partiel', 'Préparé / donné : fait. Publication aux familles : étape 5.'),
  R(3, '§10 Suivi', 'Évaluations : grille, notes et/ou maîtrise, non évalué, versions adaptées, aucune conversion silencieuse', 'fait'),
  R(3, '§10 Suivi', 'Bilans et appréciations modifiables ; livrets par période ; adaptation maternelle', 'fait', 'Export tabulaire des appréciations à reporter dans le LSU ; vocabulaire adapté en maternelle.'),
  R(5, '§10 Suivi', 'Export compatible LSU (à vérifier séparément, sans remplacer le service officiel)'),
  R(3, '§10 Suivi', 'Rattrapage : absences × séances réellement faites × supports distribués ; remis/rattrapé', 'fait'),

  // ── §11 Fichiers, diaporamas, charte
  R(1, '§11 Fichiers', 'Espace fichiers : dossiers, tags, année/matière/niveau/projet, recherche, favoris', 'fait'),
  R(1, '§11 Fichiers', 'Aperçu (images, PDF, texte) et versions', 'fait', 'Les autres formats se téléchargent.'),
  R(1, '§11 Fichiers', 'Liens externes (Drive, Canva…) opérationnels sans connexion authentifiée', 'fait'),
  R(2, '§11 Fichiers', 'Réutilisation par lien (sans duplication) depuis séances et préparations', 'fait'),
  R(3, '§11 Fichiers', 'Diaporamas par séance, vue hebdomadaire, liste de projection du jour', 'fait'),
  R(3, '§11 Fichiers', 'Import PDF/images affichables ; PPTX : conversion nécessaire expliquée', 'fait'),
  R(3, '§11 Fichiers', 'Éditeur simple de diapositives (titre, texte, image, consigne, exercice, timer)', 'fait'),
  R(3, '§11 Fichiers', 'Mode projection séparé sans données privées ; notes présentateur', 'fait'),
  R(4, '§11 Fichiers', 'Charte visuelle enregistrée', 'fait', 'Réglages › Charte visuelle : police, couleurs, bordure.'),
  R(4, '§11 Fichiers', 'Générateur d’étiquettes, affichages, cartes d’ateliers ; académies (noms, couleurs, emblèmes), série, PDF à taille réelle', 'fait', 'Impression A4 à taille réelle (PDF via « Enregistrer au format PDF ») ; séries versionnées après changement d’académie.'),

  // ── §12 Organisation et finances
  R(4, '§12 Organisation', 'Réunions : notes, compte rendu, décisions, tâches, liens agenda/élèves', 'fait'),
  R(4, '§12 Organisation', 'Transmissions binôme (fait/à terminer/information, accusé de lecture)', 'partiel', 'Préremplies depuis le cahier journal ; lecture notée sur l’appareil, copie/impression pour l’envoi. Partage automatique avec les comptes (étape 5).'),
  R(4, '§12 Organisation', 'Répertoire de l’école et des intervenants', 'fait'),
  R(4, '§12 Organisation', '108 h : activités, prévu/réalisé, totaux, export (règles à vérifier)', 'fait', 'Objectifs indicatifs modifiables (quotité, consignes de la circonscription) ; réunions et APC comptées une seule fois.'),
  R(4, '§12 Organisation', 'APC : objectifs, élèves, séances, présences, bilan, comptage unique', 'fait'),
  R(4, '§12 Organisation', 'Module PES : échéances INSPE, visites, objectifs, retours', 'fait'),
  R(4, '§12 Organisation', 'Dossiers remplacement/visite personnalisables', 'fait'),
  R(4, '§12 Organisation', 'Argent et projets : attendu/reçu/reste, paiements partiels, journal unique, corrections traçables, comptes par année', 'fait', 'Comptes par année avec solde initial/report explicites ; export CSV et impression ; aucun paiement en ligne.'),
  R(4, '§12 Organisation', 'Projets transdisciplinaires ; matériel (stocks, achats, prêts)', 'fait', 'Achat de matériel → une seule dépense au journal financier.'),

  // ── §13 Familles et connexions
  R(5, '§13 Familles', 'Comptes responsables liés aux bons enfants (contrôle côté serveur)'),
  R(5, '§13 Familles', 'Messages, documents, devoirs, autorisations ; consultation/réponse/retour'),
  R(5, '§13 Familles', 'Préparation privée jusqu’à publication ; aperçu « comme ce parent »'),
  R(5, '§13 Familles', 'Réservation de rendez-vous sur créneaux ouverts, sans double réservation'),
  R(5, '§13 Familles', 'Mail académique (selon fournisseur et accès autorisés)'),
  R(1, '§13 Connexions', 'Statut des connexions affiché honnêtement (Drive, Canva, agendas, LSU, mail)', 'fait'),
  R(5, '§13 Connexions', 'Connexions Drive, Canva, agendas, LSU vérifiées une par une'),

  // ── §14 Impression et exports
  R(1, '§14 Exports', 'Liste d’élèves : aperçu, A4 portrait/paysage, colonnes, version vierge, impression', 'fait'),
  R(1, '§14 Exports', 'Export CSV (élèves, fichiers)', 'fait'),
  R(1, '§14 Exports', 'Sauvegarde complète réimportable', 'fait'),
  R(2, '§14 Exports', 'Impression EDT, cahier journal, préparations, séquences, progressions', 'fait'),
  R(3, '§14 Exports', 'Impression listes, trombinoscope, devoirs, rattrapage, évaluations, bilans', 'fait'),
  R(4, '§14 Exports', 'Dossier de semaine ; finances ; étiquettes à taille réelle'),
  R(3, '§14 Exports', 'Profils d’export enseignant/élèves/familles/remplaçant ; exclusions par défaut', 'partiel', 'Impressions familles déjà filtrées (bilans, rattrapage, listes). Profils d’export complets avec le dossier remplaçant (étape 4).'),

  // ── §15 Fiabilité
  R(1, '§15 Fiabilité', 'Utilisable téléphone, tablette, ordinateur', 'fait'),
  R(1, '§15 Fiabilité', 'Sauvegarde persistante sur l’appareil, état visible', 'fait'),
  R(1, '§15 Fiabilité', 'Annulation et corbeille (récupération après suppression)', 'fait'),
  R(1, '§15 Fiabilité', 'Hors connexion : application entière (données locales)', 'fait'),
  R(5, '§15 Fiabilité', 'Comptes personnels, rôles enseignant/binôme/parent, permissions côté serveur'),
  R(5, '§15 Fiabilité', 'Synchronisation, file de modifications et conflits explicites'),
  R(3, '§15 Fiabilité', 'Accès restreint aux données sensibles (santé, accompagnements) ; jamais en projection/recherche', 'partiel', 'Masquage, exclusion de la recherche et de la projection : faits. Droits par compte : étape 5.'),
  R(5, '§15 Fiabilité', 'Vérifier le cadre d’hébergement avant données réelles d’enfants'),

  R(3, '§2 Interface', 'Thèmes de couleurs (pastel, bleu, école, vert) et version sombre automatique le soir, au choix dans Réglages', 'fait'),
  // ── §19 Atelier
  R(3, '§19 Atelier', 'Timer de couleur persistant (widget flottant, plein écran, heure cible)', 'fait', 'Fenêtre flottante au-dessus des autres applications seulement si le navigateur le permet (Chrome, Edge).'),
  R(3, '§19 Atelier', 'Écriture : lignes Seyès, réglures, textes à compléter', 'fait'),
  R(3, '§19 Atelier', 'Tableau d’écriture Seyès : texte tapé en cursive (police Marelle importée), calé sur les lignes, imprimable et affichable en grand avec annotation', 'fait', 'La police Marelle (gratuite, licence libre) se télécharge sur le site du ministère puis s’importe une fois par appareil.'),
  R(3, '§19 Atelier', 'Maths : droites graduées, numération, fractions, horloges', 'fait'),
  R(4, '§19 Atelier', 'Géométrie : quadrillages, figures, instruments virtuels, fiches et corrections', 'partiel', 'Quadrillages, symétrie, reproduction, figures aux dimensions réelles, angles, avec corrections. Instruments virtuels : en cours.'),
  R(4, '§19 Atelier', 'Cartes monde/continents/France à partir de données sourcées', 'fait', 'Natural Earth (domaine public) et IGN Admin Express (Licence ouverte) ; versions vierge numérotée, légendée, corrigée.'),
  R(4, '§19 Atelier', 'Jeux : memory, associations, classement, remise en ordre, quiz, bingo, cartes'),
  R(4, '§19 Atelier', 'Anglais : flashcards, affiches, vocabulaire, dialogues, audio sourcé'),
  R(4, '§19 Atelier', 'Modes concevoir/animer plein écran, annotation, tactile'),
  R(4, '§19 Atelier', 'Fenêtre de projection séparée / image dans l’image si supporté'),

  // ── §20 Plans, groupes, EPS
  R(3, '§20 Plans', 'Plan de classe visuel : mobilier, modèles, dispositions nommées par période/séance', 'fait'),
  R(3, '§20 Plans', 'Groupes manuels ou aléatoires, absents, rôles, rotations ; groupes de séance figés', 'fait'),
  R(4, '§20 Plans', 'Fiches de groupes imprimables/projetables (version enseignant séparée)'),
  R(4, '§20 Plans', 'Éditeur de schémas EPS lié aux préparations et au cahier journal'),

  // ── §21-22 PWA, sync, budget, visites
  R(1, '§21 PWA', 'Application web installable (manifeste, icônes, fonctionnement hors ligne)', 'fait'),
  R(1, '§21 PWA', 'Sauvegarde téléchargeable (données + fichiers), restauration vérifiée, versions', 'fait'),
  R(5, '§21 PWA', 'Sauvegarde automatique en ligne et synchronisation entre appareils', 'configurer', 'Demande un service distant : tableau gratuit/limites/coûts à valider avant intégration.'),
  R(5, '§21 PWA', 'Politique de rétention distante'),
  R(2, '§22 Visites', 'Préparations liées au référentiel, à la programmation, progression, séquence, cahier journal', 'fait'),
  R(2, '§22 Visites', 'Modèle structuré pour visite/inspection, allégeable, export PDF et version vierge', 'fait'),
  R(2, '§22 Visites', 'Import/reproduction du modèle personnel de l’utilisatrice', 'fait', 'Modèles de l’enseignante reproduits (programmation, progression, séquence, séance).'),

  // ── §23 Bibliothèque
  R(3, '§23 Bibliothèque', 'Catalogue (exemplaires distincts) et prêts ; un exemplaire = un prêt actif', 'fait'),
  R(3, '§23 Bibliothèque', 'Vues par livre/élève, retards, retour en un clic, impressions, grille vierge', 'fait'),
  R(3, '§23 Bibliothèque', 'Prêts ouverts signalés au départ d’un élève ou au changement d’année', 'fait'),
  R(4, '§23 Bibliothèque', 'Scan code-barres/QR (facultatif)'),
];

// Sous-pages de chaque rubrique et l'étape où elles arrivent.
// `route` = sous-page réalisée ; sinon on affiche honnêtement « à venir ».
export const RUBRIQUES = [
  { id: 'aujourdhui', titre: 'Aujourd’hui', icone: 'sun', sous: [
    { id: 'journee', titre: 'Ma journée', route: 'aujourdhui' },
    { id: 'appel', titre: 'Appel', route: 'appel' },
    { id: 'services', titre: 'Cantine et services', route: 'services' },
    { id: 'taches', titre: 'Tâches et rendez-vous', route: 'taches' },
    { id: 'projection', titre: 'Projection', route: 'projection' },
  ]},
  { id: 'preparer', titre: 'Préparer', icone: 'book', sous: [
    { id: 'programmes', titre: 'Programmes et référentiels', route: 'referentiels' },
    { id: 'programmations', titre: 'Programmations', route: 'programmations' },
    { id: 'progressions', titre: 'Progressions', route: 'progressions' },
    { id: 'sequences', titre: 'Séquences', route: 'sequences' },
    { id: 'preparations', titre: 'Fiches de séance', route: 'preparations' },
    { id: 'manuels', titre: 'Manuels', route: 'manuels' },
    { id: 'lecons', titre: 'Leçons', route: 'lecons' },
    { id: 'fichiers', titre: 'Fichiers et ressources', route: 'fichiers' },
    { id: 'diaporamas', titre: 'Diaporamas', route: 'diaporamas' },
    { id: 'atelier', titre: 'Atelier pédagogique', route: 'atelier' },
    { id: 'etiquettes', titre: 'Étiquettes et affichages', route: 'etiquettes' },
  ]},
  { id: 'planifier', titre: 'Planifier', icone: 'calendar', sous: [
    { id: 'cahier', titre: 'Cahier journal', route: 'cahier' },
    { id: 'edt', titre: 'Emploi du temps', route: 'edt' },
    { id: 'agenda', titre: 'Agenda', route: 'agenda' },
    { id: 'devoirs', titre: 'Devoirs', route: 'devoirs' },
    { id: 'interventions', titre: 'Interventions', route: 'interventions' },
    { id: 'ateliers', titre: 'Ateliers et rotations', etape: 3 },
  ]},
  { id: 'classe', titre: 'Ma classe', icone: 'users', sous: [
    { id: 'eleves', titre: 'Élèves', route: 'eleves' },
    { id: 'trombi', titre: 'Trombinoscope', route: 'trombi' },
    { id: 'evaluations', titre: 'Évaluations', route: 'evaluations' },
    { id: 'livrets', titre: 'Livrets et bilans', route: 'livrets' },
    { id: 'differenciation', titre: 'Différenciation', route: 'differenciation' },
    { id: 'rattrapage', titre: 'Rattrapage', route: 'rattrapage' },
    { id: 'listes', titre: 'Listes', route: 'listes' },
    { id: 'plan', titre: 'Plan de classe et groupes', route: 'plan' },
    { id: 'responsabilites', titre: 'Responsabilités', route: 'responsabilites' },
    { id: 'bibliotheque', titre: 'Bibliothèque', route: 'bibliotheque' },
  ]},
  { id: 'familles', titre: 'Familles', icone: 'home', sous: [
    { id: 'messages', titre: 'Messages', etape: 5 },
    { id: 'publications', titre: 'Publications', etape: 5 },
    { id: 'documents', titre: 'Documents', etape: 5 },
    { id: 'rdv', titre: 'Rendez-vous', etape: 5 },
    { id: 'apercu', titre: 'Aperçu parent', etape: 5 },
  ]},
  { id: 'organisation', titre: 'Organisation', icone: 'briefcase', sous: [
    { id: 'reception', titre: 'Boîte de réception', route: 'reception' },
    { id: 'reunions', titre: 'Réunions et notes', route: 'reunions' },
    { id: 'heures', titre: '108 h et APC', route: 'heures' },
    { id: 'transmissions', titre: 'Transmissions binôme', route: 'transmissions' },
    { id: 'argent', titre: 'Argent et projets', route: 'argent' },
    { id: 'materiel', titre: 'Matériel', route: 'materiel' },
    { id: 'contacts', titre: 'Contacts', route: 'contacts' },
    { id: 'remplacement', titre: 'Dossiers remplacement et visite', route: 'remplacement' },
    { id: 'pes', titre: 'PES et visites', route: 'pes' },
  ]},
];
