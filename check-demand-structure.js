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

async function checkDemandStructure() {
  console.log('\n🔍 Demand struktúra ellenőrzése...\n');
  
  // Egy migrált igény
  const migratedSnap = await db.collection('pharmaDemands').where('migratedFrom', '==', 'wordpress').limit(1).get();
  
  // Egy eredeti igény (ha van)
  const originalSnap = await db.collection('pharmaDemands').where('migratedFrom', '==', null).limit(1).get();
  
  console.log('=== MIGRÁLT IGÉNY ===');
  if (!migratedSnap.empty) {
    const data = migratedSnap.docs[0].data();
    console.log(JSON.stringify(data, null, 2));
  }
  
  console.log('\n=== EREDETI IGÉNY (ha van) ===');
  if (!originalSnap.empty) {
    const data = originalSnap.docs[0].data();
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('Nincs eredeti igény a rendszerben');
  }
}

checkDemandStructure().then(() => process.exit(0));
