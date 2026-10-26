# Classeur — application de gestion de classe (nom provisoire)

Application web installable (PWA) pour professeurs des écoles, en français. Référence : le cahier des charges (document de travail personnel, non publié dans ce dépôt). Suivi de tout le périmètre : `FEUILLE_DE_ROUTE.md` (aussi visible dans l'application : Réglages › Feuille de route).

**État : les cinq étapes sont réalisées et testées (version 0.5.16).** Étape 5 selon votre choix du 23/10/2026 : synchronisation par **Nuage** (apps.education.fr) et communication avec les familles par le **cahier de liaison, l'e-mail ou l'application de l'école** (au choix, sans ENT), sans aucun serveur ni service payant. Ce qui reste est listé dans `FEUILLE_DE_ROUTE.md` (rien « à développer » ; ce qui est impossible gratuitement et sans serveur est marqué « Retiré », gardé pour mémoire).

---

## 1. Lancer l'application sur votre ordinateur

Il faut un petit serveur local (les navigateurs refusent d'exécuter l'application si on double-clique sur `index.html`). Rien d'autre à installer, aucun compte, aucun service payant.

**Avec Python** (déjà présent sur Mac et Linux ; sur Windows : installer Python depuis python.org ou le Microsoft Store), dans le dossier de l'application :

```
python3 serveur.py
```
(sous Windows : `python serveur.py` ou `py serveur.py`). Le navigateur s'ouvre automatiquement. Ce petit script force les bons types de fichiers, ce qui évite un blocage connu sous certains Windows.

**Ou avec Node.js**, si vous l'avez : `npx http-server -p 8080`

Puis ouvrez **http://localhost:8080** dans Chrome, Edge, Firefox ou Safari. Pour arrêter : Ctrl+C dans le terminal. Vos données restent enregistrées dans le navigateur entre deux lancements.

**Installer comme une application** : dans Chrome ou Edge, icône « Installer » dans la barre d'adresse (ou menu ⋮ › Installer Classeur). L'application s'ouvre alors dans sa propre fenêtre et fonctionne hors connexion.

**Sur téléphone ou tablette** : l'installation (icône sur l'écran d'accueil) et le hors-connexion exigent une adresse en **https**. Il faudra donc publier les fichiers sur un hébergement statique gratuit (voir § 5). En attendant, sur le même Wi-Fi, `http://ADRESSE-IP-DE-L-ORDINATEUR:8080` permet de tester l'affichage, mais **les données saisies sur le téléphone restent sur le téléphone** (aucune synchronisation à ce stade).

## 2. Tester l'étape 1 (parcours conseillé, 10 minutes)

1. **Réglages › Démonstration › Charger les données fictives** : classe « CE2 (démo) », 12 élèves inventés, une arrivée le 2 novembre et un départ le 16 octobre. Tout est marqué « Démo ».
2. **Aujourd'hui** : la date est située dans le calendrier (le 19/10/2026 : vacances, reprise le 2 novembre), effectif du jour, arrivées/départs à venir, rappel de sauvegarde.
3. **Ma classe › Élèves** : changez la date « Inscrits au » (ex. 01/10/2026 puis 10/11/2026) pour voir que les listes passées restent justes. Ouvrez une fiche : contacts (un seul prioritaire), photo, « Enregistrer un départ ».
4. **Importer** : collez `Prénom;Nom;Date de naissance;Niveau` puis quelques lignes ; les erreurs et doublons sont signalés avant import.
5. **Imprimer** : choisissez colonnes, colonnes vierges titrées (« Cahier rendu, Mot signé »), portrait/paysage, noir et blanc, aperçu A4, puis « Imprimer / PDF ».
6. **Préparer › Fichiers** : déposez des fichiers (ou glissez-les), aperçu des images/PDF/textes, « Nouvelle version », liens Drive/Canva, tags, dossiers, favoris.
7. **Bouton « Ajouter »** puis « Note dans la boîte de réception » ; ensuite **Organisation › Boîte de réception › Classer dans Fichiers**.
8. **Recherche** (barre du haut) : un prénom sans accent, un tag…
9. **Annuler** (flèche en haut) après une action ; **Réglages › Corbeille** ; **Réglages › Historique**.
10. **Réglages › Sauvegarde** : exportez, puis « Tout effacer », puis « Restaurer » le fichier : le message confirme la vérification.
11. **Réglages › Démonstration › Retirer les données fictives** avant de saisir vos vraies données.

## 2 bis. Tester l'étape 2 (parcours conseillé, 15 minutes)

Chargez les données fictives (Réglages › Démonstration), puis :

1. **Préparer › Programmations** : la programmation de maths d'exemple (périodes × sous-domaines, vue « Détaillée » conforme au modèle de l’enseignante). « Importer un tableau » accepte un CSV ou un copier-coller (Période ; Sous-domaine ; Notion ; Compétences ; Ressources).
2. **Préparer › Séquences** › « Les nombres jusqu'à 10 000 » : les 7 blocs du modèle de séquence ; le déroulé se remplit depuis les fiches de séance.
3. Ouvrez la **séance 1** : identification, objectifs, préparation matérielle, photocopies (nombre d'exemplaires calculé), puis les 5 phases avec leurs rubriques propres. Basculez **Quotidien / Visite** ; **Imprimer** et **Version vierge** produisent la fiche A4.
4. **Planifier › Cahier journal**, le **2 novembre 2026** : la séance de maths y figure. Cliquez « Faite », remplissez « Bilan express » et « Après la séance ». Modifiez ensuite le titre de la fiche : le 2 novembre garde la version réalisée.
5. Le **5 novembre 2026** : la sortie au musée crée des conflits. « Reporter… » propose les prochains créneaux de la même discipline ; la séance d'origine reste, marquée « reportée ».
6. Le **19 novembre 2026** (jeudi) : la natation, confirmée à partir du 16 novembre, apparaît ; elle n'apparaît pas le 12.
7. Sélecteur de classe › **CE1-CE2 (démo)**, cahier journal du 2 novembre : colonnes parallèles CE1 / CE2 et signalement de deux ateliers exigeant l'enseignant en même temps.
8. **Planifier › Emploi du temps** : modifiez un créneau en choisissant « à partir du » une date future : les journées antérieures ne changent pas. En bas, le temps hebdomadaire par discipline (référence horaire à saisir vous-même).
9. **Préparer › Progressions** › P2 : la ligne de la séquence indique l'avancement du cahier journal et propose un statut à appliquer (jamais appliqué tout seul) ; le bilan de période liste les notions terminées et restantes.
10. **Agenda**, **Tâches et rendez-vous** (rubrique Aujourd'hui), **Devoirs**, **Interventions**, **Leçons**, **Manuels**, **Programmes et référentiels** (import puis validation, versions).
11. **Réglages › Reprise d'année** : copie les modèles d'une classe d'une autre année, sans jamais reprendre journal, devoirs donnés ni bilans.

## 2 ter. Tester l'étape 3 (usage en classe, 15 minutes)

Avec les données fictives chargées :

1. **Timer** : icône horloge en haut. Choisissez 2 min, Démarrer, puis Réduire : le compte continue en changeant de page et même après rechargement. Glissez-le où vous voulez ; « ⛶ » pour le grand format ; « ⧉ » ouvre une fenêtre flottante au-dessus des autres applications (Chrome, Edge).
2. **Aujourd'hui › Appel** : P / A / R / D / ½ pour chaque élève, « Les non pointés sont présents », puis « Valider l'appel ». Le 2 novembre (matin) est déjà validé, avec une absence partielle.
3. **Aujourd'hui › Cantine et services** : semaine type, exceptions du jour, effectifs (inscrits ≠ présences prévues), sorties du jour et personnes autorisées.
4. **Aujourd'hui › Projection** : « Ouvrir l'écran de projection » ouvre une seconde fenêtre à placer sur le TNI ; le pupitre choisit séance, phase, groupes, devoirs, diaporama. L'écran n'affiche jamais de donnée personnelle.
5. **Fiche d'un élève** (Ma classe › Élèves) : onglets Documents et autorisations (assurance, droit à l'image par usage), Suivi pédagogique, Besoins particuliers (masqués : bouton « Afficher »), Vie scolaire, Échanges.
6. **Ma classe › Listes** › « Documents de rentrée » : cocher l'assurance d'un élève met à jour sa fiche.
7. **Ma classe › Rattrapage**, du 20 octobre au 4 novembre : choisissez Nino ou Lou. Seules les séances marquées « faites » pendant l'absence sont proposées (marquez d'abord la séance de maths du 2 novembre « Faite » au cahier journal).
8. **Ma classe › Évaluations, Livrets et bilans, Différenciation, Trombinoscope.**
9. **Ma classe › Plan de classe et groupes** : nouvelle disposition (îlots, U…), glisser les meubles, « Placer les élèves », groupes aléatoires ou manuels, « Utiliser pour une séance datée ».
10. **Ma classe › Responsabilités** (rotation) et **Bibliothèque** (prêter, retour en un clic, retards).
10 bis. **Réglages › Général › Apparence** : thème de couleurs (pastel doux par défaut, bleu frais, coloré école, vert d’origine, ou « Mes couleurs » : couleur principale, menu et fond au choix, rendues lisibles automatiquement) et mode sombre (automatique de 19 h à 7 h, comme l’appareil, toujours clair ou toujours sombre). Impressions, projection et diaporamas restent sur fond blanc.
10 ter. **Préparer › Programmes et référentiels** : tableau des programmes officiels en vigueur en 2026-2027 pour les niveaux de la classe (ou tous les niveaux), avec le BO et le PDF officiel ; « Créer le référentiel » prépare le référentiel avec la bonne source et la bonne date.
11. **Préparer › Atelier pédagogique** : **Tableau d’écriture (Seyès)** — tapez un texte, il s’écrit en attaché sur les lignes du cahier (minuscules = 1 interligne, ligne de base sur la ligne épaisse). Les polices **Marelle** (attaché et bâton, ministère de l’Éducation nationale, licence libre OFL, fichier `fonts/OFL.txt`) sont fournies avec l’application ; « Importer une autre police » permet d’en ajouter. « Afficher en grand » permet d’écrire par-dessus au doigt/stylet. Aussi : lignes Seyès, réglure, texte à compléter, droite graduée, numération, fractions, horloges ; version corrigée ; impression A4 à taille réelle (imprimer à 100 %).
12. **Préparer › Diaporamas** : « Créer depuis la fiche » reprend la structure du modèle de diaporama ; « Présenter ici » ou « Projeter sur l'écran séparé » (notes présentateur jamais projetées).

## 2 quater. Tester l'étape 4 (organisation et atelier, 20 minutes)

Chargez la démonstration (Réglages › Démonstration), puis :

1. **Organisation › Argent et projets** : onglet Comptes (solde initial explicite, report d'une année sur l'autre), « Sortie au musée (exemple) » : ajoutez un versement à un élève → il apparaît une seule fois dans le projet, le journal, la fiche élève (onglet Vie) et dans une liste qui a une colonne « Paiement d'un projet ». Journal : « Annuler » crée une correction tracée, l'original reste visible.
2. **Organisation › Matériel** : achat (crée la dépense au journal), prêt et retour, alerte « à racheter ».
3. **Préparer › Étiquettes et affichages** : onglet Académies (noms, couleurs, emblèmes, répartition), puis Générer (prénoms, 24 par planche 70 × 37 mm, police Marelle), « Enregistrer la série » et retouche ; changez un élève d'académie → « Créer une version actualisée ».
4. **Réglages › Charte visuelle** : police, couleurs, bordure par défaut.
5. **Préparer › Programmes et référentiels** : « Importer les compétences » sur une ligne (ex. Mathématiques CE2) → référentiel à relire (page du PDF indiquée, intitulés « à relire » surlignés) puis à valider.
6. **Préparer › Atelier pédagogique** : Géométrie (symétrie, reproduction, figures en vraies dimensions, angles) et Cartes (planisphère, continents, France), version corrigée ; « Afficher en grand » : règle, équerre, rapporteur, compas.
7. **Préparer › Jeux et anglais** : memory, quiz, bingo (cartons), flashcards avec voix de synthèse ou votre enregistrement ; « Jouer en grand ».
8. **Préparer › Schémas EPS** (ou « + schéma EPS » dans une phase d'une fiche d'EPS) : modèle, déplacer, poignées (taille, orientation), dupliquer, annuler, équipes de la classe, consignes ; le schéma apparaît dans la fiche et le cahier journal.
9. **Planifier › Cahier journal › Semaine** : « Dossier de la semaine ».
10. **Ma classe › Bibliothèque** : « Code-barres / QR » (saisie, douchette ou caméra).

## 2 quinquies. Tester les ajouts inspirés de votre agenda (10 minutes)

1. **Ma classe › Informations élèves** : le tableau de votre agenda. Cliquez une case (assurance, coopérative, lunettes, bus…) : la fiche de l'élève est mise à jour. « Afficher les colonnes confidentielles » pour PAI, PPRE/PAP/PPS, RASED, situation familiale. « Colonnes » pour en ajouter ou en masquer ; « Imprimer » (rempli, ou grille vierge à remplir à la main).
2. **Aujourd'hui › Outils de classe** : « Texte d'une photo » (choisissez une photo de page : le texte est lu sur l'appareil, puis corrigeable, imprimable en tapuscrit, envoyable au tableau Seyès), lire pour moi, sonomètre, pot de récompense, abaque, tableau des nombres, numération et conversion, réglettes, pourcentages. « Afficher en grand » pour le TNI.
3. **Fichiers** : « Aperçu » d'une image › « Lire le texte de l'image » : le texte est enregistré et retrouvé par la recherche.
4. **Organisation › Mots, autorisations et registres** : mot ou autorisation de sortie (aussi depuis un projet d'Argent et projets) avec coupon, un exemplaire par élève ; appréciations (aussi dans Livrets et bilans, « Aide à la rédaction ») ; fiche AESH, rapport d'incident, registre de soins (confidentiels).

## 2 sexies. Tester l'étape 5 (Nuage, familles, rappels, 15 minutes)

1. **Réglages › Synchronisation (Nuage)** : nom de l'appareil, mot de passe de synchronisation (le même partout, à noter). Sur ordinateur (Chrome/Edge) : installez Nextcloud (guide officiel en lien), choisissez votre dossier Nuage, « Synchroniser maintenant ». Sur téléphone : « Envoyer vers Nuage » (choisir Nextcloud dans le partage) et « Récupérer depuis Nuage ».
2. **Familles › Publications** : texte et photos, « Qui est sur la photo ? » ; un élève sans droit à l'image « Site ou ENT » bloque la publication. « Copier le texte », télécharger les photos, diffuser par le canal choisi (cahier de liaison, e-mail, application de l'école), puis « Marquer « diffusé » ».
3. **Familles › Rendez-vous** : « Ouvrir des créneaux », « Mot avec les créneaux libres », réserver, puis « Fait » (compte rendu dans l'historique de l'élève).
4. **Familles › Carnet et comportement** (« Noter » : comportement, travail non fait, oubli, retard, félicitations, information, pour un ou plusieurs élèves, avec « mot écrit dans le carnet » ; mots à faire signer et relances ; bilan par élève sur la semaine, le mois, la période ou l'année ; impression du suivi d'un élève ; « Rédiger un mot » à partir des modèles), **Documents** (manquants, relances par famille), **Aperçu parent** (ce qu'une famille peut recevoir, rien de privé).
5. **Réglages › Rappels et agenda** et **Planifier › Agenda › « Vers mon agenda »** : fichier .ics à ouvrir dans l'agenda du téléphone, qui sonnera même application fermée.
6. **Planifier › Ateliers et rotations** : tableau de rotation à partir de vos groupes.

## 2 septies. Tester les compléments (10 minutes)

1. **Aujourd'hui › Outils de classe › Syllabes en couleur** : collez un texte ; couleurs alternées, arcs, lettres muettes en gris, police Marelle, impression. Un mot mal coupé se corrige en l'écrivant « li|on ».
2. **Outils de classe › Parler et transcrire** : cochez d'abord l'accord (la voix part au service de reconnaissance du navigateur), puis dictez ; « virgule », « point », « à la ligne ».
3. **Préparer › Générateurs d'exercices** : calculs (posés ou en ligne, tables, sans retenue), problèmes, dictée de mots par son, fiche de fluence ; « avec le corrigé », « Nouvelle fiche ».
4. **Organisation › Surveillances de récréation** : adultes et jours de présence, « Répartir équitablement ».
5. **Organisation › Liens utiles**.
6. Boutons « Simplifier » (Texte d'une photo) et « Reformuler » (appréciations) : visibles seulement si votre navigateur propose son IA intégrée (Chrome récent sur un ordinateur compatible).

## 2 octies. Fin d'année : archiver pour garder l'application légère

**Réglages › Années** : « Archiver » une année terminée, puis « Archiver dans un fichier… » : taille affichée, mot de passe conseillé, création du fichier (à ranger dans Nuage), **vérification du fichier relu**, puis seulement « Retirer l'année de l'appareil ». L'archive se rouvre en lecture seule avec « Consulter une archive » (élèves, bilans, évaluations, cahier journal). Restent toujours : référentiels, manuels, bibliothèque, contacts, fichiers communs, et les élèves réinscrits l'année suivante.

## 2 nonies. Semaine, export, import de tableaux, compétences (10 minutes)

1. **Planifier › Cahier journal** : « Préparer la semaine » → « avec l'emploi du temps » (les créneaux reçoivent leur **fiche habituelle ★** et les séances suivantes de vos **progressions**) ou « semaine vierge » (vous ajoutez vos activités). Fiche habituelle : dans un créneau, « Plus » › « ★ Fiche habituelle de ce créneau ».
2. **« Exporter… »** : jour, semaine, mois, période, année ou dates choisies ; détaillé (une page par jour), compact (une page par semaine) ou tableau CSV.
3. **Préparer › Importer un tableau** : téléchargez le modèle (programmation, progression, séquences et séances, emploi du temps, cahier journal), remplissez-le dans votre tableur, importez : aperçu et erreurs ligne par ligne, puis tout est relié (séquences retrouvées par leur titre, créneaux de l'EDT, compétences des référentiels).
4. **Préparer › Où j'en suis** : avancement par discipline et par période (notions, séances faites, progression, heures faites), comparé au temps écoulé (trait vertical sur les barres), couverture des compétences des programmes et suggestions pour la suite. Les trois suggestions principales apparaissent aussi sur « Aujourd'hui ».
5. **Cahier journal** : sur une semaine pas encore préparée, un bandeau propose « Préparer maintenant » ; dans la fenêtre, « Pré-remplir : jusqu'aux vacances » prépare toutes les semaines de la période d'un coup (une séance n'est jamais proposée deux fois). Tout reste modifiable.
6. **Importer un tableau**, compléments : l’emploi du temps accepte les colonnes « Période » (P1, P2-P3…) et « À partir du » (changement en cours de période, ex. piscine) ; la progression accepte « Sous-domaine » (un mot de l’intitulé des créneaux : les séances vont dans ces créneaux) ; les séquences acceptent « Déroulé » (« 10 min Recherche : consigne | 15 min Entraînement : … ») et « Matériel ».
6 octies. **Planifier › Sorties et natation** : « Nouvelle sortie ou cycle » (un cycle de natation crée ses séances chaque semaine, hors vacances, dans l’agenda et le cahier journal) ; onglets Dates, Adultes et groupes (taux d’encadrement à saisir d’après la circulaire de votre département), Autorisations (annuelle ou propre à la sortie), Check-list, Appel départ / retour ; « Fiche de sortie » et « Mot aux familles » avec coupon.
6 nonies. **Organisation › Mes remplacements (brigade)** : « Nouveau remplacement » crée une classe à part (élèves tapés ou lus sur une photo de la liste) ; école, horaires, contacts, consignes, documents de la titulaire, jours comptés, distance notée, historique CSV ; « Terminer » la retire du choix de classe.
6 decies. **Préparer › Disciplines et méthodes** : manuel ou méthode par discipline et sous-domaine ; proposé dans les fiches (« Ajouter à la fiche ») et repris dans le dossier de remplacement.
6 septies. **Organisation › Surveillances** : « + Accueil du matin (8 h 20 – 8 h 30) », « + Accueil de l’après-midi (13 h 20 – 13 h 30) » ou « + Récréation » ; horaires et lieu modifiables (ex. Portail, Escaliers) ; « Répartir équitablement » équilibre les minutes ; cochez « c’est moi » pour voir vos surveillances du jour sur Aujourd’hui.
6 sexies. **Cahier journal › « + Activité »** ou, sur un créneau, **Plus › Modifier l’activité** : durée (la fin se calcule), classe entière ou groupes, décloisonnement, hors horaires, domaine, discipline, intitulé, objectif, séquence, déroulement, matériel, lieu, pièces jointes, notes, compétences. Tout s’affiche sur la carte du jour et à l’impression.
6 quinquies. **Plan de classe** : dimensions de la salle (en cm), taille de chaque élément (champs L et P ou poignée orange), rangements (étagère, armoire, meuble à bacs, casiers, porte-manteaux, bibliothèque, évier, poste informatique) et espaces (coin regroupement, coin lecture). **Atelier** : symétrie et reproduction avec « Figures : dessinées par moi » ; figures à mesurer avec quadrillage en cm et/ou règle graduée sur la fiche (pour la projection) ; dans « Afficher en grand », règle et rapporteur virtuels. **Dictée de mots** : « Mes mots ».
6 quater. **Planifier › Emploi du temps** : onglets P1 à P5 (« 2 EDT » quand la période change en cours de route) ; dans la période, un onglet par emploi du temps avec ses dates (ex. « gym avec intervenant — du 2 nov. au 7 déc. », « natation + intervenant — du 8 déc. au 18 déc. ») ; les créneaux qui changent sont encadrés « changé » ; « + Changement à partir d’une date » pour en ajouter un.
6 ter. **Liens Drive / Docs / Slides / Canva** : bouton « Aperçu » dans Fichiers ; dans un diaporama (diapositive « Lien ») et à l'écran de projection, le document s'affiche directement s'il est partagé par lien. **Messagerie académique** : Réglages › Général (adresse de la messagerie en ligne ; Versailles proposée), puis Familles › Carnet et comportement › « Rédiger un mot » › « Copier et ouvrir ma messagerie académique ».
6 bis. **Plus** (téléphone) : champ « Trouver une page », rubriques repliables, pages les plus utilisées en haut. **Aujourd'hui** : carte « Premiers pas » (masquable).
7. **Préparer › Programmes et référentiels** : « À quoi ça sert ? » explique la chaîne programme → référentiel → séquences et fiches → cahier journal → évaluations ; la colonne « Travaillée » montre la couverture de chaque compétence.
8. Polices pour les plus petits : **Andika** (script des débutants) et **Marelle Bâton** ; dans le tableau d'écriture, « Écriture : CAPITALES D'IMPRIMERIE ».

## 2 decies. Registre d'appel, binôme, timer

1. **Aujourd'hui › Registre d'appel** (ou « Registre du mois » depuis l'Appel) : Statistiques (présences totales, matin, après-midi, calendrier des appels faits), Registre (grille élèves × demi-journées, total), Absences (touchez une absence pour la justifier : motif légitime, autre motif, injustifiée ; cumul des retards ; alerte à 4 demi-journées non justifiées dans le mois), Préférences (tri par nom ou prénom, groupes de niveau, repas spécial, élève non pris en compte). Impression du mois et tableau CSV.
2. **Réglages › Classes › Modifier** : « Je partage cette classe avec une binôme » à cocher ou décocher.
3. **Timer** : pastille tricolore = vert, orange à mi-temps, rouge à la fin (couleur par défaut).

## 3. Architecture retenue

| Choix | Pourquoi |
|---|---|
| HTML/CSS/JavaScript standard, modules ES, **aucune dépendance à l'exécution**, aucune compilation | Gratuit, durable, hébergeable partout, rien à mettre à jour |
| **IndexedDB** dans le navigateur (données + fichiers) | Vraie persistance après fermeture, fonctionne hors connexion. N'est **pas** une sauvegarde en ligne : c'est affiché dans l'application |
| Service worker + manifeste | Application installable et utilisable sans réseau |
| Sauvegarde complète `.json` (données, fichiers, historique, empreinte SHA-256) | Seul moyen de sécurité en mode local ; restauration vérifiée ; refus des fichiers altérés ou d'une version plus récente |
| Couche de données unique (`js/store.js`) | Identifiants stables, historique auteur/date, annulation, corbeille ; synchronisée par fichiers chiffrés (Nuage) sans serveur de l'application |

**Entités en place** (chaque objet a un identifiant stable ; les liens se font par identifiant, jamais par nom) :

- `year` : année, dates, périodes, jours sans classe, source du calendrier.
- `class` : rattachée à une année ; niveaux (multiniveau possible), cycle déduit, école, service, binôme.
- `student` : identité, photo, responsables/contacts (légal, prioritaire, urgence, autorisé à venir chercher). **Indépendant de l'année.**
- `enrollment` : un élève dans une classe, avec niveau, date d'arrivée, date de départ, motif. C'est ce qui garde les listes historiques exactes.
- `file` / `folder` : fichiers (avec versions) ou liens externes ; tags, matière, niveau, projet, année, élèves concernés.
- `inbox` : éléments à classer (note, photo, PDF).
- Historique (`audit`) : chaque modification, avec auteur, date, avant/après.

Ajoutées à l'étape 2 :

- `referential` : référentiel officiel importé, avec source, date du texte, version, statut « à vérifier » / « validé » ; une nouvelle version n'efface pas l'ancienne.
- `programmation` (une discipline, un niveau, une classe) et `notion` (période, sous-domaine). Le statut d'une notion est **déduit** des progressions.
- `progression` (une discipline, une période) : lignes semaine par semaine reliées à une séquence ou une séance, statut saisi à la main avec suggestion du cahier journal, bilan de période.
- `sequence` et `session` (fiche de séance = **modèle réutilisable**, phases typées). `copiedFrom` distingue une copie d'un original.
- `timetable` : EDT par période(s), en **versions datées** (`from`).
- `occurrence` : une **séance datée** du cahier journal, liée à un créneau et à une fiche (par identifiant). Statut prévue/faite/partielle/reportée/annulée, bilan du jour, « après la séance », instantané (`snapshot`) de ce qui a été fait, `postponedFrom` / `postponedTo`.
- `intervention`, `event`, `task`, `homework`, `lesson` (distributions datées), `manual`.

Ajoutées à l'étape 3 : `attendance` (appel par demi-journée, validé ou non), `serviceplan` / `serviceexc` (semaine type et exceptions datées), `studentdoc` (documents, autorisations, droit à l'image, par année), `observation`, `levelmark`, `aid`, `portfolio`, `exchange`, `need` et `plan` (confidentiels), `list` (colonnes libres ou liées à la fiche élève), `evaluation` (maîtrise et points séparés), `report` (bilans de période), `catchup` (rattrapage), `layout` (plans de classe), `groupset` (groupes ; copie figée dans la séance datée), `jobs`, `book` / `loan`, `slideshow`.

Ajoutées à l'étape 4 : `contact`, `meeting`, `h108`, `apc…`, `handover`, `pesitem`, `account` et `movement` (journal financier unique, corrections par mouvement inverse), `project`, `material` / `matmove`, `labelset` (séries d'étiquettes versionnées), `game`, `epsdiagram` (relié à une séance et une phase). Ajoutées à l'étape 5 : `publication` (brouillon privé / publié, photos et élèves visibles), `rdvslot` (créneaux, réservation unique). Réglages propres à l'appareil (identité, mot de passe mémorisé, dossier Nuage, rappels déjà affichés) dans une petite base séparée `classeur-appareil`, jamais synchronisée.

Ajoutées ensuite (inspirées de l'agenda) : `studentinfo` (cases propres à une année), `infoconf` (informations confidentielles, séparées de la fiche), `rewardjar`, `familynote`, `aeshsheet`, `incident`, `soin` (ces trois derniers confidentiels). Données fournies : `data/programmes/` (compétences extraites des PDF officiels, voir `tools/programmes/`), `data/maps/` (Natural Earth, IGN Admin Express), `fonts/` (Marelle, Andika et OpenDyslexic, licence OFL).

**Fichiers du projet**

```
index.html, manifest.webmanifest, sw.js (généré), icons/
css/app.css
js/db.js        accès IndexedDB          js/store.js   données, historique, annulation, corbeille
js/model.js     années, périodes, classes, inscriptions, calendrier zone C
js/backup.js    sauvegarde/restauration  js/csv.js     import/export CSV
js/print.js     impression A4            js/search.js  recherche globale
js/roadmap.js   feuille de route + navigation (source unique)
js/main.js, router.js, shell.js, components.js, ui.js, quickadd.js, demo.js
js/pages/       aujourd'hui, élèves, fiche élève, fichiers, réception, recherche, réglages, plus, à venir
tests/e2e.mjs   tests automatisés dans un vrai navigateur
tools/          génération de sw.js et de FEUILLE_DE_ROUTE.md
```

## 4. Vérifications automatiques

**Étape 1** — 27 scénarios (`tests/e2e.mjs`), dont : année zone C, classe, ajout et doublon, import CSV avec erreurs, annulation, contacts, départ daté et listes historiques, corbeille, fichiers et versions, lien dangereux refusé, réception, recherche (accents ignorés, contacts non indexés), modules masqués, page à venir sans bouton, export CSV, **PDF long de 2 pages au format A4 avec en-têtes répétés**, **fermer/rouvrir**, **export → tout effacer → restauration vérifiée (y compris une image)**, sauvegarde altérée refusée, historique, démo retirée sans toucher aux vraies données, **hors connexion**, **téléphone 375 px sans débordement**.

**Étape 2** — 17 scénarios (`tests/e2e-etape2.mjs`), dont ceux du cahier des charges : modifier une préparation et la retrouver au cahier journal sans doublon ; reporter une séance (supports conservés, créneau proposé, passé préservé) ; intervention à partir d'une date (absente avant) ; multiniveau (colonnes parallèles, conflit de présence de l'enseignant) ; réalisé figé ; EDT versionné ; statut de notion déduit ; copie indépendante ; référentiel validé et versionné ; reprise d'année sans journal ni résultats ; impressions PDF (fiche de visite sur 3 pages, séquence, EDT, journée, semaine, devoirs) ; sauvegarde/restauration de toutes les nouvelles données ; retrait complet de la démo.

**Étape 4** — 25 scénarios (`tests/e2e-etape4.mjs`), dont : **deux versements → total juste dans le projet et le journal, sans double compte** ; correction tracée ; colonne de liste liée au paiement ; report de compte sans mélanger les années ; achat de matériel = une seule dépense ; **étiquettes à taille réelle (24 par planche, colonnes, pagination)** ; version actualisée après changement d'académie ; géométrie exacte et cartes sourcées ; instruments à l'échelle ; jeux jouables ; schéma EPS modifié retrouvé dans la fiche ; dossier de la semaine.

**Ajouts de l'agenda** — 13 scénarios (`tests/e2e-etape4b.mjs`), dont : une case du tableau « Informations élèves » met à jour la fiche (et la semaine type de cantine, la sortie habituelle) ; colonnes confidentielles masquées, stockées à part, jamais imprimées par défaut ni trouvées par la recherche ; **texte réellement lu dans une image** puis envoyé au tableau Seyès ; texte d'une image des Fichiers retrouvé par la recherche ; pot enregistré, abaque avec échange, tableau des nombres ; autorisation de sortie depuis un projet, un exemplaire par élève ; appréciation accordée au féminin placée dans le bilan ; incident : mots de jugement signalés, noms remplacés par les initiales.

**Étape 5** — 8 scénarios de synchronisation (`tests/e2e-etape5.mjs`) : fichier chiffré illisible sans le mot de passe ; nouvel appareil qui récupère tout ; modifications sur deux appareils fusionnées, conflit tracé ; suppression définitive propagée ; « Remplacer » sans doublon ; dossier synchronisé. Et 11 scénarios familles et rappels (`tests/e2e-etape5b.mjs`) : **photo avec un élève sans droit à l'image → publication bloquée** ; aperçu parent sans observation, besoin, échange ni devoir d'un autre élève ; **un créneau ne peut pas être réservé deux fois** ; message noté dans l'historique ; relances par famille ; fichier .ics conforme (alertes, aucun nom de famille) ; rappel affiché une seule fois ; rotation des ateliers.

**Compléments** — 10 scénarios (`tests/e2e-complements.mjs`) : **60 mots courants coupés comme à l'école** ; couleurs alternées et lettres muettes ; **corrigé des calculs vérifié**, sans retenue, même graine = même fiche ; problèmes, dictée, fluence (cumul des mots) ; surveillances équilibrées qui respectent les jours de présence ; adresse de lien dangereuse refusée ; **dictée vocale inactive sans accord** ; IA cachée quand le navigateur ne la propose pas.

**Archives** — 5 scénarios (`tests/e2e-archive.mjs`) : seuls les éléments de l'année partent (élève réinscrit, référentiels, manuels gardés ; observations de l'élève réinscrit triées par date) ; fichier chiffré ; retrait seulement après relecture du fichier et refusé si l'année a changé depuis ; place libérée (photos) ; retrait propagé aux autres appareils ; consultation sans réimport.

**Semaine et import** — 9 scénarios (`tests/e2e-semaine.mjs`) : fiche habituelle et séance suivante de la progression proposées, jamais posées deux fois ; semaine vierge sans toucher les autres ; export d'un mois en CSV et d'une semaine (une page par jour) ; menu « Plus » dans l'écran du téléphone ; import d'une progression qui relie la séquence existante sans la dupliquer ; import du cahier journal dans les créneaux, sans écraser ; couverture des compétences ; Andika et capitales.

**Registre** — 6 scénarios (`tests/e2e-registre.mjs`) : statistiques exactes (retards comptés présents), grille et totaux, justification et alerte à 4 demi-journées, cumul des retards, préférences appliquées à l'appel et aux statistiques, CSV et impression, téléphone sans débordement.

**Étape 3** — 16 scénarios (`tests/e2e-etape3.mjs`), dont : cocher une assurance dans une liste met à jour la fiche élève (et inversement) ; absence partielle : seules les séances réellement faites pendant l'absence sont proposées, remis ≠ rattrapé ; projection et bilans familles sans aucune donnée privée (besoins, observations, bilans, notes, coordonnées) ; recherche sans données confidentielles ; inscription au service ≠ présence prévue ; timer qui continue entre les pages et après rechargement, une seule alerte ; changer de plan de classe sans perdre d'élève ; ajuster une équipe sans modifier une séance passée ; un exemplaire ne peut avoir deux prêts ; non évalué ≠ non acquis, aucune conversion ; support d'atelier en A4 à taille réelle ; diaporama sans notes projetées ; sauvegarde/restauration ; téléphone sans débordement.

**Exploration** (`npm run explorer`, `tests/explore.mjs`) : avec les données fictives, toutes les pages et leurs onglets (116) sur ordinateur et sur téléphone, et environ 350 boutons non destructifs cliqués ; relève les erreurs, pages vides ou « à venir » et tout ce qui dépasse de l'écran du téléphone. Résultat au 23/10/2026 : 0 problème.

Pour les relancer (nécessite Node.js) :

```
npm install            # installe Playwright et pdf-lib (outils de test uniquement)
npx playwright install chromium
python3 serveur.py &              # ou dans un autre terminal
npm test                          # étapes 1 à 5 et ajouts
node tools/build-sw.mjs           # après toute modification des fichiers de l'application
```

## 4 bis. Mise en ligne sur GitHub Pages (choix retenu, gratuit)

Le dépôt est public : on y trouve le code et des exemples fictifs, **jamais de données d'élèves** (elles restent dans le navigateur de chaque appareil).

1. Sur GitHub : **Settings › Pages** › *Source* : **Deploy from a branch** › *Branch* : **production**, dossier **/ (root)** › **Save**.
2. Après 1 à 2 minutes, l'application est à l'adresse **https://dididark00.github.io/Application-prof/**.
3. La branche `production` est mise à jour à la fin de chaque étape ; la page se met à jour toute seule.

## 4 ter. Autre possibilité : Netlify (non utilisée)

Le dépôt contient `netlify.toml` : site statique, sans étape de construction ; les fichiers qui ne font pas partie de l'application (tests, outils, documents) ne sont pas servis.

1. Créer un compte sur netlify.com (« Sign up with GitHub », avec le compte dididark00).
2. « Add new project » › « Import an existing project » › GitHub › autoriser Netlify sur le seul dépôt **Application-prof**.
3. Réglages proposés : *Branch to deploy* = **production** ; *Build command* = vide ; *Publish directory* = `.` (repris de `netlify.toml`). Lancer le déploiement.
4. Ouvrir l'adresse en `https://….netlify.app`, puis « Installer » (ordinateur) ou « Ajouter à l'écran d'accueil » (téléphone, tablette).

Quota gratuit (vérifié le 22/10/2026 sur netlify.com/pricing) : 300 crédits par mois ; un déploiement de production coûte 15 crédits, la bande passante 20 crédits par Go. L'application pèse environ 0,3 Mo et se met en cache : c'est le nombre de déploiements qui compte. La branche `production` n'est donc mise à jour qu'une fois par étape. En cas de dépassement, Netlify **suspend le site jusqu'au mois suivant, sans facturer** l'offre gratuite. Les données restent dans chaque navigateur : la mise en ligne ne synchronise pas les appareils (étape 5).

## 5. Dépendances externes et coûts

**Aucune pour l'étape 1.** Tout fonctionne localement et gratuitement. Aucun service n'a été souscrit, aucun mot de passe n'est demandé.

À décider plus tard, avec votre accord, après un tableau fonction / solution gratuite / limites / coût vérifié à la date du choix :

- **Hébergement des fichiers de l'application en https** (pour l'installer sur téléphone) : plusieurs hébergeurs statiques proposent une offre gratuite (par ex. GitHub Pages, Cloudflare Pages, Netlify). L'application ne contient aucune donnée : héberger le code ne transmet aucune donnée d'élève.
- **Synchronisation entre appareils** : **Nuage** d'apps.education.fr (gratuit pour les agents, 100 Go, serveurs du ministère). Fichiers chiffrés (AES-256, mot de passe connu de vous seule). Comparatif fait le 23/10/2026 avec Supabase, Firebase, Appwrite et Cloudflare : écartés (entreprises privées, mises en pause, carte bancaire pour les fichiers, démarches RGPD).
- **Familles** : le canal de l'école (cahier de liaison papier, e-mail ou application de l'école) ; l'application ne contacte aucun serveur.
- **Lecture de texte (OCR)** : intégrée, gratuite, sur l'appareil — moteur tesseract-wasm (licence BSD) et modèle français tessdata fast (Apache 2.0), dossier `ocr/` (4,7 Mo), téléchargé seulement à la première utilisation. Sources dans `ocr/SOURCES.txt`.
- IA, SMS, emails en masse, domaine personnalisé : facultatifs, non nécessaires.

## 6. Limites connues

- Données sur un seul appareil/navigateur ; pas de synchronisation (le dire n'est pas un défaut caché : c'est affiché dans Réglages › Sauvegarde).
- Numéro de page en pied de page : affiché par Chrome/Edge ; d'autres navigateurs peuvent l'omettre.
- PowerPoint (.pptx) : pas d'aperçu dans le navigateur (téléchargement, ou export PDF à déposer).
- Données sensibles (santé, PPS/PAI…) : pas encore saisissables ; elles arriveront à l'étape 3 avec un accès restreint.
- Avant d'y mettre de vraies données d'élèves : exportez régulièrement la sauvegarde et rangez-la en lieu sûr.
- Rappels : affichés quand l'application est ouverte ; pour être prévenue application fermée, exportez vers l'agenda du téléphone (.ics).
- Synchronisation : sur téléphone, envoyer et récupérer se font à la main (deux gestes) ; synchronisation d'un clic seulement sur ordinateur avec Chrome ou Edge.
- Familles : pas de portail propre ; les familles ne réservent pas elles-mêmes un rendez-vous en ligne (réponse par le cahier de liaison ou par e-mail).
- Compétences officielles : extraction automatique des PDF, à relire avant validation ; objectifs d'EVAR de maternelle non extraits.
- Syllabes en couleur : découpage automatique, à relire (correction possible mot par mot).
- Dictée vocale : la voix part en général au service du navigateur (Google, Apple) ; à n'utiliser qu'après accord, sans données d'élèves.
- IA : seulement celle intégrée au navigateur, quand il la propose ; aucune IA en ligne.
- LSU : l'import direct est réservé aux éditeurs validés par le ministère ; l'application exporte un tableau à recopier.
- Lecture de texte (OCR) : images seulement pour l'instant (pas encore les PDF scannés) ; le texte lu peut contenir des erreurs, à relire.
- Sonomètre : niveau relatif, non étalonné en décibels.
- Voix anglaise : celle fournie par l'appareil (qualité variable) ; un enregistrement de votre voix est toujours possible.
- Les heures de référence par discipline ne sont pas préremplies : à saisir depuis le texte officiel en vigueur.
- Les champs de date affichent le format de la langue du navigateur.
- Informations confidentielles : masquage à l'écran (avec code facultatif), pas un chiffrement ; sans serveur, il n'y a pas de comptes : protégez l'appareil par son propre code de verrouillage.
- Timer au-dessus des autres applications : seulement dans les navigateurs qui le permettent (Chrome, Edge). Sinon, il reste au-dessus des pages de l'application et dans l'écran de projection.
- Export des appréciations : tableau à reporter dans le LSU, pas un import officiel vérifié.
