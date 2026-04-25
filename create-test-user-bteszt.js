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

const TEST_USER = {
  email: 'bteszt@pharmagister.hu',
  password: 'Bteszt2026!',
  userData: {
    name: 'bteszt',
    displayName: 'bteszt',
    role: 'pharmacist',
    pharmagisterRole: 'pharmacist',
    pharmaProfileComplete: true,
    emailVerified: true,
    phone: '+36301110000',
    city: 'Budapest',
    postalCode: '1052',
    bio: 'Belső teszt gyógyszerész fiók a beosztáskezelő modulhoz.',
    availableForSubstitution: true,
    privacyAcceptedAt: new Date().toISOString(),
  }
};

async function createOrUpdateTestUser() {
  console.log('Teszt felhasznalo letrehozasa/frissitese: bteszt');

  try {
    let authUser;

    try {
      authUser = await auth.getUserByEmail(TEST_USER.email);
      await auth.updateUser(authUser.uid, {
        password: TEST_USER.password,
        displayName: TEST_USER.userData.displayName,
        emailVerified: true,
      });
      console.log(`Meglevo user frissitve (${authUser.uid})`);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }

      authUser = await auth.createUser({
        email: TEST_USER.email,
        password: TEST_USER.password,
        displayName: TEST_USER.userData.displayName,
        emailVerified: true,
      });
      console.log(`Uj user letrehozva (${authUser.uid})`);
    }

    await db.collection('users').doc(authUser.uid).set({
      ...TEST_USER.userData,
      email: TEST_USER.email,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }, { merge: true });

    console.log('Firestore user dokumentum frissitve.');
    console.log('---');
    console.log(`Email: ${TEST_USER.email}`);
    console.log(`Jelszo: ${TEST_USER.password}`);
    console.log('Szerepkor: pharmacist');
  } catch (error) {
    console.error('Hiba a teszt user letrehozasa kozben:', error.message);
    process.exit(1);
  }
}

createOrUpdateTestUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Varatlan hiba:', err);
    process.exit(1);
  });
