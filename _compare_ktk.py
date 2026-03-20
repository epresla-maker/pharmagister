import pandas as pd
import json

# Régi adat betöltése
with open('public/ktk-data.json', 'r') as f:
    old_data = json.load(f)

# Csak 8-as szakmacsoport szűrése a régiből
old_8 = [r for r in old_data if r.get('szakmacsoportok') and '8' in [s.strip() for s in r['szakmacsoportok'].split(',')]]
old_ids = set(r.get('nyilvantartasi_szam') for r in old_8 if r.get('nyilvantartasi_szam'))
print(f'Régi adat (03.05): {len(old_data)} összes, {len(old_8)} db 8-as szakmacsoport')

# Új Excel betöltése
df = pd.read_excel('/Users/epresl/Downloads/Teljes KTK_03.16..xls', sheet_name='KTK', header=None)
columns = [
    'nyilvantartasi_szam', 'fantazia_nev', 'program_megnevezes', 'kulso_azonosito',
    'ktk_statusz', 'szervezo_akkreditacio', 'tovabbkepzes_varos', 'tovabbkepzes_cime', 'helyszin',
    'szervezo_megnevezes', 'szakmacsoportok', 'kezdes_idopontja', 'befejezes_idopontja',
    'kapcsolattarto_neve', 'kapcsolattarto_beosztas', 'kapcsolattarto_email',
    'kapcsolattarto_telefon', 'kapcsolattarto_mobil',
    'kapcsolattarto2_neve', 'kapcsolattarto2_beosztas', 'kapcsolattarto2_email',
    'kapcsolattarto2_telefon', 'kapcsolattarto2_mobil',
    'szukitett_szakmacsoport'
]
data = df.iloc[6:].copy()
data.columns = columns
data = data.dropna(how='all')

new_records = []
for _, row in data.iterrows():
    record = {}
    for col in columns:
        val = row[col]
        if pd.notna(val):
            record[col] = str(val).strip()
        else:
            record[col] = None
    new_records.append(record)

# Csak 8-as szakmacsoport szűrése az újból
new_8 = [r for r in new_records if r.get('szakmacsoportok') and '8' in [s.strip() for s in r['szakmacsoportok'].split(',')]]
new_ids = set(r.get('nyilvantartasi_szam') for r in new_8 if r.get('nyilvantartasi_szam'))
print(f'Új adat (03.16): {len(new_records)} összes, {len(new_8)} db 8-as szakmacsoport')

# Összehasonlítás
added = new_ids - old_ids
removed = old_ids - new_ids
common = new_ids & old_ids

print(f'\n--- KÜLÖNBSÉGEK (8-as szakmacsoport) ---')
print(f'Megmaradt: {len(common)}')
print(f'Új (hozzáadott): {len(added)}')
print(f'Eltávolított: {len(removed)}')

if added:
    print(f'\n=== ÚJ TOVÁBBKÉPZÉSEK ({len(added)} db) ===')
    for r in new_8:
        if r.get('nyilvantartasi_szam') in added:
            print(f'  + {r["program_megnevezes"]} | {r["ktk_statusz"]} | {r.get("kezdes_idopontja","?")}')

if removed:
    print(f'\n=== ELTÁVOLÍTOTT ({len(removed)} db) ===')
    for r in old_8:
        if r.get('nyilvantartasi_szam') in removed:
            print(f'  - {r["program_megnevezes"]} | {r["ktk_statusz"]} | {r.get("kezdes_idopontja","?")}')

# Státusz változások
print(f'\n=== STÁTUSZ VÁLTOZÁSOK ===')
old_map = {r['nyilvantartasi_szam']: r for r in old_8 if r.get('nyilvantartasi_szam')}
new_map = {r['nyilvantartasi_szam']: r for r in new_8 if r.get('nyilvantartasi_szam')}
changes = 0
for nid in common:
    old_status = old_map[nid].get('ktk_statusz')
    new_status = new_map[nid].get('ktk_statusz')
    if old_status != new_status:
        changes += 1
        print(f'  ~ {new_map[nid]["program_megnevezes"]}: {old_status} -> {new_status}')
if changes == 0:
    print('  Nincs státuszváltozás')
