require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pharmacare-dfa3c',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}
const db = admin.firestore();
(async () => {
  const uid = 'liS5Ij5fwsO7Rh7fmlwRgcAmbH32';

  // Firebase Auth-ból
  try {
    const authUser = await admin.auth().getUser(uid);
    console.log('=== FIREBASE AUTH ===');
    console.log('email:', authUser.email);
    console.log('displayName:', authUser.displayName);
    console.log('phoneNumber:', authUser.phoneNumber);
    console.log('emailVerified:', authUser.emailVerified);
    console.log('disabled:', authUser.disabled);
    console.log('creationTime:', authUser.metadata.creationTime);
    console.log('lastSignInTime:', authUser.metadata.lastSignInTime);
    console.log('providerData:', JSON.stringify(authUser.providerData, null, 2));
  } catch(e) { console.log('Auth error:', e.message); }

  // Firestore users kollekcióból
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    console.log('\n=== FIRESTORE USER DOC ===');
    const d = userDoc.data();
    for (const [key, val] of Object.entries(d)) {
      if (val && val.toDate) {
        console.log(key + ':', val.toDate().toISOString());
      } else if (typeof val === 'object' && val !== null) {
        console.log(key + ':', JSON.stringify(val, null, 2));
      } else {
        console.log(key + ':', val);
      }
    }
  } else {
    console.log('Firestore users dokumentum NEM található!');
  }

  process.exit(0);
})();

/* DISABLED
  const postId = 'VoR1BCs8FPx2ZDb0MGmg';
  const docSnap = await db.collection('communityPosts').doc(postId).get();
  if (!docSnap.exists) { console.log('Poszt nem található!'); process.exit(1); }
  const d = docSnap.data();
  console.log('=== POSZT ÖSSZES MEZŐ ===');
  console.log('ID:', postId);
  for (const [key, val] of Object.entries(d)) {
    if (val && val.toDate) {
      console.log(key + ':', val.toDate().toISOString());
    } else if (typeof val === 'object' && val !== null) {
      console.log(key + ':', JSON.stringify(val, null, 2));
    } else {
      console.log(key + ':', val);
    }
  }

  // Kommentek lekérdezése
  const commSnap = await db.collection('communityPosts').doc(postId).collection('comments').orderBy('createdAt', 'asc').get();
  console.log('\n=== KOMMENTEK (' + commSnap.size + ' db) ===');
  commSnap.docs.forEach((c, i) => {
    const cd = c.data();
    console.log('\n--- Komment #' + (i+1) + ' (id: ' + c.id + ') ---');
    for (const [key, val] of Object.entries(cd)) {
      if (val && val.toDate) {
        console.log('  ' + key + ':', val.toDate().toISOString());
      } else if (typeof val === 'object' && val !== null) {
        console.log('  ' + key + ':', JSON.stringify(val, null, 2));
      } else {
        console.log('  ' + key + ':', val);
      }
    }
  });

  // Reakciók lekérdezése
  const reactSnap = await db.collection('communityPosts').doc(postId).collection('reactions').get();
  console.log('\n=== REAKCIÓK (' + reactSnap.size + ' db) ===');
  reactSnap.docs.forEach((r, i) => {
    const rd = r.data();
    console.log('\n--- Reakció #' + (i+1) + ' (id: ' + r.id + ') ---');
    for (const [key, val] of Object.entries(rd)) {
      if (val && val.toDate) {
        console.log('  ' + key + ':', val.toDate().toISOString());
      } else {
        console.log('  ' + key + ':', val);
      }
    }
  });

  process.exit(0);
})();
*/
