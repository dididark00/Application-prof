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
  R(1, '§2 Navigation', 'Liens contextuels entre pages', 'partiel', 'Élève ↔ classe ↔ fichiers. Les autres liens arrivent avec leurs modules.'),
  R(1, '§2 Navigation', 'Modules masquables sans effacer les données', 'fait'),
  R(1, '§2 Navigation', 'Sélecteur d’année et de classe visible', 'fait'),
  R(1, '§2 Navigation', 'Boîte de réception (photo, PDF, note à classer plus tard)', 'fait'),

  // ── §3 Données et liens
  R(1, '§3 Données', 'Identifiants stables, liens par identifiant (jamais par nom)', 'fait'),
  R(1, '§3 Données', 'Historique auteur/date des modifications', 'fait'),
  R(2, '§3 Données', 'Chaîne programme → programmation → progression → séquence → séances/préparations'),
  R(2, '§3 Données', 'Distinguer « lier » et « dupliquer » ; modèle réutilisable vs séance datée'),
  R(2, '§3 Données', 'Distinguer prévu/réalisé, préparé/publié ; le futur ne réécrit pas le passé'),
  R(3, '§3 Données', 'Distinguer remis/rattrapé, non évalué/non acquis, inscription/présence prévue'),

  // ── §4 Années, niveaux, multiniveau
  R(1, '§4 Années', 'Créer plusieurs années (périodes datées) et classes', 'fait', 'Préréglage zone C 2026-2027 sourcé.'),
  R(1, '§4 Années', 'Niveaux multiples par classe et cycle déduit', 'fait'),
  R(1, '§4 Années', 'Ajouter, modifier, archiver, importer (CSV) les élèves', 'fait'),
  R(1, '§4 Années', 'Arrivées/départs en cours d’année sans altérer l’historique', 'fait', 'Inscriptions datées ; listes consultables à une date.'),
  R(2, '§4 Années', 'Reprendre modèles, séquences, ressources d’une année précédente (sans paiements, autorisations, résultats)'),
  R(2, '§4 Années', 'Référentiels sourcés, datés, versionnés ; import vérifié avant intégration'),
  R(2, '§4 Années', 'Multiniveau : programmations/progressions par niveau, séquences communes, consignes distinctes'),
  R(2, '§4 Années', 'Cahier journal en colonnes parallèles ; travail dirigé/autonomie/ateliers'),
  R(2, '§4 Années', 'Signaler deux activités exigeant simultanément l’enseignant'),
  R(3, '§4 Années', 'Groupes de besoin transversaux, ateliers et rotations'),

  // ── §5 Préparation
  R(2, '§5 Préparation', 'Programmations annuelles et progressions (ajouter, déplacer, ordonner, suivre les notions)'),
  R(2, '§5 Préparation', 'Bilans de période (notions réalisées et restantes)'),
  R(2, '§5 Préparation', 'Fiche de séquence complète'),
  R(2, '§5 Préparation', 'Fiche de préparation (phases minutées, différenciation, critères, bilan), modèles, duplication'),
  R(2, '§5 Préparation', 'Manuels (Picot, Accès, Retz… configurables, sans contenu prérempli), pages et pièces jointes'),
  R(4, '§5 Préparation', 'OCR optionnel avec texte incertain signalé', 'afaire', 'Local et gratuit si possible ; OCR distant facultatif.'),
  R(5, '§5 Préparation', 'Génération assistée par IA (facultative, sources visibles, aucune donnée élève envoyée)'),
  R(2, '§5 Préparation', 'Leçons numérotées liées aux séances, devoirs, évaluations ; distribution réelle'),
  R(2, '§5 Préparation', 'Photos du tableau et corrections ; suivi des apprentissages à reprendre'),

  // ── §6 Agenda, EDT, cahier journal
  R(2, '§6 Planifier', 'EDT de référence par période, duplication, récurrences'),
  R(2, '§6 Planifier', 'Exceptions datées (sortie, absence, visite, réunion, report)'),
  R(2, '§6 Planifier', 'Interventions (contact, lieu, dates, créneaux, groupes) ; « à planifier » sans bloquer'),
  R(2, '§6 Planifier', 'Conflits et propositions de report ajustables, sans décalage automatique'),
  R(2, '§6 Planifier', 'Vues jour/semaine/période ; temps par matière avec référentiel configurable'),
  R(2, '§6 Planifier', 'Cahier journal depuis l’EDT : bilan express, faite/partielle/reportée, historique'),
  R(2, '§6 Planifier', 'Rituels récurrents ; liste consolidée matériel/photocopies'),
  R(2, '§6 Planifier', 'Agenda personnel et professionnel, tâches, échéances'),
  R(4, '§6 Planifier', 'Répartition des préparations avec la binôme'),
  R(5, '§6 Planifier', 'Notifications configurables'),

  // ── §7 Appel et quotidien
  R(3, '§7 Quotidien', 'Appel matin/après-midi (absent, retard, départ, absence partielle), validation'),
  R(3, '§7 Quotidien', 'Cantine, étude, périscolaire : semaine type, exceptions, listes imprimables'),
  R(3, '§7 Quotidien', 'Départ seul/accompagné, personnes autorisées, exceptions'),
  R(3, '§7 Quotidien', 'Responsabilités et rotations'),
  R(3, '§7 Quotidien', 'Trombinoscope (photo ou silhouette), vues classe/niveau/groupe, impression'),

  // ── §8 Fiches élèves
  R(1, '§8 Élèves', 'Fiche élève : identité, responsables multiples, téléphones/emails, contact prioritaire, urgence, personnes autorisées', 'fait'),
  R(3, '§8 Élèves', 'Statuts documentaires (à recevoir/reçu/à compléter, relance), assurance avec validité'),
  R(3, '§8 Élèves', 'Droit à l’image par usage (autorisé/refusé/à renseigner), justificatif'),
  R(3, '§8 Élèves', 'Observations datées par domaine, réussites, difficultés, actions'),
  R(3, '§8 Élèves', 'Besoins particuliers (confirmé vs observation) ; PPRE/PAP/PPS/PAI/AESH à accès restreint'),
  R(3, '§8 Élèves', 'Niveau par domaine daté ; aides efficaces et historique'),
  R(3, '§8 Élèves', 'Différenciation dans les préparations (sans adaptation automatique sur diagnostic)'),
  R(3, '§8 Élèves', 'Portfolio lié aux compétences ; historique des échanges'),

  // ── §9 Listes
  R(3, '§9 Listes', 'Listes personnalisables (colonnes case/date/texte/montant/choix, filtres, tri, actions groupées)'),
  R(3, '§9 Listes', 'Colonnes liées qui actualisent la donnée (assurance, autorisation, paiement)'),
  R(3, '§9 Listes', 'Modèles réutilisables d’une année à l’autre ; impression vierge ou remplie'),

  // ── §10 Devoirs, évaluations, rattrapage
  R(2, '§10 Suivi', 'Devoirs datés liés aux séances/leçons, destinataires, publication volontaire'),
  R(3, '§10 Suivi', 'Évaluations : grille, notes et/ou maîtrise, non évalué, versions adaptées, aucune conversion silencieuse'),
  R(3, '§10 Suivi', 'Bilans et appréciations modifiables ; livrets par période ; adaptation maternelle'),
  R(5, '§10 Suivi', 'Export compatible LSU (à vérifier séparément, sans remplacer le service officiel)'),
  R(3, '§10 Suivi', 'Rattrapage : absences × séances réellement faites × supports distribués ; remis/rattrapé'),

  // ── §11 Fichiers, diaporamas, charte
  R(1, '§11 Fichiers', 'Espace fichiers : dossiers, tags, année/matière/niveau/projet, recherche, favoris', 'fait'),
  R(1, '§11 Fichiers', 'Aperçu (images, PDF, texte) et versions', 'fait', 'Les autres formats se téléchargent.'),
  R(1, '§11 Fichiers', 'Liens externes (Drive, Canva…) opérationnels sans connexion authentifiée', 'fait'),
  R(2, '§11 Fichiers', 'Réutilisation par lien (sans duplication) depuis séances et préparations'),
  R(3, '§11 Fichiers', 'Diaporamas par séance, vue hebdomadaire, liste de projection du jour'),
  R(3, '§11 Fichiers', 'Import PDF/images affichables ; PPTX : conversion nécessaire expliquée'),
  R(3, '§11 Fichiers', 'Éditeur simple de diapositives (titre, texte, image, consigne, exercice, timer)'),
  R(3, '§11 Fichiers', 'Mode projection séparé sans données privées ; notes présentateur'),
  R(4, '§11 Fichiers', 'Charte visuelle enregistrée'),
  R(4, '§11 Fichiers', 'Générateur d’étiquettes, affichages, cartes d’ateliers ; académies (noms, couleurs, emblèmes), série, PDF à taille réelle'),

  // ── §12 Organisation et finances
  R(4, '§12 Organisation', 'Réunions : notes, compte rendu, décisions, tâches, liens agenda/élèves'),
  R(4, '§12 Organisation', 'Transmissions binôme (fait/à terminer/information, accusé de lecture)'),
  R(4, '§12 Organisation', 'Répertoire de l’école et des intervenants'),
  R(4, '§12 Organisation', '108 h : activités, prévu/réalisé, totaux, export (règles à vérifier)'),
  R(4, '§12 Organisation', 'APC : objectifs, élèves, séances, présences, bilan, comptage unique'),
  R(4, '§12 Organisation', 'Module PES : échéances INSPE, visites, objectifs, retours'),
  R(4, '§12 Organisation', 'Dossiers remplacement/visite personnalisables'),
  R(4, '§12 Organisation', 'Argent et projets : attendu/reçu/reste, paiements partiels, journal unique, corrections traçables, comptes par année'),
  R(4, '§12 Organisation', 'Projets transdisciplinaires ; matériel (stocks, achats, prêts)'),

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
  R(2, '§14 Exports', 'Impression EDT, cahier journal, préparations, séquences, progressions'),
  R(3, '§14 Exports', 'Impression listes, trombinoscope, devoirs, rattrapage, évaluations, bilans'),
  R(4, '§14 Exports', 'Dossier de semaine ; finances ; étiquettes à taille réelle'),
  R(3, '§14 Exports', 'Profils d’export enseignant/élèves/familles/remplaçant ; exclusions par défaut'),

  // ── §15 Fiabilité
  R(1, '§15 Fiabilité', 'Utilisable téléphone, tablette, ordinateur', 'fait'),
  R(1, '§15 Fiabilité', 'Sauvegarde persistante sur l’appareil, état visible', 'fait'),
  R(1, '§15 Fiabilité', 'Annulation et corbeille (récupération après suppression)', 'fait'),
  R(1, '§15 Fiabilité', 'Hors connexion : application entière (données locales)', 'fait'),
  R(5, '§15 Fiabilité', 'Comptes personnels, rôles enseignant/binôme/parent, permissions côté serveur'),
  R(5, '§15 Fiabilité', 'Synchronisation, file de modifications et conflits explicites'),
  R(3, '§15 Fiabilité', 'Accès restreint aux données sensibles (santé, accompagnements) ; jamais en projection/recherche'),
  R(5, '§15 Fiabilité', 'Vérifier le cadre d’hébergement avant données réelles d’enfants'),

  // ── §19 Atelier
  R(3, '§19 Atelier', 'Timer de couleur persistant (widget flottant, plein écran, heure cible)'),
  R(3, '§19 Atelier', 'Écriture : lignes Seyès, réglures, textes à compléter'),
  R(3, '§19 Atelier', 'Maths : droites graduées, numération, fractions, horloges'),
  R(4, '§19 Atelier', 'Géométrie : quadrillages, figures, instruments virtuels, fiches et corrections'),
  R(4, '§19 Atelier', 'Cartes monde/continents/France à partir de données sourcées'),
  R(4, '§19 Atelier', 'Jeux : memory, associations, classement, remise en ordre, quiz, bingo, cartes'),
  R(4, '§19 Atelier', 'Anglais : flashcards, affiches, vocabulaire, dialogues, audio sourcé'),
  R(4, '§19 Atelier', 'Modes concevoir/animer plein écran, annotation, tactile'),
  R(4, '§19 Atelier', 'Fenêtre de projection séparée / image dans l’image si supporté'),

  // ── §20 Plans, groupes, EPS
  R(3, '§20 Plans', 'Plan de classe visuel : mobilier, modèles, dispositions nommées par période/séance'),
  R(3, '§20 Plans', 'Groupes manuels ou aléatoires, absents, rôles, rotations ; groupes de séance figés'),
  R(4, '§20 Plans', 'Fiches de groupes imprimables/projetables (version enseignant séparée)'),
  R(4, '§20 Plans', 'Éditeur de schémas EPS lié aux préparations et au cahier journal'),

  // ── §21-22 PWA, sync, budget, visites
  R(1, '§21 PWA', 'Application web installable (manifeste, icônes, fonctionnement hors ligne)', 'fait'),
  R(1, '§21 PWA', 'Sauvegarde téléchargeable (données + fichiers), restauration vérifiée, versions', 'fait'),
  R(5, '§21 PWA', 'Sauvegarde automatique en ligne et synchronisation entre appareils', 'configurer', 'Demande un service distant : tableau gratuit/limites/coûts à valider avant intégration.'),
  R(5, '§21 PWA', 'Politique de rétention distante'),
  R(2, '§22 Visites', 'Préparations liées au référentiel, à la programmation, progression, séquence, cahier journal'),
  R(2, '§22 Visites', 'Modèle structuré pour visite/inspection, allégeable, export PDF et version vierge'),
  R(2, '§22 Visites', 'Import/reproduction du modèle personnel de l’utilisatrice'),

  // ── §23 Bibliothèque
  R(3, '§23 Bibliothèque', 'Catalogue (exemplaires distincts) et prêts ; un exemplaire = un prêt actif'),
  R(3, '§23 Bibliothèque', 'Vues par livre/élève, retards, retour en un clic, impressions, grille vierge'),
  R(3, '§23 Bibliothèque', 'Prêts ouverts signalés au départ d’un élève ou au changement d’année'),
  R(4, '§23 Bibliothèque', 'Scan code-barres/QR (facultatif)'),
];

// Sous-pages de chaque rubrique et l'étape où elles arrivent.
// `route` = sous-page réalisée ; sinon on affiche honnêtement « à venir ».
export const RUBRIQUES = [
  { id: 'aujourdhui', titre: 'Aujourd’hui', icone: 'sun', sous: [
    { id: 'journee', titre: 'Ma journée', route: 'aujourdhui' },
    { id: 'appel', titre: 'Appel rapide', etape: 3 },
    { id: 'taches', titre: 'Tâches et rendez-vous', etape: 2 },
    { id: 'projection', titre: 'Projection', etape: 3 },
  ]},
  { id: 'preparer', titre: 'Préparer', icone: 'book', sous: [
    { id: 'fichiers', titre: 'Fichiers et ressources', route: 'fichiers' },
    { id: 'programmes', titre: 'Programmes et référentiels', etape: 2 },
    { id: 'programmations', titre: 'Programmations', etape: 2 },
    { id: 'progressions', titre: 'Progressions', etape: 2 },
    { id: 'sequences', titre: 'Séquences', etape: 2 },
    { id: 'preparations', titre: 'Préparations', etape: 2 },
    { id: 'manuels', titre: 'Manuels', etape: 2 },
    { id: 'lecons', titre: 'Leçons', etape: 2 },
    { id: 'diaporamas', titre: 'Diaporamas', etape: 3 },
    { id: 'atelier', titre: 'Atelier pédagogique', etape: 3 },
    { id: 'etiquettes', titre: 'Étiquettes et affichages', etape: 4 },
  ]},
  { id: 'planifier', titre: 'Planifier', icone: 'calendar', sous: [
    { id: 'agenda', titre: 'Agenda', etape: 2 },
    { id: 'edt', titre: 'Emploi du temps', etape: 2 },
    { id: 'cahier', titre: 'Cahier journal', etape: 2 },
    { id: 'devoirs', titre: 'Devoirs', etape: 2 },
    { id: 'interventions', titre: 'Interventions', etape: 2 },
    { id: 'ateliers', titre: 'Ateliers et rotations', etape: 3 },
  ]},
  { id: 'classe', titre: 'Ma classe', icone: 'users', sous: [
    { id: 'eleves', titre: 'Élèves', route: 'eleves' },
    { id: 'trombi', titre: 'Trombinoscope', etape: 3 },
    { id: 'evaluations', titre: 'Évaluations', etape: 3 },
    { id: 'livrets', titre: 'Livrets et bilans', etape: 3 },
    { id: 'differenciation', titre: 'Différenciation', etape: 3 },
    { id: 'rattrapage', titre: 'Rattrapage', etape: 3 },
    { id: 'listes', titre: 'Listes', etape: 3 },
    { id: 'plan', titre: 'Plan de classe et groupes', etape: 3 },
    { id: 'responsabilites', titre: 'Responsabilités', etape: 3 },
    { id: 'bibliotheque', titre: 'Bibliothèque', etape: 3 },
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
    { id: 'reunions', titre: 'Réunions et notes', etape: 4 },
    { id: 'heures', titre: '108 h et APC', etape: 4 },
    { id: 'transmissions', titre: 'Transmissions binôme', etape: 4 },
    { id: 'argent', titre: 'Argent et projets', etape: 4 },
    { id: 'materiel', titre: 'Matériel', etape: 4 },
    { id: 'contacts', titre: 'Contacts', etape: 4 },
    { id: 'remplacement', titre: 'Dossier remplacement', etape: 4 },
    { id: 'pes', titre: 'PES et visites', etape: 4 },
  ]},
];
