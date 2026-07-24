import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';
import { resolveMarketFromRequest } from '@/lib/market';

function asInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function getCopy(market) {
  if (market === 'de') {
    return {
      forbidden: 'Keine Admin-Berechtigung',
      missingUserId: 'userId ist erforderlich',
      invalidMode: 'Ungueltiger Modus',
      userNotFound: 'Apothekenkonto nicht gefunden',
      failed: 'Kredit-Aenderung fehlgeschlagen',
    };
  }

  return {
    forbidden: 'Nincs admin jogosultsag',
    missingUserId: 'A userId megadasa kotelezo',
    invalidMode: 'Ervenytelen mod',
    userNotFound: 'A gyogyszertari fiok nem talalhato',
    failed: 'A kreditmodositas sikertelen',
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
    const userId = String(body?.userId || '').trim();
    const mode = String(body?.mode || '').trim();
    const note = String(body?.note || '').trim();
    const paymentRef = String(body?.paymentRef || '').trim();

    if (!userId) {
      return NextResponse.json({ error: copy.missingUserId, code: 'MISSING_USER_ID' }, { status: 400 });
    }
    if (mode !== 'increment' && mode !== 'set') {
      return NextResponse.json({ error: copy.invalidMode, code: 'INVALID_MODE' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);

    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        const err = new Error('USER_NOT_FOUND');
        err.code = 'USER_NOT_FOUND';
        throw err;
      }

      const userData = userSnap.data() || {};
      const currentTotal = Math.max(0, asInt(userData.demandCreditsTotal, 0));
      const currentUsed = Math.max(0, asInt(userData.demandCreditsUsed, 0));

      let nextTotal = currentTotal;
      let nextUsed = currentUsed;

      if (mode === 'increment') {
        const delta = asInt(body?.delta, 0);
        nextTotal = Math.max(0, currentTotal + delta);
        nextUsed = Math.min(currentUsed, nextTotal);
      } else {
        nextTotal = Math.max(0, asInt(body?.totalCredits, currentTotal));
        const requestedUsed = Math.max(0, asInt(body?.usedCredits, currentUsed));
        nextUsed = Math.min(requestedUsed, nextTotal);
      }

      tx.update(userRef, {
        demandCreditsTotal: nextTotal,
        demandCreditsUsed: nextUsed,
        demandCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        demandCreditsUpdatedBy: adminUser.uid,
        demandCreditsUpdatedByEmail: adminUser.email || '',
      });

      const logRef = db.collection('demandCreditAdminAdjustments').doc();
      tx.set(logRef, {
        userId,
        userEmail: userData.email || '',
        pharmacyName: userData.pharmacyName || userData.displayName || '',
        mode,
        delta: mode === 'increment' ? asInt(body?.delta, 0) : null,
        previousTotal: currentTotal,
        previousUsed: currentUsed,
        nextTotal,
        nextUsed,
        paymentRef,
        note,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        userId,
        email: userData.email || '',
        pharmacyName: userData.pharmacyName || userData.displayName || '',
        previousTotal: currentTotal,
        previousUsed: currentUsed,
        totalCredits: nextTotal,
        usedCredits: nextUsed,
        remainingCredits: Math.max(0, nextTotal - nextUsed),
      };
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Admin demand credit adjust error:', error);
    if (error?.code === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: copy.userNotFound, code: 'USER_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: copy.failed, code: 'ADJUST_FAILED' }, { status: 500 });
  }
}
