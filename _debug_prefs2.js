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
  const allPrefs = await db.collection('schedulePreferences').get();
  allPrefs.forEach(d => console.log(JSON.stringify({ id: d.id, ...d.data() })));
}
main().catch(console.error).finally(() => process.exit());
