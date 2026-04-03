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
  const subs = await db.collection('pushSubscriptions').limit(10).get();
  console.log('Sample subscriptions:\n');
  for (const doc of subs.docs) {
    const data = doc.data();
    console.log('Doc ID:', doc.id);
    console.log('UserId:', data.userId);
    console.log('Platform:', data.platform);
    console.log('Has endpoint:', !!data.endpoint);
    console.log('Has keys:', !!data.keys);
    console.log('Has subscription obj:', !!data.subscription);
    if (data.subscription) {
      console.log('  subscription.token:', data.subscription.token ? 'YES' : 'NO');
      console.log('  subscription.endpoint:', data.subscription.endpoint ? data.subscription.endpoint.substring(0,40) + '...' : 'NO');
    }
    console.log('---\n');
  }
}

main().then(() => process.exit(0)).catch(console.error);
