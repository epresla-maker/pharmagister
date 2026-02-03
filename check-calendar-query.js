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

async function checkCalendarQuery() {
  console.log('🔍 Naptár lekérdezés szimulálása...\n');
  
  // Ez a lekérdezés, amit a naptár használ helyettesítőknek
  const snapshot = await db.collection('pharmaDemands')
    .where('status', '==', 'open')
    .orderBy('date', 'asc')
    .get();
  
  console.log(`📊 Összes open státuszú igény: ${snapshot.size}\n`);
  
  // Csoportosítsuk dátum szerint
  const byDate = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const date = data.date;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({
      id: doc.id,
      pharmacyName: data.pharmacyName || '???',
      position: data.position || '???',
      date: data.date
    });
  });
  
  console.log('📅 Igények dátum szerint:\n');
  Object.keys(byDate).sort().forEach(date => {
    console.log(`  ${date}: ${byDate[date].length} igény`);
    byDate[date].forEach(d => {
      console.log(`    - ${d.pharmacyName} (${d.position})`);
    });
  });
  
  // Ellenőrizzük a február hónapot
  console.log('\n📅 Február 2026 igények:');
  const febDemands = snapshot.docs.filter(doc => {
    const date = doc.data().date;
    return date && date.startsWith('2026-02');
  });
  console.log(`  ${febDemands.length} igény februárban`);
}

checkCalendarQuery().catch(console.error);
