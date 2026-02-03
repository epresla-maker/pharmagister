require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

(async () => {
  console.log('🔍 Összes igény listázása (pharmaDemands)...\n');
  
  // List all demands from pharmaDemands collection
  const snapshot = await db.collection('pharmaDemands').get();
  console.log('Összes igény (' + snapshot.size + ' db):\n');
  
  let foundId = null;
  
  for (const doc of snapshot.docs) {
    const d = doc.data();
    const info = doc.id + ': ' + (d.pharmacyName || d.userName || 'N/A') + ' - ' + (d.requirements || d.description || d.note || 'N/A');
    console.log(info);
    
    // Check if this is the one we're looking for
    if (d.requirements === 'Admin próba ne jelentkezz' || 
        d.description === 'Admin próba ne jelentkezz' ||
        d.note === 'Admin próba ne jelentkezz') {
      foundId = doc.id;
      console.log('  ^^^ EZT TÖRLÖM ^^^');
    }
  }
  
  if (foundId) {
    console.log('\n🗑️  Törlés: ' + foundId);
    await db.collection('pharmaDemands').doc(foundId).delete();
    console.log('✅ Törölve!');
  } else {
    console.log('\n❌ Nem találtam "Admin próba ne jelentkezz" igényt');
  }
  
  process.exit(0);
})();
