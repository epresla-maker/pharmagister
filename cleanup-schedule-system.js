/**
 * cleanup-schedule-system.js
 *
 * Elvégzi a következőket:
 *  1. Felsorolja az összes pharmacyEmployee-t
 *  2. Törli a bteszt / bteszt2 / Epres Bettina nevű dolgozókat a pharmacyEmployees kollekcióból
 *  3. Törli az összes pharmacySchedules bejegyzést
 *  4. Törli a hozzájuk tartozó schedulePreferences, scheduleSwapRequests, scheduleVacationRequests rekordokat
 *
 * NEM törli a users kollekcióból, és NEM törli a Firebase Auth fiókokat.
 *
 * Futtatás: node cleanup-schedule-system.js
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

// ── Segédfüggvény: batch törlés ──────────────────────────────────────────────
async function deleteCollection(snap, label) {
  if (snap.empty) {
    console.log(`   ↳ (üres, nincs törlendő) – ${label}`);
    return 0;
  }
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`   ↳ ${snap.size} db törölve – ${label}`);
  return snap.size;
}

async function main() {
  // ── 1. Összes employee listázása ─────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('  PHARMAGISTER – Beosztási rendszer alaphelyzetbe  ');
  console.log('══════════════════════════════════════════════════\n');

  const allEmpSnap = await db.collection('pharmacyEmployees').get();
  console.log(`Jelenlegi pharmacyEmployees (${allEmpSnap.size} db):`);
  allEmpSnap.docs.forEach(d => {
    const e = d.data();
    console.log(`  • [${d.id}]  ${e.name || '(névtelen)'}  |  ${e.email || '–'}  |  pharmacyId: ${e.pharmacyId || '–'}`);
  });

  // ── 2. A törlendő dolgozók azonosítása ───────────────────────────────────
  const TARGET_NAMES = ['bteszt', 'bteszt2', 'epres bettina'];
  const TARGET_EMAILS_PARTIAL = ['bteszt', 'bettina', 'epres'];

  const toDelete = allEmpSnap.docs.filter(d => {
    const e = d.data();
    const name = (e.name || '').toLowerCase();
    const email = (e.email || '').toLowerCase();
    return (
      TARGET_NAMES.some(t => name.includes(t)) ||
      TARGET_EMAILS_PARTIAL.some(t => email.includes(t))
    );
  });

  console.log(`\nTörlendő dolgozók (${toDelete.length} db):`);
  toDelete.forEach(d => {
    const e = d.data();
    console.log(`  🗑️  [${d.id}]  ${e.name}  |  ${e.email}`);
  });

  if (toDelete.length === 0) {
    console.log('   (nincs ilyen nevű/emailű alkalmazott)');
  }

  const deletedEmployeeIds = toDelete.map(d => d.id);
  const deletedLinkedUserIds = toDelete.map(d => d.data().linkedUserId).filter(Boolean);

  // ── 3. Összes pharmacySchedules törlése ──────────────────────────────────
  console.log('\n── pharmacySchedules törlése ────────────────────────────────');
  const schedSnap = await db.collection('pharmacySchedules').get();
  let totalDeleted = 0;

  // Batch-enként 500
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;
  for (const doc of schedSnap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count >= BATCH_SIZE) {
      await batch.commit();
      totalDeleted += count;
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) {
    await batch.commit();
    totalDeleted += count;
  }
  console.log(`   ↳ ${totalDeleted} db pharmacySchedules törölve`);

  // ── 4. schedulePreferences törlése (törölt dolgozókhoz) ──────────────────
  console.log('\n── schedulePreferences törlése ──────────────────────────────');
  const prefSnap = await db.collection('schedulePreferences').get();
  const prefToDelete = prefSnap.docs.filter(d => {
    const p = d.data();
    return (
      deletedEmployeeIds.includes(p.employeeId) ||
      deletedLinkedUserIds.includes(p.userId)
    );
  });
  const prefBatch = db.batch();
  prefToDelete.forEach(d => prefBatch.delete(d.ref));
  if (prefToDelete.length > 0) await prefBatch.commit();
  console.log(`   ↳ ${prefToDelete.length} db schedulePreferences törölve`);

  // ── 5. scheduleSwapRequests törlése ──────────────────────────────────────
  console.log('\n── scheduleSwapRequests törlése ─────────────────────────────');
  const swapSnap = await db.collection('scheduleSwapRequests').get();
  const swapToDelete = swapSnap.docs.filter(d => {
    const s = d.data();
    return (
      deletedLinkedUserIds.includes(s.requesterUserId) ||
      deletedLinkedUserIds.includes(s.targetUserId) ||
      deletedEmployeeIds.includes(s.requesterEmployeeId) ||
      deletedEmployeeIds.includes(s.targetEmployeeId)
    );
  });
  const swapBatch = db.batch();
  swapToDelete.forEach(d => swapBatch.delete(d.ref));
  if (swapToDelete.length > 0) await swapBatch.commit();
  console.log(`   ↳ ${swapToDelete.length} db scheduleSwapRequests törölve`);

  // ── 6. scheduleVacationRequests törlése ───────────────────────────────────
  console.log('\n── scheduleVacationRequests törlése ──────────────────────────');
  const vacSnap = await db.collection('scheduleVacationRequests').get();
  const vacToDelete = vacSnap.docs.filter(d => {
    const v = d.data();
    return (
      deletedLinkedUserIds.includes(v.userId) ||
      deletedEmployeeIds.includes(v.employeeId)
    );
  });
  const vacBatch = db.batch();
  vacToDelete.forEach(d => vacBatch.delete(d.ref));
  if (vacToDelete.length > 0) await vacBatch.commit();
  console.log(`   ↳ ${vacToDelete.length} db scheduleVacationRequests törölve`);

  // ── 7. pharmacyEmployees törlése ──────────────────────────────────────────
  console.log('\n── pharmacyEmployees törlése ─────────────────────────────────');
  if (toDelete.length > 0) {
    const empBatch = db.batch();
    toDelete.forEach(d => empBatch.delete(d.ref));
    await empBatch.commit();
    console.log(`   ↳ ${toDelete.length} db pharmacyEmployee törölve`);
  } else {
    console.log('   ↳ Nincs törlendő alkalmazott.');
  }

  // ── Összefoglaló ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('  ✅ KÉSZ – beosztási rendszer alaphelyzetbe állítva');
  console.log('     (Felhasználói fiókok és users dokumentumok épek!)');
  console.log('══════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('HIBA:', err);
  process.exit(1);
}).then(() => process.exit(0));
