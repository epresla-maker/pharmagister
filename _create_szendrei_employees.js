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

const SZENDREI_UID = 'P3qEbZaHephgqkpOIBOkcBqL35c2';

const EMPLOYEES = [
  // Gyógyszerészek
  { name: 'Dr. Kovács Éva', position: 'Gyógyszerész', color: '#7C3AED' },
  { name: 'Dr. Németh Péter', position: 'Gyógyszerész', color: '#2563EB' },
  { name: 'Dr. Balogh Katalin', position: 'Gyógyszerész', color: '#059669' },
  // Gyógyszertári szakasszisztensek
  { name: 'Tóth Mária', position: 'Gyógyszertári szakasszisztens', color: '#D97706' },
  { name: 'Varga Eszter', position: 'Gyógyszertári szakasszisztens', color: '#DC2626' },
  { name: 'Horváth Zsuzsa', position: 'Gyógyszertári szakasszisztens', color: '#DB2777' },
];

async function main() {
  // Get Szendrei's pharmacyId
  const userDoc = await db.collection('users').doc(SZENDREI_UID).get();
  const userData = userDoc.data();
  const pharmacyId = userData.pharmacyId || SZENDREI_UID;
  console.log('pharmacyId:', pharmacyId);

  for (const emp of EMPLOYEES) {
    const ref = db.collection('pharmacyEmployees').doc();
    await ref.set({
      name: emp.name,
      position: emp.position,
      color: emp.color,
      pharmacyId,
      ownerId: SZENDREI_UID,
      isActive: true,
      weeklyHours: 40,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Létrehozva:', emp.name, '-', emp.position, '| ID:', ref.id);
  }
  console.log('Kész!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
