import pickle, re, sys, json
LEVELS = {'Cours préparatoire': 'CP', 'Cours élémentaire première année': 'CE1', 'Cours élémentaire deuxième année': 'CE2', 'Cours moyen première année': 'CM1', 'Cours moyen deuxième année': 'CM2',
          'Petite section': 'PS', 'Moyenne section': 'MS', 'Grande section': 'GS', 'Classe de sixième': '6e', 'Sixième': '6e', 'Cours moyen': 'CM'}
LEVEL_PREFIX = re.compile(r'^(Cours préparatoire|Cours élémentaire première année|Cours élémentaire deuxième année|Cours moyen première année|Cours moyen deuxième année|Sixième)\s*:\s*(.+)$')
SKIP_HEAD = ('Question', 'Mots-clés', 'Mots clés', 'Exemples', 'Points de vigilance', 'Au cycle', 'Tous les jours', 'À chaque', 'Remarque', 'Sommaire', 'Conditions', 'Repères', 'Propositions')
DASH = ('- ', '– ', '— ', '• ', '▪ ', ' ')
def norm(s):
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'(\w) (\w{1,2})(?=\s|$)', lambda m: m.group(0), s)
    return s
def text(ws): return ' '.join(w[0] for w in ws)
def parse(name, margin_tol=8, skip_pages=0, dom_min=11, level_prefixes=None):
    L = pickle.load(open(name + '.pkl', 'rb'))
    body = [l for l in L if l['p'] >= skip_pages]
    xs = sorted(round(l['words'][0][1]) for l in body if 'Bold' in l['words'][0][3])
    margin = min(xs) if xs else 36
    items = []; domain = ''; level = None; subs = []; added_since_head = False
    in_table = False; split = 9999; cur = None; lead = ''; last_dom = False; last_dom_size = 0
    def flush():
        nonlocal cur
        if cur and cur['label'].strip(' -–—•:'):
            lab = norm(cur['label']).lstrip('-–—•▪ ').strip()
            lab = re.sub(r'\s+([,.;:!?)])', r'\1', lab).replace(' ’', '’').replace('’ ', '’') if False else lab
            items.append({**cur, 'label': lab})
        cur = None
    def guess_split(idx, header_split):
        import collections
        c = collections.Counter()
        for l2 in body[idx + 1: idx + 30]:
            ws2 = sorted(l2['words'], key=lambda w: w[1])
            for a, b in zip(ws2, ws2[1:]):
                if b[1] - a[2] >= 7 and 140 <= b[1] <= 460: c[round(b[1] / 4) * 4] += 1
            if len(ws2) == 1 and 140 <= ws2[0][1] <= 460: c[round(ws2[0][1] / 4) * 4] += 1
        if not c: return header_split
        best, n = c.most_common(1)[0]
        cands = [x for x, k in c.items() if abs(x - best) <= 8]
        return min(cands) - 3 if n >= 2 else header_split
    for idx, l in enumerate(body):
        ws = [w for w in l['words'] if w[4] >= 7.5 and not w[3].startswith(('Freestyle', 'InkFree', 'Bradley', 'SimSun', 'Symbol', 'Wingdings'))]
        if not ws: continue
        if l['top'] < 25 or l['top'] > 805: continue
        t = re.sub(r"\s*’\s*", "’", norm(text(ws))); f = ws[0]; bold = 'Bold' in f[3]; x0 = f[1]
        italic = 'Italic' in f[3]
        m = LEVEL_PREFIX.match(t)
        if m and (bold or f[4] >= 10):
            flush(); in_table = False; level = LEVELS[m.group(1)]; subs = [m.group(2)]; added_since_head = False; last_dom = False; continue
        if level_prefixes:
            lp = next((v for k, v in level_prefixes.items() if t.startswith(k)), None)
            if lp:
                flush(); in_table = False; level = lp; added_since_head = False; continue
        if t in LEVELS:
            flush(); in_table = False; level = LEVELS[t]; subs = []; added_since_head = False; continue
        if t.startswith(('Objectifs d’apprentissage', 'Objectif d’apprentissage', 'Objectifs d\'apprentissage')):
            flush(); in_table = True; lead = ''
            rest = [w for w in ws if w[1] > x0 + 120]
            split = rest[0][1] - 4 if rest else 9999
            if rest: split = guess_split(idx, split)
            continue
        at_margin = abs(x0 - margin) <= margin_tol
        is_head = at_margin and (bold or f[4] >= 11 or (italic and len(t) < 80 and not t.startswith('Mots'))) and not t.startswith(SKIP_HEAD) and len(t) < 160
        if is_head:
            flush(); in_table = False
            if f[4] >= dom_min:
                if last_dom and last_dom_size == f[4]: domain = domain + ' ' + t
                else: domain = t
                subs = []; last_dom = True; last_dom_size = f[4]; added_since_head = False; continue
            else:
                if added_since_head: subs = []
                subs = (subs + [t])[-2:]
            added_since_head = False; last_dom = False
            continue
        last_dom = False
        if not in_table:
            # Tableau sans en-tête répété : lignes à tiret juste après un titre.
            if t[:2] in DASH and x0 <= margin + 12 and split != 9999: in_table = True; lead = ''
            else: continue
        if bold and t.startswith(SKIP_HEAD): flush(); in_table = False; continue
        left = [w for w in ws if w[2] <= split + 2]
        if not left: continue
        lt = norm(text(left))
        if 'Italic' in left[0][3] and lt.startswith('Mots'): flush(); in_table = False; continue
        starts_dash = lt[:2] in DASH or lt[:1] in '-–—•'
        if lt.endswith(':') and not starts_dash:
            flush(); lead = lt; continue
        if starts_dash and cur is not None and lt.lstrip('-–—•▪  ')[:1].islower():
            cur['label'] += ('; ' if not cur['label'].rstrip().endswith(':') else ' ') + lt.lstrip('-–—•▪  '); continue
        new_sentence = cur is not None and cur['label'].rstrip().endswith('.') and lt[:1].isupper()
        if starts_dash or new_sentence or (cur is None) or (split == 9999 and lt[:1].isupper() and not cur['label'].rstrip().endswith((',', ' de', ' du', ' des', ' et', ' la', ' le', ' les', ' à', ' en', '’'))):
            flush()
            cur = {'domain': domain, 'sub': ' › '.join(subs), 'level': level, 'label': (lead + ' ' if lead and starts_dash else '') + lt, 'page': l['p']}
            added_since_head = True
        else:
            cur['label'] += ' ' + lt
    flush()
    return items
if __name__ == '__main__':
    its = parse(sys.argv[1], skip_pages=int(sys.argv[2]) if len(sys.argv) > 2 else 0)
    lv = sys.argv[3] if len(sys.argv) > 3 else None
    for i in its:
        if lv and i['level'] != lv: continue
        print(i['level'], '|', i['domain'], '|', i['sub'], '|', i['label'])
    print(len(its), file=sys.stderr)
