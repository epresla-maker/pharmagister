const admin = require('firebase-admin');
const webpush = require('web-push');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: key,
    }),
  });
}
const db = admin.firestore();

const SZENDREI_UID = 'P3qEbZaHephgqkpOIBOkcBqL35c2';
const SZENDREI_EMAIL = 'szendrei.gyula66@gmail.com';
const SZENDREI_NAME = 'Szendrei Gyula';

// VAPID setup
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.trim().replace(/=+$/, '');
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY.trim().replace(/=+$/, '');
webpush.setVapidDetails('mailto:epresla@icloud.com', VAPID_PUBLIC, VAPID_PRIVATE);

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendEmail() {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://pharmagister.hu/icons/icon-192x192.png" alt="Pharmagister" style="width: 64px; height: 64px; border-radius: 16px;" />
    </div>
    <h1 style="color: #7C3AED; text-align: center; margin-bottom: 8px;">Üdvözöljük a Pharmagister rendszerében!</h1>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Kedves <strong>${SZENDREI_NAME}</strong>!</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
      Örömmel értesítjük, hogy fiókja sikeresen aktiválva lett <strong>gyógyszertár-vezető</strong> jogosultsággal.
    </p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
      Mostantól elérheti a <strong>Beosztások kezelése</strong> funkciót, amellyel:
    </p>
    <ul style="color: #374151; font-size: 15px; line-height: 1.8;">
      <li>Kezelheti dolgozói beosztásait</li>
      <li>Megtekintheti a dolgozói preferenciákat</li>
      <li>Jóváhagyhatja a cserekérelmeket</li>
    </ul>
    <div style="text-align: center; margin-top: 32px;">
      <a href="https://pharmagister.hu/pharmagister" 
         style="background: #7C3AED; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
        Belépés a rendszerbe
      </a>
    </div>
    <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin-top: 32px;">
      Pharmagister · <a href="https://pharmagister.hu" style="color: #7C3AED;">pharmagister.hu</a>
    </p>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Pharmagister <noreply@pharmagister.hu>',
      to: SZENDREI_EMAIL,
      subject: '🎉 Fiókja aktiválva – Gyógyszertár-vezető jogosultság',
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  console.log('✅ Email elküldve:', data.id);
}

async function createInAppNotification() {
  const ref = await db.collection('notifications').add({
    userId: SZENDREI_UID,
    type: 'role_upgrade',
    title: '🎉 Gyógyszertár-vezető jogosultság aktiválva',
    message: 'Fiókja sikeresen aktiválva lett. Mostantól elérheti a Beosztások kezelése funkciót.',
    read: false,
    url: '/pharmagister',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✅ In-app értesítés létrehozva:', ref.id);
  return ref.id;
}

async function sendPushNotifications() {
  const subsSnap = await db.collection('pushSubscriptions')
    .where('userId', '==', SZENDREI_UID)
    .get();

  if (subsSnap.empty) {
    console.log('ℹ️ Nincs push feliratkozás Szendrei felhasználóhoz');
    return;
  }

  const payload = JSON.stringify({
    title: '🎉 Gyógyszertár-vezető jogosultság aktiválva',
    body: 'Mostantól elérheti a Beosztások kezelése funkciót.',
    url: '/pharmagister',
    tag: 'role_upgrade',
  });

  let sent = 0;
  for (const doc of subsSnap.docs) {
    const sub = doc.data().subscription || doc.data();
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      console.warn('Push küldési hiba:', err.message);
    }
  }
  console.log(`✅ Push értesítés elküldve: ${sent}/${subsSnap.size}`);
}

async function main() {
  await Promise.all([
    sendEmail(),
    createInAppNotification(),
    sendPushNotifications(),
  ]);
  console.log('🏁 Kész!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
