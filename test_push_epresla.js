require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const webpush = require('web-push');

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

async function main() {
  // Find user by email
  const userSnap = await db.collection('users').where('email', '==', 'epresla@icloud.com').get();
  if (userSnap.empty) {
    console.log('User not found');
    return;
  }
  const userId = userSnap.docs[0].id;
  console.log('User ID:', userId);

  // Get all push subscriptions  
  const subsSnap = await db.collection('pushSubscriptions').where('userId', '==', userId).get();
  console.log('\n=== Push subscriptions:', subsSnap.size, '===\n');

  for (const doc of subsSnap.docs) {
    const data = doc.data();
    console.log('--- Subscription:', doc.id, '---');
    console.log('Platform:', data.platform || 'web (no platform)');
    console.log('Created:', data.createdAt?.toDate?.() || data.createdAt);
    
    // Check for FCM token (iOS/Android native)
    if (data.subscription?.token) {
      console.log('FCM Token:', data.subscription.token.substring(0, 50) + '...');
      
      // Send FCM push
      console.log('\n-> Sending FCM test push...');
      try {
        const msg = {
          token: data.subscription.token,
          notification: { 
            title: '🔔 Teszt Push', 
            body: 'iOS teszt - ' + new Date().toLocaleTimeString('hu-HU') 
          },
          data: { url: '/notifications', tag: 'test-push' },
          apns: { 
            payload: { 
              aps: { 
                alert: { title: '🔔 Teszt Push', body: 'iOS teszt - ' + new Date().toLocaleTimeString('hu-HU') }, 
                badge: 1, 
                sound: 'default' 
              } 
            } 
          }
        };
        const result = await admin.messaging().send(msg);
        console.log('✅ FCM push sent! Result:', result);
      } catch (err) {
        console.log('❌ FCM push failed:', err.code, err.message);
      }
    }
    
    // Check for web push (endpoint + keys)
    if (data.endpoint && data.keys) {
      console.log('Web Endpoint:', data.endpoint.substring(0, 70) + '...');
      console.log('Web Keys: Present');
      
      // Send web push
      console.log('\n-> Sending Web Push test...');
      try {
        let VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/=+$/, '');
        let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim().replace(/=+$/, '');
        
        if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
          webpush.setVapidDetails('mailto:epresla@icloud.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
          
          const payload = JSON.stringify({
            title: '🔔 Teszt Push',
            body: 'Web teszt - ' + new Date().toLocaleTimeString('hu-HU'),
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: 'test-push',
            url: '/notifications'
          });
          
          await webpush.sendNotification({ endpoint: data.endpoint, keys: data.keys }, payload);
          console.log('✅ Web push sent!');
        } else {
          console.log('❌ VAPID keys not configured');
        }
      } catch (err) {
        console.log('❌ Web push failed:', err.statusCode, err.message);
      }
    }
    
    console.log('');
  }
}

main().then(() => process.exit(0)).catch(console.error);
