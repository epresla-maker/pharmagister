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
const pharmacyId = 'AcBMMwkqMvWAjrodNPPBjFdjjhw2'; // epresla@icloud.com

async function deleteOldDemands() {
  console.log('\n🔍 epresla@icloud.com RÉGI igényeinek törlése (pharmacyId alapján)...\n');
  
  const snap = await db.collection('pharmaDemands').where('pharmacyId', '==', pharmacyId).get();
  
  console.log('Talált régi igények:', snap.size);
  
  if (snap.empty) {
    console.log('Nincs törlendő igény.');
    return;
  }
  
  for (const doc of snap.docs) {
    console.log('🗑️  Törlés:', doc.id);
    await doc.ref.delete();
  }
  
  console.log('\n✅', snap.size, 'régi igény törölve!');
}

deleteOldDemands().then(() => process.exit(0));
