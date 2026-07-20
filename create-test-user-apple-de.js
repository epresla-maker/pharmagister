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

const testUser = {
  email: 'review.de@pharmagister.hu',
  password: 'ReviewDe2026!',
  userData: {
    name: 'Review DE Pharma',
    displayName: 'Review DE Pharma',
    pharmagisterRole: 'pharmacist',
    pharmaProfileComplete: true,
    emailVerified: true,
    market: 'de',
    phone: '+4915112345678',
    city: 'Berlin',
    postalCode: '10115',
    bio: 'Apple review DE test account.',
    privacyAcceptedAt: new Date().toISOString(),
    passwordActivated: true,
  }
};

async function createOrUpdateDeReviewUser() {
  console.log('Creating/updating DE Apple review test user...');

  let uid;
  try {
    const existing = await auth.getUserByEmail(testUser.email);
    uid = existing.uid;

    await auth.updateUser(uid, {
      password: testUser.password,
      displayName: testUser.userData.displayName,
      emailVerified: true,
    });

    console.log(`Updated Auth user: ${testUser.email} (${uid})`);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error;
    }

    const authUser = await auth.createUser({
      email: testUser.email,
      password: testUser.password,
      displayName: testUser.userData.displayName,
      emailVerified: true,
    });

    uid = authUser.uid;
    console.log(`Created Auth user: ${testUser.email} (${uid})`);
  }

  await db.collection('users').doc(uid).set({
    ...testUser.userData,
    email: testUser.email,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }, { merge: true });

  console.log('Updated Firestore profile.');
  console.log('--- REVIEW CREDENTIALS ---');
  console.log(`Email: ${testUser.email}`);
  console.log(`Password: ${testUser.password}`);
  console.log('Market: de');
}

createOrUpdateDeReviewUser()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
