/**
 * Migrált igények struktúra javítása
 * 
 * A frontend más mezőneveket vár, mint amit a migráció létrehozott.
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

async function fixDemandStructure() {
  console.log('\n🔧 Migrált igények struktúra javítása...\n');
  
  const demandsSnap = await db.collection('pharmaDemands').where('migratedFrom', '==', 'wordpress').get();
  console.log(`Igények: ${demandsSnap.size}\n`);
  
  let fixed = 0;
  
  for (const docSnap of demandsSnap.docs) {
    const data = docSnap.data();
    const userId = data.userId;
    
    if (!userId) {
      console.log(`⚠️  Nincs userId: ${docSnap.id}`);
      continue;
    }
    
    // Lekérjük a gyógyszertár adatait
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`⚠️  User nem található: ${userId}`);
      continue;
    }
    
    const userData = userDoc.data();
    
    // Gyógyszertár név - wpTitle-ből vagy user adatokból
    let pharmacyName = userData.pharmacyName || userData.name || userData.displayName;
    if (!pharmacyName && data.wpTitle) {
      // wpTitle formátum: "Gyógyszertár neve - 2026-02-22 - Gyógyszerész"
      pharmacyName = data.wpTitle.split(' - ')[0];
    }
    
    // Position meghatározás
    const position = data.role || 'pharmacist';
    
    // Teljes cím
    const fullAddress = `${userData.pharmacyZipCode || userData.zipCode || ''} ${userData.pharmacyCity || userData.city || ''}, ${userData.pharmacyStreet || userData.address || ''} ${userData.pharmacyHouseNumber || ''}`.trim();
    
    // Frissítendő mezők
    const updateData = {
      pharmacyId: userId,
      pharmacyName: pharmacyName || 'Gyógyszertár',
      pharmacyCity: userData.pharmacyCity || userData.city || '',
      pharmacyZipCode: userData.pharmacyZipCode || userData.zipCode || '',
      pharmacyStreet: userData.pharmacyStreet || userData.address || '',
      pharmacyHouseNumber: userData.pharmacyHouseNumber || '',
      pharmacyFullAddress: fullAddress,
      pharmacyPhotoURL: userData.photoURL || userData.pharmaPhotoURL || '',
      position: position,
      workHours: data.workHours || '',
      minExperience: data.minExperience || '',
      requiredSoftware: data.requiredSoftware || '',
      otherSoftware: data.otherSoftware || '',
      maxHourlyRate: data.maxHourlyRate || null,
      additionalRequirements: data.requirements || data.additionalRequirements || '',
      createdBy: userId,
      updatedAt: new Date().toISOString(),
    };
    
    await docSnap.ref.update(updateData);
    console.log(`✅ ${pharmacyName} - ${data.date} - ${position === 'pharmacist' ? 'Gyógyszerész' : 'Szakasszisztens'}`);
    fixed++;
  }
  
  console.log(`\n✅ ${fixed} igény javítva!`);
  
  // ServiceFeedPosts frissítése is
  console.log('\n🔧 ServiceFeedPosts frissítése...\n');
  
  const feedSnap = await db.collection('serviceFeedPosts').where('migratedFrom', '==', 'wordpress').get();
  
  for (const docSnap of feedSnap.docs) {
    const data = docSnap.data();
    const pharmaDemandId = data.pharmaDemandId;
    
    if (!pharmaDemandId) continue;
    
    // Frissített demand lekérése
    const demandDoc = await db.collection('pharmaDemands').doc(pharmaDemandId).get();
    if (!demandDoc.exists) continue;
    
    const demandData = demandDoc.data();
    
    // ServiceFeedPost frissítése a demand adataival
    await docSnap.ref.update({
      pharmacyId: demandData.pharmacyId,
      pharmacyName: demandData.pharmacyName,
      pharmacyCity: demandData.pharmacyCity,
      pharmacyZipCode: demandData.pharmacyZipCode,
      pharmacyStreet: demandData.pharmacyStreet,
      pharmacyHouseNumber: demandData.pharmacyHouseNumber,
      pharmacyFullAddress: demandData.pharmacyFullAddress,
      pharmacyPhotoURL: demandData.pharmacyPhotoURL,
      position: demandData.position,
      positionLabel: demandData.position === 'pharmacist' ? 'Gyógyszerész' : 'Szakasszisztens',
      userId: demandData.pharmacyId,
    });
  }
  
  console.log(`✅ ${feedSnap.size} serviceFeedPost frissítve!`);
  console.log('\n✅ Struktúra javítás kész!');
}

fixDemandStructure().then(() => process.exit(0)).catch(err => {
  console.error('Hiba:', err);
  process.exit(1);
});
