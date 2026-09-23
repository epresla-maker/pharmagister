import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';

function asDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    try { return value.toDate(); } catch (_) { return null; }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request) {
  try {
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Nincs admin jogosultsag', code: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const now = Date.now();
    const snapshot = await db.collection('demandCreditPurchaseIntents').get();
    const expiredIds = [];

    for (const doc of snapshot.docs) {
      const data = doc.data() || {};
      const status = String(data.status || '');
      if (!['pending_payment', 'pending', 'service_request_pending'].includes(status)) continue;

      const dueAt = asDate(data.dueAt || data.paymentDueAt);
      if (!dueAt) continue;
      if (new Date(dueAt).getTime() > now) continue;

      const userId = String(data.userId || '');
      const updates = {
        status: 'expired',
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUid: adminUser.uid,
        updatedByEmail: adminUser.email || '',
        adminNote: data.adminNote || 'Automatikus lejárat: 8 napos határidő letelt.',
      };
      await doc.ref.update(updates);
      expiredIds.push(doc.id);

      if (userId) {
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};
        const totalCredits = Number(userData.demandCreditsTotal || 0);
        const usedCredits = Number(userData.demandCreditsUsed || 0);
        const nextTotal = Math.max(0, totalCredits - Math.max(0, Number(data.creditedCredits || 0)));
        await userRef.update({
          demandCreditsTotal: Math.max(0, nextTotal),
          demandCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          demandCreditsUpdatedBy: adminUser.uid,
          demandCreditsUpdatedByEmail: adminUser.email || '',
        });

        const demandsSnap = await db.collection('pharmaDemands').where('pharmacyId', '==', userId).get();
        const batch = db.batch();
        demandsSnap.docs.forEach((demandDoc) => {
          const demandData = demandDoc.data() || {};
          if (demandData.status === 'deleted') return;
          batch.delete(demandDoc.ref);
        });
        if (demandsSnap.docs.some((d) => (d.data() || {}).status !== 'deleted')) {
          await batch.commit();
        }

        if (usedCredits > 0 && nextTotal < usedCredits) {
          await userRef.update({
            demandCreditsUsed: Math.max(0, Math.min(usedCredits, nextTotal)),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      expiredCount: expiredIds.length,
      expiredIds,
    });
  } catch (error) {
    console.error('Auto-expire service requests failed:', error);
    return NextResponse.json({ error: 'A lejárt keretek feldolgozása sikertelen volt.', code: 'EXPIRE_FAILED' }, { status: 500 });
  }
}
