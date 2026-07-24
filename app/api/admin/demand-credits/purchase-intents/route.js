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
    if (action !== 'approve_and_credit' && action !== 'set_status') {
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
        tx.update(intentRef, {
          status: nextStatus || intent.status || 'pending_payment',
          paymentRef,
          adminNote,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUid: adminUser.uid,
          updatedByEmail: adminUser.email || '',
        });

        return {
          intentId,
          status: nextStatus || intent.status || 'pending_payment',
          userId,
          credited: false,
        };
      }

      if (intent.creditedAt || intent.status === 'credited') {
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
