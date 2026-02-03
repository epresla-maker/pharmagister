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

async function checkDates() {
  console.log('\n🔍 Migrált igények dátum formátum ellenőrzése...\n');
  
  const snap = await db.collection('pharmaDemands').where('migratedFrom', '==', 'wordpress').limit(5).get();
  
  snap.docs.forEach(d => {
    const data = d.data();
    console.log('ID:', d.id);
    console.log('  date:', data.date, '| típus:', typeof data.date);
    if (data.date && data.date.toDate) {
      console.log('  date.toDate():', data.date.toDate());
    }
    console.log('  wpTitle:', data.wpTitle);
    console.log('---');
  });
}

checkDates().then(() => process.exit(0));
