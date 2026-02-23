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

async function check() {
  try {
    const u = await admin.auth().getUserByEmail('teszt.patika@pharmagister.hu');
    console.log('Letezik - uid:', u.uid);
    
    const doc = await admin.firestore().collection('users').doc(u.uid).get();
    if (doc.exists) {
      const d = doc.data();
      console.log('Role:', d.pharmagisterRole);
      console.log('Name:', d.name || d.displayName);
      console.log('PharmacyName:', d.pharmacyName);
      console.log('ProfileComplete:', d.pharmaProfileComplete);
    } else {
      console.log('Firestore doc nem letezik!');
    }
  } catch (e) {
    console.log('Nem letezik:', e.code);
  }
  process.exit(0);
}

check();
