/**
 * ServiceFeedPosts létrehozása a migrált pharmaDemands-ból
 * 
 * Ez a script végigmegy a migrált igényeken és létrehozza 
 * a megfelelő serviceFeedPosts bejegyzéseket a hírfolyamhoz.
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

async function createServiceFeedPosts() {
  console.log('\n📋 ServiceFeedPosts létrehozása a migrált igényekhez...\n');
  
  // Migrált igények lekérése
  const demandsSnap = await db.collection('pharmaDemands')
    .where('migratedFrom', '==', 'wordpress')
    .get();
  
  console.log(`Migrált igények: ${demandsSnap.size}\n`);
  
  let created = 0;
  let skipped = 0;
  
  for (const demandDoc of demandsSnap.docs) {
    const demand = demandDoc.data();
    const demandId = demandDoc.id;
    
    // Ellenőrizzük, hogy már van-e serviceFeedPost ehhez az igényhez
    const existingPost = await db.collection('serviceFeedPosts')
      .where('pharmaDemandId', '==', demandId)
      .get();
    
    if (!existingPost.empty) {
      console.log(`⏭️  Már létezik: ${demand.wpTitle || demandId}`);
      skipped++;
      continue;
    }
    
    // Lekérjük a gyógyszertár (user) adatait
    const userId = demand.userId;
    let pharmacyData = {};
    
    if (userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        pharmacyData = userDoc.data();
      }
    }
    
    // Dátum feldolgozás
    let dateStr = '';
    if (demand.date) {
      if (demand.date.toDate) {
        dateStr = demand.date.toDate().toISOString().split('T')[0];
      } else if (typeof demand.date === 'string') {
        dateStr = demand.date;
      }
    }
    
    // Position meghatározás
    const position = demand.role || 'pharmacist';
    const positionLabel = position === 'pharmacist' ? 'Gyógyszerész' : 'Szakasszisztens';
    
    // Pharmacy adatok
    const pharmacyName = pharmacyData.pharmacyName || pharmacyData.name || demand.wpTitle?.split(' - ')[0] || 'Gyógyszertár';
    const pharmacyCity = pharmacyData.pharmacyCity || pharmacyData.city || '';
    const pharmacyZipCode = pharmacyData.pharmacyZipCode || pharmacyData.zipCode || '';
    const pharmacyStreet = pharmacyData.pharmacyStreet || pharmacyData.address || '';
    const pharmacyHouseNumber = pharmacyData.pharmacyHouseNumber || '';
    const pharmacyFullAddress = `${pharmacyZipCode} ${pharmacyCity}, ${pharmacyStreet} ${pharmacyHouseNumber}`.trim();
    const pharmacyPhotoURL = pharmacyData.photoURL || pharmacyData.pharmaPhotoURL || '';
    
    // ServiceFeedPost létrehozása
    const feedPost = {
      postType: 'pharmaDemand',
      module: 'pharmagister',
      pharmaDemandId: demandId,
      pharmacyId: userId,
      pharmacyName: pharmacyName,
      pharmacyCity: pharmacyCity,
      pharmacyZipCode: pharmacyZipCode,
      pharmacyStreet: pharmacyStreet,
      pharmacyHouseNumber: pharmacyHouseNumber,
      pharmacyFullAddress: pharmacyFullAddress,
      pharmacyPhotoURL: pharmacyPhotoURL,
      position: position,
      positionLabel: positionLabel,
      workHours: demand.workHours || '',
      minExperience: demand.minExperience || '',
      requiredSoftware: demand.requiredSoftware || '',
      otherSoftware: demand.otherSoftware || '',
      maxHourlyRate: demand.maxHourlyRate || null,
      additionalRequirements: demand.requirements || demand.additionalRequirements || '',
      date: dateStr,
      createdAt: demand.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      userId: userId,
      migratedFrom: 'wordpress'
    };
    
    await db.collection('serviceFeedPosts').add(feedPost);
    
    console.log(`✅ Létrehozva: ${pharmacyName} - ${dateStr} - ${positionLabel}`);
    created++;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 ÖSSZESÍTŐ:`);
  console.log(`   Létrehozva: ${created}`);
  console.log(`   Kihagyva (már létezett): ${skipped}`);
  console.log(`\n✅ ServiceFeedPosts létrehozás kész!`);
}

createServiceFeedPosts().then(() => process.exit(0)).catch(err => {
  console.error('Hiba:', err);
  process.exit(1);
});
