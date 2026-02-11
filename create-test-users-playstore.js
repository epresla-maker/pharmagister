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
const auth = admin.auth();

// Test users for Google Play Store review
const testUsers = [
  {
    email: 'teszt.patika@pharmagister.hu',
    password: 'PlayStore2026!',
    userData: {
      name: 'Teszt Patika',
      displayName: 'Teszt Patika',
      pharmagisterRole: 'pharmacy',
      pharmaProfileComplete: true,
      emailVerified: true,
      phone: '+36301112233',
      city: 'Budapest',
      postalCode: '1052',
      pharmacyName: 'Teszt Központi Patika',
      address: 'Budapest, Deák Ferenc utca 1.',
      bio: 'Teszt fiók a Google Play ellenőrzéshez. Gyógyszertár - helyettesítőt keres.',
      privacyAcceptedAt: new Date().toISOString(),
    }
  },
  {
    email: 'teszt.gyogyszeresz@pharmagister.hu',
    password: 'PlayStore2026!',
    userData: {
      name: 'Dr. Teszt György',
      displayName: 'Dr. Teszt György',
      pharmagisterRole: 'pharmacist',
      pharmaProfileComplete: true,
      emailVerified: true,
      phone: '+36301234567',
      city: 'Budapest',
      postalCode: '1134',
      bio: 'Teszt fiók a Google Play ellenőrzéshez. Gyógyszerész - helyettesítésre jelentkezik.',
      experience: '15 év tapasztalat',
      availableForSubstitution: true,
      privacyAcceptedAt: new Date().toISOString(),
    }
  },
  {
    email: 'teszt.asszisztens@pharmagister.hu',
    password: 'PlayStore2026!',
    userData: {
      name: 'Tesztelő Anna',
      displayName: 'Tesztelő Anna',
      pharmagisterRole: 'assistant',
      pharmaProfileComplete: true,
      emailVerified: true,
      phone: '+36309876543',
      city: 'Budapest',
      postalCode: '1134',
      bio: 'Teszt fiók a Google Play ellenőrzéshez. Szakasszisztens - helyettesítésre jelentkezik.',
      experience: '8 év tapasztalat',
      availableForSubstitution: true,
      privacyAcceptedAt: new Date().toISOString(),
    }
  }
];

async function createTestUsers() {
  console.log('=== PLAY STORE TESZT FELHASZNÁLÓK LÉTREHOZÁSA ===\n');

  for (const user of testUsers) {
    try {
      // Check if user already exists
      let authUser;
      try {
        authUser = await auth.getUserByEmail(user.email);
        console.log(`⚠️  ${user.email} már létezik (uid: ${authUser.uid})`);
        
        // Update Firestore anyway
        await db.collection('users').doc(authUser.uid).set({
          ...user.userData,
          email: user.email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        
        console.log(`   Firestore adatok frissítve`);
        
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Create new user
          authUser = await auth.createUser({
            email: user.email,
            password: user.password,
            displayName: user.userData.displayName,
            emailVerified: true,
          });
          
          console.log(`✅ ${user.email} létrehozva (uid: ${authUser.uid})`);
          
          // Create Firestore document
          await db.collection('users').doc(authUser.uid).set({
            ...user.userData,
            email: user.email,
            createdAt: new Date().toISOString(),
          });
          
          console.log(`   Firestore dokumentum létrehozva`);
        } else {
          throw error;
        }
      }

      console.log(`   Szerepkör: ${user.userData.pharmagisterRole}`);
      console.log(`   Jelszó: ${user.password}`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Hiba ${user.email} létrehozásakor:`, error.message);
    }
  }

  console.log('\n=== PLAY STORE ELLENŐRZÉSHEZ HASZNÁLHATÓ FIÓKOK ===\n');
  console.log('1. Gyógyszertár (helyettesítést keres):');
  console.log('   Email: teszt.patika@pharmagister.hu');
  console.log('   Jelszó: PlayStore2026!');
  console.log('');
  console.log('2. Gyógyszerész (helyettesítésre jelentkezik):');
  console.log('   Email: teszt.gyogyszeresz@pharmagister.hu');
  console.log('   Jelszó: PlayStore2026!');
  console.log('');
  console.log('3. Szakasszisztens (helyettesítésre jelentkezik):');
  console.log('   Email: teszt.asszisztens@pharmagister.hu');
  console.log('   Jelszó: PlayStore2026!');
  console.log('');
  console.log('Ezeket add meg a Play Console-ban!');
}

createTestUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Hiba:', err);
    process.exit(1);
  });
