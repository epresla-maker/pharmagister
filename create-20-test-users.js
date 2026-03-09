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

async function createTestUsers() {
  console.log('=== 20 SZAKASSZISZTENS TESZT FELHASZNÁLÓ LÉTREHOZÁSA ===\n');

  for (let i = 1; i <= 20; i++) {
    const email = `${i}@${i}.com`;
    const password = `Betti@${i}${i}`;
    const name = `${i}`;

    try {
      let authUser;
      try {
        authUser = await auth.getUserByEmail(email);
        console.log(`⚠️  ${email} már létezik (uid: ${authUser.uid})`);

        await db.collection('users').doc(authUser.uid).set({
          name,
          displayName: name,
          email,
          pharmagisterRole: 'assistant',
          pharmaProfileComplete: true,
          emailVerified: true,
          passwordActivated: true,
          passwordActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
          phone: `+3630000000${String(i).padStart(2, '0')}`,
          city: 'Budapest',
          postalCode: '1134',
          bio: `Szakasszisztens teszt felhasználó #${i}`,
          experience: `${i} év tapasztalat`,
          availableForSubstitution: true,
          privacyAcceptedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        console.log(`   Firestore adatok frissítve`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          authUser = await auth.createUser({
            email,
            password,
            displayName: name,
            emailVerified: true,
          });

          console.log(`✅ ${name} létrehozva (uid: ${authUser.uid})`);

          await db.collection('users').doc(authUser.uid).set({
            name,
            displayName: name,
            email,
            pharmagisterRole: 'assistant',
            pharmaProfileComplete: true,
            emailVerified: true,
            passwordActivated: true,
            passwordActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            phone: `+3630000000${String(i).padStart(2, '0')}`,
            city: 'Budapest',
            postalCode: '1134',
            bio: `Szakasszisztens teszt felhasználó #${i}`,
            experience: `${i} év tapasztalat`,
            availableForSubstitution: true,
            privacyAcceptedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });

          console.log(`   Firestore dokumentum létrehozva`);
        } else {
          throw error;
        }
      }

      console.log(`   Email: ${email} | Jelszó: ${password}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Hiba ${email} létrehozásakor:`, error.message);
    }
  }

  console.log('\n=== ÖSSZESÍTÉS ===\n');
  for (let i = 1; i <= 20; i++) {
    console.log(`  ${String(i).padStart(2, ' ')}. Név: ${i}  |  Email: ${i}@${i}.com  |  Jelszó: Betti@${i}${i}`);
  }
  console.log('\n  Szerepkör: szakasszisztens (assistant)');
  console.log('  Minden felhasználó aktivált és teljes profillal rendelkezik.');
}

createTestUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Hiba:', err);
    process.exit(1);
  });
