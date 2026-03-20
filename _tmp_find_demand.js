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

async function find() {
  // 1. Keresés az összes pharmaDemands-ban (szűrés nélkül)
  console.log('=== ÖSSZES pharmaDemands dokumentum ===');
  const allSnapshot = await db.collection('pharmaDemands').get();
  const allDocs = allSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('Összes igény:', allDocs.length);
  
  const results = allDocs.filter(d =>
    (d.pharmacyName || '').toLowerCase().includes('patika') ||
    (d.pharmacyCity || '').toLowerCase().includes('cegl') ||
    (d.pharmacyFullAddress || '').toLowerCase().includes('cegl') ||
    (d.pharmacyStreet || '').toLowerCase().includes('cegl')
  );
  console.log('Patika / Cegléd találatok:', results.length);
  results.forEach(d => {
    console.log(JSON.stringify({ id: d.id, date: d.date, pharmacyName: d.pharmacyName, pharmacyCity: d.pharmacyCity, status: d.status, position: d.position, pharmacyId: d.pharmacyId }, null, 2));
  });

  // 2. Keresés törölt igények között (ha van deletedDemands collection)
  console.log('\n=== deletedDemands collection ===');
  try {
    const deleted = await db.collection('deletedDemands').get();
    console.log('Törölt igények száma:', deleted.size);
    const deletedResults = deleted.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(d =>
        (d.pharmacyName || '').toLowerCase().includes('patika') ||
        (d.pharmacyCity || '').toLowerCase().includes('cegl')
      );
    console.log('Patika / Cegléd törölt:', deletedResults.length);
    deletedResults.forEach(d => console.log(JSON.stringify(d, null, 2)));
  } catch(e) { console.log('Nincs deletedDemands collection'); }

  // 3. Keresés archiváltakban
  console.log('\n=== archivedDemands collection ===');
  try {
    const archived = await db.collection('archivedDemands').get();
    console.log('Archivált igények száma:', archived.size);
    const archivedResults = archived.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(d =>
        (d.pharmacyName || '').toLowerCase().includes('patika') ||
        (d.pharmacyCity || '').toLowerCase().includes('cegl')
      );
    console.log('Patika / Cegléd archivált:', archivedResults.length);
    archivedResults.forEach(d => console.log(JSON.stringify(d, null, 2)));
  } catch(e) { console.log('Nincs archivedDemands collection'); }

  // 4. Listázzuk az összes collection nevet, hátha máshol van
  console.log('\n=== Összes collection ===');
  const collections = await db.listCollections();
  const collNames = collections.map(c => c.id);
  console.log(collNames.join(', '));

  // 5. Keresés minden demand-szerű collectionben
  const demandCollections = collNames.filter(c => c.toLowerCase().includes('demand'));
  for (const coll of demandCollections) {
    if (coll === 'pharmaDemands') continue;
    console.log('\n=== ' + coll + ' ===');
    const snap = await db.collection(coll).get();
    console.log('Dokumentumok:', snap.size);
    const found = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(d =>
        (d.pharmacyName || '').toLowerCase().includes('patika') ||
        (d.pharmacyCity || '').toLowerCase().includes('cegl') ||
        JSON.stringify(d).toLowerCase().includes('patika') ||
        JSON.stringify(d).toLowerCase().includes('cegl')
      );
    console.log('Patika / Cegléd:', found.length);
    found.forEach(d => console.log(JSON.stringify(d, null, 2)));
  }

  // 6. Keresés a users collection-ban is Cegléd-re
  console.log('\n=== Users Ceglédről ===');
  const usersSnap = await db.collection('users').get();
  const ceglUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(d =>
      (d.pharmacyName || '').toLowerCase().includes('patika plus') ||
      (d.pharmacyCity || '').toLowerCase().includes('cegl') ||
      (d.city || '').toLowerCase().includes('cegl')
    );
  console.log('Ceglédi felhasználók:', ceglUsers.length);
  ceglUsers.forEach(u => {
    console.log(JSON.stringify({ id: u.id, displayName: u.displayName, email: u.email, pharmacyName: u.pharmacyName, pharmacyCity: u.pharmacyCity, city: u.city }, null, 2));
  });
}

find().then(() => process.exit(0));
