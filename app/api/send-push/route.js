import webpush from 'web-push';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';

// Configure webpush on each request to ensure fresh keys
function configureWebpush() {
  let VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys not configured');
  }
  
  // Sanitize VAPID keys - remove any padding '=' characters and trim whitespace
  // VAPID keys must be URL-safe Base64 without padding
  VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.trim().replace(/=+$/, '');
  VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.trim().replace(/=+$/, '');
  
  webpush.setVapidDetails(
    'mailto:epresla@icloud.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

function isLikelyApnsToken(token) {
  return typeof token === 'string' && /^[0-9a-fA-F]{64}$/.test(token);
}

export async function POST(request) {
  try {
    // Verify authenticated user
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return new Response(JSON.stringify({ error: 'Nincs jogosultság' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    console.log('📨 Push notification API called by:', authUser.email);
    
    // Environment variables check
    let VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    
    // Clean up VAPID keys - remove any padding and ensure URL-safe Base64
    if (VAPID_PUBLIC_KEY) {
      VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.trim().replace(/=+$/, '');
    }
    if (VAPID_PRIVATE_KEY) {
      VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.trim().replace(/=+$/, '');
    }
    
    console.log('🔑 VAPID keys check:', {
      publicKey: VAPID_PUBLIC_KEY ? `✅ Present (length: ${VAPID_PUBLIC_KEY.length})` : '❌ Missing',
      privateKey: VAPID_PRIVATE_KEY ? `✅ Present (length: ${VAPID_PRIVATE_KEY.length})` : '❌ Missing',
      publicKeyContainsEquals: VAPID_PUBLIC_KEY?.includes('='),
      privateKeyContainsEquals: VAPID_PRIVATE_KEY?.includes('=')
    });
    
    configureWebpush();
    
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { userId, title, body, url, tag } = await request.json();
    
    console.log('📋 Request data:', { userId, title, hasBody: !!body, url, tag });

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get user's push subscriptions from Firestore
    const subscriptionsSnapshot = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .get();
    
    console.log(`📱 Found ${subscriptionsSnapshot.size} subscriptions for user ${userId}`);

    if (subscriptionsSnapshot.empty) {
      console.log(`No push subscriptions found for user: ${userId}`);
      return Response.json({ success: true, sent: 0, message: 'No subscriptions found' });
    }

    const payload = JSON.stringify({
      title: title || 'Pharmagister',
      body: body || 'Új értesítésed érkezett!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: tag || 'pharmagister-notification',
      url: url || '/notifications'
    });

    const results = [];
    const expiredSubscriptions = [];

    for (const subDoc of subscriptionsSnapshot.docs) {
      const subscription = subDoc.data().subscription;
      
      try {
        // Natív (iOS/Android) push - FCM-en keresztül
        if (subscription.endpoint?.startsWith('native-') && subscription.token) {
          const platform = subscription.platform || 'unknown';
          const tokenType = subscription.tokenType || 'unknown';

          if (platform === 'ios' && (tokenType === 'apns' || isLikelyApnsToken(subscription.token))) {
            // iOS APNS token nem küldhető közvetlenül Firebase Admin messaging().send()-del.
            // Itt FCM registration token szükséges.
            results.push({
              success: false,
              id: subDoc.id,
              platform: 'native-ios',
              error: `APNS token detected (tokenType=${tokenType}); FCM token required for Firebase Admin send`
            });
            console.warn(`⚠️ iOS subscription ${subDoc.id} APNS tokennel mentve (FCM token szükséges)`);
            continue;
          }

          const message = {
            token: subscription.token,
            notification: {
              title: title || 'Pharmagister',
              body: body || 'Új értesítésed érkezett!',
            },
            data: {
              url: url || '/notifications',
              tag: tag || 'pharmagister-notification'
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: title || 'Pharmagister',
                    body: body || 'Új értesítésed érkezett!',
                  },
                  badge: 1,
                  sound: 'default'
                }
              }
            }
          };
          
          await admin.messaging().send(message);
          results.push({ success: true, id: subDoc.id, platform: 'native' });
          console.log(`✅ FCM push sent to ${subDoc.id}`);
        } else {
          // Web push - VAPID/webpush
          await webpush.sendNotification(subscription, payload);
          results.push({ success: true, id: subDoc.id, platform: 'web' });
        }
      } catch (error) {
        console.error(`Push failed for subscription ${subDoc.id}:`, error.statusCode || error.code || error.message);
        
        // If subscription is expired or invalid, mark for deletion
        if (error.statusCode === 410 || error.statusCode === 404 || 
            error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/invalid-registration-token') {
          expiredSubscriptions.push(subDoc.id);
        }
        results.push({ success: false, id: subDoc.id, error: error.message });
      }
    }

    // Clean up expired subscriptions
    for (const subId of expiredSubscriptions) {
      await db.collection('pushSubscriptions').doc(subId).delete();
      console.log(`Deleted expired subscription: ${subId}`);
    }

    const successCount = results.filter(r => r.success).length;
    return Response.json({ 
      success: true, 
      sent: successCount, 
      total: results.length,
      cleaned: expiredSubscriptions.length 
    });

  } catch (error) {
    console.error('Send push error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
