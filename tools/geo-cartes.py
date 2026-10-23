# Usage : python3 tools/geo-cartes.py <dossier des sources> data/maps
# Sources : clone partiel de github.com/nvkelso/natural-earth-vector (dossier ne/) et github.com/gregoiredavid/france-geojson (dossier fr/).
# Prépare des cartes SVG compactes à partir de Natural Earth (domaine public) et Admin Express (IGN, Licence ouverte).
import json, math, sys
SRC = sys.argv[1]; OUT = sys.argv[2]

def dp(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy) or 1e-9
    imax, dmax = 0, 0
    for i in range(1, len(pts)-1):
        p = pts[i]
        d = abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/L if L > 1e-9 else math.hypot(p[0]-a[0], p[1]-a[1])
        if d > dmax: imax, dmax = i, d
    if dmax > tol:
        return dp(pts[:imax+1], tol)[:-1] + dp(pts[imax:], tol)
    return [a, b]

def path(rings, proj, tol, closed=True):
    out = []
    for r in rings:
        pts = [proj(x, y) for x, y in r[:len(r)]]
        pts = dp(pts, tol)
        if closed and len(pts) < 4: continue
        if not closed and len(pts) < 2: continue
        s = 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + ('Z' if closed else '')
        out.append(s)
    return ''.join(out)

def centroid(rings, proj):
    best = None
    for r in rings:
        pts = [proj(x, y) for x, y in r]
        a = cx = cy = 0
        for i in range(len(pts)-1):
            x0_, y0_ = pts[i]; x1_, y1_ = pts[i+1]
            c = x0_*y1_ - x1_*y0_; a += c; cx += (x0_+x1_)*c; cy += (y0_+y1_)*c
        if abs(a) < 1e-9: continue
        cand = (abs(a), cx/(3*a), cy/(3*a))
        if not best or cand[0] > best[0]: best = cand
    return (round(best[1], 1), round(best[2], 1)) if best else (0, 0)

def midline(rings, proj):
    longest = max(rings, key=len)
    x, y = proj(*longest[len(longest)//2]); return round(x, 1), round(y, 1)

def rings_of(geom):
    if not geom: return []
    t = geom['type']; c = geom.get('coordinates')
    if t == 'Polygon': return c
    if t == 'MultiPolygon': return [r for p in c for r in p]
    if t == 'LineString': return [c]
    if t == 'MultiLineString': return c
    return []

def bbox_of(geom):
    xs = [p[0] for r in rings_of(geom) for p in r]; ys = [p[1] for r in rings_of(geom) for p in r]
    return (min(xs), min(ys), max(xs), max(ys)) if xs else (999, 999, 999, 999)

# ───── Monde : projection Equal Earth (Šavrič, Patterson, Jenny 2018)
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3)/2
def ee(lon, lat):
    l, p = math.radians(lon), math.radians(lat)
    th = math.asin(M*math.sin(p)); t2 = th*th; t6 = t2*t2*t2
    x = 2*math.sqrt(3)*l*math.cos(th) / (3*(9*A4*t6*t2 + 7*A3*t6 + 3*A2*t2 + A1))
    y = th*(A1 + A2*t2 + A3*t6 + A4*t6*t2)
    return x, y
XMAX = ee(180, 0)[0]; YMAX = ee(0, 90)[1]
W = 1000; S = W/(2*XMAX); H = 2*YMAX*S
def pw(lon, lat):
    x, y = ee(lon, lat); return (x+XMAX)*S, (YMAX-y)*S

CONT = {'Africa': 'Afrique', 'Asia': 'Asie', 'Europe': 'Europe', 'North America': 'Amérique du Nord', 'South America': 'Amérique du Sud', 'Oceania': 'Océanie', 'Antarctica': 'Antarctique'}
countries = json.load(open(f'{SRC}/ne/geojson/ne_110m_admin_0_countries.geojson'))
world = {'sources': 'Natural Earth (domaine public), données 1:110 000 000', 'width': W, 'height': round(H, 1), 'projection': 'Equal Earth', 'countries': [], 'labels': {}, 'lines': [], 'rivers': []}
for f in countries['features']:
    p = f['properties']
    cont = CONT.get(p['CONTINENT'])
    if not cont: cont = 'Afrique' if p['NAME'] in ('Madagascar', 'Seychelles') else None
    world['countries'].append({'name': p['NAME_FR'] or p['NAME'], 'iso': p['ISO_A3'], 'continent': cont or '', 'd': path(rings_of(f['geometry']), pw, 0.35), 'lx': round(pw(p['LABEL_X'], p['LABEL_Y'])[0], 1), 'ly': round(pw(p['LABEL_X'], p['LABEL_Y'])[1], 1)})
# Positions d'étiquettes (longitude, latitude) choisies à la main pour la lisibilité.
LAB = {'continents': {'Afrique': (20, 8), 'Asie': (90, 48), 'Europe': (15, 52), 'Amérique du Nord': (-100, 45), 'Amérique du Sud': (-60, -15), 'Océanie': (135, -25), 'Antarctique': (0, -78)},
       'oceans': {'océan Pacifique': [(-150, 5), (165, 20)], 'océan Atlantique': [(-38, 28), (-15, -25)], 'océan Indien': [(78, -22)], 'océan Arctique': [(0, 84)], 'océan Austral': [(60, -60)]}}
world['labels']['continents'] = {k: [round(c, 1) for c in pw(*v)] for k, v in LAB['continents'].items()}
world['labels']['oceans'] = {k: [[round(c, 1) for c in pw(*p)] for p in v] for k, v in LAB['oceans'].items()}
for name, lat in [('Équateur', 0), ('Tropique du Cancer', 23.44), ('Tropique du Capricorne', -23.44), ('Cercle polaire arctique', 66.56), ('Cercle polaire antarctique', -66.56)]:
    world['lines'].append({'name': name, 'd': 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in (pw(lon, lat) for lon in range(-180, 181, 5)))})
world['lines'].append({'name': 'Méridien de Greenwich', 'd': 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in (pw(0, lat) for lat in range(-90, 91, 5)))})
world['outline'] = 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in [pw(-180, lat) for lat in range(-90, 91, 2)] + [pw(180, lat) for lat in range(90, -91, -2)]) + 'Z'
riv = json.load(open(f'{SRC}/ne/geojson/ne_110m_rivers_lake_centerlines.geojson'))
for f in riv['features']:
    p = f['properties']
    if p.get('featurecla') != 'River': continue
    world['rivers'].append({'name': p.get('name_fr') or p.get('name'), 'd': path(rings_of(f['geometry']), pw, 0.4, closed=False)})
json.dump(world, open(f'{OUT}/monde.json', 'w'), ensure_ascii=False, separators=(',', ':'))

# ───── France métropolitaine : projection conique simple centrée sur 46,5° N (lisible pour l'école)
LON0, LAT0 = 2.6, 46.6
BB = (-5.6, 41.2, 10.0, 51.3)
k = math.cos(math.radians(LAT0))
def raw(lon, lat): return (lon-LON0)*k, -(lat-LAT0)
x0, y0 = raw(BB[0], BB[3]); x1, y1 = raw(BB[2], BB[1])
FW = 1000; FS = FW/(x1-x0); FH = (y1-y0)*FS
def pf(lon, lat):
    x, y = raw(lon, lat); return (x-x0)*FS, (y-y0)*FS
def inter(b):
    return not (b[2] < BB[0] or b[0] > BB[2] or b[3] < BB[1] or b[1] > BB[3])
fr = {'sources': 'Contours : IGN Admin Express 2018 (Licence ouverte) via france-geojson ; fleuves, reliefs, villes et pays voisins : Natural Earth (domaine public)', 'width': FW, 'height': round(FH, 1), 'projection': 'conique simple', 'regions': [], 'departements': [], 'neighbors': [], 'rivers': [], 'mountains': [], 'cities': []}
met = json.load(open(f'{SRC}/fr/metropole-version-simplifiee.geojson'))
feats = met['features'] if 'features' in met else [met]
fr['outline'] = ''.join(path(rings_of(f['geometry']), pf, 0.6) for f in feats)
for f in json.load(open(f'{SRC}/fr/regions-version-simplifiee.geojson'))['features']:
    p = f['properties']
    if not inter(bbox_of(f['geometry'])): continue
    b = bbox_of(f['geometry']); cx, cy = pf((b[0]+b[2])/2, (b[1]+b[3])/2)
    lx, ly = centroid([r for r in rings_of(f['geometry'])], pf)
    fr['regions'].append({'code': p['code'], 'name': p['nom'], 'd': path(rings_of(f['geometry']), pf, 0.6), 'lx': lx, 'ly': ly})
for f in json.load(open(f'{SRC}/fr/departements-version-simplifiee.geojson'))['features']:
    p = f['properties']
    if not inter(bbox_of(f['geometry'])): continue
    lx, ly = centroid(rings_of(f['geometry']), pf)
    fr['departements'].append({'code': p['code'], 'name': p['nom'], 'd': path(rings_of(f['geometry']), pf, 0.9), 'lx': lx, 'ly': ly})
for f in json.load(open(f'{SRC}/ne/geojson/ne_50m_admin_0_countries.geojson'))['features']:
    p = f['properties']
    if p['ISO_A3'] == 'FRA' or not inter(bbox_of(f['geometry'])): continue
    fr['neighbors'].append({'name': p['NAME_FR'] or p['NAME'], 'd': path(rings_of(f['geometry']), pf, 0.8)})
WANT = {'Seine': 'Seine', 'Loire': 'Loire', 'Garonne': 'Garonne', 'Rhône': 'Rhône', 'Rhin': 'Rhin', 'Rhine': 'Rhin', 'Rhein': 'Rhin', 'Dordogne': 'Dordogne', 'Saône': 'Saône'}
rivers = {}
for fn in ['ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe']:
    for f in json.load(open(f'{SRC}/ne/geojson/{fn}.geojson'))['features']:
        n = WANT.get(f['properties'].get('name') or '')
        if not n or not inter(bbox_of(f['geometry'])): continue
        rivers.setdefault(n, []).extend(rings_of(f['geometry']))
for n, rings in rivers.items():
    lx, ly = midline(rings, pf)
    fr['rivers'].append({'name': n, 'd': path(rings, pf, 0.5, closed=False), 'lx': lx, 'ly': ly})
RANGES = {'ALPS': 'Alpes', 'PYRENEES': 'Pyrénées', 'Massif Central': 'Massif central', 'Jura': 'Jura', 'Vosges': 'Vosges'}
for f in json.load(open(f'{SRC}/ne/geojson/ne_10m_geography_regions_polys.geojson'))['features']:
    n = RANGES.get(f['properties']['NAME'])
    if not n or not inter(bbox_of(f['geometry'])): continue
    lx, ly = centroid(rings_of(f['geometry']), pf)
    fr['mountains'].append({'name': n, 'd': path(rings_of(f['geometry']), pf, 0.8), 'lx': lx, 'ly': ly})
FIX = {'Poitier': 'Poitiers'}
for f in json.load(open(f'{SRC}/ne/geojson/ne_50m_populated_places_simple.geojson'))['features']:
    p = f['properties']
    if p['adm0name'] != 'France': continue
    lon, lat = p['longitude'], p['latitude']
    if not (BB[0] <= lon <= BB[2] and BB[1] <= lat <= BB[3]): continue
    x, y = pf(lon, lat)
    fr['cities'].append({'name': FIX.get(p['name'], p['name']), 'x': round(x, 1), 'y': round(y, 1), 'capital': p['adm0cap'] == 1})
json.dump(fr, open(f'{OUT}/france.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('ok', len(world['countries']), len(fr['regions']), len(fr['departements']), [r['name'] for r in fr['rivers']], [m['name'] for m in fr['mountains']], len(fr['cities']))
