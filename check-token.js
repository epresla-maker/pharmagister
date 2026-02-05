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

async function checkToken() {
  const snap = await db.collection('users').where('email', '==', 'epreslaszlo11@gmail.com').get();
  
  snap.forEach(doc => {
    const data = doc.data();
    console.log('User ID:', doc.id);
    console.log('passwordResetToken exists:', !!data.passwordResetToken);
    console.log('Token (first 20 chars):', data.passwordResetToken ? data.passwordResetToken.substring(0,20) + '...' : 'N/A');
    console.log('passwordResetTokenExpiry:', data.passwordResetTokenExpiry);
    console.log('Full token:', data.passwordResetToken);
  });
}

checkToken().then(() => process.exit(0));
