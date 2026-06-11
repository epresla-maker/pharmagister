import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';
import { resolveMarketFromRequest } from '@/lib/market';

function getAdminDeleteUserCopy(market) {
  if (market === 'de') {
    return {
      missingAdminPermission: 'Keine Admin-Berechtigung',
      serverConfigError: 'Server-Konfigurationsfehler',
      userIdRequired: 'userId ist erforderlich',
      successFull: 'Nutzer/in vollstaendig geloescht (Firestore + Auth + Posts)',
      successPartial: 'Nutzer/in aus Firestore geloescht (Auth-Loeschung fehlgeschlagen)',
      warningManualAuthDelete: 'Firebase-Auth-Loeschung fehlgeschlagen - bitte manuell in der Firebase Console loeschen',
      genericDeleteError: 'Loeschfehler',
    };
  }

  return {
    missingAdminPermission: 'Nincs admin jogosultság',
    serverConfigError: 'Server konfigurációs hiba',
    userIdRequired: 'userId kötelező',
    successFull: 'Felhasználó teljesen törölve (Firestore + Auth + Posts)',
    successPartial: 'Felhasználó törölve Firestore-ból (Auth törlés sikertelen)',
    warningManualAuthDelete: 'Firebase Auth törlés nem sikerült - töröld manuálisan a Firebase Console-ból',
    genericDeleteError: 'Törlési hiba',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getAdminDeleteUserCopy(requestMarket);
    // Verify admin access
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: copy.missingAdminPermission }, { status: 403 });
    }

    // Initialize Firebase Admin
    let admin;
    try {
      admin = getFirebaseAdmin();
    } catch (initError) {
      console.error('❌ Firebase Admin initialization error:', initError);
      return NextResponse.json({ 
        error: copy.serverConfigError,
        details: initError.message 
      }, { status: 500 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: copy.userIdRequired }, { status: 400 });
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
        message: copy.successFull,
        deletedPosts: deletedPosts
      });
    } catch (authError) {
      console.error('⚠️ Auth törlés nem sikerült, de Firestore törölve:', authError.message);
      
      return NextResponse.json({ 
        success: true, 
        message: copy.successPartial,
        deletedPosts: deletedPosts,
        warning: copy.warningManualAuthDelete
      });
    }

  } catch (error) {
    console.error('❌ User törlési hiba:', error);
    const copy = getAdminDeleteUserCopy(resolveMarketFromRequest(request));
    return NextResponse.json({ 
      error: copy.genericDeleteError,
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
