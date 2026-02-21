export const dynamic = "force-static";
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export async function GET(request) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const snapshot = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .get();

    const hasSubscription = !snapshot.empty;
    const subscriptions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ 
      hasSubscription, 
      count: subscriptions.length,
      subscriptions 
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { userId, subscription } = await request.json();

    if (!userId || !subscription) {
      return Response.json({ error: 'userId and subscription are required' }, { status: 400 });
    }

    // Check if subscription already exists
    const existingQuery = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .where('subscription.endpoint', '==', subscription.endpoint)
      .get();

    if (!existingQuery.empty) {
      // Update existing subscription
      const docId = existingQuery.docs[0].id;
      await db.collection('pushSubscriptions').doc(docId).update({
        subscription,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return Response.json({ success: true, message: 'Subscription updated', id: docId });
    }

    // Create new subscription
    const docRef = await db.collection('pushSubscriptions').add({
      userId,
      subscription,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return Response.json({ success: true, message: 'Subscription saved', id: docRef.id });

  } catch (error) {
    console.error('Save subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { userId, endpoint } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    let query = db.collection('pushSubscriptions').where('userId', '==', userId);
    
    if (endpoint) {
      query = query.where('subscription.endpoint', '==', endpoint);
    }

    const snapshot = await query.get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return Response.json({ success: true, deleted: snapshot.size });

  } catch (error) {
    console.error('Delete subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
