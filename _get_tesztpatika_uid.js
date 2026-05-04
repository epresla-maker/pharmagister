require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })});
}
admin.auth().getUserByEmail('tesztpatika@pharmagister.hu')
  .then(u => { console.log(u.uid); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
