require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}
const db = admin.firestore();

async function check() {
  // Check sentEmails for bulk token emails
  const sentSnap = await db.collection('sentEmails')
    .where('type', '==', 'bulk-token-email')
    .get();
  
  console.log('Bulk token email küldések száma:', sentSnap.size);
  sentSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log('---');
    console.log('Időpont:', d.sentAt ? d.sentAt.toDate() : 'N/A');
    console.log('Elküldve:', d.sentCount);
    console.log('Sikertelen:', d.failedCount);
    console.log('Címzettek száma:', d.to ? d.to.length : 0);
    if (d.failedTo && d.failedTo.length > 0) {
      console.log('Sikertelen címek:', d.failedTo.join(', '));
    }
  });

  // Also check last 5 sent emails
  const allSent = await db.collection('sentEmails').orderBy('sentAt', 'desc').limit(5).get();
  console.log('\n=== Utolsó 5 küldés ===');
  allSent.docs.forEach(doc => {
    const d = doc.data();
    console.log('---');
    console.log('Típus:', d.type || 'normal');
    console.log('Tárgy:', d.subject);
    console.log('Időpont:', d.sentAt ? d.sentAt.toDate() : 'N/A');
    console.log('Elküldve:', d.sentCount, '| Sikertelen:', d.failedCount);
  });

  // Count total inactive users
  const usersSnap = await db.collection('users').get();
  const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const inactive = allUsers.filter(u => u.lastLogin === undefined && u.lastSeen === undefined && !u.passwordActivated);
  console.log('\n=== Összesítés ===');
  console.log('Összes felhasználó:', allUsers.length);
  console.log('Inaktív felhasználók:', inactive.length);
  
  // Check who has tokens generated
  const tokensSnap = await db.collection('accountActionTokens').get();
  const uniqueUsers = new Set();
  tokensSnap.docs.forEach(doc => {
    uniqueUsers.add(doc.data().userId);
  });
  console.log('Generált tokenek:', tokensSnap.size);
  console.log('Token generálva ennyi felhasználónak:', uniqueUsers.size);
}

check().then(() => process.exit());
