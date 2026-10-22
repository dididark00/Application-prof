# Classeur — application de gestion de classe (nom provisoire)

Application web installable (PWA) pour professeurs des écoles, en français. Référence : `Cahier_des_charges_application_prof_Claude.md`. Suivi de tout le périmètre : `FEUILLE_DE_ROUTE.md` (aussi visible dans l'application : Réglages › Feuille de route).

**État : étape 1 (socle) réalisée et testée.** Les étapes 2 à 5 restent à développer ; leurs pages sont visibles mais affichent honnêtement « Pas encore disponible », sans bouton factice.

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

Prévues aux étapes suivantes (déjà pensées dans le modèle) : référentiel versionné → programmation → progression → séquence → séance (modèle) → occurrence datée du cahier journal ; créneaux d'EDT par période ; appel ; évaluations ; mouvements financiers uniques, etc.

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

27 scénarios testés dans Chromium (`tests/e2e.mjs`), dont : année zone C, classe, ajout et doublon, import CSV avec erreurs, annulation, contacts, départ daté et listes historiques, corbeille, fichiers et versions, lien dangereux refusé, réception, recherche (accents ignorés, contacts non indexés), modules masqués, page à venir sans bouton, export CSV, **PDF long de 2 pages au format A4 avec en-têtes répétés**, **fermer/rouvrir**, **export → tout effacer → restauration vérifiée (y compris une image)**, sauvegarde altérée refusée, historique, démo retirée sans toucher aux vraies données, **hors connexion**, **téléphone 375 px sans débordement**.

Pour les relancer (nécessite Node.js) :

```
npm install            # installe Playwright et pdf-lib (outils de test uniquement)
npx playwright install chromium
python3 serveur.py &              # ou dans un autre terminal
npm test
node tools/build-sw.mjs           # après toute modification des fichiers de l'application
```

## 5. Dépendances externes et coûts

**Aucune pour l'étape 1.** Tout fonctionne localement et gratuitement. Aucun service n'a été souscrit, aucun mot de passe n'est demandé.

À décider plus tard, avec votre accord, après un tableau fonction / solution gratuite / limites / coût vérifié à la date du choix :

- **Hébergement des fichiers de l'application en https** (pour l'installer sur téléphone) : plusieurs hébergeurs statiques proposent une offre gratuite (par ex. GitHub Pages, Cloudflare Pages, Netlify). L'application ne contient aucune donnée : héberger le code ne transmet aucune donnée d'élève.
- **Synchronisation entre appareils et sauvegarde en ligne** (étape 5) : demande une base de données et une authentification en ligne ; offres gratuites à comparer (quotas, localisation des données, conditions) **avant** toute donnée réelle d'enfant.
- OCR, IA, SMS, emails en masse, domaine personnalisé : facultatifs, non nécessaires.

## 6. Limites connues de l'étape 1

- Données sur un seul appareil/navigateur ; pas de synchronisation (le dire n'est pas un défaut caché : c'est affiché dans Réglages › Sauvegarde).
- Numéro de page en pied de page : affiché par Chrome/Edge ; d'autres navigateurs peuvent l'omettre.
- PowerPoint (.pptx) : pas d'aperçu dans le navigateur (téléchargement, ou export PDF à déposer).
- Données sensibles (santé, PPS/PAI…) : pas encore saisissables ; elles arriveront à l'étape 3 avec un accès restreint.
- Avant d'y mettre de vraies données d'élèves : exportez régulièrement la sauvegarde et rangez-la en lieu sûr.
