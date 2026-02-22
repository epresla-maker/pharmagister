import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Verify Firebase ID token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (tokenError) {
      return NextResponse.json({ error: 'Érvénytelen token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;
    console.log('🗑️ Fiók törlés indul:', userId, userEmail);

    const deletionResults = {};

    // 1. Delete user document
    try {
      await db.collection('users').doc(userId).delete();
      deletionResults.users = 'deleted';
    } catch (e) {
      deletionResults.users = `error: ${e.message}`;
    }

    // 2. Delete serviceFeedPosts
    try {
      const posts = await db.collection('serviceFeedPosts').where('userId', '==', userId).get();
      const batch1 = db.batch();
      posts.docs.forEach(doc => batch1.delete(doc.ref));
      if (posts.size > 0) await batch1.commit();
      deletionResults.serviceFeedPosts = posts.size;
    } catch (e) {
      deletionResults.serviceFeedPosts = `error: ${e.message}`;
    }

    // 3. Delete allandoKeresPosts
    try {
      const posts = await db.collection('allandoKeresPosts').where('userId', '==', userId).get();
      const batch2 = db.batch();
      posts.docs.forEach(doc => batch2.delete(doc.ref));
      if (posts.size > 0) await batch2.commit();
      deletionResults.allandoKeresPosts = posts.size;
    } catch (e) {
      deletionResults.allandoKeresPosts = `error: ${e.message}`;
    }

    // 4. Delete pharmaDemands
    try {
      const demands = await db.collection('pharmaDemands').where('userId', '==', userId).get();
      const batch3 = db.batch();
      demands.docs.forEach(doc => batch3.delete(doc.ref));
      if (demands.size > 0) await batch3.commit();
      deletionResults.pharmaDemands = demands.size;
    } catch (e) {
      deletionResults.pharmaDemands = `error: ${e.message}`;
    }

    // 5. Delete pharmaApplications
    try {
      const apps = await db.collection('pharmaApplications').where('userId', '==', userId).get();
      const batch4 = db.batch();
      apps.docs.forEach(doc => batch4.delete(doc.ref));
      if (apps.size > 0) await batch4.commit();
      deletionResults.pharmaApplications = apps.size;
    } catch (e) {
      deletionResults.pharmaApplications = `error: ${e.message}`;
    }

    // 6. Delete notifications (where user is recipient)
    try {
      const notifs = await db.collection('notifications').where('userId', '==', userId).get();
      const batch5 = db.batch();
      notifs.docs.forEach(doc => batch5.delete(doc.ref));
      if (notifs.size > 0) await batch5.commit();
      deletionResults.notifications = notifs.size;
    } catch (e) {
      deletionResults.notifications = `error: ${e.message}`;
    }

    // 7. Delete pushSubscriptions
    try {
      const subs = await db.collection('pushSubscriptions').where('userId', '==', userId).get();
      const batch6 = db.batch();
      subs.docs.forEach(doc => batch6.delete(doc.ref));
      if (subs.size > 0) await batch6.commit();
      deletionResults.pushSubscriptions = subs.size;
    } catch (e) {
      deletionResults.pushSubscriptions = `error: ${e.message}`;
    }

    // 8. Delete chats where user is participant + their messages
    try {
      const chats = await db.collection('chats').where('participants', 'array-contains', userId).get();
      let deletedChats = 0;
      for (const chatDoc of chats.docs) {
        // Delete all messages in the chat
        const messages = await chatDoc.ref.collection('messages').get();
        const msgBatch = db.batch();
        messages.docs.forEach(doc => msgBatch.delete(doc.ref));
        if (messages.size > 0) await msgBatch.commit();
        // Delete the chat document
        await chatDoc.ref.delete();
        deletedChats++;
      }
      deletionResults.chats = deletedChats;
    } catch (e) {
      deletionResults.chats = `error: ${e.message}`;
    }

    // 9. Delete blockedUsers (where user is blocker)
    try {
      const blocks = await db.collection('blockedUsers').where('blockerId', '==', userId).get();
      const batch7 = db.batch();
      blocks.docs.forEach(doc => batch7.delete(doc.ref));
      if (blocks.size > 0) await batch7.commit();
      deletionResults.blockedUsers = blocks.size;
    } catch (e) {
      deletionResults.blockedUsers = `error: ${e.message}`;
    }

    // 10. Delete reports by user
    try {
      const reports = await db.collection('reports').where('reporterId', '==', userId).get();
      const batch8 = db.batch();
      reports.docs.forEach(doc => batch8.delete(doc.ref));
      if (reports.size > 0) await batch8.commit();
      deletionResults.reports = reports.size;
    } catch (e) {
      deletionResults.reports = `error: ${e.message}`;
    }

    // 11. Finally, delete Firebase Auth account
    try {
      await admin.auth().deleteUser(userId);
      deletionResults.auth = 'deleted';
    } catch (e) {
      deletionResults.auth = `error: ${e.message}`;
    }

    console.log('✅ Fiók törlés befejezve:', userId, deletionResults);

    return NextResponse.json({
      success: true,
      message: 'Fiók és összes adat sikeresen törölve',
      details: deletionResults
    });

  } catch (error) {
    console.error('❌ Fiók törlési hiba:', error);
    return NextResponse.json({
      error: 'Törlési hiba történt',
      details: error.message
    }, { status: 500 });
  }
}
