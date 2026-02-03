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

async function check() {
  console.log('📅 Migrált igények ellenőrzése...\n');
  
  // Migrált igények
  const migrated = await db.collection('pharmaDemands').where('migratedFrom', '==', 'wordpress').get();
  
  console.log(`Migrált igények: ${migrated.size}\n`);
  
  migrated.docs.slice(0, 5).forEach(doc => {
    const d = doc.data();
    console.log('ID:', doc.id);
    console.log('  date:', d.date, '| type:', typeof d.date);
    console.log('  status:', d.status);
    console.log('  pharmacyId:', d.pharmacyId);
    console.log('  pharmacyName:', d.pharmacyName);
    console.log('---');
  });
  
  // Összes open státuszú igény
  console.log('\n📊 Összes open státuszú igény:');
  const openDemands = await db.collection('pharmaDemands').where('status', '==', 'open').get();
  console.log(`Open demands: ${openDemands.size}`);
  
  openDemands.docs.slice(0, 3).forEach(doc => {
    const d = doc.data();
    console.log('  -', d.pharmacyName, '|', d.date, '| status:', d.status);
  });
}

check().then(() => process.exit(0));
