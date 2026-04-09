// Teszt gyógyszerész profil létrehozása értékelésekkel
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require(process.env.HOME + '/Downloads/pharmacare-dfa3c-firebase-adminsdk-fbsvc-569047f165.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createTestRatedPharmacist() {
  // Teszt user ID
  const testUserId = 'test-rated-pharmacist-001';
  
  // Teszt profil adatok értékelésekkel
  const testUserData = {
    displayName: 'Teszt Gyógyszerész',
    email: 'teszt.gyogyszeresz@example.com',
    pharmagisterRole: 'pharmacist',
    pharmaProfileComplete: true,
    pharmaApproved: true,
    pharmaYearsOfExperience: 8,
    pharmaSoftwareKnowledge: ['Medworks', 'Receptura', 'NEAK'],
    pharmaHourlyRate: 4500,
    pharmaBio: 'Tapasztalt gyógyszerész vagyok, több mint 8 éves tapasztalattal. Rugalmas időbeosztással tudok segíteni helyettesítésben.',
    pharmacyCity: 'Budapest',
    
    // Értékelések - ez a fontos teszteléshez
    pharmaRating: {
      averageRating: 4.3,
      ratingCount: 3,
      wouldChooseAgainPercent: 85,
      ratings: {
        megbizhatas: 4.5,
        szakmaiTudas: 4.2,
        kommunikacio: 4.3
      }
    },
    
    // Privacy beállítások
    privacySettings: {
      substitute: {
        shareEmail: true,
        sharePhone: true,
        shareExperience: true,
        shareSoftwareKnowledge: true,
        shareHourlyRate: true,
        shareBio: true
      }
    },
    
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    // Létrehozzuk a user dokumentumot
    await db.collection('users').doc(testUserId).set(testUserData, { merge: true });
    
    console.log('✅ Teszt gyógyszerész profil létrehozva!');
    console.log('📌 User ID:', testUserId);
    console.log('🔗 Profil link: /profil/' + testUserId);
    console.log('\n📊 Értékelés adatok:');
    console.log('   - Átlag: 4.3 ⭐');
    console.log('   - Értékelések száma: 3');
    console.log('   - Újra választaná: 85%');
    console.log('   - Megbízhatóság: 4.5');
    console.log('   - Szakmai tudás: 4.2');
    console.log('   - Kommunikáció: 4.3');
    
  } catch (error) {
    console.error('❌ Hiba:', error);
  }
  
  process.exit(0);
}

createTestRatedPharmacist();
