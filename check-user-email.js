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

const email = process.argv[2] || 'epresla@icloud.com';

async function check() {
  console.log(`\n🔍 Ellenőrzés: ${email}\n`);
  console.log('='.repeat(50));
  
  // Firebase Auth
  try {
    const authUser = await auth.getUserByEmail(email);
    console.log('\n🔐 FIREBASE AUTH:');
    console.log('   UID:', authUser.uid);
    console.log('   Email:', authUser.email);
    console.log('   Név:', authUser.displayName);
    console.log('   Email verified:', authUser.emailVerified);
    console.log('   Létrehozva:', authUser.metadata.creationTime);
  } catch(e) {
    console.log('\n❌ Nem található Firebase Auth-ban');
  }
  
  // Firestore
  const snap = await db.collection('users').where('email', '==', email).get();
  console.log('\n📄 FIRESTORE USERS:');
  if (snap.empty) {
    console.log('   Nem található');
  } else {
    snap.docs.forEach(d => {
      const data = d.data();
      console.log('   Doc ID:', d.id);
      console.log('   Név:', data.name || data.displayName);
      console.log('   Role:', data.role);
      console.log('   Pharmagister role:', data.pharmagisterRole);
      console.log('   Migrált:', data.migratedFrom || 'NEM (eredeti user)');
      console.log('   WP User ID:', data.wpUserId || 'N/A');
    });
  }
  
  console.log('\n' + '='.repeat(50));
}

check().then(() => process.exit(0));
