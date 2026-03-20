import pandas as pd
import json

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
print(json.dumps(records[0], indent=2, ensure_ascii=False))

with open('/Users/epresl/Desktop/pharmagister/public/ktk-data.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(records)} records to public/ktk-data.json")
