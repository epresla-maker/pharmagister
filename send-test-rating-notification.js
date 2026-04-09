// Teszt értékelési értesítés küldése az adminoknak
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require(process.env.HOME + '/Downloads/pharmacare-dfa3c-firebase-adminsdk-fbsvc-569047f165.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function sendTestRatingNotifications() {
  const ADMIN_EMAILS = ['epresla@icloud.com', 'etinatina22@gmail.com'];
  const TEST_PHARMACIST_ID = 'test-rated-pharmacist-001';
  
  console.log('🔍 Admin userek keresése...');
  
  // Admin userek keresése
  const adminUsers = [];
  for (const email of ADMIN_EMAILS) {
    const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!userQuery.empty) {
      const userData = userQuery.docs[0];
      adminUsers.push({ id: userData.id, ...userData.data() });
      console.log(`  ✅ ${email} -> ${userData.id}`);
    } else {
      console.log(`  ❌ ${email} nem található`);
    }
  }

  if (adminUsers.length === 0) {
    console.log('❌ Nem találtam admin usereket');
    process.exit(1);
  }

  // Teszt demand létrehozása (ha nincs)
  const testDemandId = 'test-demand-for-rating';
  const testDemandRef = db.collection('pharmaDemands').doc(testDemandId);
  const testDemandDoc = await testDemandRef.get();
  
  if (!testDemandDoc.exists) {
    console.log('\n📝 Teszt igény létrehozása...');
    await testDemandRef.set({
      pharmacyId: adminUsers[0].id, // Első admin mint gyógyszertár
      userId: adminUsers[0].id,
      status: 'completed',
      position: 'pharmacist',
      date: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)), // tegnap
      pharmacyName: 'Teszt Gyógyszertár',
      pharmacyCity: 'Budapest',
      acceptedApplicantId: TEST_PHARMACIST_ID,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('  ✅ Teszt igény létrehozva:', testDemandId);
  }

  // Értesítések küldése mindkét adminnak
  console.log('\n📬 Értesítések küldése...');
  
  for (const adminUser of adminUsers) {
    const notificationData = {
      userId: adminUser.id,
      type: 'rating_reminder',
      title: 'Értékeld a helyettesítőt!',
      body: 'Hogy dolgoztatok együtt? Értékeld Teszt Gyógyszerész munkáját!',
      url: `/ertekeles/${testDemandId}`,
      relatedId: testDemandId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('notifications').add(notificationData);
    console.log(`  ✅ Értesítés küldve: ${adminUser.email}`);
  }

  console.log('\n🎉 Kész! Az értesítések megjelennek az appban.');
  console.log('🔗 Értékelő oldal: /ertekeles/' + testDemandId);
  console.log('👤 Teszt profil: /profil/' + TEST_PHARMACIST_ID);

  process.exit(0);
}

sendTestRatingNotifications();
