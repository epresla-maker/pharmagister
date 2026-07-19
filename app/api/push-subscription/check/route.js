import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import { isAdminEmail } from '../../../../lib/scheduleAccess';
import { resolveMarketFromRequest, isDocInMarket } from '../../../../lib/market';

function getPushSubscriptionCheckCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      requiredFields: 'userId und endpoint sind erforderlich',
      forbidden: 'Keine Berechtigung fuer dieses Abonnement',
    };
  }

  return {
    unauthorized: 'Nincs jogosultság',
    requiredFields: 'A userId és endpoint megadása kötelező',
    forbidden: 'Nincs jogosultság ehhez a feliratkozáshoz',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getPushSubscriptionCheckCopy(requestMarket);
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: copy.unauthorized }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { userId, endpoint } = await request.json();

    if (!userId || !endpoint) {
      return Response.json({ error: copy.requiredFields }, { status: 400 });
    }

    if (userId !== authUser.uid && !isAdminEmail(authUser.email)) {
      return Response.json({ error: copy.forbidden }, { status: 403 });
    }

    // Check if subscription exists for this user with this endpoint
    const existingQuery = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .where('subscription.endpoint', '==', endpoint)
      .get();

    const matching = existingQuery.docs.filter((doc) => isDocInMarket(doc.data(), requestMarket));

    return Response.json({ 
      exists: matching.length > 0,
      count: matching.length
    });

  } catch (error) {
    console.error('Check subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
