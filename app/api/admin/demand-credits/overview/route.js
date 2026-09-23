import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';
import { resolveMarketFromRequest } from '@/lib/market';

function toIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (_) {
      return null;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate();
    } catch (_) {
      return null;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCopy(market) {
  if (market === 'de') {
    return {
      forbidden: 'Keine Admin-Berechtigung',
      failed: 'Kredit-Uebersicht konnte nicht geladen werden',
    };
  }

  return {
    forbidden: 'Nincs admin jogosultsag',
    failed: 'Nem sikerult betolteni a kredit attekintest',
  };
}

export async function GET(request) {
  const market = resolveMarketFromRequest(request);
  const copy = getCopy(market);

  try {
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: copy.forbidden, code: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const [pharmaciesSnap, intentsSnap] = await Promise.all([
      db.collection('users').where('pharmagisterRole', '==', 'pharmacy').get(),
      db.collection('demandCreditPurchaseIntents').orderBy('createdAt', 'desc').limit(500).get(),
    ]);

    const pharmacies = pharmaciesSnap.docs.map((doc) => {
      const data = doc.data() || {};
      const totalCredits = Math.max(0, asNumber(data.demandCreditsTotal, 0));
      const usedCredits = Math.max(0, asNumber(data.demandCreditsUsed, 0));
      const remainingCredits = Math.max(0, totalCredits - usedCredits);
      const emailVerified = Boolean(data.emailVerified);
      const passwordActivated = Boolean(data.passwordActivated);
      return {
        id: doc.id,
        email: data.email || '',
        contactName: data.contactName || data.displayName || '',
        displayName: data.displayName || '',
        pharmacyName: data.pharmacyName || data.displayName || '',
        pharmacyCity: data.pharmacyCity || '',
        pharmacyZipCode: data.pharmacyZipCode || '',
        phone: data.pharmaPhone || data.phone || '',
        market: data.market || 'hu',
        totalCredits,
        usedCredits,
        remainingCredits,
        emailVerified,
        passwordActivated,
        isActive: emailVerified && passwordActivated,
        profileComplete: Boolean(data.pharmaProfileComplete),
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        creditsUpdatedAt: toIso(data.demandCreditsUpdatedAt),
      };
    });

    const pharmacyById = new Map(pharmacies.map((item) => [item.id, item]));

    const purchaseIntents = intentsSnap.docs.map((doc) => {
      const data = doc.data() || {};
      const owner = pharmacyById.get(String(data.userId || ''));
      const requesterName =
        data.requesterName
        || data.contactName
        || owner?.contactName
        || owner?.displayName
        || owner?.pharmacyName
        || data.pharmacyName
        || '';
      const createdAt = asDate(data.createdAt);
      const dueAtFallback = createdAt ? new Date(createdAt.getTime() + (8 * 24 * 60 * 60 * 1000)) : null;
      const dueAt = asDate(data.dueAt) || dueAtFallback;
      const paymentDueAt = dueAt ? dueAt.toISOString() : null;
      const daysLeft = dueAt ? Math.max(0, Math.ceil((dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
      return {
        id: doc.id,
        userId: data.userId || '',
        email: data.email || owner?.email || '',
        requesterName,
        pharmacyName: data.pharmacyName || owner?.pharmacyName || '',
        market: data.market || 'hu',
        packageCredits: Math.max(0, asNumber(data.packageCredits, 0)),
        basePriceHuf: Math.max(0, asNumber(data.basePriceHuf, 0)),
        discountPercent: Math.max(0, asNumber(data.discountPercent, 0)),
        finalPriceHuf: Math.max(0, asNumber(data.finalPriceHuf, 0)),
        founderDiscountApplied: Boolean(data.founderDiscountApplied),
        status: data.status || 'pending_payment',
        paymentRef: data.paymentRef || '',
        adminNote: data.adminNote || '',
        creditedCredits: Math.max(0, asNumber(data.creditedCredits, 0)),
        creditedByEmail: data.creditedByEmail || '',
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        creditedAt: toIso(data.creditedAt),
        dueAt: paymentDueAt,
        daysLeft,
        serviceRequestType: data.serviceRequestType || 'service_frame_request',
        sentToAdminEmail: data.sentToAdminEmail || '',
        invoiceSummary: data.invoiceSummary || null,
      };
    });

    return NextResponse.json({
      success: true,
      pharmacies,
      purchaseIntents,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin demand credit overview error:', error);
    return NextResponse.json({ error: copy.failed, code: 'OVERVIEW_FAILED' }, { status: 500 });
  }
}
