require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}
const db = getFirestore();

async function main() {
  const sub = await db.collection('pushSubscriptions').doc('aR2Sv8p1Z02gnrnPGUuj').get();
  if (!sub.exists) {
    console.log('Not found');
    return;
  }
  console.log('Full subscription data:');
  console.log(JSON.stringify(sub.data(), null, 2));
}

main().then(() => process.exit(0)).catch(console.error);
