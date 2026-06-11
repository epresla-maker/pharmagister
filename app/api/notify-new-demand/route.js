import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import webpush from 'web-push';
import { resolveMarketFromRequest, isDocInMarket, normalizeMarket } from '@/lib/market';

function getPositionLabelByMarket(position, market) {
  if (market === 'de') return position === 'pharmacist' ? 'Apotheker/in' : position === 'pka' ? 'PKA' : 'PTA';
  return position === 'pharmacist' ? 'gyógyszerész' : position === 'pka' ? 'PKA' : 'szakasszisztens';
}

function buildDemandNotificationCopy({ market, pharmacyName, position, date }) {
  const locale = market === 'de' ? 'de-DE' : 'hu-HU';
  const dateStr = date
    ? new Date(date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    : '';
  const positionLabel = getPositionLabelByMarket(position, market);

  if (market === 'de') {
    const title = 'Neue Vertretungsanfrage';
    const body = `${pharmacyName || 'Eine Apotheke'} sucht ${positionLabel} fuer Vertretung${dateStr ? ` (${dateStr})` : ''}.`;
    return { title, body };
  }

  const title = 'Új helyettesítési igény';
  const body = `${pharmacyName || 'Egy gyógyszertár'} ${positionLabel} helyettest keres${dateStr ? ` (${dateStr})` : ''}.`;
  return { title, body };
}

function getNotifySummaryMessage(market) {
  return market === 'de' ? 'Keine passenden Nutzer zum Benachrichtigen' : 'Nincs értesíthető, megfelelő felhasználó';
}

function getNotifyNewDemandApiCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      requiredFields: 'demandId und position sind erforderlich',
      demandNotFound: 'Anfrage nicht gefunden',
      forbidden: 'Keine Berechtigung fuer diese Anfrage',
    };
  }

  return {
    unauthorized: 'Nincs jogosultság',
    requiredFields: 'A demandId és position megadása kötelező',
    demandNotFound: 'Az igeny nem talalhato',
    forbidden: 'Nincs jogosultsag ehhez az igenyhez',
  };
}

function configureWebpush() {
  let VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.trim().replace(/=+$/, '');
  VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.trim().replace(/=+$/, '');
  webpush.setVapidDetails('mailto:epresla@icloud.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getNotifyNewDemandApiCopy(requestMarket);
    // Verify authenticated user
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: copy.unauthorized }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { demandId, pharmacyZipCode, position, pharmacyName, date } = await request.json();
    
    console.log('📢 New demand notification request:', { demandId, pharmacyZipCode, position, pharmacyName, date });
    
    if (!demandId || !position) {
      return Response.json({ error: copy.requiredFields }, { status: 400 });
    }
    
    const ADMIN_UID = 'AcBMMwkqMvWAjrodNPPBjFdjjhw2';
    const demandDoc = await db.collection('pharmaDemands').doc(demandId).get();
    if (!demandDoc.exists) {
      return Response.json({ error: copy.demandNotFound }, { status: 404 });
    }

    const demandData = demandDoc.data() || {};
    if (authUser.uid !== demandData.pharmacyId && authUser.uid !== ADMIN_UID) {
      return Response.json({ error: copy.forbidden }, { status: 403 });
    }

    const targetMarket = normalizeMarket(demandData.market || requestMarket);
    
    // Keressük meg azokat a felhasználókat, akik:
    // 1. pharmacist vagy assistant szerepkörűek (nem pharmacy)
    // 2. newDemand értesítés be van kapcsolva
    // 3. A pozíció egyezik a beállított szűrővel
    // 4. Az irányítószám egyezik (vagy nincs megadva szűrő)
    
    const usersSnapshot = await db.collection('users')
      .where('pharmagisterRole', 'in', ['pharmacist', 'assistant'])
      .get();
    
    console.log(`📋 Found ${usersSnapshot.size} pharmacists/assistants`);
    
    const usersToNotify = [];
    let adminAlreadyIncluded = false;
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (!isDocInMarket(userData, targetMarket)) {
        return;
      }
      const settings = userData.notificationSettings || {};
      
      if (doc.id === ADMIN_UID) {
        adminAlreadyIncluded = true;
      }
      
      // Ellenőrizzük, hogy be van-e kapcsolva az új igény értesítés
      if (settings.newDemand === false) {
        console.log(`⏭️ User ${doc.id} has newDemand disabled`);
        return;
      }
      
      // Ellenőrizzük a pozíció szűrőt
      const positionFilter = settings.demandPositions || [userData.pharmagisterRole];
      if (!positionFilter.includes(position)) {
        console.log(`⏭️ User ${doc.id} position filter doesn't match: ${positionFilter} vs ${position}`);
        return;
      }
      
      // Ellenőrizzük az irányítószám szűrőt
      const zipFilter = settings.demandZipCodes || [];
      if (zipFilter.length > 0 && pharmacyZipCode && !zipFilter.includes(pharmacyZipCode)) {
        console.log(`⏭️ User ${doc.id} zip filter doesn't match: ${zipFilter} vs ${pharmacyZipCode}`);
        return;
      }
      
      usersToNotify.push({
        id: doc.id,
        displayName: userData.displayName,
        market: normalizeMarket(userData.market)
      });
    });
    
    // Admin mindig kapjon értesítést, szűrőktől függetlenül
    if (!usersToNotify.find(u => u.id === ADMIN_UID)) {
      // Admin nincs benne a listában (mert pl. pharmacy role-ja van) - hozzáadjuk
      const adminDoc = adminAlreadyIncluded ? null : await db.collection('users').doc(ADMIN_UID).get();
      const adminName = adminAlreadyIncluded ? 'Admin' : (adminDoc?.exists ? adminDoc.data()?.displayName : 'Admin');
      usersToNotify.push({
        id: ADMIN_UID,
        displayName: adminName || 'Admin',
        market: normalizeMarket(adminDoc?.exists ? adminDoc.data()?.market : targetMarket)
      });
      console.log('📌 Admin added to notification list (bypass filters)');
    }
    
    console.log(`📬 Users to notify: ${usersToNotify.length}`);
    
    if (usersToNotify.length === 0) {
      return Response.json({ success: true, notified: 0, message: getNotifySummaryMessage(targetMarket) });
    }
    
    // Küldünk értesítést minden érintett felhasználónak
    const results = [];
    
    for (const userInfo of usersToNotify) {
      try {
        const userMarket = normalizeMarket(userInfo.market || targetMarket);
        const copy = buildDemandNotificationCopy({
          market: userMarket,
          pharmacyName,
          position,
          date,
        });

        // App értesítés létrehozása
        await db.collection('notifications').add({
          userId: userInfo.id,
          market: userMarket,
          type: 'new_demand',
          title: copy.title,
          message: copy.body,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: {
            demandId,
            pharmacyZipCode,
            position
          }
        });
        
        // Push notification küldése közvetlenül (web + natív FCM)
        try {
          const subsSnapshot = await db.collection('pushSubscriptions')
            .where('userId', '==', userInfo.id)
            .get();

          const marketSubs = subsSnapshot.docs.filter((doc) => isDocInMarket(doc.data(), userMarket));
          
          if (marketSubs.length > 0) {
            const webPayload = JSON.stringify({
              title: copy.title,
              body: copy.body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
              tag: `new-demand-${demandId}`,
              url: `/pharmagister/demand/${demandId}`
            });
            
            const webpushReady = configureWebpush();
            
            for (const subDoc of marketSubs) {
              const subscription = subDoc.data().subscription;
              try {
                if (subscription.endpoint?.startsWith('native-') && subscription.token) {
                  // Natív push FCM-en keresztül
                  await admin.messaging().send({
                    token: subscription.token,
                    notification: {
                      title: copy.title,
                      body: copy.body,
                    },
                    data: {
                      url: `/pharmagister/demand/${demandId}`,
                      tag: `new-demand-${demandId}`
                    },
                    apns: {
                      payload: {
                        aps: {
                          alert: {
                            title: copy.title,
                            body: copy.body,
                          },
                          badge: 1,
                          sound: 'default'
                        }
                      }
                    }
                  });
                } else if (webpushReady) {
                  // Web push
                  await webpush.sendNotification(subscription, webPayload);
                }
              } catch (pushErr) {
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404 ||
                    pushErr.code === 'messaging/registration-token-not-registered' ||
                    pushErr.code === 'messaging/invalid-registration-token') {
                  const subMarket = normalizeMarket(subDoc.data()?.market);
                  if (subMarket === userMarket) {
                    await db.collection('pushSubscriptions').doc(subDoc.id).delete();
                  }
                }
              }
            }
          }
        } catch (pushError) {
          console.log(`Push notification failed for ${userInfo.id} (non-critical):`, pushError.message);
        }
        
        results.push({ userId: userInfo.id, success: true });
        console.log(`✅ Notified user ${userInfo.id}`);
      } catch (error) {
        console.error(`❌ Failed to notify user ${userInfo.id}:`, error);
        results.push({ userId: userInfo.id, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return Response.json({ 
      success: true, 
      notified: successCount,
      total: usersToNotify.length,
      results 
    });
    
  } catch (error) {
    console.error('Notify new demand error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
