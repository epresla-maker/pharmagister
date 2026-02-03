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

async function deleteDemands() {
  console.log('\n🔍 epresla@icloud.com igényeinek keresése...\n');
  
  const snap = await db.collection('pharmaDemands').where('userId', '==', userId).get();
  console.log('Talált igények:', snap.size);
  
  if (snap.empty) {
    console.log('Nincs törlendő igény.');
    return;
  }
  
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log('🗑️  Törlés:', doc.id, '-', data.wpTitle || data.date?.toDate?.() || 'N/A');
    await doc.ref.delete();
  }
  
  console.log('\n✅ Összes igény törölve!');
}

deleteDemands().then(() => process.exit(0));
