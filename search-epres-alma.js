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

async function searchEpresAlma() {
  console.log('\n🔍 "Epres Alma" keresése az összes collection-ben...\n');
  
  // Összes főbb collection átnézése
  const collections = ['pharmaDemands', 'demands', 'posts', 'pharmacyDemands', 'serviceDemands'];
  
  for (const coll of collections) {
    try {
      const snap = await db.collection(coll).get();
      if (!snap.empty) {
        console.log(`\n📋 ${coll}: ${snap.size} dokumentum`);
        snap.docs.forEach(d => {
          const data = d.data();
          const str = JSON.stringify(data);
          if (str.toLowerCase().includes('epres') || str.toLowerCase().includes('alma')) {
            console.log('   🎯 TALÁLAT:', d.id);
            console.log('      ', data.title || data.wpTitle || data.pharmacyName || 'N/A');
          }
        });
      }
    } catch(e) {
      // collection nem létezik
    }
  }
  
  // Ellenőrizzük a users collection-t is az "Epres Alma Gyógyszertár" keresésre
  console.log('\n👤 Users collection - "Epres Alma" keresése:');
  const usersSnap = await db.collection('users').get();
  usersSnap.docs.forEach(d => {
    const data = d.data();
    const name = (data.name || data.displayName || data.pharmacyName || '').toLowerCase();
    if (name.includes('epres') && name.includes('alma')) {
      console.log('   🎯 TALÁLAT:', d.id);
      console.log('      Név:', data.name || data.displayName);
      console.log('      Email:', data.email);
    }
  });
}

searchEpresAlma().then(() => process.exit(0));
