/**
 * _add_tesztpatika_employees.js
 *
 * tesztpatika@pharmagister.hu gyógyszertárba hozzáad:
 *  - 2 gyógyszerész (Balogh Zsuzsanna, Fekete Gábor)
 *  - 2 szakasszisztens (Horváth Ildikó, Molnár Dóra)
 *
 * Futtatás: node _add_tesztpatika_employees.js
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

const PHARMACY_UID   = 'Wep2ekVOKQgUVLTkJi1UsiqcMGI2';
const PHARMACY_NAME  = 'Teszt Patika';
const PHARMACY_EMAIL = 'tesztpatika@pharmagister.hu';

const employees = [
  { name: 'Balogh Zsuzsanna', role: 'pharmacist', birthDate: '1988-04-12' },
  { name: 'Fekete Gábor',     role: 'pharmacist', birthDate: '1983-09-25' },
  { name: 'Horváth Ildikó',   role: 'assistant',  birthDate: '1996-01-17' },
  { name: 'Molnár Dóra',      role: 'assistant',  birthDate: '1999-07-03' },
];

function roleLabel(role) {
  if (role === 'pharmacist') return 'Gyógyszerész';
  if (role === 'assistant')  return 'Szakasszisztens';
  return role;
}

function calcVacationDays(birthDate) {
  const birth = new Date(birthDate);
  const years = (new Date('2026-01-01') - birth) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 25) return 20;
  if (years < 28) return 21;
  if (years < 31) return 22;
  if (years < 33) return 23;
  if (years < 35) return 24;
  if (years < 37) return 25;
  if (years < 39) return 26;
  if (years < 41) return 27;
  if (years < 43) return 28;
  if (years < 45) return 29;
  return 30;
}

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Teszt Patika – Új dolgozók hozzáadása           ');
  console.log('══════════════════════════════════════════════════\n');

  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const emp of employees) {
    const vacation = calcVacationDays(emp.birthDate);

    const empRef = await db.collection('pharmacyEmployees').add({
      pharmacyId:    PHARMACY_UID,
      pharmacyName:  PHARMACY_NAME,
      pharmacyEmail: PHARMACY_EMAIL,
      name:          emp.name,
      email:         '',
      phone:         '',
      address:       '',
      role:          emp.role,
      notes:         '',
      linkedUserId:  null,
      status:        'active',
      createdAt:     now,
      updatedAt:     now,
    });

    await db.collection('employeeProfiles').add({
      pharmacyId:              PHARMACY_UID,
      employeeId:              empRef.id,
      userId:                  null,
      birthDate:               emp.birthDate,
      childrenCount:           0,
      contractHours:           8,
      vacationTakenThisYear:   0,
      vacationCarriedOver:     0,
      createdAt:               now,
      updatedAt:               now,
    });

    console.log(`  ✅ ${roleLabel(emp.role).padEnd(16)} – ${emp.name}  (${vacation} nap szabadság, id: ${empRef.id})`);
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('  ✅ KÉSZ – 4 dolgozó sikeresen hozzáadva         ');
  console.log('══════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('HIBA:', err);
  process.exit(1);
}).then(() => process.exit(0));
