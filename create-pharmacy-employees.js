/**
 * create-pharmacy-employees.js
 *
 * epresla@icloud.com gyógyszertárába létrehoz:
 *  - 2 gyógyszerész (Kis Andrea, Nagy Petra)
 *  - 2 szakasszisztens (Szabó Mária, Varga Eszter)
 *
 * Mindegyik: 8 órás munkaviszony, 20 nap szabadság (24 éves, 0 gyerek)
 *
 * Futtatás: node create-pharmacy-employees.js
 */

require('dotenv').config({ path: '.env.local' });
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

const PHARMACY_UID = 'AcBMMwkqMvWAjrodNPPBjFdjjhw2'; // epresla@icloud.com
const PHARMACY_NAME = 'Pharmagister Teszpatika';
const PHARMACY_EMAIL = 'epresla@icloud.com';

// 2002-01-01 → kor 2026-ban: 24 → 20 nap alap szabadság (Mt. 115.§, kor <25)
const BIRTH_DATE = '2002-01-01';
const CONTRACT_HOURS = 8;    // napi 8 óra
const CHILDREN_COUNT = 0;

const employees = [
  { name: 'Kis Andrea',    role: 'pharmacist', email: '' },
  { name: 'Nagy Petra',    role: 'pharmacist', email: '' },
  { name: 'Szabó Mária',   role: 'assistant',  email: '' },
  { name: 'Varga Eszter',  role: 'assistant',  email: '' },
];

function roleLabel(role) {
  if (role === 'pharmacist') return 'Gyógyszerész';
  if (role === 'assistant')  return 'Szakasszisztens';
  return role;
}

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  PHARMAGISTER – Dolgozók létrehozása             ');
  console.log('══════════════════════════════════════════════════\n');
  console.log(`Gyógyszertár UID : ${PHARMACY_UID}`);
  console.log(`Szerződés        : ${CONTRACT_HOURS} h/nap`);
  console.log(`Születési dátum  : ${BIRTH_DATE}  (kor ~24 → 20 nap szabadság)\n`);

  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const emp of employees) {
    // 1. pharmacyEmployees dokumentum
    const empRef = await db.collection('pharmacyEmployees').add({
      pharmacyId:    PHARMACY_UID,
      pharmacyName:  PHARMACY_NAME,
      pharmacyEmail: PHARMACY_EMAIL,
      name:          emp.name,
      email:         emp.email,
      phone:         '',
      address:       '',
      role:          emp.role,
      notes:         '',
      linkedUserId:  null,
      status:        'active',
      createdAt:     now,
      updatedAt:     now,
    });

    // 2. employeeProfiles dokumentum (munkaviszony adatok)
    await db.collection('employeeProfiles').add({
      pharmacyId:          PHARMACY_UID,
      employeeId:          empRef.id,
      userId:              null,
      birthDate:           BIRTH_DATE,
      childrenCount:       CHILDREN_COUNT,
      contractHours:       CONTRACT_HOURS,
      vacationTakenThisYear: 0,
      vacationCarriedOver:   0,
      createdAt:           now,
      updatedAt:           now,
    });

    console.log(`  ✅ ${roleLabel(emp.role).padEnd(16)} – ${emp.name}  (id: ${empRef.id})`);
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('  ✅ KÉSZ – 4 dolgozó sikeresen létrehozva        ');
  console.log('══════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('HIBA:', err);
  process.exit(1);
}).then(() => process.exit(0));
