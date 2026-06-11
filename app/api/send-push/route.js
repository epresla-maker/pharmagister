import webpush from 'web-push';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import { canSendNotificationToUser } from '@/lib/scheduleAccess';
import { resolveMarketFromRequest, isDocInMarket } from '@/lib/market';

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

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function getNoSubscriptionsMessage(market) {
  return market === 'de' ? 'Keine Abonnements gefunden' : 'Nem található push feliratkozás';
}

function getSendPushApiCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      userIdRequired: 'userId ist erforderlich',
      forbidden: 'Keine Berechtigung fuer den Benachrichtigungsempfaenger',
      defaultBody: 'Du hast eine neue Benachrichtigung erhalten!',
    };
  }

  return {
    unauthorized: 'Nincs jogosultság',
    userIdRequired: 'A userId megadása kötelező',
    forbidden: 'Nincs jogosultság az értesítés címzettjéhez.',
    defaultBody: 'Új értesítésed érkezett!',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getSendPushApiCopy(requestMarket);
    // Verify authenticated user
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return new Response(JSON.stringify({ error: copy.unauthorized }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    console.log('📨 Push notification API called by:', authUser.email);

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const {
      userId,
      title,
      body,
      url,
      tag,
      type,
      createInAppNotification = true,
      notificationData,
      dedupeWindowSeconds = 0,
      dedupeByDataKeys = [],
    } = await request.json();

    if (!userId) {
      return Response.json({ error: copy.userIdRequired }, { status: 400 });
    }

    const normalizedTitle = title || 'Pharmagister';
    const normalizedBody = body || copy.defaultBody;
    const normalizedUrl = url || '/notifications';
    const normalizedTag = tag || 'pharmagister-notification';
    const normalizedType = type || (String(normalizedTag).startsWith('chat-') ? 'new_message' : 'system');
    const extraData = isPlainObject(notificationData) ? notificationData : {};

    console.log('📋 Request data:', { userId, title: normalizedTitle, hasBody: !!body, url: normalizedUrl, tag: normalizedTag, type: normalizedType });

    const canSend = await canSendNotificationToUser({
      authUser,
      db,
      targetUserId: userId,
      type: normalizedType,
      tag: normalizedTag,
      url: normalizedUrl,
      notificationData: extraData,
    });

    if (!canSend) {
      return Response.json({ error: copy.forbidden }, { status: 403 });
    }

    let notificationId = null;

    if (createInAppNotification) {
      if (dedupeWindowSeconds > 0) {
        const recentSnapshot = await db.collection('notifications')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(30)
          .get();

        const nowMs = Date.now();
        const duplicate = recentSnapshot.docs.find((docItem) => {
          const existing = docItem.data();
          if (existing.type !== normalizedType) return false;
          if (existing.title !== normalizedTitle) return false;
          if (existing.message !== normalizedBody) return false;

          const allDataKeysMatch = (Array.isArray(dedupeByDataKeys) ? dedupeByDataKeys : []).every((key) => {
            if (key === 'type') return existing.type === normalizedType;
            return existing[key] === extraData[key];
          });
          if (!allDataKeysMatch) return false;

          const createdAtMs = existing.createdAt?.toDate?.()?.getTime?.();
          if (!createdAtMs) return false;
          return nowMs - createdAtMs <= Number(dedupeWindowSeconds) * 1000;
        });

        if (duplicate) {
          console.log('⏭️ Duplicate notification skipped:', duplicate.id);
          return Response.json({ success: true, deduped: true, notificationId: duplicate.id, sent: 0, total: 0, cleaned: 0 });
        }
      }

      const notificationRef = await db.collection('notifications').add({
        userId,
        market: requestMarket,
        type: normalizedType,
        title: normalizedTitle,
        message: normalizedBody,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...extraData,
        url: normalizedUrl,
        data: {
          ...extraData,
          url: normalizedUrl,
        },
      });
      notificationId = notificationRef.id;
    }

    // Environment variables check
    let VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    
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

    // Get user's push subscriptions from Firestore
    const subscriptionsSnapshot = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .get();

    const marketSubscriptions = subscriptionsSnapshot.docs.filter((doc) => isDocInMarket(doc.data(), requestMarket));
    
    console.log(`📱 Found ${marketSubscriptions.length} subscriptions in market ${requestMarket} for user ${userId}`);

    if (marketSubscriptions.length === 0) {
      console.log(`No push subscriptions found for user: ${userId}`);
      return Response.json({
        success: true,
        sent: 0,
        notificationId,
        message: getNoSubscriptionsMessage(requestMarket)
      });
    }

    const unreadSnapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();
    const badgeCount = unreadSnapshot.docs
      .filter((d) => isDocInMarket(d.data(), requestMarket))
      .filter(d => d.data()?.type !== 'new_message')
      .length;

    const payload = JSON.stringify({
      title: normalizedTitle,
      body: normalizedBody,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: normalizedTag,
      url: normalizedUrl
    });

    const results = [];
    const expiredSubscriptions = [];

    for (const subDoc of marketSubscriptions) {
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
              title: normalizedTitle,
              body: normalizedBody,
            },
            data: {
              url: normalizedUrl,
              tag: normalizedTag
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: normalizedTitle,
                    body: normalizedBody,
                  },
                  badge: badgeCount,
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
      cleaned: expiredSubscriptions.length,
      notificationId,
    });

  } catch (error) {
    console.error('Send push error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
