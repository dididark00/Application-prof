# Feuille de route — suivi de tout le cahier des charges

Fichier généré depuis `js/roadmap.js` (`node tools/roadmap-md.mjs`). La même liste est consultable dans l’application : Réglages › Feuille de route.

Légende : ✅ Réalisé (182) · 🟡 Partiel (3) · ⚙️ À configurer (0) · ⬜ À développer (0) · ✖️ Retiré (impossible gratuitement, sans serveur) (10) — 195 entrées.

## Étape 1 — Socle

| | Section | Fonction | Note |
|---|---|---|---|
| ✅ | §2 Navigation | Six rubriques sur ordinateur (Aujourd’hui, Préparer, Planifier, Ma classe, Familles, Organisation) |  |
| ✅ | §2 Navigation | Réglages séparés |  |
| ✅ | §2 Navigation | Barre téléphone : Aujourd’hui, Planifier, Ma classe, Plus |  |
| ✅ | §2 Navigation | Favoris personnalisables |  |
| ✅ | §2 Navigation | Recherche globale | Élèves, classes, fichiers, notes, pages. Les modules masqués sont exclus. |
| ✅ | §2 Navigation | Bouton d’ajout rapide | Élève, note, fichier, lien. S’enrichira à chaque étape. |
| ✅ | §2 Navigation | Liens contextuels entre pages | Élèves, classes, fichiers, programmation ↔ progression ↔ séquence ↔ séance ↔ cahier journal ↔ leçons/devoirs, évaluations, familles. |
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
| ✅ | §3 Données | Distinguer prévu/réalisé, préparé/publié ; le futur ne réécrit pas le passé | Prévu/réalisé (instantané figé), EDT versionné ; « publié » = marqué « diffusé » dans Familles. |
| ✅ | §4 Années | Reprendre modèles, séquences, ressources d’une année précédente (sans paiements, autorisations, résultats) |  |
| ✅ | §4 Années | Référentiels sourcés, datés, versionnés ; import vérifié avant intégration | Aucun contenu officiel prérempli : import puis validation par l’enseignante. |
| ✅ | §4 Années | Multiniveau : programmations/progressions par niveau, séquences communes, consignes distinctes |  |
| ✅ | §4 Années | Cahier journal en colonnes parallèles ; travail dirigé/autonomie/ateliers |  |
| ✅ | §4 Années | Signaler deux activités exigeant simultanément l’enseignant |  |
| ✅ | §5 Préparation | Programmations annuelles et progressions (ajouter, déplacer, ordonner, suivre les notions) | D’après les modèles de l’enseignante ; import d’un tableau de notions. |
| ✅ | §5 Préparation | Bilans de période (notions réalisées et restantes) |  |
| ✅ | §5 Préparation | Fiche de séquence complète |  |
| ✅ | §5 Préparation | Fiche de préparation (phases minutées, différenciation, critères, bilan), modèles, duplication | Phases typées du modèle de l’enseignante ; modes quotidien/visite ; version vierge. |
| ✅ | §5 Préparation | Manuels (Picot, Accès, Retz… configurables, sans contenu prérempli), pages et pièces jointes |  |
| ✅ | §5 Préparation | Leçons numérotées liées aux séances, devoirs, évaluations ; distribution réelle |  |
| ✅ | §5 Préparation | Photos du tableau et corrections ; suivi des apprentissages à reprendre | Photos du tableau et corrections ; liste « à reprendre » par élève (Rattrapage). |
| ✅ | §6 Planifier | EDT de référence par période, duplication, récurrences | Versions datées : une modification ne réécrit pas les journées passées. |
| ✅ | §6 Planifier | Exceptions datées (sortie, absence, visite, réunion, report) |  |
| ✅ | §6 Planifier | Interventions (contact, lieu, dates, créneaux, groupes) ; « à planifier » sans bloquer |  |
| ✅ | §6 Planifier | Conflits et propositions de report ajustables, sans décalage automatique |  |
| ✅ | §6 Planifier | Vues jour/semaine/période ; temps par matière avec référentiel configurable | Jour et semaine (cahier journal), semaine et mois (agenda), période (progression). Référence horaire saisie par l’enseignante. |
| ✅ | §6 Planifier | Cahier journal depuis l’EDT : bilan express, faite/partielle/reportée, historique |  |
| ✅ | §6 Planifier | Rituels récurrents ; liste consolidée matériel/photocopies |  |
| ✅ | §6 Planifier | Agenda personnel et professionnel, tâches, échéances |  |
| ✅ | §10 Suivi | Devoirs datés liés aux séances/leçons, destinataires, publication volontaire | Préparé / donné ; transmis aux familles par le cahier de texte, un mot, un e-mail ou l’application de l’école. |
| ✅ | §11 Fichiers | Réutilisation par lien (sans duplication) depuis séances et préparations |  |
| ✅ | §14 Exports | Impression EDT, cahier journal, préparations, séquences, progressions |  |
| ✅ | §22 Visites | Préparations liées au référentiel, à la programmation, progression, séquence, cahier journal |  |
| ✅ | §22 Visites | Modèle structuré pour visite/inspection, allégeable, export PDF et version vierge |  |
| ✅ | §22 Visites | Import/reproduction du modèle personnel de l’utilisatrice | Modèles de l’enseignante reproduits (programmation, progression, séquence, séance). |

## Étape 3 — Usage en classe

| | Section | Fonction | Note |
|---|---|---|---|
| ✅ | §3 Données | Distinguer remis/rattrapé, non évalué/non acquis, inscription/présence prévue |  |
| ✅ | §4 Années | Groupes de besoin transversaux, ateliers et rotations |  |
| ✅ | §5 Préparation | Programmes officiels en vigueur par niveau (TPS–CM2), avec liens BO et PDF, et création d’un référentiel prérempli | Références relevées sur Éduscol le 22/10/2026. |
| ✅ | §7 Quotidien | Appel matin/après-midi (absent, retard, départ, absence partielle), validation |  |
| ✅ | §7 Quotidien | Cantine, étude, périscolaire : semaine type, exceptions, listes imprimables |  |
| ✅ | §7 Quotidien | Départ seul/accompagné, personnes autorisées, exceptions |  |
| ✅ | §7 Quotidien | Responsabilités et rotations |  |
| ✅ | §7 Quotidien | Trombinoscope (photo ou silhouette), vues classe/niveau/groupe, impression |  |
| ✅ | §8 Élèves | Statuts documentaires (à recevoir/reçu/à compléter, relance), assurance avec validité |  |
| ✅ | §8 Élèves | Droit à l’image par usage (autorisé/refusé/à renseigner), justificatif |  |
| ✅ | §8 Élèves | Observations datées par domaine, réussites, difficultés, actions |  |
| ✅ | §8 Élèves | Besoins particuliers (confirmé vs observation) ; PPRE/PAP/PPS/PAI/AESH à accès restreint | Masqués par défaut (code facultatif), hors recherche et projection. |
| ✅ | §8 Élèves | Niveau par domaine daté ; aides efficaces et historique |  |
| ✅ | §8 Élèves | Différenciation dans les préparations (sans adaptation automatique sur diagnostic) |  |
| ✅ | §8 Élèves | Portfolio lié aux compétences ; historique des échanges |  |
| ✅ | §9 Listes | Listes personnalisables (colonnes case/date/texte/montant/choix, filtres, tri, actions groupées) |  |
| ✅ | §9 Listes | Colonnes liées qui actualisent la donnée (assurance, autorisation, paiement) | Documents, autorisations, droit à l’image, paiements d’un projet (Argent et projets). |
| ✅ | §9 Listes | Modèles réutilisables d’une année à l’autre ; impression vierge ou remplie |  |
| ✅ | §10 Suivi | Évaluations : grille, notes et/ou maîtrise, non évalué, versions adaptées, aucune conversion silencieuse |  |
| ✅ | §10 Suivi | Bilans et appréciations modifiables ; livrets par période ; adaptation maternelle | Export tabulaire des appréciations à reporter dans le LSU ; vocabulaire adapté en maternelle. |
| ✅ | §10 Suivi | Rattrapage : absences × séances réellement faites × supports distribués ; remis/rattrapé |  |
| ✅ | §11 Fichiers | Diaporamas par séance, vue hebdomadaire, liste de projection du jour |  |
| ✅ | §11 Fichiers | Import PDF/images affichables ; PPTX : conversion nécessaire expliquée |  |
| ✅ | §11 Fichiers | Éditeur simple de diapositives (titre, texte, image, consigne, exercice, timer) |  |
| ✅ | §11 Fichiers | Mode projection séparé sans données privées ; notes présentateur |  |
| ✅ | §14 Exports | Impression listes, trombinoscope, devoirs, rattrapage, évaluations, bilans |  |
| 🟡 | §14 Exports | Profils d’export enseignant/élèves/familles/remplaçant ; exclusions par défaut | Impressions familles déjà filtrées (bilans, rattrapage, listes). Profils d’export complets avec le dossier remplaçant (étape 4). |
| ✅ | §15 Fiabilité | Accès restreint aux données sensibles (santé, accompagnements) ; jamais en projection/recherche | Masquage (code facultatif), exclusion de la recherche et de la projection. |
| ✅ | §2 Interface | Thèmes de couleurs (pastel, bleu, école, vert) et version sombre automatique le soir, au choix dans Réglages |  |
| ✅ | §19 Atelier | Timer de couleur persistant (widget flottant, plein écran, heure cible) | Fenêtre flottante au-dessus des autres applications seulement si le navigateur le permet (Chrome, Edge). |
| ✅ | §19 Atelier | Écriture : lignes Seyès, réglures, textes à compléter |  |
| ✅ | §19 Atelier | Tableau d’écriture Seyès : texte tapé en cursive (police Marelle importée), calé sur les lignes, imprimable et affichable en grand avec annotation | La police Marelle (gratuite, licence libre) se télécharge sur le site du ministère puis s’importe une fois par appareil. |
| ✅ | §19 Atelier | Maths : droites graduées, numération, fractions, horloges |  |
| ✅ | §20 Plans | Plan de classe visuel : mobilier, modèles, dispositions nommées par période/séance |  |
| ✅ | §20 Plans | Groupes manuels ou aléatoires, absents, rôles, rotations ; groupes de séance figés |  |
| ✅ | §23 Bibliothèque | Catalogue (exemplaires distincts) et prêts ; un exemplaire = un prêt actif |  |
| ✅ | §23 Bibliothèque | Vues par livre/élève, retards, retour en un clic, impressions, grille vierge |  |
| ✅ | §23 Bibliothèque | Prêts ouverts signalés au départ d’un élève ou au changement d’année |  |

## Étape 4 — Organisation

| | Section | Fonction | Note |
|---|---|---|---|
| ✅ | §5 Préparation | Compétences détaillées des programmes officiels pré-importées (à vérifier puis valider) | 2 080 intitulés extraits des PDF officiels (TPS–CM2), page indiquée, contrôle automatique mot à mot ; EVAR maternelle non extrait. |
| 🟡 | §5 Préparation | OCR optionnel avec texte incertain signalé | Fait : lecture du texte d’une photo ou capture, sur l’appareil (moteur Tesseract gratuit, 4,7 Mo téléchargés à la première utilisation), dans Outils de classe et dans l’aperçu des images de Fichiers (texte enregistré et cherchable). À venir : PDF scannés (page par page) et surlignage des mots incertains. |
| ✅ | §6 Planifier | Répartition des préparations avec la binôme | Vue « Qui prépare quoi » d’après le responsable de chaque séquence (Transmissions binôme). |
| ✅ | §11 Fichiers | Charte visuelle enregistrée | Réglages › Charte visuelle : police, couleurs, bordure. |
| ✅ | §11 Fichiers | Générateur d’étiquettes, affichages, cartes d’ateliers ; académies (noms, couleurs, emblèmes), série, PDF à taille réelle | Impression A4 à taille réelle (PDF via « Enregistrer au format PDF ») ; séries versionnées après changement d’académie. |
| ✅ | §12 Organisation | Réunions : notes, compte rendu, décisions, tâches, liens agenda/élèves |  |
| ✅ | §12 Organisation | Transmissions binôme (fait/à terminer/information, accusé de lecture) | Préremplies depuis le cahier journal ; copie/impression pour l’envoi ; partage possible par la synchronisation Nuage. |
| ✅ | §12 Organisation | Répertoire de l’école et des intervenants |  |
| ✅ | §12 Organisation | 108 h : activités, prévu/réalisé, totaux, export (règles à vérifier) | Objectifs indicatifs modifiables (quotité, consignes de la circonscription) ; réunions et APC comptées une seule fois. |
| ✅ | §12 Organisation | APC : objectifs, élèves, séances, présences, bilan, comptage unique |  |
| ✅ | §12 Organisation | Module PES : échéances INSPE, visites, objectifs, retours |  |
| ✅ | §12 Organisation | Dossiers remplacement/visite personnalisables |  |
| ✅ | §12 Organisation | Argent et projets : attendu/reçu/reste, paiements partiels, journal unique, corrections traçables, comptes par année | Comptes par année avec solde initial/report explicites ; export CSV et impression ; aucun paiement en ligne. |
| ✅ | §12 Organisation | Projets transdisciplinaires ; matériel (stocks, achats, prêts) | Achat de matériel → une seule dépense au journal financier. |
| ✅ | §14 Exports | Dossier de semaine ; finances ; étiquettes à taille réelle | Cahier journal › semaine › « Dossier de la semaine » : semaine, matériel, fiches de séance et schémas EPS. |
| ✅ | §19 Atelier | Géométrie : quadrillages, figures, instruments virtuels, fiches et corrections | Quadrillages, symétrie, reproduction, figures aux dimensions réelles, angles, corrections ; règle, équerre, rapporteur et compas à l’échelle de la fiche en affichage en grand. |
| ✅ | §19 Atelier | Cartes monde/continents/France à partir de données sourcées | Natural Earth (domaine public) et IGN Admin Express (Licence ouverte) ; versions vierge numérotée, légendée, corrigée. |
| ✅ | §19 Atelier | Jeux : memory, associations, classement, remise en ordre, quiz, bingo, cartes | Imprimables et jouables en grand (tactile), reliés aux séances. |
| ✅ | §19 Atelier | Anglais : flashcards, affiches, vocabulaire, dialogues, audio sourcé | Audio : voix de synthèse de l’appareil (indiquée comme telle) ou enregistrement de l’enseignante. |
| 🟡 | §19 Atelier | Modes concevoir/animer plein écran, annotation, tactile | Plein écran, annotation au doigt, instruments déplaçables, jeux jouables en grand. À venir : affichage progressif des éléments d’une fiche. |
| ✅ | §19 Atelier | Fenêtre de projection séparée / image dans l’image si supporté | Écran de projection séparé (Aujourd’hui › Projection) ; timer en image dans l’image sur Chrome/Edge. |
| ✅ | §20 Plans | Fiches de groupes imprimables/projetables (version enseignant séparée) | Plan de classe et groupes › Fiches de groupe / Version enseignante (notes) ; projection des groupes. |
| ✅ | §20 Plans | Éditeur de schémas EPS lié aux préparations et au cahier journal | Déplacer, redimensionner, orienter, dupliquer, annuler ; modèles ; couleurs d’équipes des groupes ; image, impression, projection ; croquis non coté sauf dimensions saisies. |
| ✅ | §21 Plan de classe | Taille de la salle et des éléments réglable (en cm, poignée d’agrandissement), rangements (étagère, armoire, bacs, casiers, porte-manteaux, bibliothèque, évier, poste informatique) et espaces |  |
| ✅ | §19 Atelier | Symétrie et reproduction : figures dessinées par l’enseignante (nœuds du quadrillage) ; figures à mesurer : quadrillage en cm et règle graduée sur la fiche pour la projection |  |
| ✅ | §19 Atelier | Dictée de mots : liste de mots choisie par l’enseignante |  |
| ✅ | §12 Organisation | Surveillances : accueils (ex. 8 h 20 – 8 h 30, 13 h 20 – 13 h 30) en plus des récréations, horaires et lieux par surveillance, répartition équilibrée en minutes, « je surveille » sur Aujourd’hui |  |
| ✅ | §12 Organisation | Sorties et cycles (natation, judo, classe découverte) : dates dans l’agenda et le cahier journal, adultes et taux d’encadrement saisi, groupes avec adulte responsable, autorisations (annuelle ou propre à la sortie), check-list, appel au départ et au retour, fiche de sortie et mot aux familles avec coupon |  |
| ✅ | §12 Organisation | Remplaçante / brigade : un remplacement = une classe temporaire (élèves tapés ou lus sur une photo), école, horaires, contacts, consignes, documents de la titulaire, jours de classe comptés, distance notée, historique CSV ; classe retirée du choix une fois terminée |  |
| ✅ | §5 Préparation | Disciplines et méthodes : manuel, fichier ou méthode par discipline et sous-domaine (sous-domaines repris des programmations), proposés dans les fiches de séquence et de séance, imprimables et repris dans le dossier de remplacement |  |
| ✅ | §8 Élèves | Radar élèves : signaux croisés sur 2, 3 ou 6 semaines (absences non justifiées, retards, carnet, non acquis, observations), élèves « à regarder » avec le détail et les pistes ; rappel discret sur Aujourd’hui |  |
| ✅ | §2 Navigation | Mode en classe : activité en cours et suivante, séance faite, appel, timer, projection, noter au carnet en 2 touches |  |
| ✅ | §2 Navigation | Aujourd’hui selon l’heure (« Maintenant » pendant la classe, « Pour demain » après la classe) ; actions dans la recherche (noter, nouvelle activité, appel, sortie, remplacement…) | Les 6 rubriques sont gardées : les regrouper en 4 aurait donné des sous-menus de 15 à 19 pages, moins lisibles. |
| ✅ | §2 Navigation | Aujourd’hui « Mon espace » : à faire aujourd’hui (ajout en une ligne), important (tâches et rendez-vous des 7 jours), matériel à préparer (fiches programmées et « À imprimer »), notes, semaine en calendrier, plan du jour ; titre réglable |  |
| ✅ | §12 Organisation | Mes tâches : calendrier de la semaine, liste, archives ; listes « À faire » et « À imprimer » ; durée estimée, priorité, important |  |
| ✅ | §2 Navigation | Tutoriel : astuce en haut de chaque page (désactivable, « Compris » par page) et visite guidée en 13 étapes (Réglages › Général ou Premiers pas) |  |
| ✅ | §5 Préparation | Manuels : plusieurs niveaux par manuel |  |
| ✅ | §26 Agenda | Tableau « Informations élèves » de l’agenda (fiche, coopérative, assurance, image, cantine, garderie, bus, PAI, PPRE/PAP/PPS, suivi extérieur, RASED, lunettes, gaucher, situation familiale, profession des parents) | Relié aux fiches sans double saisie ; colonnes ajoutables et masquables ; confidentiel séparé ; impression remplie ou vierge. |
| ✅ | §26 Agenda | Outils de classe : lire pour moi, sonomètre, pot de récompense, abaque, tableau des nombres, numération et conversion, réglettes, pourcentages (dictée, appel) | Affichables en grand, hors ligne, sans compte. |
| ✅ | §26 Agenda | Texte d’une photo (tapuscrit) : lire, corriger, agrandir, imprimer, envoyer vers Seyès / Lire pour moi |  |
| ✅ | §26 Agenda | Aide à la rédaction des appréciations (phrases-types accordées, sans IA) | Dans Livrets et bilans et dans Organisation › Mots, autorisations et registres. |
| ✅ | §26 Agenda | Mots aux familles et autorisations de sortie avec coupon, un exemplaire par élève | Remplissage depuis un projet d’Argent et projets ; historique. |
| ✅ | §26 Agenda | Fiche de missions AESH, rapport d’incident factuel (initiales, mots de jugement signalés), registre de soins | Confidentiels : masqués par défaut, jamais projetés ni indexés. |
| ✅ | §26 Agenda | Code couleur des syllabes (type « Lire Couleur ») pour l’aide au décodage | Outils de classe › Syllabes en couleur : découpage de l’écrit par règles (vérifié sur 60 mots courants), couleurs alternées, arcs, lettres muettes en gris, police Marelle, impression. Correction possible d’un mot : « li/on ». |
| ✅ | §26 Agenda | Parler et transcrire (dictée vocale) | Outils de classe › Parler et transcrire : reconnaissance du navigateur (la voix part en général à son service en ligne : Google, Apple), seulement après votre accord (case à cocher), avec avertissement ; ponctuation dictée. |
| ✅ | §26 Agenda | Générateurs d’exercices : séries de calculs, problèmes, dictées, textes de lecture | Préparer › Générateurs d’exercices : calculs (en ligne ou posés, tables, sans retenue), problèmes (9 types), dictées de mots par son (15 sons), fiches de fluence ; graine et corrigé. Pas de génération de textes originaux sans IA : vos textes servent de base. |
| ✅ | §26 Agenda | Planning des surveillances de récréation (école) | Organisation › Surveillances de récréation : adultes et jours de présence, répartition équitable, modification case par case, impression. |
| ✅ | §23 Bibliothèque | Scan code-barres/QR (facultatif) | Saisie ou douchette partout ; caméra si le navigateur sait lire les codes. |

## Étape 5 — Collaboration et connexions

| | Section | Fonction | Note |
|---|---|---|---|
| ✅ | §5 Préparation | Génération assistée par IA (facultative, sources visibles, aucune donnée élève envoyée) | IA intégrée au navigateur, sur l’appareil (Chrome) : « Simplifier », « Reformuler ». Boutons affichés seulement si l’appareil la propose en français. |
| ✖️ | §5 Préparation | IA en ligne | Retiré le 25/10/2026 à votre demande : payante ou envoyant des données hors de l’appareil. |
| ✅ | §6 Planifier | Notifications configurables | Réglages › Rappels et agenda : tâches, rendez-vous, événements, séances de demain sans fiche ; bandeau et notification quand l’application est ouverte ; export .ics pour que l’agenda du téléphone sonne même application fermée. |
| ✖️ | §8 Élèves | Droits d’accès par compte utilisateur | Retiré le 25/10/2026 à votre demande : des comptes exigent un serveur. Chacune a ses données sur son appareil ; partage par Nuage. |
| ✅ | §10 Suivi | Export compatible LSU (à vérifier séparément, sans remplacer le service officiel) | Export tableau des appréciations à recopier dans le LSU. |
| ✖️ | §10 Suivi | Import direct dans le LSU | Retiré le 25/10/2026 à votre demande : réservé aux éditeurs validés par le ministère. |
| ✖️ | §12 Organisation | Envoi automatique des transmissions sur le compte de la binôme | Retiré le 25/10/2026 à votre demande : exige des comptes et un serveur. |
| ✖️ | §13 Familles | Comptes responsables liés aux bons enfants (contrôle côté serveur) | Retiré le 25/10/2026 à votre demande : exige un serveur. L’application prépare ce qui est diffusé, élève par élève, par cahier de liaison, e-mail ou application de l’école. |
| ✅ | §13 Familles | Messages, documents, devoirs, autorisations ; consultation/réponse/retour | Messages à partir de modèles (cahier de liaison, e-mail, copie), notés dans l’historique ; documents manquants et relances ; autorisations avec coupon. Réponses par le cahier de liaison ou l’e-mail. |
| ✖️ | §13 Familles | Portail en ligne pour les familles (consultation et réponse dans l’application) | Retiré le 25/10/2026 à votre demande : exige un serveur et des comptes parents. |
| ✅ | §13 Familles | Préparation privée jusqu’à publication ; aperçu « comme ce parent » | Publications en brouillon privé jusqu’à « publié » ; photos bloquées sans droit à l’image ; Aperçu parent sans aucune donnée privée. |
| ✅ | §13 Familles | Réservation de rendez-vous sur créneaux ouverts, sans double réservation | Créneaux, réservation sans double réservation, mot et planning imprimables, compte rendu dans l’historique. |
| ✖️ | §13 Familles | Réservation en ligne par les familles elles-mêmes | Retiré le 25/10/2026 à votre demande : exige un serveur. |
| ✅ | §13 Familles | Mail académique | Réglages › Général : adresse et messagerie en ligne (Versailles proposée). « Copier et ouvrir ma messagerie académique », copie des adresses des familles. |
| ✖️ | §13 Familles | Envoi automatique par la messagerie académique | Retiré le 25/10/2026 à votre demande : la messagerie académique n’est pas ouverte aux applications externes. |
| ✅ | §13 Connexions | Connexions Drive, Canva, agendas, LSU vérifiées une par une | Agendas : export .ics. Drive, Docs, Slides, Sheets, Canva : liens avec aperçu intégré (Fichiers, diaporamas, écran de projection) ; fichiers du Drive ajoutés par le sélecteur de l’appareil. LSU : export tableau. |
| ✖️ | §13 Connexions | Connexion directe au compte Google Drive ou Canva (parcourir, importer automatiquement) | Retiré le 25/10/2026 à votre demande : exige l’inscription de l’application chez Google, ou un serveur pour Canva. |
| ✖️ | §15 Fiabilité | Comptes personnels, rôles enseignant/binôme/parent, permissions côté serveur | Retiré le 25/10/2026 à votre demande : exige un serveur. Une utilisatrice par appareil, synchronisée par Nuage. |
| ✅ | §15 Fiabilité | Synchronisation, file de modifications et conflits explicites | Par Nuage : fichier chiffré par appareil, fusion élément par élément, conflits tracés dans l’historique, suppressions propagées. |
| ✅ | §15 Fiabilité | Vérifier le cadre d’hébergement avant données réelles d’enfants | Données sur l’appareil et, chiffrées, dans Nuage (serveurs du ministère). Aucun service privé. Familles : cahier de liaison, e-mail ou application de l’école, au choix. |
| ✅ | §21 PWA | Sauvegarde automatique en ligne et synchronisation entre appareils | Nuage (apps.education.fr, gratuit, 100 Go) : synchronisation d’un clic sur ordinateur (automatique si le dossier est autorisé), Envoyer / Récupérer sur téléphone. |
| ✅ | §3 Données | Importer un tableau CSV (programmation, progression, séquences et séances, cahier journal) relié à l’existant | Préparer › Importer un tableau : modèle téléchargeable, aperçu et erreurs ligne par ligne, séquences et séances retrouvées par titre, créneaux de l’EDT, compétences retrouvées dans les référentiels. |
| ✅ | §6 Planifier | Préparer la semaine : depuis l’EDT (fiches habituelles ★ et progressions) ou semaine vierge ; export du cahier journal par jour, semaine, mois, période, année ou dates |  |
| ✅ | §5 Préparation | Où j’en suis : avancement par discipline et par période (notions, séances faites, lignes de progression, temps fait), comparé au temps écoulé ; couverture des compétences ; suggestions pour la suite | Préparer › Où j’en suis. Tout est déduit de l’existant, rien n’est modifié automatiquement. |
| ✅ | §6 Planifier | Cahier journal : bandeau « semaine pas encore préparée » et pré-remplissage jusqu’aux vacances (une séance n’est jamais proposée deux fois) |  |
| ✅ | §15 Familles | Familles sans ENT : canal choisi (cahier de liaison papier, e-mail, application de l’école) ; mot imprimable pour le cahier de liaison, e-mail à toutes les familles |  |
| ✅ | §3 Données | Import CSV : emploi du temps par période et changement daté (piscine, intervenant…), progression par sous-domaine (séances placées dans les bons créneaux), déroulé des séances en phases et matériel | Préparer › Importer un tableau. Les anciens EDT sont conservés. |
| ✅ | §3 Données | Programmation et progression importées séparément et reliées : lignes de progression reliées aux notions (colonne Notions ou même titre), état des notions déduit |  |
| ✅ | §6 Planifier | Emploi du temps : onglets par période et emplois du temps successifs d’une période (dates, nom, « en cours / à venir »), créneaux changés signalés, changement à partir d’une date |  |
| ✅ | §13 Familles | Carnet de liaison et comportement : noter en un geste (comportement, travail, oubli, retard, félicitations, information), mots à faire signer et relances, bilan par élève, impression du suivi | Remplace la page « Messages » (pas d’envoi possible) ; la rédaction d’un mot à partir d’un modèle reste disponible. |
| ✅ | §6 Planifier | Cahier journal : fiche d’activité complète — durée, classe entière ou groupes, domaine, discipline, décloisonnement, hors horaires, intitulé, objectif, séquence, déroulement, matériel, lieu, pièces jointes, notes, compétences (comptées dans la couverture des programmes) | « + Activité » ou « Plus › Modifier l’activité » sur un créneau ; ne change que cette date. |
| ✅ | §6 Planifier | Cahier journal détaillé (programme : discipline, domaine, séquence, notions ; objectif, critères, compétences en toutes lettres, déroulé avec durées et consignes, matériel, manuels, trace) ou compact ; « Vider… » un jour, une semaine, un mois, une période ou des dates (séances faites gardées par défaut, annulable) |  |
| ✅ | §5 Préparation | Couverture des compétences : où et quand chaque compétence officielle est travaillée ; compétences affichées au cahier journal |  |
| ✅ | §19 Atelier | Polices pour les débutants et la dyslexie (Andika, Marelle Bâton, OpenDyslexic, Verdana) et écriture en capitales d’imprimerie | Andika et OpenDyslexic (licence OFL) fournies ; Verdana est celle de l’appareil (remplacée par une police proche si absente, ex. Android). |
| ✅ | §4 Années | Binôme activable / désactivable par classe (fin de l’année de PES, temps plein) | Réglages › Classes : sans binôme, plus de « jour de la binôme », de choix « binôme » ni de transmissions. |
| ✅ | §19 Atelier | Timer « feu tricolore » : vert, orange à mi-temps, rouge quand il reste peu de temps | Couleur par défaut ; les couleurs fixes restent au choix. |
| ✅ | §7 Quotidien | Registre d’appel mensuel : statistiques (total, matin, après-midi), grille élèves × demi-journées, justification des absences, cumul des retards, alerte à 4 demi-journées injustifiées, préférences (tri, niveau, repas spécial, non pris en compte), impression et CSV |  |
| ✅ | §21 PWA | Archiver une année terminée dans un fichier (chiffré, vérifié) pour libérer la place ; consultation en lecture seule | Réglages › Années : « Archiver dans un fichier… » sur une année archivée ; « Consulter une archive ». Les communs (référentiels, manuels, bibliothèque, fichiers, contacts) restent. |
| ✅ | §21 PWA | Politique de rétention distante | Un seul fichier par appareil dans Nuage, remplacé à chaque envoi ; Nuage garde ses propres versions. Supprimer le fichier dans Nuage suffit à tout retirer. |
| ✅ | §26 Agenda | Ressources externes utiles (IPS, mouvement, grille de salaire, vidéos d’albums) : liens | Organisation › Liens utiles : liens officiels vérifiés le 23/10/2026 (Éduscol, BO, apps.education.fr, IPS des écoles, Lumni…), liste modifiable. |
| ✅ | §10 Suivi | Livrets reliés aux évaluations : choisir les évaluations de chaque période, générer le livret de chaque élève ou de toute la classe (compétence par compétence, niveaux, appréciations) | Livrets et bilans › « Évaluations reliées au livret » puis « Générer les livrets de la classe ». Modèles officiels de l’école : à intégrer quand vous les envoyez. |
| ✅ | §10 Suivi | Maternelle : carnet de suivi des apprentissages (réussites observées, portfolio, synthèse des acquis) | Même page, vocabulaire et document adaptés quand la classe est en maternelle. |
| ✅ | §12 Organisation | Répartition des élèves chez les collègues (équitable, places limitées, absents, fiche par classe d’accueil) | Organisation › Répartition et décloisonnement ; collègues retenus pour la fois suivante. |
| ✅ | §12 Organisation | Décloisonnement activable par classe : créneaux réguliers, autre classe, élèves concernés, affichage sur Aujourd’hui | Désactivé : rien ne s’affiche et les créneaux sont gardés. |
| ✅ | §6 Planifier | Supprimer en une fois : programmations, progressions, séquences (avec leurs fiches), fiches de séance — au choix ou toutes | Bouton « Supprimer… » sur chaque page : liste rangée par discipline, séquence ou période, filtrable, « tout le groupe » ; tout va dans la corbeille. |
| ✅ | §15 Fiabilité | Corbeille : sélection, restaurer ou supprimer plusieurs éléments, vidage automatique après un délai choisi | Réglages › Corbeille : 7, 30, 90, 365 jours ou jamais (30 par défaut). |
| ✅ | §23 Bibliothèque | Modifier ou supprimer un emprunt (élève, dates, retour, remarque) |  |
| ✅ | §10 Suivi | Informations élèves : la coche se met bien à jour au clic (correctif) |  |
| ✅ | §6 Planifier | Impressions colorées d’après vos modèles : fiche de préparation et fiche de séquence (tableaux bleus, déroulement en 6 colonnes), programmation et progression teintées par période, cahier-journal en cartes de la couleur de chaque discipline avec récréations | Réglages › Général › Style des impressions : coloré ou sobre (noir et blanc). |
| ✅ | §6 Planifier | Fiches au niveau de détail des modèles validés : problématique, place dans la journée, trace et cahier, bloc « Institutionnalisation, correction et évaluation », bilan après la séance repris du cahier journal ; séquence : institutionnalisation et prolongement, bilan de progression, séances de remédiation « si nécessaire », transmission à la binôme seulement si la classe en a une | Les phases restent détaillées dans le déroulement. Sans binôme (Réglages › Classes), la ligne de transmission disparaît. |
