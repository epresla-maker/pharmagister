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

(async () => {
  const snap = await db.collection('pharmaDemands').get();
  const total = snap.size;
  console.log('Current total demands:', total);
  
  await db.collection('firestoreStats').doc('demands').set(
    { totalEverCreated: total },
    { merge: true }
  );
  
  console.log('Counter initialized to', total);
  process.exit(0);
})();
