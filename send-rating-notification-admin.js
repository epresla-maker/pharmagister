const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require(process.env.HOME + '/Downloads/pharmacare-dfa3c-firebase-adminsdk-fbsvc-569047f165.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function sendNotification() {
  // Find admin user
  const userQuery = await db.collection('users').where('email', '==', 'epresla@icloud.com').limit(1).get();
  if (userQuery.empty) {
    console.log('❌ Admin nem található');
    process.exit(1);
  }
  const adminUser = userQuery.docs[0];
  console.log('✅ Admin:', adminUser.id);
  
  // Create notification
  await db.collection('notifications').add({
    userId: adminUser.id,
    type: 'rating_request',
    title: 'Értékeld a helyettesítőt',
    body: 'Értékelés Teszt készen áll az értékelésre. Kérjük, értékeld a munkáját!',
    data: {
      demandId: 'test-demand-for-rating',
      substituteId: 'test-rated-pharmacist-001',
      substituteName: 'Értékelés Teszt'
    },
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('✅ In-app értesítés elküldve');
  
  // Check for push subscription
  const pushQuery = await db.collection('pushSubscriptions').where('userId', '==', adminUser.id).get();
  if (!pushQuery.empty) {
    const sub = pushQuery.docs[0].data();
    if (sub.fcmToken) {
      try {
        await admin.messaging().send({
          token: sub.fcmToken,
          notification: {
            title: 'Értékeld a helyettesítőt',
            body: 'Értékelés Teszt készen áll az értékelésre!'
          },
          webpush: {
            fcmOptions: { link: '/ertekeles/test-demand-for-rating' }
          }
        });
        console.log('✅ Push értesítés elküldve');
      } catch (e) {
        console.log('⚠️ Push hiba:', e.message);
      }
    }
  } else {
    console.log('ℹ️ Nincs push subscription');
  }
  
  console.log('\n🎉 Kész!');
  console.log('🔗 Értékelő oldal: /ertekeles/test-demand-for-rating');
  console.log('👤 Profil: /profil/test-rated-pharmacist-001');
  process.exit(0);
}

sendNotification().catch(e => { console.error(e); process.exit(1); });
