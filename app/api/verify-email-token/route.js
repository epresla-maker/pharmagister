export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { normalizeMarket, resolveMarketFromRequest } from '@/lib/market';

function getVerifyEmailCopy(market) {
  if (market === 'de') {
    return {
      unauthorized: 'Keine Berechtigung',
      serverConfigError: 'Server-Konfigurationsfehler. Bitte kontaktiere den Administrator.',
      missingToken: 'Token fehlt',
      invalidLink: 'Ungueltiger oder bereits verwendeter Verifizierungslink',
      expiredLink: 'Der Verifizierungslink ist abgelaufen. Fordere einen neuen Link an.',
      success: 'E-Mail-Adresse erfolgreich bestaetigt!',
      genericError: 'Fehler bei der E-Mail-Bestaetigung',
    };
  }

  return {
    unauthorized: 'Nincs jogosultság',
    serverConfigError: 'Server konfigurációs hiba. Kérjük, vegye fel a kapcsolatot az adminisztrátorral.',
    missingToken: 'Token hiányzik',
    invalidLink: 'Érvénytelen vagy már felhasznált verifikációs link',
    expiredLink: 'A verifikációs link lejárt. Kérj új linket.',
    success: 'Email cím sikeresen megerősítve!',
    genericError: 'Hiba történt az email megerősítése során',
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const requestMarket = normalizeMarket(body.market || resolveMarketFromRequest(request));
    const copy = getVerifyEmailCopy(requestMarket);
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

    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: copy.missingToken }, { status: 400 });
    }

    const db = admin.firestore();
    const usersRef = db.collection('users');
    
    // Keressük meg a user-t a token alapján
    const snapshot = await usersRef.where('verificationToken', '==', token).get();
    
    if (snapshot.empty) {
      return NextResponse.json({ 
        error: copy.invalidLink 
      }, { status: 404 });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Ellenőrizzük a lejáratot
    if (new Date(userData.verificationTokenExpires) < new Date()) {
      return NextResponse.json({ 
        error: copy.expiredLink 
      }, { status: 410 });
    }

    // Frissítsük a Firestore-t
    await usersRef.doc(userDoc.id).update({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null
    });

    // Frissítsük a Firebase Auth-ot is
    try {
      await admin.auth().updateUser(userDoc.id, {
        emailVerified: true
      });
      console.log('✅ Firebase Auth emailVerified frissítve:', userDoc.id);
    } catch (authError) {
      console.error('⚠️ Firebase Auth frissítés hiba:', authError.message);
      // Firestore már frissítve van, folytatjuk
    }

    return NextResponse.json({ 
      success: true,
      message: copy.success
    });

  } catch (error) {
    console.error('❌ Email verification error:', error);
    return NextResponse.json({ 
      error: getVerifyEmailCopy(resolveMarketFromRequest(request)).genericError,
      details: error.message 
    }, { status: 500 });
  }
}
