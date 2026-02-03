/**
 * Firebase Migráció Ellenőrzés
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

async function check() {
  console.log('\n📊 FIREBASE MIGRÁCIÓ ELLENŐRZÉS\n');
  console.log('='.repeat(50));
  
  // Migrált felhasználók
  const usersSnap = await db.collection('users').where('migratedFrom', '==', 'wordpress').get();
  console.log('\n👥 FELHASZNÁLÓK:');
  console.log('   Migrált felhasználók összesen:', usersSnap.size);
  
  // Szerepkörök számolás
  let pharmacist = 0, assistant = 0, pharmacy = 0, noRole = 0;
  usersSnap.docs.forEach(d => {
    const role = d.data().pharmagisterRole;
    if (role === 'pharmacist') pharmacist++;
    else if (role === 'assistant') assistant++;
    else if (role === 'pharmacy') pharmacy++;
    else noRole++;
  });
  
  console.log('   - Gyógyszerész (pharmacist):', pharmacist);
  console.log('   - Szakasszisztens (assistant):', assistant);
  console.log('   - Gyógyszertár (pharmacy):', pharmacy);
  console.log('   - Nincs szerepkör:', noRole);
  
  // Igények
  const demandsSnap = await db.collection('pharmaDemands').where('migratedFrom', '==', 'wordpress').get();
  console.log('\n📋 IGÉNYEK:');
  console.log('   Migrált igények összesen:', demandsSnap.size);
  
  // Igények szerepkör szerint
  let demPharm = 0, demAssist = 0;
  demandsSnap.docs.forEach(d => {
    if (d.data().role === 'pharmacist') demPharm++;
    else demAssist++;
  });
  console.log('   - Gyógyszerész keresés:', demPharm);
  console.log('   - Szakasszisztens keresés:', demAssist);
  
  // Példa felhasználók
  console.log('\n👤 PÉLDA MIGRÁLT FELHASZNÁLÓK:');
  usersSnap.docs.slice(0, 5).forEach(d => {
    const data = d.data();
    console.log(`   ✓ ${data.email} | ${data.name} | ${data.pharmagisterRole || 'nincs role'}`);
  });
  
  // Példa igények
  console.log('\n📝 MIGRÁLT IGÉNYEK:');
  demandsSnap.docs.forEach(d => {
    const data = d.data();
    const date = data.date ? data.date.toDate().toISOString().split('T')[0] : 'N/A';
    console.log(`   ✓ ${data.wpTitle} | ${date}`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Ellenőrzés kész!\n');
}

check().then(() => process.exit(0)).catch(err => {
  console.error('Hiba:', err);
  process.exit(1);
});
