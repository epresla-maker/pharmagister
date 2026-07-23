require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

const DEFAULT_PASSWORD = 'TesztUser2026!';

const FIRST_NAMES = [
  'Bence', 'Anna', 'Dóra', 'Levente', 'Nóra', 'Máté', 'Petra', 'Dávid', 'Eszter', 'Balázs',
  'Réka', 'Gábor', 'Zsófia', 'Ádám', 'Kata', 'Gergely', 'Judit', 'András', 'Viktória', 'Tamás',
  'Szilvia', 'Miklós', 'Noémi', 'István', 'Renáta', 'Kristóf', 'Márta', 'Áron', 'Melinda', 'Dániel',
  'Ildikó', 'Csaba', 'Kinga', 'Roland', 'Adrienn', 'Ákos', 'Orsolya', 'Marcell', 'Ágnes', 'Patrik',
];

const LAST_NAMES = [
  'Kovács', 'Szabó', 'Tóth', 'Nagy', 'Varga', 'Kiss', 'Molnár', 'Farkas', 'Balogh', 'Papp',
  'Lakatos', 'Takács', 'Juhász', 'Mészáros', 'Horváth', 'Biró', 'Sipos', 'Nemes', 'Kádár', 'Simon',
  'Vincze', 'Bodnár', 'Kelemen', 'Hegedűs', 'Cserna', 'Barta', 'Szalai', 'Kecskés', 'Gulyás', 'Antal',
];

function removeAccents(input) {
  return String(input || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  { city: 'Makó', postalCode: '6900' },
  { city: 'Gyula', postalCode: '5700' },
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
  { district: 'XXIII. kerulet', postalCode: '1238' },
];

function pickFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomYears() {
  return `${Math.floor(Math.random() * 21) + 1} ev tapasztalat`;
}

const EMAIL_DOMAINS = [
  'mailhub.hu',
  'postalink.hu',
  'inkmail.net',
  'citymail.hu',
  'levbox.org',
  'horizontmail.hu',
  'rapidmail.net',
  'urbanposta.hu',
  'directmail.co',
  'northmail.eu',
];

function toSlug(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function makeFakeEmail(index, person, city) {
  const first = toSlug(person.firstName);
  const last = toSlug(person.lastName);
  const citySlug = toSlug(city);
  const birthYearLike = String(1978 + (index % 24));
  const serial2 = String((index * 7) % 90 + 10);
  const serial3 = String((index * 13) % 900 + 100);
  const domain = EMAIL_DOMAINS[index % EMAIL_DOMAINS.length];

  const patterns = [
    `${first}.${last}${serial2}`,
    `${last}${birthYearLike}.${first}`,
    `${first}${serial3}.${last}`,
    `${last}.${first}.${serial2}`,
    `${first}.${citySlug}${serial2}`,
  ];

  return `${patterns[index % patterns.length]}@${domain}`;
}

function makeName(index) {
  const baseFirstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const baseLastName = LAST_NAMES[(index * 3) % LAST_NAMES.length];
  const firstName = index % 4 === 0 ? removeAccents(baseFirstName) : baseFirstName;
  const lastName = index % 3 === 0 ? removeAccents(baseLastName) : baseLastName;
  return { firstName, lastName, fullName: `${lastName} ${firstName}` };
}

function buildProfile(index) {
  const role = index < 50 ? 'pharmacist' : 'assistant';
  const isBudapest = index >= 50;
  const person = makeName(index);

  let city = '';
  let postalCode = '';
  let district = null;

  if (isBudapest) {
    const d = BUDAPEST_DISTRICTS[(index - 50) % BUDAPEST_DISTRICTS.length];
    city = 'Budapest';
    postalCode = d.postalCode;
    district = d.district;
  } else {
    const t = pickFrom(HUNGARIAN_TOWNS);
    city = t.city;
    postalCode = t.postalCode;
  }

  const email = makeFakeEmail(index + 1, person, city);

  const roleLabel = role === 'pharmacist' ? 'Gyogyszeresz' : 'Szakasszisztens';

  return {
    index: index + 1,
    role,
    email,
    password: DEFAULT_PASSWORD,
    displayName: person.fullName,
    profile: {
      name: person.fullName,
      displayName: person.fullName,
      firstName: person.firstName,
      lastName: person.lastName,
      email,
      pharmagisterRole: role,
      role,
      pharmaRole: role,
      pharmaProfileComplete: true,
      emailVerified: true,
      passwordActivated: true,
      passwordActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      country: 'HU',
      city,
      district,
      postalCode,
      bio: `${roleLabel} teszt profil (${city}${district ? ', ' + district : ''}).`,
      experience: randomYears(),
      availableForSubstitution: true,
      skills: role === 'pharmacist'
        ? ['expedialas', 'keszletkezeles', 'gyogyszereszeti tanacsadas']
        : ['expedialas', 'aruatvetel', 'keszletfeltoltes'],
      languages: ['hu'],
      profileVisibility: 'public',
      privacyAcceptedAt: new Date().toISOString(),
      market: 'hu',
      isTestUser: true,
      testBatch: 'hu-100-2026-07-23',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

async function createOrUpdateUser(record) {
  let uid;
  try {
    const existing = await auth.getUserByEmail(record.email);
    uid = existing.uid;
    await auth.updateUser(uid, {
      password: record.password,
      displayName: record.displayName,
      emailVerified: true,
    });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    const created = await auth.createUser({
      email: record.email,
      password: record.password,
      displayName: record.displayName,
      emailVerified: true,
    });
    uid = created.uid;
  }

  await db.collection('users').doc(uid).set({
    uid,
    ...record.profile,
  }, { merge: true });

  return uid;
}

async function run() {
  console.log('=== 100 HU TESZT FELHASZNALO LETREHOZASA ===');
  console.log('50 gyogyszeresz + 50 szakasszisztens');
  console.log('50 random videki telepules + 50 budapesti keruletek\n');

  const users = Array.from({ length: 100 }, (_, i) => buildProfile(i));
  const results = [];
  let ok = 0;
  let fail = 0;

  for (const user of users) {
    try {
      const uid = await createOrUpdateUser(user);
      ok += 1;
      results.push({
        sorszam: user.index,
        uid,
        nev: user.displayName,
        email: user.email,
        jelszo: user.password,
        role: user.role,
        city: user.profile.city,
        district: user.profile.district || '',
        irsz: user.profile.postalCode,
      });
      console.log(`✅ [${String(user.index).padStart(3, '0')}] ${user.email} | ${user.role} | ${user.profile.city}${user.profile.district ? ' - ' + user.profile.district : ''}`);
    } catch (error) {
      fail += 1;
      console.log(`❌ [${String(user.index).padStart(3, '0')}] ${user.email}: ${error.message}`);
    }
  }

  const outDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `created-users-hu-100-${timestamp}.json`);
  const csvPath = path.join(outDir, `created-users-hu-100-${timestamp}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');

  const csvHeader = 'sorszam,uid,nev,email,jelszo,role,city,district,irsz\n';
  const csvRows = results
    .map((r) => [r.sorszam, r.uid, r.nev, r.email, r.jelszo, r.role, r.city, r.district, r.irsz]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','))
    .join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf8');

  console.log('\n=== KESZ ===');
  console.log(`Sikeres: ${ok}`);
  console.log(`Hibas: ${fail}`);
  console.log(`JSON lista: ${jsonPath}`);
  console.log(`CSV lista: ${csvPath}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Vegzetes hiba:', err);
    process.exit(1);
  });
