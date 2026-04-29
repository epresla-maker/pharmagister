require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}
const db = admin.firestore();

async function main() {
  const user = await admin.auth().getUserByEmail('epresla@icloud.com');
  console.log('Admin UID:', user.uid);

  const snap = await db.collection('pharmacyEmployees').where('pharmacyId', '==', user.uid).get();
  console.log('Employees with pharmacyId==admin.uid:', snap.size);

  const allSnap = await db.collection('pharmacyEmployees').limit(10).get();
  console.log('\nAll pharmacyEmployees (first 10):');
  allSnap.forEach(d => {
    const data = d.data();
    console.log(' -', data.name || '(névtelen)', '| pharmacyId:', data.pharmacyId, '| status:', data.status);
  });
}
main().catch(console.error).finally(() => process.exit());
