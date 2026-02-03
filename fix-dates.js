/**
 * Migrált igények dátum formátum javítása
 * 
 * A frontend "YYYY-MM-DD" string formátumot vár a date mezőben,
 * de a migráció Timestamp-ként mentette.
 */

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

async function fixDates() {
  console.log('\n🔧 Migrált igények dátum formátum javítása...\n');
  
  // pharmaDemands javítása
  const demandsSnap = await db.collection('pharmaDemands').where('migratedFrom', '==', 'wordpress').get();
  console.log(`PharmaDemands: ${demandsSnap.size} dokumentum\n`);
  
  let fixed = 0;
  for (const docSnap of demandsSnap.docs) {
    const data = docSnap.data();
    
    // Ha a date Timestamp típusú, konvertáljuk string-re
    if (data.date && typeof data.date.toDate === 'function') {
      const dateObj = data.date.toDate();
      const dateString = dateObj.toISOString().split('T')[0]; // "YYYY-MM-DD"
      
      await docSnap.ref.update({ date: dateString });
      console.log(`✅ pharmaDemands/${docSnap.id}: ${dateString}`);
      fixed++;
    }
  }
  
  console.log(`\nPharmaDemands javítva: ${fixed}`);
  
  // serviceFeedPosts javítása is
  const feedSnap = await db.collection('serviceFeedPosts').where('migratedFrom', '==', 'wordpress').get();
  console.log(`\nServiceFeedPosts: ${feedSnap.size} dokumentum\n`);
  
  let feedFixed = 0;
  for (const docSnap of feedSnap.docs) {
    const data = docSnap.data();
    
    // Ha a date Timestamp típusú, konvertáljuk string-re
    if (data.date && typeof data.date.toDate === 'function') {
      const dateObj = data.date.toDate();
      const dateString = dateObj.toISOString().split('T')[0];
      
      await docSnap.ref.update({ date: dateString });
      console.log(`✅ serviceFeedPosts/${docSnap.id}: ${dateString}`);
      feedFixed++;
    } else if (!data.date || data.date === '') {
      // Ha nincs date, próbáljuk meg a wpTitle-ből kinyerni
      const wpTitle = data.wpTitle || '';
      const dateMatch = wpTitle.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        await docSnap.ref.update({ date: dateMatch[1] });
        console.log(`✅ serviceFeedPosts/${docSnap.id}: ${dateMatch[1]} (wpTitle-ből)`);
        feedFixed++;
      }
    }
  }
  
  console.log(`\nServiceFeedPosts javítva: ${feedFixed}`);
  console.log('\n✅ Dátum javítás kész!');
}

fixDates().then(() => process.exit(0)).catch(err => {
  console.error('Hiba:', err);
  process.exit(1);
});
