require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
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
  const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(5).get();
  snap.docs.forEach(doc => {
    const d = doc.data();
    const created = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : d.createdAt;
    console.log(`${created} | ${d.email || 'n/a'} | ${d.displayName || d.name || 'n/a'} | role: ${d.pharmagisterRole || '-'}`);
  });
  process.exit(0);
}
main();
