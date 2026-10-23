import json, re, unicodedata, sys
SRC = {'fr2024': 'fr_c2', 'ma2024': 'ma_c2', 'fr2025': 'fr_c3', 'ma2025': 'ma_c3', 'hg2026c2': 'hg_c2', 'hg2026c3': 'hg_c3', 'eps2026c2': 'eps_c2', 'eps2026c3': 'eps_c3', 'st2026c2': 'st_c2', 'st2026c3': 'st_c3', 'lv2026c2': 'lv_c2', 'lv2026c3': 'lv_c3', 'emc2024': 'c3_2020', 'evar2025': 'evar', 'mat2026': 'mat', 'qlm2020': 'c2_2020', 'arts2020c2': 'c2_2020', 'eps2020c2': 'c2_2020', 'lv2020c2': 'c2_2020', 'lv2020c3': 'c3_2020', 'arts2020c3': 'c3_2020', 'eps2020c3': 'c3_2020', 'hg2020c3': 'c3_2020', 'st2023': 'c3_2020'}
def norm(s):
    s = unicodedata.normalize('NFKC', s).lower().replace('’', "'").replace('œ', 'oe')
    return re.sub(r'[^a-z0-9àâäéèêëîïôöùûüç]', '', s)
D = sys.argv[1]
tot = bad = 0
for pid, src in SRC.items():
    raw = open(src + '.txt', encoding='utf-8').read()
    # texte lu dans l'ordre des colonnes (pdftotext sans -layout) : on teste des fragments de 6 mots
    T = norm(raw)
    p = json.load(open(f'{D}/{pid}.json'))
    nb = 0
    for it in p['items']:
        words = re.findall(r"\w+[’']?\w*", it['label'])
        frags = [' '.join(words[i:i + 5]) for i in range(0, max(1, len(words) - 4), 5)]
        hits = sum(1 for f in frags if norm(f) in T)
        it['ok'] = hits / max(1, len(frags))
        if it['ok'] < 0.6: nb += 1
    tot += len(p['items']); bad += nb
    json.dump(p, open(f'{D}/{pid}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(pid, len(p['items']), 'douteux:', nb)
print('total', tot, 'douteux', bad)
