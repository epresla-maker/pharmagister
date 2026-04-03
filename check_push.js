const admin = require('firebase-admin');
const serviceAccount = require('./pharmagister-6e97a-firebase-adminsdk-juytn-9ec4e1f7c7.json');
if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
  const snap = await db.collection('users').where('email', '==', 'epresla@icloud.com').get();
  if (snap.empty) { console.log('User not found'); return; }
  const userId = snap.docs[0].id;
  console.log('User ID:', userId);
  const subs = await db.collection('pushSubscriptions').where('userId', '==', userId).get();
  console.log('Push subscriptions:', subs.size);
  subs.forEach(doc => {
    const data = doc.data();
    console.log('---');
    console.log('Doc ID:', doc.id);
    console.log('Platform:', data.platform || 'web');
    console.log('FCM Token:', data.fcmToken ? data.fcmToken.substring(0,50) + '...' : 'None');
    console.log('Endpoint:', data.endpoint ? data.endpoint.substring(0,80) + '...' : 'None');
    console.log('Keys:', data.keys ? 'Present' : 'None');
  });
}
main().then(() => process.exit(0));
