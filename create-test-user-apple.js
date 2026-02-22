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

// Test users for Apple App Store review
const testUsers = [
  {
    email: 'teszt.review@pharmagister.hu',
    password: 'AppleReview2026!',
    userData: {
      name: 'Teszt Gyógyszerész',
      displayName: 'Teszt Gyógyszerész',
      pharmagisterRole: 'pharmacist',
      pharmaProfileComplete: true,
      emailVerified: true,
      phone: '+36301234567',
      city: 'Budapest',
      postalCode: '1052',
      bio: 'Apple Review teszt fiók. Gyógyszerész - helyettesítést vállal.',
      privacyAcceptedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
  }
];

async function createTestUsers() {
  console.log('🍎 Apple Review teszt felhasználó létrehozása...\n');

  for (const testUser of testUsers) {
    try {
      // Check if user already exists
      try {
        const existing = await auth.getUserByEmail(testUser.email);
        console.log(`⚠️  ${testUser.email} már létezik (uid: ${existing.uid}), frissítés...`);
        
        // Update password
        await auth.updateUser(existing.uid, { password: testUser.password });
        
        // Update Firestore
        await db.collection('users').doc(existing.uid).set({
          ...testUser.userData,
          email: testUser.email,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        
        console.log(`✅ ${testUser.email} frissítve`);
        continue;
      } catch (e) {
        // User doesn't exist, create new
      }

      const authUser = await auth.createUser({
        email: testUser.email,
        password: testUser.password,
        displayName: testUser.userData.displayName,
        emailVerified: true,
      });

      await db.collection('users').doc(authUser.uid).set({
        ...testUser.userData,
        email: testUser.email,
        createdAt: new Date().toISOString(),
      });

      console.log(`✅ ${testUser.email} létrehozva (uid: ${authUser.uid})`);
    } catch (error) {
      console.error(`❌ Hiba ${testUser.email}:`, error.message);
    }
  }

  console.log('\n📋 Apple Review Notes for Reviewer:');
  console.log('─'.repeat(50));
  console.log('Demo Account:');
  console.log(`  Email: ${testUsers[0].email}`);
  console.log(`  Password: ${testUsers[0].password}`);
  console.log('');
  console.log('This is a pharmacy shift substitution platform');
  console.log('for Hungarian pharmacists. The test account has');
  console.log('a pre-configured pharmacist profile to explore');
  console.log('all features of the app.');
  console.log('─'.repeat(50));
}

createTestUsers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
