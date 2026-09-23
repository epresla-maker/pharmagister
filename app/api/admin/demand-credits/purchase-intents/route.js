import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';
import { resolveMarketFromRequest } from '@/lib/market';
import { DEMAND_PACKAGE_SIZE } from '@/lib/demandCredits';

function asInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function getCopy(market) {
  if (market === 'de') {
    return {
      forbidden: 'Keine Admin-Berechtigung',
      missingIntentId: 'intentId ist erforderlich',
      invalidAction: 'Ungueltige Aktion',
      notFound: 'Kaufanfrage nicht gefunden',
      alreadyCredited: 'Diese Anfrage wurde bereits gutgeschrieben',
      failed: 'Aenderung der Kaufanfrage fehlgeschlagen',
    };
  }

  return {
    forbidden: 'Nincs admin jogosultsag',
    missingIntentId: 'Az intentId kotelezo',
    invalidAction: 'Ervenytelen muvelet',
    notFound: 'A vasarlasi igeny nem talalhato',
    alreadyCredited: 'Ehhez az igenyhez mar megtortent a jovairas',
    failed: 'A vasarlasi igeny frissitese sikertelen',
  };
}

export async function POST(request) {
  const market = resolveMarketFromRequest(request);
  const copy = getCopy(market);

  try {
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: copy.forbidden, code: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const intentId = String(body?.intentId || '').trim();
    const action = String(body?.action || '').trim();
    const nextStatus = String(body?.status || '').trim();
    const paymentRef = String(body?.paymentRef || '').trim();
    const adminNote = String(body?.adminNote || '').trim();

    if (!intentId) {
      return NextResponse.json({ error: copy.missingIntentId, code: 'MISSING_INTENT_ID' }, { status: 400 });
    }
    if (action !== 'approve_and_credit' && action !== 'confirm_payment' && action !== 'set_status') {
      return NextResponse.json({ error: copy.invalidAction, code: 'INVALID_ACTION' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const intentRef = db.collection('demandCreditPurchaseIntents').doc(intentId);

    const result = await db.runTransaction(async (tx) => {
      const intentSnap = await tx.get(intentRef);
      if (!intentSnap.exists) {
        const err = new Error('INTENT_NOT_FOUND');
        err.code = 'INTENT_NOT_FOUND';
        throw err;
      }

      const intent = intentSnap.data() || {};
      const userId = String(intent.userId || '');

      if (action === 'set_status') {
        const resolvedStatus = nextStatus || intent.status || 'pending_payment';
        const shouldRevertCredit = ['rejected', 'cancelled'].includes(resolvedStatus)
          && intent.status === 'pending_payment'
          && !intent.creditReverted
          && asInt(intent.creditedCredits, 0) > 0;

        if (shouldRevertCredit && userId) {
          const userRef = db.collection('users').doc(userId);
          const userSnap = await tx.get(userRef);
          if (userSnap.exists) {
            const userData = userSnap.data() || {};
            const currentTotal = Math.max(0, asInt(userData.demandCreditsTotal, 0));
            const currentUsed = Math.max(0, asInt(userData.demandCreditsUsed, 0));
            const revertAmount = asInt(intent.creditedCredits, 0);
            const nextTotal = Math.max(0, currentTotal - revertAmount);

            tx.update(userRef, {
              demandCreditsTotal: nextTotal,
              demandCreditsUsed: Math.min(currentUsed, nextTotal),
              demandCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
              demandCreditsUpdatedBy: adminUser.uid,
              demandCreditsUpdatedByEmail: adminUser.email || '',
            });

            const logRef = db.collection('demandCreditAdminAdjustments').doc();
            tx.set(logRef, {
              userId,
              userEmail: userData.email || '',
              pharmacyName: userData.pharmacyName || userData.displayName || '',
              mode: 'intent_credit_reverted',
              intentId,
              delta: -revertAmount,
              previousTotal: currentTotal,
              previousUsed: currentUsed,
              nextTotal,
              nextUsed: Math.min(currentUsed, nextTotal),
              note: adminNote || `Keret visszavonva: ${resolvedStatus}`,
              adminUid: adminUser.uid,
              adminEmail: adminUser.email || '',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        tx.update(intentRef, {
          status: resolvedStatus,
          paymentRef,
          adminNote,
          creditReverted: shouldRevertCredit ? true : Boolean(intent.creditReverted),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUid: adminUser.uid,
          updatedByEmail: adminUser.email || '',
        });

        return {
          intentId,
          status: resolvedStatus,
          userId,
          credited: false,
        };
      }

      if (action === 'confirm_payment') {
        if (!userId) {
          const err = new Error('INTENT_NOT_FOUND');
          err.code = 'INTENT_NOT_FOUND';
          throw err;
        }

        const creditAmount = asInt(intent.creditedCredits, asInt(intent.packageCredits, DEMAND_PACKAGE_SIZE));

        // A keret mar a keretigenyles bekuldesekor automatikusan jovairasra kerult
        // (lasd: app/api/pharmagister/service-request/route.js). Itt csak a fizetes
        // igazolasat rogzitjuk, hogy a lejarati automatika ne vonja vissza a keretet.
        tx.update(intentRef, {
          status: 'paid_confirmed',
          creditedCredits: creditAmount,
          paymentRef,
          adminNote,
          creditedAt: intent.creditedAt || admin.firestore.FieldValue.serverTimestamp(),
          paidConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          creditedByUid: adminUser.uid,
          creditedByEmail: adminUser.email || '',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUid: adminUser.uid,
          updatedByEmail: adminUser.email || '',
        });

        const logRef = db.collection('demandCreditAdminAdjustments').doc();
        tx.set(logRef, {
          userId,
          mode: 'intent_payment_confirmed',
          intentId,
          delta: 0,
          note: adminNote || 'Fizetes igazolva, keret mar korabban jovairva',
          paymentRef,
          adminUid: adminUser.uid,
          adminEmail: adminUser.email || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          intentId,
          userId,
          status: 'paid_confirmed',
          credited: true,
          creditedCredits: creditAmount,
        };
      }

      if (intent.creditedAt || intent.status === 'credited' || intent.status === 'paid_confirmed') {
        const err = new Error('ALREADY_CREDITED');
        err.code = 'ALREADY_CREDITED';
        throw err;
      }

      if (!userId) {
        const err = new Error('INTENT_NOT_FOUND');
        err.code = 'INTENT_NOT_FOUND';
        throw err;
      }

      const userRef = db.collection('users').doc(userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        const err = new Error('INTENT_NOT_FOUND');
        err.code = 'INTENT_NOT_FOUND';
        throw err;
      }

      const userData = userSnap.data() || {};
      const currentTotal = Math.max(0, asInt(userData.demandCreditsTotal, 0));
      const currentUsed = Math.max(0, asInt(userData.demandCreditsUsed, 0));
      const creditAmount = Math.max(1, asInt(body?.creditedCredits, asInt(intent.packageCredits, DEMAND_PACKAGE_SIZE)));
      const nextTotal = currentTotal + creditAmount;

      tx.update(userRef, {
        demandCreditsTotal: nextTotal,
        demandCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        demandCreditsUpdatedBy: adminUser.uid,
        demandCreditsUpdatedByEmail: adminUser.email || '',
      });

      tx.update(intentRef, {
        status: 'credited',
        creditedCredits: creditAmount,
        paymentRef,
        adminNote,
        creditedAt: admin.firestore.FieldValue.serverTimestamp(),
        creditedByUid: adminUser.uid,
        creditedByEmail: adminUser.email || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUid: adminUser.uid,
        updatedByEmail: adminUser.email || '',
      });

      const logRef = db.collection('demandCreditAdminAdjustments').doc();
      tx.set(logRef, {
        userId,
        userEmail: userData.email || '',
        pharmacyName: userData.pharmacyName || userData.displayName || '',
        mode: 'intent_credit',
        intentId,
        delta: creditAmount,
        previousTotal: currentTotal,
        previousUsed: currentUsed,
        nextTotal,
        nextUsed: currentUsed,
        paymentRef,
        note: adminNote,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        intentId,
        userId,
        status: 'credited',
        credited: true,
        creditedCredits: creditAmount,
        totalCredits: nextTotal,
        usedCredits: currentUsed,
        remainingCredits: Math.max(0, nextTotal - currentUsed),
      };
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Admin purchase intent action error:', error);

    if (error?.code === 'INTENT_NOT_FOUND') {
      return NextResponse.json({ error: copy.notFound, code: 'INTENT_NOT_FOUND' }, { status: 404 });
    }
    if (error?.code === 'ALREADY_CREDITED') {
      return NextResponse.json({ error: copy.alreadyCredited, code: 'ALREADY_CREDITED' }, { status: 409 });
    }

    return NextResponse.json({ error: copy.failed, code: 'INTENT_ACTION_FAILED' }, { status: 500 });
  }
}
