/**
 * _delete_all_schedules.js
 * Törli az összes pharmacySchedules rekordot mindkét gyógyszertárhoz.
 * Futtatás: node _delete_all_schedules.js
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

const PHARMACY_IDS = [
  'Wep2ekVOKQgUVLTkJi1UsiqcMGI2', // tesztpatika@pharmagister.hu
  'AcBMMwkqMvWAjrodNPPBjFdjjhw2',  // epresla@icloud.com
];

async function deleteAll() {
  let total = 0;
  for (const pharmacyId of PHARMACY_IDS) {
    const snap = await db.collection('pharmacySchedules')
      .where('pharmacyId', '==', pharmacyId)
      .get();
    console.log(`  ${pharmacyId}: ${snap.size} rekord törlése...`);
    const batch_size = 400;
    let docs = snap.docs;
    while (docs.length > 0) {
      const chunk = docs.splice(0, batch_size);
      const batch = db.batch();
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
      total += chunk.length;
    }
  }
  console.log(`\n✅ KÉSZ – összesen ${total} beosztás törölve.\n`);
}

deleteAll().catch(e => { console.error(e); process.exit(1); }).then(() => process.exit(0));
