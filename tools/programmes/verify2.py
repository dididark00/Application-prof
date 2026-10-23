import json, re, sys, random
exec(open('verify.py').read().split("D = sys.argv[1]")[0])
D = sys.argv[1]; ex = []; tot = 0; bad = 0
for pid, src in SRC.items():
    T = norm(open(src + '.txt', encoding='utf-8').read()); Tl = norm(open(src + '.layout.txt', encoding='utf-8').read()); Tr = norm(open(src + '.raw.txt', encoding='utf-8').read())
    p = json.load(open(f'{D}/{pid}.json')); nb = 0
    for it in p['items']:
        w = re.findall(r"\w+[’']?\w*", it['label'])
        frags = [' '.join(w[i:i + 3]) for i in range(0, max(1, len(w) - 2))]
        miss = [f for f in frags if norm(f) not in T and norm(f) not in Tl and norm(f) not in Tr]
        if miss: nb += 1; ex.append((pid, it['code'], it['label'][:120], miss[:3])); it['check'] = True
        else: it.pop('check', None)
    tot += len(p['items']); bad += nb
    json.dump(p, open(f'{D}/{pid}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    if nb: print(pid, len(p['items']), 'à relire en priorité :', nb)
print('total', tot, 'à relire', bad)
for e in ex: print(e)
