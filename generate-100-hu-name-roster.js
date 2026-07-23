const fs = require('fs');
const path = require('path');

const HUNGARIAN_LAST_NAMES = [
  'Kovács', 'Szabó', 'Tóth', 'Nagy', 'Varga', 'Kiss', 'Molnár', 'Farkas', 'Balogh', 'Papp',
  'Lakatos', 'Takács', 'Juhász', 'Mészáros', 'Horváth', 'Biró', 'Sipos', 'Nemes', 'Kádár', 'Simon',
  'Vincze', 'Bodnár', 'Kelemen', 'Hegedűs', 'Cserna', 'Barta', 'Szalai', 'Kecskés', 'Gulyás', 'Antal',
  'Orbán', 'Illés', 'Bencze', 'Fehér', 'Boros', 'Kis', 'Kocsis', 'Fodor', 'Hajdú', 'Barna',
  'Fazekas', 'Madarász', 'Rácz', 'Dobi', 'Tamási', 'Veres', 'Kolozsi', 'Páll', 'Sárközi', 'Dudás'
];

const HUNGARIAN_FIRST_NAMES = [
  'Anna', 'Bence', 'Dóra', 'Levente', 'Noémi', 'Máté', 'Eszter', 'Dávid', 'Petra', 'Balázs',
  'Réka', 'Gábor', 'Zsófia', 'Ádám', 'Kata', 'Gergely', 'Judit', 'András', 'Viktória', 'Tamás',
  'Szilvia', 'Miklós', 'Nóra', 'István', 'Renáta', 'Kristóf', 'Márta', 'Áron', 'Melinda', 'Dániel',
  'Ildikó', 'Csaba', 'Kinga', 'Roland', 'Adrienn', 'Ákos', 'Orsolya', 'Marcell', 'Ágnes', 'Patrik',
  'Vivien', 'Boglárka', 'Gergő', 'Emese', 'Attila', 'Bianka', 'László', 'Zalán', 'Hanna', 'Milán'
];

function removeAccents(input) {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const HUNGARIAN_TOWNS = [
  { city: 'Debrecen', postalCode: '4024' },
  { city: 'Szeged', postalCode: '6720' },
  { city: 'Miskolc', postalCode: '3525' },
  { city: 'Pecs', postalCode: '7621' },
  { city: 'Gyor', postalCode: '9021' },
  { city: 'Nyiregyhaza', postalCode: '4400' },
  { city: 'Kecskemet', postalCode: '6000' },
  { city: 'Szekesfehervar', postalCode: '8000' },
  { city: 'Szombathely', postalCode: '9700' },
  { city: 'Szolnok', postalCode: '5000' },
  { city: 'Tatabanya', postalCode: '2800' },
  { city: 'Kaposvar', postalCode: '7400' },
  { city: 'Bekescsaba', postalCode: '5600' },
  { city: 'Zalaegerszeg', postalCode: '8900' },
  { city: 'Eger', postalCode: '3300' },
  { city: 'Nagykanizsa', postalCode: '8800' },
  { city: 'Dunaujvaros', postalCode: '2400' },
  { city: 'Hodmezovasarhely', postalCode: '6800' },
  { city: 'Sopron', postalCode: '9400' },
  { city: 'Salgotarjan', postalCode: '3100' },
  { city: 'Veszprem', postalCode: '8200' },
  { city: 'Vac', postalCode: '2600' },
  { city: 'Godollo', postalCode: '2100' },
  { city: 'Siofok', postalCode: '8600' },
  { city: 'Esztergom', postalCode: '2500' },
  { city: 'Papa', postalCode: '8500' },
  { city: 'Baja', postalCode: '6500' },
  { city: 'Ozd', postalCode: '3600' },
  { city: 'Cegled', postalCode: '2700' },
  { city: 'Mosonmagyarovar', postalCode: '9200' },
  { city: 'Kiskunfelegyhaza', postalCode: '6100' },
  { city: 'Budaors', postalCode: '2040' },
  { city: 'Szentendre', postalCode: '2000' },
  { city: 'Dunakeszi', postalCode: '2120' },
  { city: 'Gyongyos', postalCode: '3200' },
  { city: 'Hajduszoboszlo', postalCode: '4200' },
  { city: 'Kazincbarcika', postalCode: '3700' },
  { city: 'Komarom', postalCode: '2900' },
  { city: 'Ajka', postalCode: '8400' },
  { city: 'Tapolca', postalCode: '8300' },
  { city: 'Keszthely', postalCode: '8360' },
  { city: 'Balatonfured', postalCode: '8230' },
  { city: 'Balassagyarmat', postalCode: '2660' },
  { city: 'Paks', postalCode: '7030' },
  { city: 'Kiskunhalas', postalCode: '6400' },
  { city: 'Kalocsa', postalCode: '6300' },
  { city: 'Sarvar', postalCode: '9600' },
  { city: 'Heviz', postalCode: '8380' },
  { city: 'Mako', postalCode: '6900' },
  { city: 'Gyula', postalCode: '5700' }
];

const BUDAPEST_DISTRICTS = [
  { district: 'I. kerulet', postalCode: '1011' },
  { district: 'II. kerulet', postalCode: '1024' },
  { district: 'III. kerulet', postalCode: '1033' },
  { district: 'IV. kerulet', postalCode: '1042' },
  { district: 'V. kerulet', postalCode: '1052' },
  { district: 'VI. kerulet', postalCode: '1062' },
  { district: 'VII. kerulet', postalCode: '1073' },
  { district: 'VIII. kerulet', postalCode: '1085' },
  { district: 'IX. kerulet', postalCode: '1094' },
  { district: 'X. kerulet', postalCode: '1102' },
  { district: 'XI. kerulet', postalCode: '1117' },
  { district: 'XII. kerulet', postalCode: '1123' },
  { district: 'XIII. kerulet', postalCode: '1138' },
  { district: 'XIV. kerulet', postalCode: '1146' },
  { district: 'XV. kerulet', postalCode: '1153' },
  { district: 'XVI. kerulet', postalCode: '1163' },
  { district: 'XVII. kerulet', postalCode: '1173' },
  { district: 'XVIII. kerulet', postalCode: '1184' },
  { district: 'XIX. kerulet', postalCode: '1191' },
  { district: 'XX. kerulet', postalCode: '1203' },
  { district: 'XXI. kerulet', postalCode: '1211' },
  { district: 'XXII. kerulet', postalCode: '1222' },
  { district: 'XXIII. kerulet', postalCode: '1238' }
];

function buildName(index) {
  const baseLastName = HUNGARIAN_LAST_NAMES[index % HUNGARIAN_LAST_NAMES.length];
  const baseFirstName = HUNGARIAN_FIRST_NAMES[(index * 7) % HUNGARIAN_FIRST_NAMES.length];

  // Keep a mixed distribution: some names accented, some plain.
  const usePlainLastName = index % 3 === 0;
  const usePlainFirstName = index % 4 === 0;

  const lastName = usePlainLastName ? removeAccents(baseLastName) : baseLastName;
  const firstName = usePlainFirstName ? removeAccents(baseFirstName) : baseFirstName;
  return { lastName, firstName, fullName: `${lastName} ${firstName}` };
}

function buildRecord(index) {
  const role = index < 50 ? 'pharmacist' : 'assistant';
  const person = buildName(index);

  if (index < 50) {
    const town = HUNGARIAN_TOWNS[Math.floor(Math.random() * HUNGARIAN_TOWNS.length)];
    return {
      sorszam: index + 1,
      vezeteknev: person.lastName,
      utonev: person.firstName,
      teljesNev: person.fullName,
      role,
      city: town.city,
      district: '',
      postalCode: town.postalCode,
      country: 'HU',
      email: null,
      phone: null,
    };
  }

  const district = BUDAPEST_DISTRICTS[(index - 50) % BUDAPEST_DISTRICTS.length];
  return {
    sorszam: index + 1,
    vezeteknev: person.lastName,
    utonev: person.firstName,
    teljesNev: person.fullName,
    role,
    city: 'Budapest',
    district: district.district,
    postalCode: district.postalCode,
    country: 'HU',
    email: null,
    phone: null,
  };
}

function generateRoster() {
  const records = Array.from({ length: 100 }, (_, i) => buildRecord(i));

  const outDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `hu-name-roster-100-${timestamp}.json`);
  const csvPath = path.join(outDir, `hu-name-roster-100-${timestamp}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), 'utf8');

  const header = 'sorszam,vezeteknev,utonev,teljesNev,role,city,district,postalCode,country,email,phone\n';
  const rows = records
    .map((r) => [
      r.sorszam,
      r.vezeteknev,
      r.utonev,
      r.teljesNev,
      r.role,
      r.city,
      r.district,
      r.postalCode,
      r.country,
      r.email,
      r.phone,
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  fs.writeFileSync(csvPath, header + rows, 'utf8');

  const pharmacists = records.filter((r) => r.role === 'pharmacist').length;
  const assistants = records.filter((r) => r.role === 'assistant').length;
  const budapest = records.filter((r) => r.city === 'Budapest').length;
  const nonBudapest = records.filter((r) => r.city !== 'Budapest').length;

  console.log('=== 100-AS MAGYAR NEVLISTA ELKESZULT ===');
  console.log(`Gyogyszeresz: ${pharmacists}`);
  console.log(`Szakasszisztens: ${assistants}`);
  console.log(`Videk: ${nonBudapest}`);
  console.log(`Budapest: ${budapest}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
}

generateRoster();
