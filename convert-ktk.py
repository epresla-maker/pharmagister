import pandas as pd
import json

df = pd.read_excel('/Users/epresl/Downloads/Teljes KTK_04.02..xlsx', sheet_name='KTK', header=None)

# Új oszlopsorrend 2024.04.02-es exportban
columns = [
    'ktk_statusz', 'kezdes_idopontja', 'befejezes_idopontja', 'tovabbkepzes_varos',
    'nyilvantartasi_szam', 'fantazia_nev', 'program_megnevezes', 'szakmacsoportok',
    'szukitett_szakmacsoport', 'szervezo_akkreditacio', 'szervezo_megnevezes',
    'tovabbkepzes_cime', 'helyszin',
    'kapcsolattarto_neve', 'kapcsolattarto_beosztas', 'kapcsolattarto_email',
    'kapcsolattarto_telefon', 'kapcsolattarto_mobil',
    'kapcsolattarto2_neve', 'kapcsolattarto2_beosztas', 'kapcsolattarto2_email',
    'kapcsolattarto2_telefon', 'kapcsolattarto2_mobil',
    'kulso_azonosito'
]

data = df.iloc[6:].copy()
data.columns = columns
data = data.dropna(how='all')

for col in ['kezdes_idopontja', 'befejezes_idopontja']:
    data[col] = pd.to_datetime(data[col], errors='coerce').dt.strftime('%Y-%m-%d')

records = []
for _, row in data.iterrows():
    record = {}
    for col in columns:
        val = row[col]
        if pd.notna(val):
            record[col] = str(val).strip()
        else:
            record[col] = None
    records.append(record)

print(f"Total records: {len(records)}")

# Csak a 8-as szakmacsoportot tartalmazó rekordok
records = [r for r in records if r.get('szakmacsoportok') and '8' in [s.strip() for s in r['szakmacsoportok'].split(',')]]
print(f"Filtered to szakmacsoport 8: {len(records)} records")

print(json.dumps(records[0], indent=2, ensure_ascii=False))

with open('/Users/epresl/Desktop/pharmagister/public/ktk-data.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(records)} records to public/ktk-data.json")
