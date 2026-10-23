# Extraction des programmes officiels

Scripts utilisés une fois pour produire `data/programmes/*.json` à partir des PDF officiels (BO / Éduscol).

1. `lines.py` : lit chaque PDF (pdfplumber) en lignes avec police, taille et position.
2. `parse.py`, `build_refs.py` : repèrent niveaux, domaines, tableaux « Objectifs d'apprentissage » / « Attendus » et en extraient la colonne des objectifs.
3. `clean.py` : répare les espaces parasites du PDF (mots coupés, apostrophes).
4. `pack.py` : regroupe par texte officiel, attribue les codes (ex. `MA.CE2.07`) et la page du PDF.
5. `verify2.py` : contrôle chaque intitulé mot à mot (fenêtres de 3 mots) contre le texte du PDF ; les intitulés non confirmés sont marqués `check: true` (« à relire » dans l'application).

Aucun intitulé n'est rédigé à la main. L'enseignante relit puis valide le référentiel dans l'application.
