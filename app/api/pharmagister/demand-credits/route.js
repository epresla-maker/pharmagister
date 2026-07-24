import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import { resolveMarketFromRequest } from '@/lib/market';
import { getDemandCreditBalance, getDemandPackageOffer } from '@/lib/demandCredits';

function getCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      pharmacyOnly: 'Nur Apothekenkonten koennen Credits verwalten.',
    };
  }

  return {
    unauthorized: 'Nincs jogosultsag',
    pharmacyOnly: 'Csak gyogyszertar szerepkorrel kezelhetok a kreditek.',
  };
}

export async function GET(request) {
  const requestMarket = resolveMarketFromRequest(request);
  const copy = getCopy(requestMarket);

  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: copy.unauthorized, code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const userSnap = await db.collection('users').doc(authUser.uid).get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};

    if (userData.pharmagisterRole !== 'pharmacy') {
      return Response.json({ error: copy.pharmacyOnly, code: 'PHARMACY_ONLY' }, { status: 403 });
    }

    const balance = getDemandCreditBalance(userData);
    const offer = getDemandPackageOffer(userData);

    return Response.json({
      success: true,
      balance,
      offer,
    });
  } catch (error) {
    console.error('Demand credits status error:', error);
    return Response.json({ error: 'STATUS_FAILED', code: 'STATUS_FAILED' }, { status: 500 });
  }
}
