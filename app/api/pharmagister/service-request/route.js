import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth, ADMIN_EMAILS } from '@/lib/apiAuth';
import { getDemandPackageOffer } from '@/lib/demandCredits';
import { normalizePharmagisterRole } from '@/lib/pharmagisterProfile';

const SERVICE_FRAME_WINDOW_DAYS = 8;

function configureWebpush() {
  let VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.trim().replace(/=+$/, '');
  VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.trim().replace(/=+$/, '');
  webpush.setVapidDetails('mailto:epresla@icloud.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

async function loadAdminUserIds(db) {
  const ids = [];
  for (const email of ADMIN_EMAILS) {
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!snap.empty) ids.push(snap.docs[0].id);
  }
  return ids;
}

async function notifyAdminsOfServiceFrameRequest({ admin, db, requestId, requesterName, pharmacyName, packageCredits, finalPriceHuf }) {
  const adminUserIds = await loadAdminUserIds(db);
  if (adminUserIds.length === 0) return;

  const title = 'Új szolgáltatási keret igénylés';
  const body = `${pharmacyName || requesterName || 'Egy gyógyszertár'} ${packageCredits} kredites keretet igényelt (${finalPriceHuf} Ft).`;

  const notifBatch = db.batch();
  adminUserIds.forEach((adminId) => {
    const notifRef = db.collection('notifications').doc();
    notifBatch.set(notifRef, {
      userId: adminId,
      type: 'service_frame_request',
      title,
      message: body,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      data: { requestId, url: '/admin/demand-credits' },
      url: '/admin/demand-credits',
    });
  });
  await notifBatch.commit();

  try {
    const webpushReady = configureWebpush();
    for (const adminId of adminUserIds) {
      const subsSnapshot = await db.collection('pushSubscriptions').where('userId', '==', adminId).get();
      const payload = JSON.stringify({
        title,
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: `service-frame-request-${requestId}`,
        url: '/admin/demand-credits',
      });

      for (const subDoc of subsSnapshot.docs) {
        const subscription = subDoc.data().subscription;
        try {
          if (subscription?.endpoint?.startsWith('native-') && subscription.token) {
            await admin.messaging().send({
              token: subscription.token,
              notification: { title, body },
              data: { url: '/admin/demand-credits', tag: `service-frame-request-${requestId}` },
              apns: { payload: { aps: { alert: { title, body }, sound: 'default' } } },
            });
          } else if (webpushReady && subscription) {
            await webpush.sendNotification(subscription, payload);
          }
        } catch (pushErr) {
          console.log('Admin push notification failed (non-critical):', pushErr.message);
        }
      }
    }
  } catch (pushError) {
    console.log('Admin push notification batch failed (non-critical):', pushError.message);
  }
}

export async function POST(request) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Nincs jogosultsag', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const userRef = db.collection('users').doc(authUser.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};

    const normalizedRole = normalizePharmagisterRole(userData.pharmagisterRole || userData.pharmaRole || userData.role);
    if (normalizedRole !== 'pharmacy') {
      return NextResponse.json({ error: 'Csak gyogyszertar fiok tud keretigénylést küldeni.', code: 'PHARMACY_ONLY' }, { status: 403 });
    }

    let requestBody = {};
    try {
      requestBody = await request.json();
    } catch (_) {
      requestBody = {};
    }
    const forceAdditional = requestBody?.force === true;

    const existingPendingSnap = await db.collection('demandCreditPurchaseIntents')
      .where('userId', '==', authUser.uid)
      .where('status', '==', 'pending_payment')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!existingPendingSnap.empty && !forceAdditional) {
      const existingDoc = existingPendingSnap.docs[0];
      const existingData = existingDoc.data() || {};
      const existingDueAt = existingData.dueAt?.toDate?.() || null;
      return NextResponse.json({
        success: true,
        alreadyPending: true,
        requestId: existingDoc.id,
        dueAt: existingDueAt ? existingDueAt.toISOString() : null,
        creditedCredits: Number(existingData.creditedCredits) || 0,
        queue: 'internal_admin_queue',
      });
    }

    const offer = getDemandPackageOffer(userData || {});
    const packageCredits = Math.max(1, Number(offer?.packageCredits || 1));
    const finalPriceHuf = Math.max(0, Number(offer?.finalPriceHuf || 0));
    const dueAt = new Date(Date.now() + SERVICE_FRAME_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const requesterName = userData.contactName || userData.displayName || userData.pharmacyName || authUser.email || userData.email || '';
    const invoiceSummary = {
      invoiceType: 'service_frame',
      pharmacyName: userData.companyName || userData.pharmacyName || '',
      companyName: userData.companyName || '',
      taxNumber: userData.taxNumber || '',
      contactName: userData.contactName || requesterName,
      email: userData.billingEmail || authUser.email || userData.email || '',
      phone: userData.pharmaPhone || userData.phone || '',
      pharmacyAddress: userData.pharmacyAddress || '',
      city: userData.pharmacyCity || '',
      zipCode: userData.pharmacyZipCode || '',
      market: userData.market || 'hu',
      packageCredits,
      finalPriceHuf,
      dueAt: dueAt.toISOString(),
      issuedAt: new Date().toISOString(),
      status: 'pending_payment',
    };

    const requestRef = db.collection('demandCreditPurchaseIntents').doc();

    const grantResult = await db.runTransaction(async (tx) => {
      const freshUserSnap = await tx.get(userRef);
      const freshUserData = freshUserSnap.exists ? (freshUserSnap.data() || {}) : {};
      const currentTotal = Math.max(0, Number(freshUserData.demandCreditsTotal) || 0);
      const currentUsed = Math.max(0, Number(freshUserData.demandCreditsUsed) || 0);
      const nextTotal = currentTotal + packageCredits;

      tx.update(userRef, {
        demandCreditsTotal: nextTotal,
        demandCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        demandCreditsUpdatedBy: authUser.uid,
        demandCreditsUpdatedByEmail: authUser.email || '',
      });

      tx.set(requestRef, {
        userId: authUser.uid,
        email: authUser.email || userData.email || '',
        requesterName,
        pharmacyName: userData.companyName || userData.pharmacyName || '',
        companyName: userData.companyName || '',
        taxNumber: userData.taxNumber || '',
        pharmacyAddress: userData.pharmacyAddress || '',
        pharmacyCity: userData.pharmacyCity || '',
        pharmacyZipCode: userData.pharmacyZipCode || '',
        contactName: userData.contactName || requesterName,
        phone: userData.pharmaPhone || userData.phone || '',
        market: userData.market || 'hu',
        packageCredits,
        basePriceHuf: Number(offer?.basePriceHuf || 0),
        discountPercent: Number(offer?.discountPercent || 0),
        finalPriceHuf,
        founderDiscountApplied: Boolean(offer?.discountPercent > 0),
        status: 'pending_payment',
        paymentProvider: 'internal_admin_queue',
        serviceRequestType: 'service_frame_request',
        sentToAdminEmail: 'internal_admin_queue',
        adminQueueSource: 'internal_service_frame_message',
        invoiceSummary,
        autoCredited: true,
        creditedCredits: packageCredits,
        creditedAt: admin.firestore.FieldValue.serverTimestamp(),
        dueAt: admin.firestore.Timestamp.fromDate(dueAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const logRef = db.collection('demandCreditAdminAdjustments').doc();
      tx.set(logRef, {
        userId: authUser.uid,
        userEmail: authUser.email || userData.email || '',
        pharmacyName: userData.pharmacyName || '',
        mode: 'auto_credit_on_request',
        intentId: requestRef.id,
        delta: packageCredits,
        previousTotal: currentTotal,
        previousUsed: currentUsed,
        nextTotal,
        nextUsed: currentUsed,
        note: 'Automatikus jovairas keretigenyles bekuldesekor',
        adminUid: 'system',
        adminEmail: 'system',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { nextTotal };
    });

    try {
      await notifyAdminsOfServiceFrameRequest({
        admin,
        db,
        requestId: requestRef.id,
        requesterName,
        pharmacyName: userData.pharmacyName,
        packageCredits,
        finalPriceHuf,
      });
    } catch (notifyError) {
      console.error('Failed to notify admin about service frame request:', notifyError);
    }

    return NextResponse.json({
      success: true,
      requestId: requestRef.id,
      dueAt: dueAt.toISOString(),
      queue: 'internal_admin_queue',
      creditedCredits: packageCredits,
      totalCredits: grantResult.nextTotal,
    });
  } catch (error) {
    console.error('Service request creation failed:', error);
    return NextResponse.json({
      error: 'A szolgáltatási keret igénylése sikertelen volt.',
      code: 'SERVICE_REQUEST_FAILED',
    }, { status: 500 });
  }
}

