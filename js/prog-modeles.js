// Propositions de programmation annuelle (point de départ modifiable, jamais imposé).
// Base : les objectifs d'apprentissage du programme en vigueur (codes du référentiel officiel, ex. MA.CE2.04).
// Deux natures de placement, toujours distinguées à l'écran :
//  - « repère officiel » : le programme lui-même situe la notion dans l'année (citation exacte, quote) ;
//  - « proposition » : répartition suggérée par l'application, à adapter (méthode, manuel, élèves, binôme).
// Période 0 = toute l'année (rituels, calcul mental quotidien, lecture, oral…).
// Sources : programmes de français et de mathématiques du cycle 2, BO n° 41 du 31 octobre 2024 (annexes 3 et 4).

const MA_SRC = 'Programme de mathématiques du cycle 2 (BO n° 41 du 31 octobre 2024), partie CE2';
const FR_SRC = 'Programme de français du cycle 2 (BO n° 41 du 31 octobre 2024), partie CE2';

// [période, sous-domaine, notion, codes, citation officielle si la période vient du programme]
const MA_CE2 = [
  [0, 'Calcul mental', 'Séances quotidiennes de calcul mental', [], 'des séances quotidiennes de calcul mental sont proposées tout au long du cycle 2'],
  [0, 'Calcul mental', 'Tables d’addition dans les deux sens (fluence)', ['MA.CE2.20'], 'À la fin du CE2, l’élève peut compléter quinze égalités de ce type en une minute.'],
  [0, 'Problèmes', 'Résolution de problèmes toute l’année (au moins deux tiers du temps : nombres, calcul, problèmes)', [], 'les deux tiers du temps d’enseignement des mathématiques, au minimum'],
  [1, 'Nombres', 'Nombres jusqu’à 1 000 et premiers nombres au-delà de mille', ['MA.CE2.01', 'MA.CE2.02', 'MA.CE2.03'], 'Des nombres supérieurs à mille sont rencontrés dès le début de la période 1.'],
  [1, 'Opérations', 'Addition posée en colonnes ; mots « terme », « somme »', ['MA.CE2.15', 'MA.CE2.16'], 'dès le début de l’année, quand les nombres en jeu le justifient'],
  [1, 'Fractions', 'Fractions d’un tout : réinvestissement du CE1', ['MA.CE2.11'], 'Au début du CE2, les élèves réinvestissent les fractions d’un tout'],
  [1, 'Calcul mental', 'Ajouter 8, 9, 18, 19, 28, 29, 38 ou 39', ['MA.CE2.24']],
  [1, 'Calcul mental', 'Tables de multiplication par 2, 5 et 10', ['MA.CE2.21']],
  [1, 'Problèmes', 'Problèmes additifs en une étape (parties-tout, comparaison)', ['MA.CE2.29']],
  [1, 'Grandeurs et mesures', 'Longueurs : comparer, mesurer en cm et mm, tracer un segment', ['MA.CE2.38', 'MA.CE2.39']],
  [1, 'Espace et géométrie', 'Vocabulaire géométrique ; carré, rectangle, triangle ; codage de l’angle droit', ['MA.CE2.67', 'MA.CE2.68', 'MA.CE2.71']],

  [2, 'Nombres', 'Nombres jusqu’à 10 000 : lire, écrire, décomposer, valeur des chiffres', ['MA.CE2.04', 'MA.CE2.05', 'MA.CE2.06'], 'Au plus tard en période 2, les élèves travaillent avec des quantités et des nombres allant jusqu’à 10 000.'],
  [2, 'Nombres', 'Comparer, encadrer, intercaler, ranger (=, <, >)', ['MA.CE2.07', 'MA.CE2.08', 'MA.CE2.09']],
  [2, 'Opérations', 'Soustraction posée en colonnes ; mot « différence »', ['MA.CE2.15', 'MA.CE2.16']],
  [2, 'Fractions', 'Égalités de fractions inférieures ou égales à 1 ; comparer des fractions inférieures à 1', ['MA.CE2.11', 'MA.CE2.13']],
  [2, 'Calcul mental', 'Soustraire 9, 19, 29 ou 39', ['MA.CE2.25']],
  [2, 'Calcul mental', 'Tables de multiplication par 3 et 4', ['MA.CE2.21']],
  [2, 'Problèmes', 'Problèmes additifs en deux étapes', ['MA.CE2.30']],
  [2, 'Grandeurs et mesures', 'Longueurs : m, dm, cm, mm, km et leurs relations ; unité adaptée ; longueurs de référence ; estimer', ['MA.CE2.35', 'MA.CE2.36', 'MA.CE2.37', 'MA.CE2.40', 'MA.CE2.41']],
  [2, 'Grandeurs et mesures', 'Monnaie : simuler des achats, rendre la monnaie ; additions de montants en euros', ['MA.CE2.54', 'MA.CE2.55']],
  [2, 'Données', 'Lire et interpréter un tableau à double entrée ou un diagramme en barres', ['MA.CE2.75']],
  [2, 'Espace et géométrie', 'Propriétés du carré, du rectangle et du losange ; reproduire et construire des figures', ['MA.CE2.69', 'MA.CE2.70']],

  [3, 'Nombres', 'Placer des nombres sur une demi-droite graduée', ['MA.CE2.10']],
  [3, 'Opérations', 'Sens de la multiplication : « facteur », « produit », « multiple »', ['MA.CE2.17']],
  [3, 'Fractions', 'Fractions d’une unité de longueur ; mesurer des longueurs non entières', ['MA.CE2.12'], 'À partir de la période 3, le travail sur les fractions d’un tout permet de considérer une fraction d’une unité de longueur.'],
  [3, 'Calcul mental', 'Multiplier un nombre entier par 10 ou par 100', ['MA.CE2.23']],
  [3, 'Calcul mental', 'Tables de multiplication par 6 et 7 ; faits multiplicatifs usuels', ['MA.CE2.21', 'MA.CE2.22']],
  [3, 'Problèmes', 'Problèmes multiplicatifs en une étape', ['MA.CE2.31']],
  [3, 'Grandeurs et mesures', 'Masses : g, kg, t, relations, unité adaptée, comparer, estimer, masses de référence', ['MA.CE2.45', 'MA.CE2.46', 'MA.CE2.47', 'MA.CE2.48', 'MA.CE2.49', 'MA.CE2.50']],
  [3, 'Grandeurs et mesures', 'Lire l’heure sur une horloge à aiguilles ; placer les aiguilles', ['MA.CE2.57', 'MA.CE2.58']],
  [3, 'Espace et géométrie', 'Symétrie : axes de symétrie (pliage, calque) ; compléter une figure symétrique', ['MA.CE2.72', 'MA.CE2.73']],

  [4, 'Opérations', 'Multiplication posée d’un nombre à deux ou trois chiffres par un nombre à un chiffre', ['MA.CE2.19'], 'L’algorithme de la multiplication posée est introduit en période 4 au plus tard.'],
  [4, 'Fractions', 'Additionner et soustraire des fractions', ['MA.CE2.14']],
  [4, 'Calcul mental', 'Multiplier par 4 ou par 8 ; multiplier un nombre inférieur à 10 par un nombre entier de dizaines', ['MA.CE2.26', 'MA.CE2.27']],
  [4, 'Calcul mental', 'Tables de multiplication par 8 et 9', ['MA.CE2.21']],
  [4, 'Problèmes', 'Comparaison multiplicative en une étape ; produits cartésiens', ['MA.CE2.33', 'MA.CE2.34']],
  [4, 'Grandeurs et mesures', 'Contenances : comparer ; L, dL, cL ; 1 L = 10 dL = 100 cL', ['MA.CE2.51', 'MA.CE2.52', 'MA.CE2.53']],
  [4, 'Grandeurs et mesures', 'Durées : comparer, mesurer, problèmes à une ou deux étapes', ['MA.CE2.59', 'MA.CE2.60']],
  [4, 'Données', 'Produire un tableau ou un diagramme en barres', ['MA.CE2.74']],
  [4, 'Espace et géométrie', 'Solides : nommer, décrire (faces, sommets, arêtes), faces du cube, du pavé, de la pyramide', ['MA.CE2.61', 'MA.CE2.62', 'MA.CE2.63', 'MA.CE2.64']],

  [5, 'Opérations', 'Multiplication posée par un nombre à deux chiffres', ['MA.CE2.19']],
  [5, 'Opérations', 'Sens de la division (partage, groupement) et symbole « ÷ »', ['MA.CE2.18']],
  [5, 'Calcul mental', 'Produit d’un nombre de 11 à 99 par un nombre inférieur à 10 (décomposition)', ['MA.CE2.28']],
  [5, 'Calcul mental', 'Toutes les tables de multiplication (fluence)', ['MA.CE2.21'], 'À la fin du CE2, l’élève peut compléter douze égalités de ce type en une minute.'],
  [5, 'Problèmes', 'Problèmes mixtes en deux ou trois étapes ; problèmes à partir de données', ['MA.CE2.32', 'MA.CE2.76']],
  [5, 'Grandeurs et mesures', 'Périmètre : définition, comparer au compas, mesurer à la règle', ['MA.CE2.42', 'MA.CE2.43', 'MA.CE2.44']],
  [5, 'Grandeurs et mesures', 'Monnaie : soustractions de montants en euros', ['MA.CE2.56']],
  [5, 'Espace et géométrie', 'Construire un cube, un pavé, une pyramide ; patron du cube ; triangle rectangle, losange, cercle', ['MA.CE2.65', 'MA.CE2.66', 'MA.CE2.68', 'MA.CE2.70']],
];

const FR_CE2 = [
  [0, 'Lecture', 'Fluence : lecture à voix haute quotidienne (objectif 90 mots par minute en fin d’année), ponctuation, liaisons et lecture expressive', ['FR.CE2.02', 'FR.CE2.03', 'FR.CE2.05', 'FR.CE2.06', 'FR.CE2.07'], 'Lire un texte adapté à son niveau de lecture avec une vitesse de 90 mots par minute.'],
  [0, 'Lecture', 'Compréhension : textes narratifs, poétiques, documentaires, théâtraux ; vocabulaire inconnu ; retour au texte', ['FR.CE2.08', 'FR.CE2.09', 'FR.CE2.12']],
  [0, 'Lecture', 'Devenir lecteur : 5 à 10 œuvres complètes dans l’année, mises en réseau, bibliothèque', ['FR.CE2.14', 'FR.CE2.15', 'FR.CE2.16']],
  [0, 'Écriture', 'Production d’écrits réguliers', ['FR.CE2.20'], 'tout au long de l’année'],
  [0, 'Écriture', 'Copie : stratégies, vitesse et exactitude (objectif : une dizaine de lignes sans erreur en fin d’année)', ['FR.CE2.19'], 'En fin d’année - L’élève utilise systématiquement des stratégies de copie'],
  [0, 'Orthographe', 'Dictées en lien avec l’étude de la langue ; mots fréquents réguliers et irréguliers', ['FR.CE2.18', 'FR.CE2.39'], 'À la fin de l’année - L’élève réalise des dictées en lien avec l’étude de la langue'],
  [0, 'Oral', 'Écouter, raconter, expliquer, débattre ; jeux de rôles et registres', ['FR.CE2.21', 'FR.CE2.22', 'FR.CE2.23', 'FR.CE2.24', 'FR.CE2.25']],
  [0, 'Vocabulaire', 'Enrichir et réemployer le vocabulaire (corpus, expressions, fluence verbale)', ['FR.CE2.26', 'FR.CE2.27', 'FR.CE2.31', 'FR.CE2.35', 'FR.CE2.38']],

  [1, 'Écriture', 'Écriture cursive : toutes les minuscules et majuscules', ['FR.CE2.17'], 'Dès la période 1'],
  [1, 'Lecture', 'Automatiser les correspondances graphophonémiques ; lettres muettes, mots inconnus', ['FR.CE2.01', 'FR.CE2.04']],
  [1, 'Grammaire', 'La phrase : ponctuation de fin de phrase ; phrases déclaratives, interrogatives, impératives', ['FR.CE2.46', 'FR.CE2.43']],
  [1, 'Grammaire', 'Classes de mots : nom commun, nom propre, déterminant', ['FR.CE2.45']],
  [1, 'Conjugaison', 'Le verbe : infinitif, radical et terminaison ; passé, présent, futur', ['FR.CE2.50']],
  [1, 'Conjugaison', 'Présent : être, avoir et verbes du premier groupe', ['FR.CE2.49']],
  [1, 'Orthographe', 'Les accents', ['FR.CE2.40']],
  [1, 'Vocabulaire', 'Utiliser un dictionnaire adapté', ['FR.CE2.30']],

  [2, 'Grammaire', 'Phrase simple : groupe sujet et verbe', ['FR.CE2.42', 'FR.CE2.48']],
  [2, 'Grammaire', 'Formes négative et exclamative', ['FR.CE2.44']],
  [2, 'Conjugaison', 'Présent : aller, faire, dire, venir, pouvoir, voir, vouloir, prendre', ['FR.CE2.49']],
  [2, 'Orthographe', 'Accord du verbe avec son sujet', ['FR.CE2.48']],
  [2, 'Vocabulaire', 'Familles de mots ; préfixes et suffixes', ['FR.CE2.29', 'FR.CE2.34']],
  [2, 'Lecture', 'Types de textes : narratif, informatif, prescriptif', ['FR.CE2.10']],

  [3, 'Grammaire', 'Le groupe nominal : déterminant, nom, adjectif', ['FR.CE2.45', 'FR.CE2.47']],
  [3, 'Conjugaison', 'Futur : être, avoir, premier groupe et verbes irréguliers étudiés', ['FR.CE2.49']],
  [3, 'Orthographe', 'Accords dans le groupe nominal (genre et nombre)', ['FR.CE2.47']],
  [3, 'Vocabulaire', 'Mots génériques et spécifiques', ['FR.CE2.32']],
  [3, 'Lecture', 'Comprendre l’implicite : inférences à partir d’indices', ['FR.CE2.11']],

  [4, 'Grammaire', 'Les compléments (sans les distinguer) ; pronoms personnels sujets', ['FR.CE2.42', 'FR.CE2.45']],
  [4, 'Conjugaison', 'Imparfait : être, avoir, premier groupe et verbes irréguliers étudiés', ['FR.CE2.49']],
  [4, 'Orthographe', 'S’appuyer sur la morphologie (radical, préfixe, suffixe) pour orthographier', ['FR.CE2.41']],
  [4, 'Vocabulaire', 'Sens propre et sens figuré', ['FR.CE2.28', 'FR.CE2.36']],
  [4, 'Lecture', 'Lire et comprendre seul un texte d’une vingtaine de lignes', ['FR.CE2.13']],

  [5, 'Grammaire', 'Le discours rapporté (« … ») ; analyse de phrases', ['FR.CE2.46', 'FR.CE2.42']],
  [5, 'Conjugaison', 'Passé composé : être, avoir, premier groupe et verbes irréguliers étudiés', ['FR.CE2.49']],
  [5, 'Vocabulaire', 'Niveaux de langue : familier, courant, soutenu', ['FR.CE2.33', 'FR.CE2.37']],
];

const build = (rows) => rows.map(([period, subdomain, title, codes, quote]) => ({ period, subdomain, title, codes, quote: quote || '' }));

export const MODELES = [
  { subject: 'Mathématiques', level: 'CE2', source: MA_SRC, pack: 'ma2024',
    subdomains: ['Nombres', 'Opérations', 'Fractions', 'Calcul mental', 'Problèmes', 'Grandeurs et mesures', 'Espace et géométrie', 'Données'], notions: build(MA_CE2) },
  { subject: 'Français', level: 'CE2', source: FR_SRC, pack: 'fr2024',
    subdomains: ['Lecture', 'Écriture', 'Oral', 'Vocabulaire', 'Grammaire', 'Conjugaison', 'Orthographe'], notions: build(FR_CE2) },
];
export const modeleFor = (subject, level) => MODELES.find(m => m.subject === subject && m.level === level) || null;
