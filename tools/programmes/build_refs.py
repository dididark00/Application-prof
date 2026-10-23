# Construit les référentiels (compétences / objectifs d'apprentissage) à partir des PDF officiels.
# Sortie : JSON compact, un fichier par texte officiel, items avec niveau(x), domaine, sous-domaine, page.
import json, re, pickle, sys, collections
from parse import parse, LEVELS
from clean import clean

PRIMARY = ['TPS', 'PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2']
OUT = sys.argv[1]

def ok_label(s):
    s = s.strip()
    return len(s) >= 6 and (s[0].isupper() or s[0].isdigit() or s[0] in '«(') and not s.startswith(('L’élève', 'Exemple', 'Par exemple'))

VERB = re.compile(r"^(Se |S’|s’|Ne |N’)?[A-ZÉÈÊÀÂÎÔÛÇ][a-zéèêàâîôûçœ’'-]*(er|ir|re|oir|aître|aitre|uire)\b")
def finalize(items, name, verbs=False):
    out = []
    for it in items:
        lab = clean(it['label'], name).strip(' ;')
        lab = re.sub(r'\(+(pré-)?A[12]\+?\)+\s*', '', lab)
        lab = re.sub(r'\s+-\s+(L’élève|Lors|Par exemple|Dans le cadre|À partir|Il |Elle ).*$', '', lab)
        lab = re.sub(r'\s{2,}', ' ', lab).strip()
        if verbs and not VERB.match(lab): continue
        lab = re.sub(r'\s*-\s*$', '', lab)
        if not ok_label(lab): continue
        sub = clean(it.get('sub', ''), name)
        if len(sub) > 140: sub = ''
        out.append({**it, 'label': lab, 'sub': sub, 'domain': clean(it.get('domain', ''), name)})
    return out

def generic(name, levels_map=None, skip_pages=1, drop_domains=()):
    items = parse(name, skip_pages=skip_pages)
    res = []
    for it in items:
        lv = it['level']
        lvls = (levels_map or {}).get(lv, [lv] if lv else [])
        lvls = [x for x in lvls if x in PRIMARY]
        if not lvls or any(it['domain'].startswith(d) for d in drop_domains): continue
        res.append({**it, 'levels': lvls})
    return finalize(res, name, verbs=True)

# ───── Histoire-géographie 2026 : colonne « Attendus (connaissances et compétences) »
from parse import LEVEL_PREFIX
def hg2026(name):
    L = pickle.load(open(name + '.pkl', 'rb'))
    res = []; level = None; dom = None; theme = None; on = False; lo = hi = None; cur = None
    def flush():
        nonlocal cur
        if cur: res.append(cur); cur = None
    import collections
    def cols(idx):
        d = collections.Counter(); g = collections.Counter()
        for l2 in L[idx + 1: idx + 45]:
            w2 = sorted(l2['words'], key=lambda w: w[1])
            for w in w2:
                if w[0].startswith('-') and 150 < w[1] < 340: d[round(w[1])] += 1
            for a, b in zip(w2, w2[1:]):
                if b[1] - a[2] >= 7: g[round(b[1] / 3) * 3] += 1
        lo = min(x for x, n in d.items() if n == max(d.values())) - 2 if d else 200
        hs = [(n, x) for x, n in g.items() if x > lo + 110]
        hi = (max(hs)[1] - 3) if hs else 999
        return lo, hi
    for idx, l in enumerate(L):
        if l['p'] < 1: continue
        ws = [w for w in l['words'] if w[4] >= 7.5]
        if not ws: continue
        t = re.sub(r'\s*’\s*', '’', ' '.join(w[0] for w in ws)).strip(); f = ws[0]
        if f[4] >= 13 and t in ('Histoire', 'Géographie'): flush(); dom = t; on = False; continue
        if t in LEVELS: flush(); level = LEVELS[t]; on = False; continue
        m = LEVEL_PREFIX.match(t)
        if m and 'Bold' in f[3]: flush(); level = LEVELS[m.group(1)]; theme = m.group(2); on = False; continue
        if 'Bold' in f[3] and t.startswith('Thème'): flush(); theme = t; on = False; continue
        if 'Bold' in ' '.join(w[3] for w in ws) and any(w[0].startswith('Attendus') for w in ws) and any('Bold' in w[3] for w in ws if w[0].startswith('Attendus')):
            flush(); on = True
            lo, hi = cols(idx)
            continue
        if not on: continue
        if 'Italic' in f[3] or 'Bold' in f[3] and abs(f[1] - 36) < 6: flush(); on = False; continue
        mid = [w for w in ws if lo <= w[1] < hi]
        if not mid: continue
        mt = ' '.join(w[0] for w in mid).strip()
        if mt.startswith('compétences)'): continue
        if mt.startswith(('- ', '-')) and len(mt) > 2:
            flush(); cur = {'level': level, 'domain': dom, 'sub': theme or '', 'label': mt.lstrip('- '), 'page': l['p'], 'levels': [level]}
        elif mt.strip() == 'ou':
            flush()
        elif cur: cur['label'] += ' ' + mt
    flush()
    return finalize([r for r in res if r['level'] in PRIMARY], name, verbs=True)

# ───── EVAR (école élémentaire) : objectif d'apprentissage + notions et compétences, par niveau et par axe
AXES = ['Se connaître, vivre et grandir avec son corps', 'Rencontrer les autres et construire des relations, s’y épanouir', 'Trouver sa place dans la société, y être libre et responsable']
def evar():
    L = pickle.load(open('evar.pkl', 'rb'))
    res = []; level = None; axe = None; obj = None; collecting = None; split = 9999; cur = None
    def flush():
        nonlocal cur
        if cur: res.append(cur); cur = None
    for l in L:
        ws = l['words']; t = re.sub(r'\s*’\s*', '’', ' '.join(w[0] for w in ws)).strip()
        m = re.match(r'^➜\s*(Cours .+)$', t)
        if m and m.group(1).strip() in LEVELS: flush(); level = LEVELS[m.group(1).strip()]; collecting = None; continue
        if t.startswith('➜'): flush(); level = None; continue
        if level is None: continue
        if t in AXES: flush(); axe = t; collecting = None; continue
        if t.startswith('Objectif d'): flush(); obj = t.split(':', 1)[1].strip(); collecting = 'obj'; continue
        if collecting == 'obj' and 'Notions' not in t and not t.startswith('Propositions'):
            if t: obj += ' ' + t
            if 'Notions' not in t: pass
        if 'Notions et compétences' in t or t.startswith('Propositions de démarches'):
            if collecting == 'obj':
                res.append({'level': level, 'domain': axe, 'sub': '', 'label': 'Objectif d’apprentissage : ' + obj, 'page': l['p'], 'levels': [level]})
            collecting = 'notions'
            split = 266
            continue
        if collecting == 'notions':
            left = [w for w in ws if w[1] < split]
            if not left: continue
            lt = ' '.join(w[0] for w in left).strip()
            if lt.startswith('•'):
                flush(); cur = {'level': level, 'domain': axe, 'sub': 'Notions et compétences', 'label': lt.lstrip('• ').strip(), 'page': l['p'], 'levels': [level]}
            elif cur: cur['label'] += ' ' + lt
    flush()
    for r in res: r['label'] = re.sub(r'!\s*', '« ', r['label']).replace(' "', ' »').replace('"', '»')
    return finalize(res, 'evar')

# ───── EMC 2024 (dans c3_2020, pages 108 et suivantes) : « contenus d'enseignement » par niveau et par thème
EMC_LEVELS = {'CP': 'CP', 'CE1': 'CE1', 'CE2': 'CE2', 'CM1': 'CM1', 'CM2': 'CM2'}
def emc():
    L = pickle.load(open('c3_2020.pkl', 'rb'))
    res = []; level = None; theme = None; part = None; cur = None; on = False; lo, hi = 133, 255
    def flush():
        nonlocal cur
        if cur: res.append(cur); cur = None
    for l in L:
        if l['p'] < 114: continue
        ws = l['words']; t = re.sub(r'\s*’\s*', '’', ' '.join(w[0] for w in ws)).strip(); f = ws[0]
        if f[4] >= 13 and t.startswith('COLLÈGE'): break
        m = re.match(r'^(CP|CE1|CE2|CM1|CM2|Sixième) : (.+)$', t)
        if m and 'Bold' in f[3] and f[4] >= 10.5:
            flush(); level = EMC_LEVELS.get(m.group(1)); theme = m.group(2); on = False; continue
        if level is None: continue
        if 'Bold' in f[3] and t.startswith('Notions abordées'):
            flush(); on = True
            c = [w for w in ws if w[0].startswith('Contenus')]; d = [w for w in ws if w[0].startswith(('Démarches', 'D'))and w[1] > 200]
            lo = (c[0][1] - 12) if c else 133; hi = (d[0][1] - 2) if d else 255
            continue
        if 'Bold' in f[3] and abs(f[1] - 43) < 4:
            flush(); on = False
            if not t.startswith(('Attendus', 'Notions')): part = t
            continue
        if not on: continue
        mid = [w for w in ws if lo <= w[1] < hi]
        if not mid: continue
        if mid[0][0] in ('', '•', '▪'):
            flush(); cur = {'level': level, 'domain': theme, 'sub': part or '', 'label': ' '.join(w[0] for w in mid[1:]), 'page': l['p'], 'levels': [level]}
        elif cur: cur['label'] += ' ' + ' '.join(w[0] for w in mid)
    flush()
    for r in res: r['label'] = r['label'][:1].upper() + r['label'][1:]
    return finalize(res, 'c3_2020')

# ───── Programmes 2020 (cycles 2 et 3) : attendus de fin de cycle par enseignement
def attendus(name, keep, pages=None, levels=()):
    L = pickle.load(open(name + '.pkl', 'rb'))
    res = []; disc = None; sub = None; on = False; cur = None; cecrl = None
    def flush():
        nonlocal cur
        if cur: res.append(cur); cur = None
    for l in L:
        if pages and not (pages[0] <= l['p'] < pages[1]): continue
        ws = [w for w in l['words'] if w[4] >= 7.5]
        if not ws: continue
        t = re.sub(r'\s*’\s*', '’', ' '.join(w[0] for w in ws)).strip(); f = ws[0]
        if t.startswith('©'): continue
        if 'Bold' in f[3] and f[4] >= 13.9 and len(t) < 90:
            flush(); on = False; disc = re.sub(r'\s*\(programme modifié.*\)$', '', t); sub = None; continue
        if f[4] >= 13.5 and len(t) < 110:
            flush(); on = False; sub = t; continue
        if t.startswith('Attendus de fin de cycle'): flush(); on = True; cecrl = None; continue
        if not on: continue
        if t.startswith('Niveau A'): flush(); cecrl = t.split(' ')[1]; continue
        if 'Bold' in f[3] and not t.startswith('-'): flush(); on = False; continue
        sentence = (not t.startswith(('-', '•'))) and f[1] >= 74 and t[:1].isupper() and cur is not None and cur['label'].rstrip().endswith('.')
        if t.startswith('-') or t.startswith('•') or sentence or (cur is None and f[1] >= 74 and t[:1].isupper()):
            body = re.sub(r'\s+\d(,\s*\d)*$', '', t.lstrip('-• ').strip())
            flush()
            cur = {'level': None, 'domain': disc, 'sub': (sub or '') + (f' — niveau {cecrl}' if cecrl else ''), 'label': body, 'page': l['p'], 'levels': list(levels)}
        elif cur and f[1] >= 74:
            cur['label'] += (' ' if cur['label'] else '') + t
        elif cur and not cur['label']:
            cur['label'] = t
        else:
            flush(); on = False
    flush()
    res = [r for r in res if r['domain'] in keep]
    return finalize(res, name)

# ───── Programmes 2020 : « compétences travaillées » (quand il n'y a pas d'attendus de fin de cycle)
def competences(name, disc_name, pages, levels):
    L = pickle.load(open(name + '.pkl', 'rb'))
    res = []; on = False; group = None; cur = None; last_bold = False
    def flush():
        nonlocal cur
        if cur: res.append(cur); cur = None
    for l in L:
        if not (pages[0] <= l['p'] < pages[1]): continue
        ws = [w for w in l['words'] if w[1] < 400 and w[4] >= 7.5]
        if not ws: continue
        t = re.sub(r'\s*’\s*', '’', ' '.join(w[0] for w in ws)).strip(); f = ws[0]
        if t.startswith(('©', 'D’après')): continue
        if 'Compétences travaillées' in t: flush(); on = True; group = None; continue
        if not on: continue
        if f[4] >= 13.5 or (abs(f[1] - 71) < 2 and not t.startswith('-')): flush(); on = False; continue
        if 'Bold' in f[3] and abs(f[1] - 74) < 4:
            flush(); group = (group + ' ' + t) if last_bold and group else t; last_bold = True; continue
        last_bold = False
        if t.startswith('-'):
            flush(); cur = {'level': None, 'domain': disc_name, 'sub': group or '', 'label': re.sub(r'\s+\d(,\s*\d)*$', '', t.lstrip('- ')), 'page': l['p'], 'levels': list(levels)}
        elif cur and f[1] >= 78:
            cur['label'] += ' ' + re.sub(r'\s+\d(,\s*\d)*$', '', t)
    flush()
    return finalize(res, name)

# ───── Histoire et géographie 2020, CM2 : thèmes et repères annuels de programmation
def hg2020_cm2():
    L = pickle.load(open('c3_2020.pkl', 'rb'))
    res = []; part = None; cls = None; theme = None; cur = None
    def flush():
        nonlocal cur
        if cur: res.append(cur); cur = None
    for l in L:
        if not (68 <= l['p'] < 77): continue
        ws = l['words']; t = re.sub(r'\s*’\s*', '’', ' '.join(w[0] for w in ws)).strip(); f = ws[0]
        if f[4] >= 13.5 and t in ('Histoire', 'Géographie'): flush(); part = t; continue
        if 'Bold' in f[3] and 'Classe de' in t: flush(); cls = 'CM2' if 'CM2' in t else 'autre'; theme = None; continue
        if 'Bold' in f[3] and t.startswith('Thème'): flush(); theme = t; continue
        if cls != 'CM2' or not theme: continue
        left = [w for w in ws if w[1] < 205]
        if not left: continue
        lt = ' '.join(w[0] for w in left).strip()
        if left[0][0] == '-' or lt.startswith('- '):
            flush(); cur = {'level': 'CM2', 'domain': part, 'sub': theme, 'label': lt.lstrip('- '), 'page': l['p'], 'levels': ['CM2']}
        elif cur and left[0][1] >= 80 and 'Bold' not in left[0][3]:
            cur['label'] += ' ' + lt
    flush()
    return finalize(res, 'c3_2020')

# ───── Maternelle (programme consolidé 2024 + 2026) : tranches d'âge
def maternelle():
    AGES = {'• À aborder avant 4 ans': 'avant 4 ans', '• À partir de 4 ans': 'à partir de 4 ans', '• À partir de 5 ans': 'à partir de 5 ans', 'À aborder avant 4 ans': 'avant 4 ans', 'À partir de 4 ans': 'à partir de 4 ans', 'À partir de 5 ans': 'à partir de 5 ans'}
    LV = {'avant 4 ans': ['TPS', 'PS'], 'à partir de 4 ans': ['MS'], 'à partir de 5 ans': ['GS']}
    items = parse('mat', skip_pages=5, dom_min=15, level_prefixes=AGES)
    res = [{**it, 'levels': LV[it['level']], 'age': it['level']} for it in items if it['level'] in LV]
    return finalize(res, 'mat', verbs=True)

if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    jobs = {
        'fr_c2': lambda: generic('fr_c2'), 'ma_c2': lambda: generic('ma_c2'),
        'fr_c3': lambda: generic('fr_c3'), 'ma_c3': lambda: generic('ma_c3'),
        'hg_c2': lambda: hg2026('hg_c2'), 'hg_c3': lambda: hg2026('hg_c3'),
        'eps_c2': lambda: generic('eps_c2'), 'eps_c3': lambda: generic('eps_c3', {'CM': ['CM1', 'CM2']}),
        'st_c2': lambda: generic('st_c2'), 'st_c3': lambda: generic('st_c3'),
        'lv_c2': lambda: generic('lv_c2'), 'lv_c3': lambda: generic('lv_c3'),
        'mat': maternelle, 'evar': evar, 'emc2024': emc,
        'c2_2020': lambda: attendus('c2_2020', ['Langues vivantes (étrangères ou régionales)', 'Enseignements artistiques', 'Éducation physique et sportive', 'Questionner le monde'], levels=('CE1', 'CE2')),
        'c3_2020': lambda: attendus('c3_2020', ['Langues vivantes (étrangères ou régionales)', 'Éducation musicale', 'Histoire des arts', 'Éducation physique et sportive'], pages=(0, 108), levels=('CM1', 'CM2'))
            + competences('c3_2020', 'Arts plastiques', (41, 47), ('CM1', 'CM2')),
        'st2023': lambda: [{**i, 'levels': ['CM2']} for i in attendus('c3_2020', ['Sciences et technologie'], pages=(77, 98), levels=('CM2',))],
        'hg2020': hg2020_cm2,
    }
    for k, fn in jobs.items():
        its = fn()
        json.dump(its, open(f'{OUT}/{k}.raw.json', 'w'), ensure_ascii=False)
        c = collections.Counter((tuple(i['levels']), i['domain'][:35]) for i in its)
        print(k, len(its), dict(list(c.items())[:40]))
