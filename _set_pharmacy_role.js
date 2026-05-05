const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: key,
    }),
  });
}
const db = admin.firestore();

async function main() {
  const uid = 'P3qEbZaHephgqkpOIBOkcBqL35c2';
  await db.collection('users').doc(uid).update({ pharmagisterRole: 'pharmacy' });
  console.log('Szerepkör frissítve: pharmacy');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
