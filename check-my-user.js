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
  // epresla@icloud.com user
  const userSnap = await db.collection('users').where('email', '==', 'epresla@icloud.com').get();
  userSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log('User:', d.email);
    console.log('  pharmagisterRole:', d.pharmagisterRole);
    console.log('  pharmaProfileComplete:', d.pharmaProfileComplete);
    console.log('  uid:', doc.id);
  });
}

check();
