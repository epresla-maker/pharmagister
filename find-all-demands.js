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
const userId = 'AcBMMwkqMvWAjrodNPPBjFdjjhw2'; // epresla@icloud.com

async function findAndDeleteDemands() {
  console.log('\n🔍 epresla@icloud.com ÖSSZES igényének keresése...\n');
  
  // Keresés minden collection-ben ahol igények lehetnek
  const collections = ['pharmaDemands', 'demands', 'posts'];
  
  for (const coll of collections) {
    try {
      const snap = await db.collection(coll).where('userId', '==', userId).get();
      if (!snap.empty) {
        console.log(`\n📋 ${coll} collection: ${snap.size} találat`);
        snap.docs.forEach(d => {
          const data = d.data();
          const date = data.date?.toDate?.()?.toISOString?.()?.split('T')[0] || 'N/A';
          console.log(`   - ${d.id} | ${date} | ${data.title || data.wpTitle || 'N/A'}`);
        });
      }
    } catch(e) {}
  }
  
  // Keressük ownerId-val is
  for (const coll of collections) {
    try {
      const snap = await db.collection(coll).where('ownerId', '==', userId).get();
      if (!snap.empty) {
        console.log(`\n📋 ${coll} (ownerId): ${snap.size} találat`);
        snap.docs.forEach(d => {
          const data = d.data();
          const date = data.date?.toDate?.()?.toISOString?.()?.split('T')[0] || 'N/A';
          console.log(`   - ${d.id} | ${date} | ${data.title || data.wpTitle || 'N/A'}`);
        });
      }
    } catch(e) {}
  }
  
  // Listázzuk az összes pharmaDemands-ot
  console.log('\n📋 ÖSSZES pharmaDemands igény:');
  const allDemands = await db.collection('pharmaDemands').get();
  console.log(`   Összesen: ${allDemands.size} igény`);
  
  allDemands.docs.slice(0, 10).forEach(d => {
    const data = d.data();
    console.log(`   - userId: ${data.userId?.substring(0,10)}... | ${data.wpTitle || data.title || 'N/A'}`);
  });
}

findAndDeleteDemands().then(() => process.exit(0));
