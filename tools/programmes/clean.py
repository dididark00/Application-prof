import re
_vocab = {}
def vocab(name):
    if name not in _vocab:
        t = open(name + '.txt', encoding='utf-8').read()
        _vocab[name] = set(w.lower() for w in re.findall(r"[A-Za-zÀ-ÿœŒæ]+", t))
    return _vocab[name]
def clean(s, name):
    V = vocab(name)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r"\s*’\s*", '’', s)
    s = re.sub(r"(\w)\s*'\s*(\w)", r"\1'\2", s)
    s = re.sub(r'\s+([,.)])', r'\1', s)
    s = re.sub(r'\(\s+', '(', s)
    s = re.sub(r'(\w) -(\w)', r'\1-\2', s); s = re.sub(r'(\w)- (\w)', lambda m: m.group(0) if m.group(1).isupper() else m.group(1) + '-' + m.group(2), s)
    toks = s.split(' ')
    out = []
    i = 0
    while i < len(toks):
        a = toks[i]
        if i + 1 < len(toks):
            b = toks[i + 1]
            ca = re.sub(r'^\W+|\W+$', '', a); cb = re.sub(r'^\W+|\W+$', '', b)
            core_a = re.sub(r'^.*’', '', ca)
            joined = (core_a + cb).lower()
            if ca and cb and re.match(r'^[A-Za-zÀ-ÿœ]+$', core_a) and re.match(r'^[a-zà-ÿœ]+', cb) and joined in V and (core_a.lower() not in V or cb.lower() not in V or len(core_a) == 1):
                out.append(a + b); i += 2; continue
        out.append(a); i += 1
    return ' '.join(out)
if __name__ == '__main__':
    for t in ['L ire un texte', 'différe ntes lectures', 'contraintes d ’é criture', 'Coopérer et s ’opposer', 'dix -mille', 'L’él ève', 'en fin d’année', 'sujet- verbe', 'groupe nominal .']:
        print(t, '→', clean(t, 'fr_c2'))
