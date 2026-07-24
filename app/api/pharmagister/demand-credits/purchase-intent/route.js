import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import { resolveMarketFromRequest } from '@/lib/market';
import { getDemandPackageOffer } from '@/lib/demandCredits';

function getCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      pharmacyOnly: 'Nur Apothekenkonten koennen Pakete kaufen.',
      profileIncomplete: 'Bitte vervollstaendige zuerst dein Profil.',
      created: 'Kaufanfrage gespeichert. Zahlung wird manuell bestaetigt.',
      failed: 'Fehler beim Speichern der Kaufanfrage.',
    };
  }

  return {
    unauthorized: 'Nincs jogosultsag',
    pharmacyOnly: 'Csak gyogyszertar fiok tud csomagot venni.',
    profileIncomplete: 'Elobb toltsd ki a profilodat.',
    created: 'Vasarlasi igeny rogzitve. A jovairas fizetes utan tortenik.',
    failed: 'Hiba tortent a vasarlasi igeny rogzitese kozben.',
  };
}

export async function POST(request) {
  const requestMarket = resolveMarketFromRequest(request);
  const copy = getCopy(requestMarket);

  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: copy.unauthorized, code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const userRef = db.collection('users').doc(authUser.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};

    if (userData.pharmagisterRole !== 'pharmacy') {
      return Response.json({ error: copy.pharmacyOnly, code: 'PHARMACY_ONLY' }, { status: 403 });
    }

    if (!userData.pharmaProfileComplete) {
      return Response.json({ error: copy.profileIncomplete, code: 'PROFILE_INCOMPLETE' }, { status: 400 });
    }

    const offer = getDemandPackageOffer(userData);

    const intentRef = await db.collection('demandCreditPurchaseIntents').add({
      userId: authUser.uid,
      email: authUser.email || userData.email || '',
      pharmacyName: userData.pharmacyName || '',
      market: userData.market || requestMarket,
      packageCredits: offer.packageCredits,
      basePriceHuf: offer.basePriceHuf,
      discountPercent: offer.discountPercent,
      finalPriceHuf: offer.finalPriceHuf,
      founderDiscountApplied: offer.discountPercent > 0,
      founderValidUntil: offer.founder?.validUntil || null,
      status: 'pending_payment',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,
      intentId: intentRef.id,
      message: copy.created,
      offer,
    });
  } catch (error) {
    console.error('Demand credit purchase intent error:', error);
    return Response.json({ error: copy.failed, code: 'PURCHASE_INTENT_FAILED' }, { status: 500 });
  }
}
