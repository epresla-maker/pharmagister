require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })});
}
const db = admin.firestore();
async function main() {
  const pharmacyId = 'AcBMMwkqMvWAjrodNPPBjFdjjhw2';
  const year = 2026;
  const month = 6;
  
  console.log('Testing exact pharmacy query (3 equality filters):');
  const snap = await db.collection('schedulePreferences')
    .where('pharmacyId', '==', pharmacyId)
    .where('year', '==', year)
    .where('month', '==', month)
    .get();
  console.log('Results:', snap.size);
  snap.forEach(d => console.log(JSON.stringify({ id: d.id, date: d.data().date, status: d.data().status, employeeId: d.data().employeeId })));
  
  // Also test all-months query
  console.log('\nTesting all-months query:');
  const snap2 = await db.collection('schedulePreferences')
    .where('pharmacyId', '==', pharmacyId)
    .get();
  console.log('Results:', snap2.size);
}
main().catch(console.error).finally(() => process.exit());
