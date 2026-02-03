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

async function check() {
  // Nézzük a migrált igények pharmacyId mezőjét
  const snap = await db.collection('pharmaDemands').where('migratedFrom', '==', 'wordpress').limit(3).get();
  snap.docs.forEach(doc => {
    const d = doc.data();
    console.log('ID:', doc.id);
    console.log('  pharmacyId:', d.pharmacyId);
    console.log('  userId:', d.userId);
    console.log('  status:', d.status);
    console.log('  date:', d.date);
    console.log('');
  });
}

check();
