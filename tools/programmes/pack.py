import json, re, collections, sys
OUT = sys.argv[1]
R = lambda k: json.load(open(f'out/{k}.raw.json'))
def by(k, pred): return [i for i in R(k) if pred(i)]
PACKS = [
  ('fr2024', 'Français — cycle 2 (CP, CE1, CE2)', 'Français', R('fr_c2'), 'FR', 0),
  ('ma2024', 'Mathématiques — cycle 2 (CP, CE1, CE2)', 'Mathématiques', R('ma_c2'), 'MA', 0),
  ('fr2025', 'Français — cycle 3 (CM1, CM2)', 'Français', R('fr_c3'), 'FR', 0),
  ('ma2025', 'Mathématiques — cycle 3 (CM1, CM2)', 'Mathématiques', R('ma_c3'), 'MA', 0),
  ('hg2026c2', 'Histoire-géographie — cycle 2 (2026)', 'Histoire-géographie', R('hg_c2'), 'HG', 0),
  ('hg2026c3', 'Histoire-géographie — cycle 3 (2026)', 'Histoire-géographie', R('hg_c3'), 'HG', 0),
  ('eps2026c2', 'EPS — cycle 2 (2026)', 'EPS', R('eps_c2'), 'EPS', 0),
  ('eps2026c3', 'EPS — cours moyen (2026)', 'EPS', R('eps_c3'), 'EPS', 0),
  ('st2026c2', 'Sciences et technologie — cycle 2 (2026)', 'Sciences et technologie', R('st_c2'), 'ST', 0),
  ('st2026c3', 'Sciences et technologie — cycle 3 (2026)', 'Sciences et technologie', R('st_c3'), 'ST', 0),
  ('lv2026c2', 'Langues vivantes — cycle 2 (2026)', 'Langues vivantes', R('lv_c2'), 'LV', 0),
  ('lv2026c3', 'Langues vivantes — cours moyen (2026)', 'Langues vivantes', R('lv_c3'), 'LV', 0),
  ('emc2024', 'Enseignement moral et civique (2024)', 'Enseignement moral et civique', R('emc2024'), 'EMC', -108),
  ('evar2025', 'Éducation à la vie affective et relationnelle (2025)', 'Vie affective et relationnelle', R('evar'), 'EVAR', 0),
  ('mat2026', 'École maternelle — six domaines (2024-2026)', 'Maternelle', R('mat'), 'MAT', 0),
  ('qlm2020', 'Questionner le monde — cycle 2 (2020)', 'Questionner le monde', by('c2_2020', lambda i: i['domain'] == 'Questionner le monde'), 'QLM', 0),
  ('arts2020c2', 'Enseignements artistiques — cycle 2 (2020)', 'Enseignements artistiques', by('c2_2020', lambda i: i['domain'] == 'Enseignements artistiques'), 'ART', 0),
  ('eps2020c2', 'EPS — cycle 2 (2020)', 'EPS', by('c2_2020', lambda i: i['domain'].startswith('Éducation physique')), 'EPS', 0),
  ('lv2020c2', 'Langues vivantes — cycle 2 (2020)', 'Langues vivantes', by('c2_2020', lambda i: i['domain'].startswith('Langues')), 'LV', 0),
  ('lv2020c3', 'Langues vivantes — cycle 3 (2020)', 'Langues vivantes', by('c3_2020', lambda i: i['domain'].startswith('Langues')), 'LV', 0),
  ('arts2020c3', 'Arts plastiques, éducation musicale, histoire des arts — cycle 3 (2020)', 'Enseignements artistiques', by('c3_2020', lambda i: i['domain'] in ('Arts plastiques', 'Éducation musicale', 'Histoire des arts')), 'ART', 0),
  ('eps2020c3', 'EPS — cycle 3 (2020)', 'EPS', by('c3_2020', lambda i: i['domain'].startswith('Éducation physique')), 'EPS', 0),
  ('hg2020c3', 'Histoire-géographie — CM2 (2020)', 'Histoire-géographie', R('hg2020'), 'HG', 0),
  ('st2023', 'Sciences et technologie — cycle 3 (2023)', 'Sciences et technologie', R('st2023'), 'ST', 0),
]
index = []
for pid, title, subject, items, prefix, off in PACKS:
    seen = set(); out = []; n = collections.Counter()
    for it in items:
        if pid in ('qlm2020', 'arts2020c2', 'eps2020c2', 'lv2020c2'): it = {**it, 'levels': ['CP', 'CE1', 'CE2']}
        lab = re.sub('[\uf0a7\uf0b7\uf0d8\uf0fc\ue000-\uf8ff]\\s*', '• ', it['label']).strip()
        key = (lab, tuple(it['levels']))
        if key in seen: continue
        seen.add(key)
        lv = it['levels']; tag = lv[0] if len(lv) == 1 else ('C' + ('1' if lv[0] in ('TPS', 'PS', 'MS', 'GS') else '2' if lv[0] in ('CP', 'CE1', 'CE2') else '3')) if len(lv) > 2 or lv[0] in ('CE1', 'CM1') else '-'.join(lv)
        if lv == ['TPS', 'PS']: tag = 'PS'
        n[tag] += 1
        out.append({'code': f'{prefix}.{tag}.{n[tag]:02d}', 'domain': it['domain'], 'subdomain': it.get('sub') or '', 'label': lab, 'levels': lv, 'page': it['page'] + 1 + off})
    json.dump({'id': pid, 'title': title, 'subject': subject, 'items': out}, open(f'{OUT}/{pid}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    index.append({'id': pid, 'title': title, 'subject': subject, 'count': len(out), 'levels': sorted({l for i in out for l in i['levels']}, key=['TPS','PS','MS','GS','CP','CE1','CE2','CM1','CM2'].index)})
    print(pid, len(out))
json.dump(index, open(f'{OUT}/index.json', 'w'), ensure_ascii=False, indent=0)
