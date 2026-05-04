require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
}
admin.firestore().collection('pharmacyEmployees').where('pharmacyId', '==', 'Wep2ekVOKQgUVLTkJi1UsiqcMGI2').get().then(snap => {
  snap.docs.forEach(d => {
    const { name, role, linkedUserId, email } = d.data();
    console.log(name, '|', role, '|', email || '-', '|', linkedUserId || 'nincs linked');
  });
  process.exit(0);
});
