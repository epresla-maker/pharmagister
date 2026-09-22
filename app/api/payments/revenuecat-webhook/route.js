import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { getNativeDemandCreditProductById } from '@/lib/nativeDemandCreditProducts';

export const runtime = 'nodejs';

function parseSignatureHeader(headerValue) {
  const parts = String(headerValue || '').split(',').map((entry) => entry.trim());
  const values = new Map();

  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    if (!key || rest.length === 0) continue;
    values.set(key, rest.join('='));
  }

  return {
    timestamp: values.get('t') || '',
    signature: values.get('v1') || '',
  };
}

function verifyRevenueCatSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!secret) return true;

  const { timestamp, signature } = parseSignatureHeader(signatureHeader);
  if (!timestamp || !signature) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
  } catch {
    return false;
  }
}

function extractCandidateUserIds(event) {
  const aliases = Array.isArray(event?.aliases) ? event.aliases : [];
  return [event?.app_user_id, event?.original_app_user_id, ...aliases]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function getEventCopy(type) {
  if (type === 'NON_RENEWING_PURCHASE' || type === 'INITIAL_PURCHASE') {
    return 'RevenueCat natív vásárlás alapján automatikusan jóváírva.';
  }

  if (type === 'CANCELLATION') {
    return 'RevenueCat vásárlás visszavonva/visszatérítve.';
  }

  return 'RevenueCat esemény feldolgozva.';
}

export async function POST(request) {
  const rawBody = await request.text();
  const authToken = String(process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN || '').trim();
  const authHeader = request.headers.get('authorization');

  if (authToken && authHeader !== `Bearer ${authToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signatureSecret = String(process.env.REVENUECAT_WEBHOOK_HMAC_SECRET || '').trim();
  const signatureHeader = request.headers.get('x-revenuecat-webhook-signature');
  if (!verifyRevenueCatSignature(rawBody, signatureHeader, signatureSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload?.event || {};
  const eventId = String(event?.id || '').trim();
  const eventType = String(event?.type || '').trim();

  if (!eventId || !eventType) {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (eventType === 'TEST') {
    return NextResponse.json({ received: true, test: true });
  }

  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const eventRef = db.collection('revenueCatWebhookEvents').doc(eventId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      if (eventSnap.exists) {
        return { duplicate: true };
      }

      const productId = String(event?.product_id || '').trim();
      const productConfig = getNativeDemandCreditProductById(productId);
      const userIds = extractCandidateUserIds(event);
      const userId = userIds[0] || '';
      const userRef = userId ? db.collection('users').doc(userId) : null;
      const userSnap = userRef ? await tx.get(userRef) : null;

      const baseEventLog = {
        type: eventType,
        store: String(event?.store || ''),
        productId,
        transactionId: String(event?.transaction_id || ''),
        originalTransactionId: String(event?.original_transaction_id || ''),
        appUserId: userId,
        environment: String(event?.environment || ''),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!userRef || !userSnap?.exists || !productConfig) {
        tx.set(eventRef, {
          ...baseEventLog,
          status: 'ignored',
          reason: !productConfig ? 'UNMAPPED_PRODUCT' : 'USER_NOT_FOUND',
        });
        return { ignored: true };
      }

      const userData = userSnap.data() || {};
      const intentId = `rc_${eventId}`;
      const intentRef = db.collection('demandCreditPurchaseIntents').doc(intentId);
      const intentSnap = await tx.get(intentRef);
      const creditAmount = Math.max(1, Number(productConfig.packageCredits) || 4);
      const currentTotal = Math.max(0, Number(userData.demandCreditsTotal) || 0);
      const currentUsed = Math.max(0, Number(userData.demandCreditsUsed) || 0);
      const paymentRef = String(event?.transaction_id || event?.original_transaction_id || eventId);
      const requesterName = userData.contactName || userData.displayName || userData.pharmacyName || userData.email || '';

      if (eventType === 'NON_RENEWING_PURCHASE' || eventType === 'INITIAL_PURCHASE') {
        if (!intentSnap.exists) {
          const nextTotal = currentTotal + creditAmount;

          tx.update(userRef, {
            demandCreditsTotal: nextTotal,
            demandCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            demandCreditsUpdatedBy: 'revenuecat-webhook',
            demandCreditsUpdatedByEmail: userData.email || '',
          });

          tx.set(intentRef, {
            userId,
            email: userData.email || '',
            requesterName,
            pharmacyName: userData.pharmacyName || userData.displayName || '',
            market: userData.market || 'hu',
            packageCredits: creditAmount,
            basePriceHuf: null,
            discountPercent: null,
            catalogFinalPriceHuf: null,
            finalPriceHuf: Number(event?.price_in_purchased_currency) || null,
            founderDiscountApplied: productConfig.kind === 'founder',
            founderValidUntil: null,
            status: 'credited',
            paymentProvider: 'revenuecat',
            paymentRef,
            creditedCredits: creditAmount,
            creditedAt: admin.firestore.FieldValue.serverTimestamp(),
            creditedByUid: 'revenuecat-webhook',
            creditedByEmail: 'revenuecat-webhook',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedByUid: 'revenuecat-webhook',
            updatedByEmail: 'revenuecat-webhook',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            adminNote: getEventCopy(eventType),
            revenueCatEventId: eventId,
            revenueCatTransactionId: String(event?.transaction_id || ''),
            revenueCatOriginalTransactionId: String(event?.original_transaction_id || ''),
            revenueCatProductId: productId,
            revenueCatStore: String(event?.store || ''),
            revenueCatEnvironment: String(event?.environment || ''),
          });

          const logRef = db.collection('demandCreditAdminAdjustments').doc();
          tx.set(logRef, {
            userId,
            userEmail: userData.email || '',
            pharmacyName: userData.pharmacyName || userData.displayName || '',
            mode: 'revenuecat_native_credit',
            intentId,
            delta: creditAmount,
            previousTotal: currentTotal,
            previousUsed: currentUsed,
            nextTotal,
            nextUsed: currentUsed,
            paymentRef,
            note: eventType,
            adminUid: 'revenuecat-webhook',
            adminEmail: 'revenuecat-webhook',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        tx.set(eventRef, {
          ...baseEventLog,
          status: 'processed',
          intentId,
        });

        return { processed: true, type: eventType, intentId };
      }

      if (eventType === 'CANCELLATION' && intentSnap.exists) {
        const intent = intentSnap.data() || {};
        const previouslyCredited = Math.max(0, Number(intent.creditedCredits) || creditAmount);
        const nextTotal = Math.max(currentUsed, currentTotal - previouslyCredited);

        tx.update(userRef, {
          demandCreditsTotal: nextTotal,
          demandCreditsUsed: Math.min(currentUsed, nextTotal),
          demandCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          demandCreditsUpdatedBy: 'revenuecat-webhook',
          demandCreditsUpdatedByEmail: userData.email || '',
        });

        tx.update(intentRef, {
          status: 'cancelled',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUid: 'revenuecat-webhook',
          updatedByEmail: 'revenuecat-webhook',
          adminNote: getEventCopy(eventType),
        });

        const logRef = db.collection('demandCreditAdminAdjustments').doc();
        tx.set(logRef, {
          userId,
          userEmail: userData.email || '',
          pharmacyName: userData.pharmacyName || userData.displayName || '',
          mode: 'revenuecat_native_refund',
          intentId,
          delta: -previouslyCredited,
          previousTotal: currentTotal,
          previousUsed: currentUsed,
          nextTotal,
          nextUsed: Math.min(currentUsed, nextTotal),
          paymentRef,
          note: eventType,
          adminUid: 'revenuecat-webhook',
          adminEmail: 'revenuecat-webhook',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.set(eventRef, {
          ...baseEventLog,
          status: 'processed',
          intentId,
        });

        return { processed: true, type: eventType, intentId };
      }

      tx.set(eventRef, {
        ...baseEventLog,
        status: 'ignored',
        reason: 'UNHANDLED_EVENT',
      });

      return { ignored: true };
    });

    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error('RevenueCat webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
