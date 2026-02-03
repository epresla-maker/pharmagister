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

async function showUserFull() {
  console.log('\n📄 epresla@icloud.com TELJES user dokumentum:\n');
  
  const doc = await db.collection('users').doc('AcBMMwkqMvWAjrodNPPBjFdjjhw2').get();
  const data = doc.data();
  
  console.log(JSON.stringify(data, null, 2));
}

showUserFull().then(() => process.exit(0));
