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

async function deleteNonMigrated() {
  console.log('\n🔍 Nem migrált igények törlése...\n');
  
  const snap = await db.collection('pharmaDemands').get();
  console.log('Összes igény:', snap.size);
  
  let deleted = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    // Ha nincs migratedFrom mező, akkor régi teszt igény
    if (!data.migratedFrom) {
      console.log('🗑️  Törlés:', doc.id, '|', data.title || 'N/A');
      await doc.ref.delete();
      deleted++;
    }
  }
  
  console.log('\n✅', deleted, 'nem migrált igény törölve!');
  console.log('Maradt:', snap.size - deleted, 'WordPress-ből migrált igény');
}

deleteNonMigrated().then(() => process.exit(0));
