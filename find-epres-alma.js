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

async function findEpresAlma() {
  console.log('\n🔍 "Epres Alma" keresése a users collection-ben...\n');
  
  const snap = await db.collection('users').get();
  
  for (const d of snap.docs) {
    const data = d.data();
    const allText = JSON.stringify(data).toLowerCase();
    
    if (allText.includes('epres alma') || allText.includes('epres béluci') || 
        (allText.includes('epres') && data.pharmagisterRole === 'pharmacy')) {
      console.log('🎯 TALÁLAT:');
      console.log('   ID:', d.id);
      console.log('   Név:', data.name || data.displayName);
      console.log('   Email:', data.email);
      console.log('   Pharmagister Role:', data.pharmagisterRole);
      console.log('   pharmacyName:', data.pharmacyName);
      console.log('   ---');
    }
  }
  
  // Keressük a demands-ban is a userId alapján
  console.log('\n📋 Az epresla@icloud.com (AcBMMwkqMvWAjrodNPPBjFdjjhw2) igényei:');
  const demandSnap = await db.collection('pharmaDemands').get();
  demandSnap.docs.forEach(d => {
    const data = d.data();
    if (data.userId === 'AcBMMwkqMvWAjrodNPPBjFdjjhw2' || 
        data.pharmacyId === 'AcBMMwkqMvWAjrodNPPBjFdjjhw2' ||
        data.ownerId === 'AcBMMwkqMvWAjrodNPPBjFdjjhw2') {
      console.log('   -', d.id, '|', data.wpTitle || data.title || 'N/A');
    }
  });
}

findEpresAlma().then(() => process.exit(0));
