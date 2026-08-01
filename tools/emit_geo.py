import json, os
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
coords = json.load(open(os.path.join(base, 'tools/mtr_coords.json'), encoding='utf8'))
lines = ['// 港鐵站經緯度（來源：OpenStreetMap，ODbL）— 由 tools/build_coords.py + emit_geo.py 產生',
         'export const MTR_STATION_GEO = {']
items = [f"  {k}: [{v[0]}, {v[1]}]" for k, v in sorted(coords.items())]
lines.append(',\n'.join(items))
lines.append('};\n')
open(os.path.join(base, 'server/src/mtrGeo.js'), 'w', encoding='utf8').write('\n'.join(lines))
print('ok', len(coords))
