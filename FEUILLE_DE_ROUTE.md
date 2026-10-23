# Feuille de route — suivi de tout le cahier des charges

Fichier généré depuis `js/roadmap.js` (`node tools/roadmap-md.mjs`). La même liste est consultable dans l’application : Réglages › Feuille de route.

Légende : ✅ Réalisé (127) · 🟡 Partiel (17) · ⚙️ À configurer (2) · ⬜ À développer (0) — 146 entrées.

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
| ✅ | §5 Préparation | Programmations annuelles et progressions (ajouter, déplacer, ordonner, suivre les notions) | D’après les modèles de l’enseignante ; import d’un tableau de notions. |
| ✅ | §5 Préparation | Bilans de période (notions réalisées et restantes) |  |
| ✅ | §5 Préparation | Fiche de séquence complète |  |
| ✅ | §5 Préparation | Fiche de préparation (phases minutées, différenciation, critères, bilan), modèles, duplication | Phases typées du modèle de l’enseignante ; modes quotidien/visite ; version vierge. |
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
| 🟡 | §8 Élèves | Besoins particuliers (confirmé vs observation) ; PPRE/PAP/PPS/PAI/AESH à accès restreint | Masqués par défaut (code facultatif), hors recherche et projection. Contrôle d’accès par compte : étape 5. |
| ✅ | §8 Élèves | Niveau par domaine daté ; aides efficaces et historique |  |
| ✅ | §8 Élèves | Différenciation dans les préparations (sans adaptation automatique sur diagnostic) |  |
| ✅ | §8 Élèves | Portfolio lié aux compétences ; historique des échanges |  |
| ✅ | §9 Listes | Listes personnalisables (colonnes case/date/texte/montant/choix, filtres, tri, actions groupées) |  |
| 🟡 | §9 Listes | Colonnes liées qui actualisent la donnée (assurance, autorisation, paiement) | Documents, autorisations et droit à l’image : faits. Paiements : avec le module Argent et projets (étape 4). |
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
| 🟡 | §15 Fiabilité | Accès restreint aux données sensibles (santé, accompagnements) ; jamais en projection/recherche | Masquage, exclusion de la recherche et de la projection : faits. Droits par compte : étape 5. |
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
| 🟡 | §12 Organisation | Transmissions binôme (fait/à terminer/information, accusé de lecture) | Préremplies depuis le cahier journal ; lecture notée sur l’appareil, copie/impression pour l’envoi. Partage automatique avec les comptes (étape 5). |
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
| 🟡 | §5 Préparation | Génération assistée par IA (facultative, sources visibles, aucune donnée élève envoyée) | Uniquement l’IA intégrée au navigateur, sur l’appareil (Chrome) : « Simplifier » un texte, « Reformuler » une appréciation. Boutons affichés seulement si l’appareil la propose en français. Aucune IA en ligne, aucun abonnement. |
| ✅ | §6 Planifier | Notifications configurables | Réglages › Rappels et agenda : tâches, rendez-vous, événements, séances de demain sans fiche ; bandeau et notification quand l’application est ouverte ; export .ics pour que l’agenda du téléphone sonne même application fermée. |
| 🟡 | §10 Suivi | Export compatible LSU (à vérifier séparément, sans remplacer le service officiel) | Export tableau des appréciations à recopier. L’import direct dans le LSU est réservé aux éditeurs validés par le ministère (Éduscol, « Interfaces entre les applications nationales ») : non accessible à cette application. |
| ⚙️ | §13 Familles | Comptes responsables liés aux bons enfants (contrôle côté serveur) | Choix du 23/10/2026 : pas de serveur de l’application. Les comptes parents sont ceux de l’ENT de l’école ; l’application prépare ce qui est diffusé, élève par élève. |
| 🟡 | §13 Familles | Messages, documents, devoirs, autorisations ; consultation/réponse/retour | Fait : messages à partir de modèles (copie pour l’ENT ou messagerie), noté dans l’historique ; documents manquants et relances par famille ; autorisations avec coupon. La consultation et la réponse des familles passent par l’ENT. |
| ✅ | §13 Familles | Préparation privée jusqu’à publication ; aperçu « comme ce parent » | Publications en brouillon privé jusqu’à « publié » ; photos bloquées sans droit à l’image ; Aperçu parent sans aucune donnée privée. |
| 🟡 | §13 Familles | Réservation de rendez-vous sur créneaux ouverts, sans double réservation | Créneaux, réservation sans double réservation, mot et planning imprimables, compte rendu dans l’historique. Les familles ne réservent pas elles-mêmes en ligne (pas de serveur) : elles répondent par l’ENT ou sur papier. |
| 🟡 | §13 Familles | Mail académique (selon fournisseur et accès autorisés) | Ouverture de votre messagerie avec le message prêt (aucun mot de passe dans l’application). |
| 🟡 | §13 Connexions | Connexions Drive, Canva, agendas, LSU vérifiées une par une | Agendas : export .ics. Drive, Canva : liens dans Fichiers. LSU : export tableau des appréciations (import direct non vérifié). |
| ⚙️ | §15 Fiabilité | Comptes personnels, rôles enseignant/binôme/parent, permissions côté serveur | Sans serveur : une utilisatrice par appareil, synchronisée par Nuage. Rôles parents gérés par l’ENT. |
| ✅ | §15 Fiabilité | Synchronisation, file de modifications et conflits explicites | Par Nuage : fichier chiffré par appareil, fusion élément par élément, conflits tracés dans l’historique, suppressions propagées. |
| ✅ | §15 Fiabilité | Vérifier le cadre d’hébergement avant données réelles d’enfants | Données sur l’appareil et, chiffrées, dans Nuage (serveurs du ministère). Aucun service privé. Famille : ENT de l’école. |
| ✅ | §21 PWA | Sauvegarde automatique en ligne et synchronisation entre appareils | Nuage (apps.education.fr, gratuit, 100 Go) : synchronisation d’un clic sur ordinateur (automatique si le dossier est autorisé), Envoyer / Récupérer sur téléphone. |
| ✅ | §21 PWA | Politique de rétention distante | Un seul fichier par appareil dans Nuage, remplacé à chaque envoi ; Nuage garde ses propres versions. Supprimer le fichier dans Nuage suffit à tout retirer. |
| ✅ | §26 Agenda | Ressources externes utiles (IPS, mouvement, grille de salaire, vidéos d’albums) : liens | Organisation › Liens utiles : liens officiels vérifiés le 23/10/2026 (Éduscol, BO, apps.education.fr, IPS des écoles, Lumni…), liste modifiable. |
