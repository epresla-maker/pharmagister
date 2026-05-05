import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import { isAdminEmail } from '@/lib/scheduleAccess';

export async function POST(request) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { userId, endpoint } = await request.json();

    if (!userId || !endpoint) {
      return Response.json({ error: 'userId and endpoint are required' }, { status: 400 });
    }

    if (userId !== authUser.uid && !isAdminEmail(authUser.email)) {
      return Response.json({ error: 'Nincs jogosultság ehhez a feliratkozáshoz' }, { status: 403 });
    }

    // Check if subscription exists for this user with this endpoint
    const existingQuery = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .where('subscription.endpoint', '==', endpoint)
      .get();

    return Response.json({ 
      exists: !existingQuery.empty,
      count: existingQuery.size
    });

  } catch (error) {
    console.error('Check subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
