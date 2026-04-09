const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require(process.env.HOME + '/Downloads/pharmacare-dfa3c-firebase-adminsdk-fbsvc-569047f165.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function renameTestUser() {
  const userId = 'test-rated-pharmacist-001';
  
  await db.collection('users').doc(userId).update({
    displayName: 'Értékelés Teszt',
    name: 'Értékelés Teszt'
  });
  
  console.log('✅ Profil átnevezve: Értékelés Teszt');
  console.log('   User ID:', userId);
  process.exit(0);
}

renameTestUser();
