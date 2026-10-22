# Feuille de route — suivi de tout le cahier des charges

Fichier généré depuis `js/roadmap.js` (`node tools/roadmap-md.mjs`). La même liste est consultable dans l’application : Réglages › Feuille de route.

Légende : ✅ Réalisé (55) · 🟡 Partiel (4) · ⚙️ À configurer (1) · ⬜ À développer (71) — 131 entrées.

## Étape 1 — Socle

| | Section | Fonction | Note |
|---|---|---|---|
| ✅ | §2 Navigation | Six rubriques sur ordinateur (Aujourd’hui, Préparer, Planifier, Ma classe, Familles, Organisation) |  |
| ✅ | §2 Navigation | Réglages séparés |  |
| ✅ | §2 Navigation | Barre téléphone : Aujourd’hui, Planifier, Ma classe, Plus |  |
| ✅ | §2 Navigation | Favoris personnalisables |  |
| ✅ | §2 Navigation | Recherche globale | Élèves, classes, fichiers, notes, pages. Les modules masqués sont exclus. |
| ✅ | §2 Navigation | Bouton d’ajout rapide | Élève, note, fichier, lien. S’enrichira à chaque étape. |
| 🟡 | §2 Navigation | Liens contextuels entre pages | Élèves, classes, fichiers, programmation ↔ progression ↔ séquence ↔ séance ↔ cahier journal ↔ leçons/devoirs. Suite avec les modules des étapes 3-5. |
| ✅ | §2 Navigation | Modules masquables sans effacer les données |  |
| ✅ | §2 Navigation | Sélecteur d’année et de classe visible |  |
| ✅ | §2 Navigation | Boîte de réception (photo, PDF, note à classer plus tard) |  |
| ✅ | §3 Données | Identifiants stables, liens par identifiant (jamais par nom) |  |
| ✅ | §3 Données | Historique auteur/date des modifications |  |
| ✅ | §4 Années | Créer plusieurs années (périodes datées) et classes | Préréglage zone C 2026-2027 sourcé. |
| ✅ | §4 Années | Niveaux multiples par classe et cycle déduit |  |
| ✅ | §4 Années | Ajouter, modifier, archiver, importer (CSV) les élèves |  |
| ✅ | §4 Années | Arrivées/départs en cours d’année sans altérer l’historique | Inscriptions datées ; listes consultables à une date. |
| ✅ | §8 Élèves | Fiche élève : identité, responsables multiples, téléphones/emails, contact prioritaire, urgence, personnes autorisées |  |
| ✅ | §11 Fichiers | Espace fichiers : dossiers, tags, année/matière/niveau/projet, recherche, favoris |  |
| ✅ | §11 Fichiers | Aperçu (images, PDF, texte) et versions | Les autres formats se téléchargent. |
| ✅ | §11 Fichiers | Liens externes (Drive, Canva…) opérationnels sans connexion authentifiée |  |
| ✅ | §13 Connexions | Statut des connexions affiché honnêtement (Drive, Canva, agendas, LSU, mail) |  |
| ✅ | §14 Exports | Liste d’élèves : aperçu, A4 portrait/paysage, colonnes, version vierge, impression |  |
| ✅ | §14 Exports | Export CSV (élèves, fichiers) |  |
| ✅ | §14 Exports | Sauvegarde complète réimportable |  |
| ✅ | §15 Fiabilité | Utilisable téléphone, tablette, ordinateur |  |
| ✅ | §15 Fiabilité | Sauvegarde persistante sur l’appareil, état visible |  |
| ✅ | §15 Fiabilité | Annulation et corbeille (récupération après suppression) |  |
| ✅ | §15 Fiabilité | Hors connexion : application entière (données locales) |  |
| ✅ | §21 PWA | Application web installable (manifeste, icônes, fonctionnement hors ligne) |  |
| ✅ | §21 PWA | Sauvegarde téléchargeable (données + fichiers), restauration vérifiée, versions |  |

## Étape 2 — Préparation liée

| | Section | Fonction | Note |
|---|---|---|---|
| ✅ | §3 Données | Chaîne programme → programmation → progression → séquence → séances/préparations |  |
| ✅ | §3 Données | Distinguer « lier » et « dupliquer » ; modèle réutilisable vs séance datée |  |
| 🟡 | §3 Données | Distinguer prévu/réalisé, préparé/publié ; le futur ne réécrit pas le passé | Prévu/réalisé (instantané figé) et EDT versionné : faits. Publié : avec le portail familles (étape 5). |
| ✅ | §4 Années | Reprendre modèles, séquences, ressources d’une année précédente (sans paiements, autorisations, résultats) |  |
| ✅ | §4 Années | Référentiels sourcés, datés, versionnés ; import vérifié avant intégration | Aucun contenu officiel prérempli : import puis validation par l’enseignante. |
| ✅ | §4 Années | Multiniveau : programmations/progressions par niveau, séquences communes, consignes distinctes |  |
| ✅ | §4 Années | Cahier journal en colonnes parallèles ; travail dirigé/autonomie/ateliers |  |
| ✅ | §4 Années | Signaler deux activités exigeant simultanément l’enseignant |  |
| ✅ | §5 Préparation | Programmations annuelles et progressions (ajouter, déplacer, ordonner, suivre les notions) | D’après les modèles de Julia ; import d’un tableau de notions. |
| ✅ | §5 Préparation | Bilans de période (notions réalisées et restantes) |  |
| ✅ | §5 Préparation | Fiche de séquence complète |  |
| ✅ | §5 Préparation | Fiche de préparation (phases minutées, différenciation, critères, bilan), modèles, duplication | Phases typées du modèle de Julia ; modes quotidien/visite ; version vierge. |
| ✅ | §5 Préparation | Manuels (Picot, Accès, Retz… configurables, sans contenu prérempli), pages et pièces jointes |  |
| ✅ | §5 Préparation | Leçons numérotées liées aux séances, devoirs, évaluations ; distribution réelle |  |
| 🟡 | §5 Préparation | Photos du tableau et corrections ; suivi des apprentissages à reprendre | Photos du tableau et corrections : faites. Liste « à reprendre » par élève : avec le rattrapage (étape 3). |
| ✅ | §6 Planifier | EDT de référence par période, duplication, récurrences | Versions datées : une modification ne réécrit pas les journées passées. |
| ✅ | §6 Planifier | Exceptions datées (sortie, absence, visite, réunion, report) |  |
| ✅ | §6 Planifier | Interventions (contact, lieu, dates, créneaux, groupes) ; « à planifier » sans bloquer |  |
| ✅ | §6 Planifier | Conflits et propositions de report ajustables, sans décalage automatique |  |
| ✅ | §6 Planifier | Vues jour/semaine/période ; temps par matière avec référentiel configurable | Jour et semaine (cahier journal), semaine et mois (agenda), période (progression). Référence horaire saisie par l’enseignante. |
| ✅ | §6 Planifier | Cahier journal depuis l’EDT : bilan express, faite/partielle/reportée, historique |  |
| ✅ | §6 Planifier | Rituels récurrents ; liste consolidée matériel/photocopies |  |
| ✅ | §6 Planifier | Agenda personnel et professionnel, tâches, échéances |  |
| 🟡 | §10 Suivi | Devoirs datés liés aux séances/leçons, destinataires, publication volontaire | Préparé / donné : fait. Publication aux familles : étape 5. |
| ✅ | §11 Fichiers | Réutilisation par lien (sans duplication) depuis séances et préparations |  |
| ✅ | §14 Exports | Impression EDT, cahier journal, préparations, séquences, progressions |  |
| ✅ | §22 Visites | Préparations liées au référentiel, à la programmation, progression, séquence, cahier journal |  |
| ✅ | §22 Visites | Modèle structuré pour visite/inspection, allégeable, export PDF et version vierge |  |
| ✅ | §22 Visites | Import/reproduction du modèle personnel de l’utilisatrice | Modèles de Julia reproduits (programmation, progression, séquence, séance). |

## Étape 3 — Usage en classe

| | Section | Fonction | Note |
|---|---|---|---|
| ⬜ | §3 Données | Distinguer remis/rattrapé, non évalué/non acquis, inscription/présence prévue |  |
| ⬜ | §4 Années | Groupes de besoin transversaux, ateliers et rotations |  |
| ⬜ | §7 Quotidien | Appel matin/après-midi (absent, retard, départ, absence partielle), validation |  |
| ⬜ | §7 Quotidien | Cantine, étude, périscolaire : semaine type, exceptions, listes imprimables |  |
| ⬜ | §7 Quotidien | Départ seul/accompagné, personnes autorisées, exceptions |  |
| ⬜ | §7 Quotidien | Responsabilités et rotations |  |
| ⬜ | §7 Quotidien | Trombinoscope (photo ou silhouette), vues classe/niveau/groupe, impression |  |
| ⬜ | §8 Élèves | Statuts documentaires (à recevoir/reçu/à compléter, relance), assurance avec validité |  |
| ⬜ | §8 Élèves | Droit à l’image par usage (autorisé/refusé/à renseigner), justificatif |  |
| ⬜ | §8 Élèves | Observations datées par domaine, réussites, difficultés, actions |  |
| ⬜ | §8 Élèves | Besoins particuliers (confirmé vs observation) ; PPRE/PAP/PPS/PAI/AESH à accès restreint |  |
| ⬜ | §8 Élèves | Niveau par domaine daté ; aides efficaces et historique |  |
| ⬜ | §8 Élèves | Différenciation dans les préparations (sans adaptation automatique sur diagnostic) |  |
| ⬜ | §8 Élèves | Portfolio lié aux compétences ; historique des échanges |  |
| ⬜ | §9 Listes | Listes personnalisables (colonnes case/date/texte/montant/choix, filtres, tri, actions groupées) |  |
| ⬜ | §9 Listes | Colonnes liées qui actualisent la donnée (assurance, autorisation, paiement) |  |
| ⬜ | §9 Listes | Modèles réutilisables d’une année à l’autre ; impression vierge ou remplie |  |
| ⬜ | §10 Suivi | Évaluations : grille, notes et/ou maîtrise, non évalué, versions adaptées, aucune conversion silencieuse |  |
| ⬜ | §10 Suivi | Bilans et appréciations modifiables ; livrets par période ; adaptation maternelle |  |
| ⬜ | §10 Suivi | Rattrapage : absences × séances réellement faites × supports distribués ; remis/rattrapé |  |
| ⬜ | §11 Fichiers | Diaporamas par séance, vue hebdomadaire, liste de projection du jour |  |
| ⬜ | §11 Fichiers | Import PDF/images affichables ; PPTX : conversion nécessaire expliquée |  |
| ⬜ | §11 Fichiers | Éditeur simple de diapositives (titre, texte, image, consigne, exercice, timer) |  |
| ⬜ | §11 Fichiers | Mode projection séparé sans données privées ; notes présentateur |  |
| ⬜ | §14 Exports | Impression listes, trombinoscope, devoirs, rattrapage, évaluations, bilans |  |
| ⬜ | §14 Exports | Profils d’export enseignant/élèves/familles/remplaçant ; exclusions par défaut |  |
| ⬜ | §15 Fiabilité | Accès restreint aux données sensibles (santé, accompagnements) ; jamais en projection/recherche |  |
| ⬜ | §19 Atelier | Timer de couleur persistant (widget flottant, plein écran, heure cible) |  |
| ⬜ | §19 Atelier | Écriture : lignes Seyès, réglures, textes à compléter |  |
| ⬜ | §19 Atelier | Maths : droites graduées, numération, fractions, horloges |  |
| ⬜ | §20 Plans | Plan de classe visuel : mobilier, modèles, dispositions nommées par période/séance |  |
| ⬜ | §20 Plans | Groupes manuels ou aléatoires, absents, rôles, rotations ; groupes de séance figés |  |
| ⬜ | §23 Bibliothèque | Catalogue (exemplaires distincts) et prêts ; un exemplaire = un prêt actif |  |
| ⬜ | §23 Bibliothèque | Vues par livre/élève, retards, retour en un clic, impressions, grille vierge |  |
| ⬜ | §23 Bibliothèque | Prêts ouverts signalés au départ d’un élève ou au changement d’année |  |

## Étape 4 — Organisation

| | Section | Fonction | Note |
|---|---|---|---|
| ⬜ | §5 Préparation | OCR optionnel avec texte incertain signalé | Local et gratuit si possible ; OCR distant facultatif. |
| ⬜ | §6 Planifier | Répartition des préparations avec la binôme |  |
| ⬜ | §11 Fichiers | Charte visuelle enregistrée |  |
| ⬜ | §11 Fichiers | Générateur d’étiquettes, affichages, cartes d’ateliers ; académies (noms, couleurs, emblèmes), série, PDF à taille réelle |  |
| ⬜ | §12 Organisation | Réunions : notes, compte rendu, décisions, tâches, liens agenda/élèves |  |
| ⬜ | §12 Organisation | Transmissions binôme (fait/à terminer/information, accusé de lecture) |  |
| ⬜ | §12 Organisation | Répertoire de l’école et des intervenants |  |
| ⬜ | §12 Organisation | 108 h : activités, prévu/réalisé, totaux, export (règles à vérifier) |  |
| ⬜ | §12 Organisation | APC : objectifs, élèves, séances, présences, bilan, comptage unique |  |
| ⬜ | §12 Organisation | Module PES : échéances INSPE, visites, objectifs, retours |  |
| ⬜ | §12 Organisation | Dossiers remplacement/visite personnalisables |  |
| ⬜ | §12 Organisation | Argent et projets : attendu/reçu/reste, paiements partiels, journal unique, corrections traçables, comptes par année |  |
| ⬜ | §12 Organisation | Projets transdisciplinaires ; matériel (stocks, achats, prêts) |  |
| ⬜ | §14 Exports | Dossier de semaine ; finances ; étiquettes à taille réelle |  |
| ⬜ | §19 Atelier | Géométrie : quadrillages, figures, instruments virtuels, fiches et corrections |  |
| ⬜ | §19 Atelier | Cartes monde/continents/France à partir de données sourcées |  |
| ⬜ | §19 Atelier | Jeux : memory, associations, classement, remise en ordre, quiz, bingo, cartes |  |
| ⬜ | §19 Atelier | Anglais : flashcards, affiches, vocabulaire, dialogues, audio sourcé |  |
| ⬜ | §19 Atelier | Modes concevoir/animer plein écran, annotation, tactile |  |
| ⬜ | §19 Atelier | Fenêtre de projection séparée / image dans l’image si supporté |  |
| ⬜ | §20 Plans | Fiches de groupes imprimables/projetables (version enseignant séparée) |  |
| ⬜ | §20 Plans | Éditeur de schémas EPS lié aux préparations et au cahier journal |  |
| ⬜ | §23 Bibliothèque | Scan code-barres/QR (facultatif) |  |

## Étape 5 — Collaboration et connexions

| | Section | Fonction | Note |
|---|---|---|---|
| ⬜ | §5 Préparation | Génération assistée par IA (facultative, sources visibles, aucune donnée élève envoyée) |  |
| ⬜ | §6 Planifier | Notifications configurables |  |
| ⬜ | §10 Suivi | Export compatible LSU (à vérifier séparément, sans remplacer le service officiel) |  |
| ⬜ | §13 Familles | Comptes responsables liés aux bons enfants (contrôle côté serveur) |  |
| ⬜ | §13 Familles | Messages, documents, devoirs, autorisations ; consultation/réponse/retour |  |
| ⬜ | §13 Familles | Préparation privée jusqu’à publication ; aperçu « comme ce parent » |  |
| ⬜ | §13 Familles | Réservation de rendez-vous sur créneaux ouverts, sans double réservation |  |
| ⬜ | §13 Familles | Mail académique (selon fournisseur et accès autorisés) |  |
| ⬜ | §13 Connexions | Connexions Drive, Canva, agendas, LSU vérifiées une par une |  |
| ⬜ | §15 Fiabilité | Comptes personnels, rôles enseignant/binôme/parent, permissions côté serveur |  |
| ⬜ | §15 Fiabilité | Synchronisation, file de modifications et conflits explicites |  |
| ⬜ | §15 Fiabilité | Vérifier le cadre d’hébergement avant données réelles d’enfants |  |
| ⚙️ | §21 PWA | Sauvegarde automatique en ligne et synchronisation entre appareils | Demande un service distant : tableau gratuit/limites/coûts à valider avant intégration. |
| ⬜ | §21 PWA | Politique de rétention distante |  |
