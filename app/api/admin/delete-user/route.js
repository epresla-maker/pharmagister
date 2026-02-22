import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';

export async function POST(request) {
  try {
    // Verify admin access
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Nincs admin jogosultság' }, { status: 403 });
    }

    // Initialize Firebase Admin
    let admin;
    try {
      admin = getFirebaseAdmin();
    } catch (initError) {
      console.error('❌ Firebase Admin initialization error:', initError);
      return NextResponse.json({ 
        error: 'Server konfigurációs hiba',
        details: initError.message 
      }, { status: 500 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId kötelező' }, { status: 400 });
    }

    console.log('🗑️ Törlés indul:', userId);

    let deletedPosts = 0;

    // 1. Firestore-ból törlés
    try {
      await admin.firestore().collection('users').doc(userId).delete();
      console.log('✅ User törölve Firestore-ból:', userId);
    } catch (firestoreError) {
      console.error('⚠️ Firestore törlési hiba:', firestoreError.message);
    }

    // 2. Kapcsolódó adatok törlése (posztok)
    try {
      const postsSnapshot = await admin.firestore()
        .collection('servicePosts')
        .where('userId', '==', userId)
        .get();
      
      const deletePromises = postsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      deletedPosts = postsSnapshot.size;
      console.log(`✅ ${deletedPosts} db poszt törölve`);
    } catch (postsError) {
      console.error('⚠️ Posztok törlési hiba:', postsError.message);
    }

    // 3. Firebase Auth törlés (utoljára, ha sikertelen se probléma)
    try {
      await admin.auth().deleteUser(userId);
      console.log('✅ User törölve Firebase Auth-ból is:', userId);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Felhasználó teljesen törölve (Firestore + Auth + Posts)',
        deletedPosts: deletedPosts
      });
    } catch (authError) {
      console.error('⚠️ Auth törlés nem sikerült, de Firestore törölve:', authError.message);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Felhasználó törölve Firestore-ból (Auth törlés sikertelen)',
        deletedPosts: deletedPosts,
        warning: 'Firebase Auth törlés nem sikerült - töröld manuálisan a Firebase Console-ból'
      });
    }

  } catch (error) {
    console.error('❌ User törlési hiba:', error);
    return NextResponse.json({ 
      error: 'Törlési hiba',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
