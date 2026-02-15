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

(async () => {
  // List ALL collections
  const cols = await db.listCollections();
  const allNames = cols.map(c => c.id);
  console.log('All collections:', allNames);

  // Check demand-related collections
  const demandCols = allNames.filter(n => 
    n.toLowerCase().includes('demand') || 
    n.toLowerCase().includes('igeny') || 
    n.toLowerCase().includes('igény') ||
    n.toLowerCase().includes('wp') ||
    n.toLowerCase().includes('migr')
  );
  console.log('\nDemand-related collections:', demandCols);
  
  for (const name of demandCols) {
    const snap = await db.collection(name).get();
    console.log(name + ':', snap.size, 'docs');
    if (snap.size > 0) {
      const sample = snap.docs[0].data();
      console.log('  Sample fields:', Object.keys(sample));
    }
  }

  // Check pharmaDemands source field
  const snap = await db.collection('pharmaDemands').get();
  console.log('\npharmaDemands analysis:');
  let migrated = 0;
  let native = 0;
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.source === 'wp' || data.migratedFrom || data.wpId) {
      migrated++;
    } else {
      native++;
    }
  });
  console.log('  Migrated:', migrated, 'Native:', native, 'Total:', snap.size);

  process.exit(0);
})();
