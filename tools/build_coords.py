import json, re, os
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

byname = {}
for fn in ('mtr_osm.json', 'mtr_osm2.json', 'mtr_osm3.json'):
    p = os.path.join(base, fn)
    if not os.path.exists(p):
        continue
    try:
        d = json.load(open(p, encoding='utf8'))
    except Exception:
        continue
    for x in d.get('elements', []):
        t = x.get('tags', {})
        lat = x.get('lat') or (x.get('center') or {}).get('lat')
        lon = x.get('lon') or (x.get('center') or {}).get('lon')
        if lat is None:
            continue
        for key in ('name:zh', 'name'):
            n = (t.get(key) or '').replace('站', '').strip()
            if n and n not in byname:
                byname[n] = (round(lat, 5), round(lon, 5))

cfg = open(os.path.join(base, 'server/src/config.js'), encoding='utf8').read()
pairs = sorted(set(re.findall(r"\['([A-Z]{3})', '([^']+)'\]", cfg)))
missing = [p for p in pairs if p[1] not in byname]
print(len(pairs), 'stations; missing:', missing)
out = {code: byname[name] for code, name in pairs if name in byname}
open(os.path.join(base, 'tools/mtr_coords.json'), 'w', encoding='utf8').write(
    json.dumps(out, ensure_ascii=False, indent=0))
print('written', len(out))
