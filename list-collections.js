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

async function listAllCollections() {
  console.log('\n📋 ÖSSZES FIRESTORE COLLECTION:\n');
  
  const collections = await db.listCollections();
  
  for (const coll of collections) {
    const snap = await coll.get();
    console.log(`${coll.id}: ${snap.size} dokumentum`);
    
    // Ha kevés dokumentum van, listázzuk őket
    if (snap.size <= 30 && snap.size > 0) {
      snap.docs.slice(0, 5).forEach(d => {
        const data = d.data();
        const preview = data.title || data.name || data.email || data.wpTitle || d.id;
        console.log(`   - ${preview.substring(0, 50)}`);
      });
      if (snap.size > 5) console.log(`   ... és még ${snap.size - 5} további`);
    }
  }
}

listAllCollections().then(() => process.exit(0));
