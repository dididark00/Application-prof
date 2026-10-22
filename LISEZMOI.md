# Classeur — application de gestion de classe (nom provisoire)

Application web installable (PWA) pour professeurs des écoles, en français. Référence : le cahier des charges (document de travail personnel, non publié dans ce dépôt). Suivi de tout le périmètre : `FEUILLE_DE_ROUTE.md` (aussi visible dans l'application : Réglages › Feuille de route).

**État : étapes 1 (socle), 2 (préparation et planification liées) et 3 (usage en classe) réalisées et testées.** Les étapes 4 et 5 restent à développer ; leurs pages sont visibles mais affichent honnêtement « Pas encore disponible », sans bouton factice.

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
10 bis. **Réglages › Général › Apparence** : thème de couleurs (pastel doux par défaut, bleu frais, coloré école, vert d’origine) et mode sombre (automatique de 19 h à 7 h, comme l’appareil, toujours clair ou toujours sombre). Impressions, projection et diaporamas restent sur fond blanc.
11. **Préparer › Atelier pédagogique** : **Tableau d’écriture (Seyès)** — tapez un texte, il s’écrit en attaché sur les lignes du cahier (minuscules = 1 interligne, ligne de base sur la ligne épaisse). Pour la police officielle **Marelle** (gratuite, licence libre OFL), téléchargez-la sur https://marelle.forge.apps.education.fr/, décompressez, puis « Importer une police » → `Marelle-Regular` (une fois par appareil ; elle est incluse dans la sauvegarde). « Afficher en grand » permet d’écrire par-dessus au doigt/stylet. Aussi : lignes Seyès, réglure, texte à compléter, droite graduée, numération, fractions, horloges ; version corrigée ; impression A4 à taille réelle (imprimer à 100 %).
12. **Préparer › Diaporamas** : « Créer depuis la fiche » reprend la structure du modèle de diaporama ; « Présenter ici » ou « Projeter sur l'écran séparé » (notes présentateur jamais projetées).

## 3. Architecture retenue

| Choix | Pourquoi |
|---|---|
| HTML/CSS/JavaScript standard, modules ES, **aucune dépendance à l'exécution**, aucune compilation | Gratuit, durable, hébergeable partout, rien à mettre à jour |
| **IndexedDB** dans le navigateur (données + fichiers) | Vraie persistance après fermeture, fonctionne hors connexion. N'est **pas** une sauvegarde en ligne : c'est affiché dans l'application |
| Service worker + manifeste | Application installable et utilisable sans réseau |
| Sauvegarde complète `.json` (données, fichiers, historique, empreinte SHA-256) | Seul moyen de sécurité en mode local ; restauration vérifiée ; refus des fichiers altérés ou d'une version plus récente |
| Couche de données unique (`js/store.js`) | Identifiants stables, historique auteur/date, annulation, corbeille ; pourra être branchée sur un serveur à l'étape 5 sans ressaisie |

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

Prévues ensuite (étape 4) : réunions, 108 h, APC, transmissions binôme, argent et projets (mouvements financiers uniques), matériel, PES, étiquettes, schémas EPS, jeux, géométrie, cartes.

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

**Étape 3** — 16 scénarios (`tests/e2e-etape3.mjs`), dont : cocher une assurance dans une liste met à jour la fiche élève (et inversement) ; absence partielle : seules les séances réellement faites pendant l'absence sont proposées, remis ≠ rattrapé ; projection et bilans familles sans aucune donnée privée (besoins, observations, bilans, notes, coordonnées) ; recherche sans données confidentielles ; inscription au service ≠ présence prévue ; timer qui continue entre les pages et après rechargement, une seule alerte ; changer de plan de classe sans perdre d'élève ; ajuster une équipe sans modifier une séance passée ; un exemplaire ne peut avoir deux prêts ; non évalué ≠ non acquis, aucune conversion ; support d'atelier en A4 à taille réelle ; diaporama sans notes projetées ; sauvegarde/restauration ; téléphone sans débordement.

Pour les relancer (nécessite Node.js) :

```
npm install            # installe Playwright et pdf-lib (outils de test uniquement)
npx playwright install chromium
python3 serveur.py &              # ou dans un autre terminal
npm test                          # étapes 1, 2 et 3 (60 scénarios)
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
- **Synchronisation entre appareils et sauvegarde en ligne** (étape 5) : demande une base de données et une authentification en ligne ; offres gratuites à comparer (quotas, localisation des données, conditions) **avant** toute donnée réelle d'enfant.
- OCR, IA, SMS, emails en masse, domaine personnalisé : facultatifs, non nécessaires.

## 6. Limites connues

- Données sur un seul appareil/navigateur ; pas de synchronisation (le dire n'est pas un défaut caché : c'est affiché dans Réglages › Sauvegarde).
- Numéro de page en pied de page : affiché par Chrome/Edge ; d'autres navigateurs peuvent l'omettre.
- PowerPoint (.pptx) : pas d'aperçu dans le navigateur (téléchargement, ou export PDF à déposer).
- Données sensibles (santé, PPS/PAI…) : pas encore saisissables ; elles arriveront à l'étape 3 avec un accès restreint.
- Avant d'y mettre de vraies données d'élèves : exportez régulièrement la sauvegarde et rangez-la en lieu sûr.
- Les notifications (rappels de tâches, de séances) arrivent à l'étape 5 ; la répartition des préparations avec la binôme, à l'étape 4.
- Les heures de référence par discipline ne sont pas préremplies : à saisir depuis le texte officiel en vigueur.
- Les champs de date affichent le format de la langue du navigateur.
- Informations confidentielles : masquage à l'écran (avec code facultatif), pas un chiffrement ; le contrôle d'accès par compte arrive à l'étape 5.
- Timer au-dessus des autres applications : seulement dans les navigateurs qui le permettent (Chrome, Edge). Sinon, il reste au-dessus des pages de l'application et dans l'écran de projection.
- Export des appréciations : tableau à reporter dans le LSU, pas un import officiel vérifié.
