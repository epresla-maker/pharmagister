import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAuth } from '@/lib/apiAuth';
import { isAdminEmail } from '@/lib/scheduleAccess';
import { resolveMarketFromRequest, isDocInMarket, normalizeMarket } from '@/lib/market';

function isLikelyApnsToken(token) {
  return typeof token === 'string' && /^[0-9a-fA-F]{64}$/.test(token);
}

export async function GET(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    if (userId !== authUser.uid && !isAdminEmail(authUser.email)) {
      return Response.json({ error: 'Nincs jogosultság ehhez a feliratkozáshoz' }, { status: 403 });
    }

    const snapshot = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .get();

    const subscriptions = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((doc) => isDocInMarket(doc, requestMarket));

    const hasSubscription = subscriptions.length > 0;

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
    const requestMarket = resolveMarketFromRequest(request);
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { userId, subscription } = await request.json();

    if (!userId || !subscription) {
      return Response.json({ error: 'userId and subscription are required' }, { status: 400 });
    }

    if (userId !== authUser.uid && !isAdminEmail(authUser.email)) {
      return Response.json({ error: 'Nincs jogosultság ehhez a feliratkozáshoz' }, { status: 403 });
    }

    // Check if subscription already exists
    const existingQuery = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .where('subscription.endpoint', '==', subscription.endpoint)
      .get();

    const existingInMarket = existingQuery.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .find((doc) => isDocInMarket(doc, requestMarket));

    if (existingInMarket) {
      // Update existing subscription
      const docId = existingInMarket.id;
      await db.collection('pushSubscriptions').doc(docId).update({
        subscription,
        market: requestMarket,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // iOS FCM token mentéskor töröljük a régi APNS tokenes iOS rekordokat
      if (subscription.platform === 'ios' && subscription.tokenType === 'fcm') {
        const userSubs = await db.collection('pushSubscriptions').where('userId', '==', userId).get();
        const batch = db.batch();
        userSubs.docs.forEach((doc) => {
          if (doc.id === docId) return;
          const sub = doc.data()?.subscription || {};
          const docMarket = normalizeMarket(doc.data()?.market);
          if (docMarket !== requestMarket) return;
          const isIosSub = sub.platform === 'ios' || sub.endpoint?.startsWith('native-ios-');
          const isApns = sub.tokenType === 'apns' || isLikelyApnsToken(sub.token);
          if (isIosSub && isApns) batch.delete(doc.ref);
        });
        await batch.commit();
      }

      return Response.json({ success: true, message: 'Subscription updated', id: docId });
    }

    // Create new subscription
    const docRef = await db.collection('pushSubscriptions').add({
      userId,
      market: requestMarket,
      subscription,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // iOS FCM token mentéskor töröljük a régi APNS tokenes iOS rekordokat
    if (subscription.platform === 'ios' && subscription.tokenType === 'fcm') {
      const userSubs = await db.collection('pushSubscriptions').where('userId', '==', userId).get();
      const batch = db.batch();
      userSubs.docs.forEach((doc) => {
        if (doc.id === docRef.id) return;
        const sub = doc.data()?.subscription || {};
        const docMarket = normalizeMarket(doc.data()?.market);
        if (docMarket !== requestMarket) return;
        const isIosSub = sub.platform === 'ios' || sub.endpoint?.startsWith('native-ios-');
        const isApns = sub.tokenType === 'apns' || isLikelyApnsToken(sub.token);
        if (isIosSub && isApns) batch.delete(doc.ref);
      });
      await batch.commit();
    }

    return Response.json({ success: true, message: 'Subscription saved', id: docRef.id });

  } catch (error) {
    console.error('Save subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return Response.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const { userId, endpoint } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    if (userId !== authUser.uid && !isAdminEmail(authUser.email)) {
      return Response.json({ error: 'Nincs jogosultság ehhez a feliratkozáshoz' }, { status: 403 });
    }

    let query = db.collection('pushSubscriptions').where('userId', '==', userId);
    
    if (endpoint) {
      query = query.where('subscription.endpoint', '==', endpoint);
    }

    const snapshot = await query.get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      if (!isDocInMarket(doc.data(), requestMarket)) return;
      batch.delete(doc.ref);
    });
    await batch.commit();

    const deleted = snapshot.docs.filter((doc) => isDocInMarket(doc.data(), requestMarket)).length;
    return Response.json({ success: true, deleted });

  } catch (error) {
    console.error('Delete subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
