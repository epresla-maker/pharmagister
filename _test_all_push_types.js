require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}
const db = getFirestore();

const USER_ID = 'AcBMMwkqMvWAjrodNPPBjFdjjhw2';

async function sendAll() {
  const snap = await db.collection('pushSubscriptions').where('userId', '==', USER_ID).get();
  const sub = snap.docs[0]?.data()?.subscription;
  const token = sub?.token;
  if (!token) { console.log('No token'); return; }

  // Olvasd le a meglévő olvasatlan értesítések számát
  const existingUnread = await db.collection('notifications')
    .where('userId', '==', USER_ID)
    .where('read', '==', false)
    .get();
  let badgeCount = existingUnread.docs.filter((doc) => doc.data()?.type !== 'new_message').length;

  const types = [
    {
      title: '💬 Új üzenet',
      body: 'Valaki üzenetet küldött neked',
      url: '/chat/test123',
      tag: 'chat-test',
      type: 'new_message',
      message: 'Valaki üzenetet küldött neked',
    },
    {
      title: '📋 Új igény érkezett',
      body: 'Teszt Pharmacy gyógyszerész helyettest keres (máj. 1.)',
      url: '/pharmagister',
      tag: 'demand-test',
      type: 'new_demand',
      message: 'Teszt Pharmacy gyógyszerész helyettest keres (máj. 1.)',
    },
    {
      title: '✅ Igény visszaigazolva',
      body: 'A jelentkezésed elfogadásra került',
      url: '/pharmagister/demands',
      tag: 'accepted-test',
      type: 'demand_accepted',
      message: 'A jelentkezésed elfogadásra került',
    },
    {
      title: '🔔 Rendszerüzenet',
      body: 'Pharmagister: Ismerje meg az újdonságokat!',
      url: '/notifications',
      tag: 'system-test',
      type: 'system',
      message: 'Pharmagister: Ismerje meg az újdonságokat!',
    },
  ];

  for (const t of types) {
    if (t.type !== 'new_message') {
      badgeCount++;
    }

    // Firestore notification doc létrehozása (megjelenik az Értesítések oldalon)
    await db.collection('notifications').add({
      userId: USER_ID,
      type: t.type,
      title: t.title,
      message: t.message,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // FCM push küldése dinamikus badge számmal
    const msg = {
      token,
      notification: { title: t.title, body: t.body },
      data: { url: t.url, tag: t.tag },
      apns: { payload: { aps: { alert: { title: t.title, body: t.body }, badge: badgeCount, sound: 'default' } } }
    };
    const r = await admin.messaging().send(msg);
    console.log(`[badge: ${badgeCount}] Elküldve:`, t.title, '->', r);
    await new Promise(res => setTimeout(res, 1500));
  }
  console.log('Kesz!');
}
sendAll().catch(console.error);
