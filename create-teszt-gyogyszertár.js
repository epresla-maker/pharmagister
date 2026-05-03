/**
 * create-teszt-gyogyszertár.js
 *
 * Létrehoz:
 *  - 1 gyógyszertár fiókot (Teszt Patika)
 *  - 3 gyógyszerész dolgozót (bejelentkezni is tudnak)
 *  - 3 szakasszisztens dolgozót (bejelentkezni is tudnak)
 *
 * Futtatás: node create-teszt-gyogyszertár.js
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
const auth = admin.auth();

// ─── GYÓGYSZERTÁR ────────────────────────────────────────────────────────────
const PHARMACY = {
  email: 'tesztpatika@pharmagister.hu',
  password: 'TesztPatika2026!',
  name: 'Teszt Patika',
  city: 'Budapest',
  postalCode: '1052',
  phone: '+36301234567',
};

// ─── DOLGOZÓK ────────────────────────────────────────────────────────────────
const EMPLOYEES = [
  // Gyógyszerészek
  { name: 'Kovács Anna',    role: 'pharmacist', email: 'kovacs.anna@pharmagister.hu',    password: 'KovacsAnna2026!',    birthDate: '1990-03-15' },
  { name: 'Nagy Péter',     role: 'pharmacist', email: 'nagy.peter@pharmagister.hu',     password: 'NagyPeter2026!',     birthDate: '1985-07-22' },
  { name: 'Szabó Katalin',  role: 'pharmacist', email: 'szabo.katalin@pharmagister.hu',  password: 'SzaboKatalin2026!', birthDate: '1992-11-08' },
  // Szakasszisztensek
  { name: 'Tóth Eszter',    role: 'assistant',  email: 'toth.eszter@pharmagister.hu',    password: 'TothEszter2026!',   birthDate: '1995-02-14' },
  { name: 'Varga Mónika',   role: 'assistant',  email: 'varga.monika@pharmagister.hu',   password: 'VargaMonika2026!',  birthDate: '1998-06-30' },
  { name: 'Kiss Réka',      role: 'assistant',  email: 'kiss.reka@pharmagister.hu',      password: 'KissReka2026!',     birthDate: '2000-09-05' },
];

function roleLabel(role) {
  if (role === 'pharmacist') return 'Gyógyszerész    ';
  if (role === 'assistant')  return 'Szakasszisztens ';
  return role;
}

function calcVacationDays(birthDate) {
  const birth = new Date(birthDate);
  const age = new Date('2026-01-01') - birth;
  const years = age / (1000 * 60 * 60 * 24 * 365.25);
  // Mt. 115.§ alapján
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

async function createOrUpdateUser(email, password, displayName, extraData) {
  let authUser;
  try {
    authUser = await auth.getUserByEmail(email);
    await auth.updateUser(authUser.uid, { password, displayName, emailVerified: true });
    console.log(`  ↻ Meglévő user frissítve: ${email}`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    authUser = await auth.createUser({ email, password, displayName, emailVerified: true });
    console.log(`  + Új user létrehozva: ${email}`);
  }

  await db.collection('users').doc(authUser.uid).set({
    email,
    displayName,
    emailVerified: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...extraData,
  }, { merge: true });

  return authUser.uid;
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  PHARMAGISTER – Teszt Gyógyszertár + 6 dolgozó létrehozása  ');
  console.log('══════════════════════════════════════════════════════════════\n');

  const now = admin.firestore.FieldValue.serverTimestamp();

  // ── 1. Gyógyszertár fiók ──────────────────────────────────────────────────
  console.log('1. Gyógyszertár fiók:');
  const pharmacyUid = await createOrUpdateUser(PHARMACY.email, PHARMACY.password, PHARMACY.name, {
    name: PHARMACY.name,
    pharmacyName: PHARMACY.name,
    role: 'pharmacy',
    pharmagisterRole: 'pharmacy',
    pharmaProfileComplete: true,
    city: PHARMACY.city,
    postalCode: PHARMACY.postalCode,
    phone: PHARMACY.phone,
    status: 'active',
    privacyAcceptedAt: new Date().toISOString(),
  });
  console.log(`  → UID: ${pharmacyUid}\n`);

  // ── 2. Dolgozók ───────────────────────────────────────────────────────────
  console.log('2. Dolgozók:');
  const results = [];
  for (const emp of EMPLOYEES) {
    const vacDays = calcVacationDays(emp.birthDate);

    // Firebase Auth + users doc
    const empUid = await createOrUpdateUser(emp.email, emp.password, emp.name, {
      name: emp.name,
      role: emp.role,
      pharmagisterRole: emp.role,
      pharmaProfileComplete: true,
      linkedPharmacyId: pharmacyUid,
      city: PHARMACY.city,
      postalCode: PHARMACY.postalCode,
      phone: '',
      status: 'active',
      privacyAcceptedAt: new Date().toISOString(),
    });

    // pharmacyEmployees doc
    const empRef = await db.collection('pharmacyEmployees').add({
      pharmacyId:    pharmacyUid,
      pharmacyName:  PHARMACY.name,
      pharmacyEmail: PHARMACY.email,
      name:          emp.name,
      email:         emp.email,
      phone:         '',
      address:       '',
      role:          emp.role,
      notes:         '',
      linkedUserId:  empUid,
      status:        'active',
      createdAt:     now,
      updatedAt:     now,
    });

    // employeeProfiles doc
    await db.collection('employeeProfiles').add({
      pharmacyId:              pharmacyUid,
      employeeId:              empRef.id,
      userId:                  empUid,
      birthDate:               emp.birthDate,
      childrenCount:           0,
      contractHours:           8,
      vacationEntitlementDays: vacDays,
      vacationTakenThisYear:   0,
      vacationCarriedOver:     0,
      createdAt:               now,
      updatedAt:               now,
    });

    results.push({ ...emp, uid: empUid, empDocId: empRef.id, vacDays });
    console.log(`  ✅ ${roleLabel(emp.role)} – ${emp.name}  (uid: ${empUid}, szabadság: ${vacDays} nap)`);
  }

  // ── Összefoglaló ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  BELÉPÉSI ADATOK');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('🏥 GYÓGYSZERTÁR FIÓK:');
  console.log(`   Email    : ${PHARMACY.email}`);
  console.log(`   Jelszó   : ${PHARMACY.password}`);
  console.log(`   UID      : ${pharmacyUid}\n`);

  console.log('👩‍⚕️ GYÓGYSZERÉSZEK:');
  results.filter(r => r.role === 'pharmacist').forEach(r => {
    console.log(`   ${r.name}`);
    console.log(`   Email  : ${r.email}`);
    console.log(`   Jelszó : ${r.password}\n`);
  });

  console.log('💊 SZAKASSZISZTENSEK:');
  results.filter(r => r.role === 'assistant').forEach(r => {
    console.log(`   ${r.name}`);
    console.log(`   Email  : ${r.email}`);
    console.log(`   Jelszó : ${r.password}\n`);
  });

  console.log('══════════════════════════════════════════════════════════════');
  console.log('  ✅ KÉSZ – 1 gyógyszertár + 6 dolgozó sikeresen létrehozva  ');
  console.log('══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('HIBA:', err);
  process.exit(1);
}).then(() => process.exit(0));
