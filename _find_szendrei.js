const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: key,
    }),
  });
}
const db = admin.firestore();

async function main() {
  const snap = await db.collection('users').get();
  const results = snap.docs.filter(d => {
    const data = d.data();
    const name = (data.displayName || data.name || '').toLowerCase();
    const email = (data.email || '').toLowerCase();
    return name.includes('szendrei') || email.includes('szendrei');
  });
  if (!results.length) {
    console.log('Nem találtam szendrei felhasználót a users kollekcióban.');
  } else {
    results.forEach(d => {
      const data = d.data();
      console.log('UID:', d.id);
      console.log('Név:', data.displayName || data.name);
      console.log('Email:', data.email);
      console.log('Role:', data.pharmagisterRole || data.role);
      console.log('---');
    });
  }

  // Also check pharmacyEmployees
  const empSnap = await db.collection('pharmacyEmployees').get();
  const empResults = empSnap.docs.filter(d => {
    const data = d.data();
    return (data.name || '').toLowerCase().includes('szendrei') ||
           (data.email || '').toLowerCase().includes('szendrei');
  });
  if (empResults.length) {
    console.log('\npharmacyEmployees találatok:');
    empResults.forEach(d => {
      const data = d.data();
      console.log('ID:', d.id, '| Név:', data.name, '| Email:', data.email, '| PharmacyId:', data.pharmacyId, '| Status:', data.status);
    });
  }
}

main().catch(console.error).finally(() => process.exit());
