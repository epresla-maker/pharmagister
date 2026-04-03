import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { userId, endpoint } = await request.json();

    if (!userId || !endpoint) {
      return Response.json({ error: 'userId and endpoint are required' }, { status: 400 });
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
