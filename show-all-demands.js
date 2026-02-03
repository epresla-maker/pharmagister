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

async function showAllDemands() {
  console.log('\n📋 ÖSSZES pharmaDemands igény részletesen:\n');
  
  const allDemands = await db.collection('pharmaDemands').get();
  
  for (const d of allDemands.docs) {
    const data = d.data();
    const date = data.date?.toDate?.()?.toISOString?.()?.split('T')[0] || 'N/A';
    const created = data.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || 'N/A';
    
    console.log('─'.repeat(60));
    console.log('ID:', d.id);
    console.log('Title:', data.wpTitle || data.title || 'N/A');
    console.log('userId:', data.userId || 'NINCS');
    console.log('ownerId:', data.ownerId || 'NINCS');
    console.log('pharmacyId:', data.pharmacyId || 'NINCS');
    console.log('Date:', date);
    console.log('Created:', created);
    console.log('Migrált:', data.migratedFrom || 'NEM');
  }
  
  console.log('\n─'.repeat(60));
  console.log('Összesen:', allDemands.size, 'igény');
}

showAllDemands().then(() => process.exit(0));
