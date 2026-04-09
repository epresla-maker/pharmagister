// Teszt gyógyszerész profil - értékelés eltávolítása
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require(process.env.HOME + '/Downloads/pharmacare-dfa3c-firebase-adminsdk-fbsvc-569047f165.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function removeRating() {
  const testUserId = 'test-rated-pharmacist-001';
  
  try {
    await db.collection('users').doc(testUserId).update({
      pharmaRating: admin.firestore.FieldValue.delete()
    });
    
    console.log('Ertekeles eltavolitva a teszt profilrol');
    console.log('Profil link: /profil/' + testUserId);
    
  } catch (error) {
    console.error('Hiba:', error);
  }
  
  process.exit(0);
}

removeRating();
