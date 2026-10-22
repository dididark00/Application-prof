# Application de gestion de classe — Cahier des charges et prompt pour Claude

## 1. Mission à donner à Claude

Tu dois concevoir puis développer une application réellement fonctionnelle, en français, pour centraliser le travail d'un professeur des écoles. Son utilisatrice initiale est Julia, enseignante stagiaire à mi-temps en CE2, travaillant avec une binôme. L'application doit être configurable pour d'autres enseignants, de la maternelle au CM2, et pour des classes multiniveaux. Aucun nom d'application n'est encore fixé.

Conserve tout le périmètre ci-dessous. Construis-le par étapes sans supprimer silencieusement des fonctions. Commence par expliciter l'architecture, les données et le plan de réalisation, puis développe une première étape utilisable. À chaque étape, indique les fonctions réalisées, celles à configurer et celles restant à développer. N'affiche jamais une simulation comme une connexion opérationnelle. Toute donnée de démonstration doit être fictive et clairement identifiée.

L'objectif central : saisir une information une seule fois, la retrouver dans toutes les vues pertinentes, préparer à la semaine et utiliser facilement l'application en classe. Ne pas imposer un abonnement à une API d'IA pour les fonctions courantes.

## 2. Navigation

Six rubriques principales sur ordinateur :

| Rubrique | Contenu |
|---|---|
| Aujourd'hui | Journée, appel rapide, tâches, rendez-vous, documents à préparer, projection |
| Préparer | Programmes, programmations, progressions, séquences, préparations, manuels, ressources, fichiers, leçons, diaporamas, étiquettes |
| Planifier | Agenda, EDT par période, cahier journal, devoirs, interventions, ateliers |
| Ma classe | Élèves, trombinoscope, évaluations, livrets, différenciation, rattrapage, listes, plan de classe, responsabilités |
| Familles | Messages, publications, documents, rendez-vous, aperçu parent |
| Organisation | Réunions, notes, 108 h, APC, transmissions, argent, projets, matériel, contacts, remplacement, PES |

Réglages séparés : année scolaire, classe, niveaux, cycle, périodes, calendrier, service, binôme, modèles, charte visuelle, modules, comptes et connexions.

Sur téléphone : Aujourd'hui, Planifier, Ma classe et Plus. Favoris personnalisables, recherche globale, bouton d'ajout rapide, liens contextuels entre pages. Modules masquables sans effacer les données. Sélecteur d'année et de classe visible. Boîte de réception pour déposer une photo, un PDF ou une note et les classer plus tard.

## 3. Données et liens obligatoires

Programme officiel → programmation annuelle → progression de période → séquence → séances et fiches de préparation. L'EDT fournit les créneaux ; le cahier journal référence les séances. Une séance peut avoir des ressources, leçons, devoirs, diaporamas, adaptations et évaluations associés.

Une fiche partagée entre plusieurs vues reste un seul objet. Distinguer « lier » et « dupliquer » : modifier un objet lié actualise ses vues ; modifier une copie n'altère pas l'original. Distinguer un modèle réutilisable d'une séance datée, afin qu'un bilan de journée ne modifie pas toutes ses utilisations.

Autres liens : appel → rattrapage ; évaluations → compétences → bilans ; rendez-vous → agenda et fiche élève ; réunion → notes, actions et heures ; paiement → projet et journal financier. Aucune double comptabilisation.

Distinguer systématiquement prévu/réalisé, préparé/publié, remis/rattrapé, non évalué/non acquis, inscription à un service/présence prévue. Une modification future ne réécrit pas les journées passées. Prévoir identifiants stables et historiques, pas de liens reposant seulement sur les noms des élèves.

## 4. Années, niveaux et multiniveau

Créer plusieurs années et classes ; importer, ajouter, modifier et archiver les élèves. Gérer les arrivées et départs en cours d'année sans altérer les listes et appels historiques. Reprendre modèles, séquences et ressources d'une année précédente sans transférer automatiquement paiements, autorisations ou résultats.

Adapter matières, domaines, compétences, modèles et bilans au niveau/cycle. Les référentiels doivent être sourcés, datés et versionnés ; ne pas inventer des compétences officielles. Permettre d'importer un référentiel et de le vérifier avant intégration.

En multiniveau : progressions et programmations par niveau ; séquences communes possibles ; objectifs, consignes, supports, devoirs et évaluations distincts. Cahier journal en colonnes parallèles. Identifier travail dirigé, autonomie et ateliers. Signaler deux activités exigeant simultanément l'enseignant. Groupes de besoin transversaux, ateliers et rotations.

## 5. Préparation pédagogique

Éditeurs de programmations annuelles et progressions par période, matière et sous-matière : ajouter, déplacer, ordonner, modifier et suivre les notions (prévue, commencée, terminée, à reprendre). Bilans de période avec notions réalisées et restantes.

Fiche de séquence : titre, domaine, niveau, compétences, objectifs, prérequis, séances ordonnées, ressources, différenciation, évaluation et bilan.

Fiche de préparation : objectifs, durée, matériel, organisation, phases minutées, consignes, rôle de l'enseignant, activité des élèves, réponses attendues, différenciation, critères de réussite et bilan. Modèles personnalisables, duplication, liens vers séquence/progression/cahier journal.

Manuels : titre, auteur/éditeur si renseignés, édition, niveau, matière, type (guide/cahier/manuel), pages et pièces jointes. Prévoir notamment Picot, Accès et Retz comme références configurables, sans préremplir leur contenu. Importer PDF scannés, images et autres fichiers ; OCR optionnel avec indication du texte incertain. Distinguer hébergement, recherche OCR et génération pédagogique assistée par IA. Si IA ajoutée : proposition modifiable, sources/pages visibles, aucune invention de contenu absent, aucun envoi automatique de données élèves.

Leçons numérotées et liées aux séances, devoirs et évaluations ; date de distribution réelle et destinataires. Photos du tableau et corrections associées. Suivi des apprentissages à reprendre.

## 6. Agenda, EDT et cahier journal

EDT de référence pour chaque période, duplication entre périodes, créneaux éditables et récurrences. Exceptions datées : sortie, absence, visite, réunion, intervention ou report. Interventions avec contact, lieu, dates de début/fin, créneaux, groupes, séquence et supports ; ajouter déplacement et préparation. Une intervention sans date confirmée reste à planifier et ne bloque pas un créneau comme si elle était confirmée.

Montrer les conflits et proposer des reports que l'enseignant ajuste. Ne pas supprimer de séance remplacée ni décaler automatiquement toute la progression. Vue jour/semaine/période ; contrôles des durées et temps par matière avec référentiel configurable.

Cahier journal construit depuis l'EDT et les séances sélectionnées : modification manuelle, bilan express, faite/partielle/reportée, historique du réellement réalisé. Rituels récurrents avec occurrences modifiables. Liste consolidée du matériel et des photocopies, nombre d'exemplaires, prêt/imprimé.

Agenda personnel et professionnel, disponibilités, événements, tâches et échéances. Répartition des préparations et séances avec la binôme. Notifications configurables.

## 7. Appel et organisation quotidienne

Appel matin/après-midi : présent, absent, retard, départ anticipé, retour et absence partielle ; horaires et commentaires. Les présences ne sont pas considérées comme vérifiées avant validation de l'appel.

Cantine, étude et périscolaire : semaine habituelle, exceptions datées, effectifs et listes imprimables. Départ seul/accompagné selon niveau et consignes renseignées ; personnes autorisées, organisation habituelle et exceptions.

Plan de classe modifiable, groupes, responsabilités et rotations. Trombinoscope avec photo ou silhouette, vues classe/niveau/groupe et impression ; accès à la fiche élève.

## 8. Fiches élèves, documents et différenciation

Informations, responsables multiples, téléphones/emails, contact prioritaire, urgence et personnes autorisées. Statuts documentaires : à recevoir/reçu/à compléter, date, pièce jointe et relance. Inclure fiche de renseignements, assurance avec validité, autorisations et documents personnalisables.

Droit à l'image par usage avec statut autorisé/refusé/à renseigner, dates et justificatif. Ne pas confondre une case générale avec toutes les autorisations.

Observations datées par domaine, réussites, difficultés, actions et suivi. Besoins particuliers renseignables (dys, handicap, attention, langage, autres) en distinguant informations confirmées et observations de l'enseignant. PPRE, PAP, PPS, PAI, AESH : statut, dates, aménagements et documents, avec accès restreint.

Niveau par domaine daté, pas une étiquette globale figée. Aides efficaces et historique de leurs effets. Sélection d'élèves/groupes dans une préparation pour adapter objectif, consigne, support, quantité, modalité de réponse et temps. Proposer des aides enregistrées sans adaptation automatique fondée seulement sur un diagnostic. Suivre les créneaux d'accompagnement utiles à l'organisation.

Portfolio de productions et réussites liées aux compétences. Historique des échanges et rendez-vous.

## 9. Listes personnalisables

Créer des listes depuis les élèves de la classe : titre, colonnes case/date/texte/montant/choix, filtres, tri, actions groupées, impression vierge ou remplie. Exemples : documents de rentrée, matériel, livres rendus, poésie, mots signés, sorties.

Une colonne liée à une donnée existante actualise cette donnée (assurance, autorisation, paiement). Une colonne libre reste propre à la liste. Réutiliser les modèles avec les élèves d'une nouvelle année ; conserver l'historique.

## 10. Devoirs, évaluations, livrets et rattrapage

Devoirs datés liés aux séances/leçons, destinataires classe/niveau/groupe/élève, pièces jointes, affichage, impression et publication volontaire.

Évaluations liées aux séquences et compétences : grille de classe, notes/barèmes, maîtrise ou les deux, absence/non évalué, versions adaptées, conditions de passation, observations et rattrapage. Aucune conversion silencieuse d'une note en maîtrise. Résultats et observations alimentent bilans et appréciations modifiables.

Préparer les livrets par période et les éléments de saisie du LSU. Une connexion/export compatible LSU doit être vérifiée séparément ; ne pas prétendre remplacer le service officiel. Adapter les bilans à la maternelle et aux niveaux concernés.

Rattrapage : croiser plages d'absence avec séances réellement faites et supports réellement distribués au groupe de l'élève. Proposer leçons, exercices, devoirs et évaluations ; l'enseignant sélectionne le nécessaire. Statuts à remettre/remis/à rattraper/rattrapé, dates et fiche imprimable/publiable. Tenir compte des absences partielles et adaptations.

## 11. Diaporamas, fichiers et charte

Espace fichiers avec dossiers, tags, année/matière/niveau/projet, recherche, favoris, aperçu et versions. Import et liens externes. Réutilisation sans duplication inutile. Liens Drive opérationnels indépendamment d'une éventuelle synchronisation authentifiée.

Diaporamas par séance ; vue de préparation hebdomadaire ; liste de projection quotidienne issue du cahier journal. Import PDF/images/PPTX : expliciter les formats réellement affichables et la conversion nécessaire pour PPTX. Liens Canva et Google Slides ; modification externe et présentation si disponible. Éditeur simple titre/texte/image/consigne/exercice/timer. Ne pas promettre la fusion universelle de présentations externes.

Mode projection séparé : programme, consignes, groupes appropriés, devoirs et timer ; jamais les données privées de l'enseignant. Notes présentateur distinctes.

Charte enregistrée : couleurs, polices, bordures, images, emblèmes et modèles. Générateur d'étiquettes élèves/matériel, affichages, cartes d'ateliers et titres. Pour les académies de Julia : noms/couleurs/emblèmes configurables et rattachement des élèves ; génération en série depuis la classe, retouche individuelle, dimensions exactes, nombre par page et PDF. Proposer une actualisation après changement d'académie sans écraser les versions précédentes.

## 12. Organisation professionnelle et finances

Réunions/rendez-vous : notes, compte rendu, documents, décisions, tâches responsables/échéances et liens agenda/élèves. Transmissions binôme avec fait/à terminer/information et accusé de lecture. Répertoire de l'école et intervenants.

108 h : activités datées, catégorie, durée prévue/réalisée, totaux, pièces et export. Service et objectifs configurables ; vérifier les règles applicables avant tout préremplissage officiel. APC : objectifs, élèves, autorisations si nécessaires, séances, présences, bilan et comptage unique des heures.

Module PES : échéances INSPE, visites, documents, objectifs de formation, retours et actions reliées aux préparations. Dossiers remplacement/visite personnalisables.

Argent et projets : coop, sortie, kermesse, collectes ; budget, participants, attendu/reçu/reste, paiements partiels, date/moyen, dépenses, remboursements, justificatifs et solde. Recettes globales par stand possibles. Un paiement crée un seul mouvement financier, visible depuis plusieurs pages. Ne pas supprimer silencieusement un mouvement validé ; correction traçable. Solde initial/report explicitement enregistré, comptes séparés par année. Exports financiers, pas de paiement en ligne implicite.

Projets transdisciplinaires : calendrier, étapes, matières, productions, intervenants, accompagnateurs, groupes, autorisations, budget et documents. Matériel : stocks, achats, prêts et retours.

## 13. Familles et connexions externes

Module facultatif avec comptes responsables associés aux bons enfants, messages individuels/groupes/classe, documents, devoirs, autorisations et historique. Distinguer consultation, réponse et retour de document. Préparation privée jusqu'à publication explicite. Aperçu « comme ce parent ». Notifications et plages de tranquillité ; aucun envoi sans action explicite de l'utilisateur.

Réservation de rendez-vous sur les seuls créneaux ouverts : durée, lieu/visio, délais, annulation, état demandé/confirmé, blocage atomique des doubles réservations. Les parents ne voient pas le détail des agendas privés. Lien avec agenda et fiche élève.

Mail académique : module dépendant du fournisseur et des accès autorisés, à vérifier avant développement. Transformer un mail sélectionné en tâche/événement/document avec contrôle humain. Connexions Drive, Canva, agendas et LSU distinctes, avec statut disponible/à configurer/non développé. Prévoir des imports/exports utiles en l'absence de connexion. Aucun stockage de mot de passe dans l'interface ou le code client.

## 14. Impression et exports

Bouton Imprimer/Exporter sur chaque document pertinent : EDT, cahier journal, préparations, séquences, progressions, programmations, listes, trombinoscope, devoirs, rattrapage, évaluations, bilans, mots, notes et finances.

Sélection période/classe/groupe/élève, rubriques et colonnes ; A4 portrait/paysage, noir et blanc/couleur ; aperçu, titres répétés, tableaux sans coupure illisible, marges et pagination. Version vierge quand pertinente. Dossier de semaine regroupant les documents choisis. Exports tabulaires pour résultats/listes/finances et sauvegarde complète réimportable. Impression des étiquettes à taille réelle.

Profils d'export enseignant/élèves/familles/remplaçant avec sélection explicite des données sensibles ; exclusions par défaut pour les destinataires non autorisés.

## 15. Fiabilité, accès et ergonomie

Utilisable téléphone/tablette/ordinateur. Sauvegarde persistante réelle après fermeture, état de sauvegarde visible, historique et annulation. Mode hors connexion limité aux fonctions réellement supportées, état de synchronisation et traitement des conflits explicites. Choisir une architecture durable permettant ensuite plusieurs utilisateurs ; ne pas présenter un stockage local comme une sauvegarde distante.

Comptes personnels, permissions par classe et fonction, rôles enseignant/binôme/parent ; autorisations contrôlées côté serveur pour tout espace partagé. Protection spécifique des contacts, documents, santé/accompagnements et données financières. Déconnexion, récupération de compte, suppression/archivage et export des données. Vérifier le cadre d'hébergement et d'utilisation avant introduction de données réelles d'enfants ou ouverture aux familles.

Historique auteur/date pour modifications importantes. Les données masquées ne doivent pas être exposées via recherche, notifications, liens partagés ou projection. Documents privés par défaut, partage sélectif de ressources et restrictions pour les scans de manuels.

## 16. Ordre de construction

1. Socle : navigation, réglages, années/classes/niveaux, élèves, données persistantes, fichiers, recherche, sauvegarde et premiers exports.
2. Préparation liée : référentiels, programmations, progressions, séquences, préparations, EDT par période, interventions, cahier journal, multiniveau, devoirs et leçons.
3. Usage en classe : appel/services, documents, listes, différenciation, évaluations/bilans, rattrapage, projection, trombinoscope, groupes et responsabilités.
4. Organisation : réunions, 108 h/APC, binôme, projets, finances, matériel, PES, générateur d'affichages et dossiers imprimables.
5. Collaboration : comptes et droits éprouvés, portail familles, publications et réservation de rendez-vous ; connexions externes vérifiées une par une.

Tout le périmètre reste dans la feuille de route. Chaque étape doit être testable et utilisable ; garder les fonctions futures clairement signalées sans faux boutons actifs.

## 17. Scénarios de validation obligatoires

- Modifier une préparation et retrouver la modification depuis le cahier journal sans doublon.
- Reporter une séance : conserver ses supports, proposer un créneau et préserver le passé.
- Programmer une intervention à partir d'une date : aucune apparition dans les semaines précédentes.
- Multiniveau : montrer deux activités parallèles et signaler un conflit de présence de l'enseignant.
- Cocher une assurance dans une liste : actualiser la fiche élève.
- Absence partielle : proposer uniquement les documents réellement manqués, adaptés au groupe ; distinguer remis/rattrapé.
- Saisir deux versements : total correct dans le projet et le journal financier, sans double compte.
- Changer d'année : reprendre modèles, garder les comptes et résultats de l'ancienne année séparés.
- Parent : accès à son enfant seulement ; aucune note privée visible ; deux demandes simultanées ne réservent pas le même créneau.
- Projection et export famille : aucune donnée sensible involontaire.
- Fermer/rouvrir : données conservées ; sauvegarde exportée puis restaurée correctement.
- PDF long et étiquettes : vérifier pagination, colonnes et taille réelle.

## 18. Première réponse attendue de Claude

Présente une architecture adaptée à une utilisation personnelle immédiate et au partage futur, les entités et leurs relations, les choix techniques et dépendances externes, puis un plan détaillé pour l'étape 1. Pose uniquement les questions bloquantes ; propose des valeurs par défaut pour les choix réversibles. Ensuite commence la réalisation dans l'environnement disponible. Si une fonction exige un service externe, explique ce qui est nécessaire et fournis une alternative réellement fonctionnelle. Ne te contente pas d'une maquette esthétique et n'affirme pas que toute l'application est finie à la première étape.

## 19. Atelier pédagogique et outils TNI/TBI

Ajouter dans Préparer un atelier pour concevoir, enregistrer, réutiliser, projeter et imprimer des supports liés au référentiel, niveau, séquence, séance et cahier journal. Prévoir variantes par niveau/groupe et corrections séparées.

- Écriture : lignes Seyès, réglures simples, taille/couleurs réglables, modèles et textes à compléter.
- Géométrie : quadrillages, points, figures, segments, angles, symétrie, règle/équerre/compas/rapporteur virtuels selon les outils réalisés ; tracés exacts, fiches et corrections imprimables.
- Maths : droites graduées, numération, fractions, horloges et manipulation.
- Cartes : monde, continents, France ; versions vierges/légendées, éléments affichables/masquables. Utiliser des données géographiques fiables et des supports sourcés, pas des contours inventés.
- Jeux : modèles fonctionnels de memory, associations, classement, remise en ordre, quiz, bingo et cartes à questions ; contenu/consignes/difficulté personnalisables selon les séances.
- Anglais : flashcards, affiches, vocabulaire, dialogues, jeux et audio disponible, avec source ou mode de production explicite.
- Mode concevoir et mode animer plein écran : annotation, éléments déplaçables, affichage progressif et corrections ; fonctionnement tactile.

### Timer de couleur persistant

Timer visuel sous forme de disque de couleur décroissant avec durée/couleurs ajustables, pause/reprise, réinitialisation et son facultatif. Modes grand format ou plein écran pour la classe, et petit widget flottant redimensionnable et déplaçable au-dessus des pages de l'application. Maintenir le timer actif pendant les changements de page, ouverture de supports et navigation interne ; préserver durée restante, position et taille. Ancrer la fin du compte à une heure cible pour éviter la dérive en arrière-plan. Limiter le déplacement aux zones visibles, prévoir remise en position accessible et fonctionnement souris/tactile. Fermer ou réduire le widget ne doit pas annuler le compte sans action explicite. Ne pas masquer des commandes essentielles ; adapter le widget au mode projection sans révéler de données privées.

Distinguer la navigation interne d'un changement vers Canva, un autre onglet ou une autre application : un widget de page ne reste pas automatiquement au-dessus des autres fenêtres. Prévoir une fenêtre de projection séparée ou un mode image dans l'image uniquement si le navigateur le supporte, sans promettre une surcouche universelle. Vérifier que le timer reste correct lors d'un changement de page et après un retour d'arrière-plan, et que deux vues synchronisées ne déclenchent pas deux alertes.

Inscrire l'atelier dans les étapes 3 et 4 de construction ; commencer par les outils de base et le timer, puis les générateurs spécialisés et les jeux. Conserver tous ces outils dans la feuille de route.

## 20. Plans de classe, groupes et schémas EPS

Plan de classe visuel éditable : mobilier, tableau, portes et zones ; déplacer/faire pivoter tables et élèves au toucher ou à la souris. Modèles rangées, binômes, îlots, U, ateliers et disposition libre. Enregistrer plusieurs dispositions nommées par classe et les associer à une période ou séance sans écraser les précédentes.

Groupes : binômes, équipes, académies, ateliers ou besoins ; constitution manuelle ou proposition aléatoire avec taille/nombre réglables, validation et ajustement par l'enseignant. Groupes propres à une séance distincts des groupes permanents ; gérer absents et élèves non affectés, éviter les doublons. Affecter rôles, couleurs, activité, matériel et ordre de rotation. Ne pas afficher de diagnostic ou niveau individuel dans une vue projetée.

Fiches de groupes imprimables et projetables : nom/couleur du groupe, membres, rôles, consigne, atelier, matériel, étapes, durée, critères de réussite et cases de suivi ; version enseignant avec notes privées séparées. Lier fiches, membres et adaptations aux préparations et au cahier journal. Conserver la composition utilisée dans une séance passée si le groupe change ensuite.

Éditeur de schémas EPS dans l'Atelier pédagogique : terrain ou espace libre, limites/zones, plots, cerceaux, bancs, tapis, ballons, silhouettes ou repères joueurs, enseignant, flèches de déplacement/passe, légende et texte. Déplacer, redimensionner, orienter, dupliquer et annuler ; modèles d'ateliers, parcours et jeux collectifs. Plusieurs schémas par séance ou phase pour montrer mise en place et évolution. Couleurs d'équipes liées aux groupes. Préciser dimensions et échelle uniquement lorsqu'elles sont réellement renseignées ; ne pas présenter un croquis comme un plan coté.

Associer le schéma directement à une phase de fiche de préparation EPS, à sa séquence et au cahier journal. Réutiliser ou dupliquer le schéma pour une autre séance. Export PDF/image, insertion dans la fiche de préparation et le dossier semaine, projection plein écran. Ajouter consignes, matériel, rotations et points de vigilance renseignés par l'enseignant.

Validation : changer de disposition sans perdre les élèves ; ajuster une équipe sans modifier une séance passée ; imprimer une fiche de groupe lisible ; modifier le schéma lié et retrouver sa version actuelle depuis la préparation et le cahier journal. Placer les plans/groupes de base dans l'étape 3, puis l'éditeur EPS et les fiches avancées dans l'étape 4.

## 21. Version web installable, synchronisation et budget

Choix de départ : application web responsive installable (PWA), accessible depuis un navigateur et une icône sur téléphone/tablette/ordinateur. Même compte et mêmes données via un backend commun ; une application native séparée n'est pas requise au lancement.

Sauvegarde automatique en ligne des données et pièces jointes, indicateur enregistré/en attente/erreur, synchronisation entre appareils, historique et récupération. Hors connexion pour un périmètre annoncé, file de modifications et résolution explicite des conflits au retour du réseau. Sauvegarde complète téléchargeable dans Réglages avec données et fichiers, restauration vérifiée et gestion des incompatibilités de version. La synchronisation n'est pas une sauvegarde : prévoir récupération après suppression et politique de rétention explicite.

Budget : privilégier un prototype et une utilisation personnelle peu coûteux. Avant de choisir un fournisseur, présenter hébergement, base de données, fichiers/backups, authentification, emails/notifications, OCR/IA éventuels et domaine facultatif ; distinguer offres gratuites limitées, coûts récurrents, coûts variables et services facultatifs. Vérifier les tarifs et conditions actuels, les limites et le cadre d'hébergement des données élèves. Ne pas promettre la gratuité à long terme. Ne souscrire aucun service payant sans choix explicite de l'utilisatrice. Pas de domaine personnalisé, paiement en ligne, publication en boutique ni API IA obligatoires pour démarrer. Indiquer toute configuration externe nécessaire à la réalisation de la sauvegarde distante.

## 22. Préparations pour les visites et priorité à la gratuité

Chaque fiche de préparation doit être explicitement liée au programme/référentiel, à la programmation annuelle, à la progression, à la séquence et aux occurrences du cahier journal. Afficher compétences officielles sélectionnées avec source/version, objectif général et objectifs opérationnels observables. Conserver les liens tout en permettant des ajustements spécifiques à la séance et au niveau.

Prévoir un modèle structuré pour visites/inspection, personnalisable : domaine/sous-domaine, classe/niveau/cycle, date, place dans la séquence, durée, références, compétences, objectifs, prérequis, matériel, organisation/groupes ; tableau des phases avec durée, consignes, rôle de l'enseignant, activité des élèves, attendus et modalités ; différenciation et aménagements, critères de réussite, évaluation, trace écrite, bilan et prolongements. Importer/reproduire le modèle personnel de l'utilisatrice quand elle le fournit ; ne pas prétendre qu'un modèle générique est officiellement imposé ou validé par l'inspection. Possibilité d'alléger les rubriques au quotidien et de les développer pour une visite. Export PDF propre et version vierge.

Priorité explicite de l'utilisatrice : gratuité maximale au démarrage. Construire les fonctions essentielles sans service payant obligatoire, notamment édition, liens, stockage local de travail, imports/exports, impressions, groupes, schémas, timer et modèles de jeux. Pour le stockage distant et la synchronisation, rechercher un service gratuit compatible avec l'usage, détailler quotas et limites et vérifier sa pertinence avant données élèves réelles. Ne pas garantir une synchronisation gratuite illimitée ou une disponibilité sans contraintes. Proposer un mode local avec sauvegarde export/import si aucune solution distante gratuite adaptée n'est disponible, en expliquant que ce mode ne synchronise pas automatiquement les appareils.

Domaine personnalisé, boutique d'applications, SMS, API IA, génération automatique avancée, OCR distant et envoi massif de mails sont facultatifs. Favoriser liens externes et outils locaux gratuits lorsque possible. Distinguer les coûts propres à l'application des limites/abonnements éventuels de l'outil de développement utilisé. Présenter avant toute intégration un tableau fonction/solution gratuite/limites/coût éventuel, et ne jamais engager de paiement. Garder la compatibilité avec un hébergement évolutif sans obliger à migrer les données manuellement.

## 23. Bibliothèque de classe et emprunts de livres

Sous-onglet Bibliothèque dans Ma classe, relié aux fiches élèves et au suivi du matériel. Catalogue : titre, auteur, catégorie, niveau indicatif, couverture facultative, identifiant et exemplaires distincts. Enregistrer un prêt en choisissant un élève et un exemplaire : date d'emprunt, retour prévu facultatif, date de retour réelle et état/commentaire. Statuts disponible/emprunté/à vérifier/perdu ou abîmé renseignés manuellement. Un même exemplaire ne peut avoir deux prêts actifs.

Vue par livre/exemplaire et par élève, historique des prêts, liste des retours attendus et retards si une échéance est définie, recherche et filtres, retour en un clic et opérations groupées contrôlées. Fiche de prêt et listes imprimables, grille vierge pour saisie papier, lien depuis fiche élève. Les livres documentaires et séries de lecture peuvent être associés aux séquences, séances et devoirs.

Conserver le catalogue d'une année à l'autre tout en séparant les historiques de classe. Signaler les prêts ouverts lors d'un départ d'élève ou d'un changement d'année ; ne jamais les marquer retournés automatiquement. Rappels aux familles préparables mais envoi uniquement sur action explicite. Scan code-barres/QR facultatif, après implémentation réelle du catalogue et des prêts. Intégrer le suivi de base à l'étape 3 et vérifier prêt/retour, disponibilité des exemplaires et historique annuel.
