require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })});
}
const db = admin.firestore();
async function main() {
  // bteszt employee record
  const empSnap = await db.collection('pharmacyEmployees').where('email', '==', 'bteszt@pharmagister.hu').get();
  empSnap.forEach(d => console.log('Employee:', JSON.stringify({ id: d.id, email: d.data().email, linkedUserId: d.data().linkedUserId, name: d.data().name })));

  // All schedulePreferences
  const allPrefs = await db.collection('schedulePreferences').get();
  console.log('\nAll schedulePreferences:', allPrefs.size);
  allPrefs.forEach(d => {
    const data = d.data();
    console.log(JSON.stringify({ id: d.id, employeeId: data.employeeId, employeeEmail: data.employeeEmail, linkedUserId: data.linkedUserId, employeeName: data.employeeName, date: data.date, status: data.status }));
  });
}
main().catch(console.error).finally(() => process.exit());
