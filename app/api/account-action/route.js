export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { randomBytes } from 'crypto';
import { resolveMarketFromRequest } from '@/lib/market';

function getAccountActionCopy(market) {
  if (market === 'de') {
    return {
      missingToken: 'Token fehlt',
      invalidToken: 'Ungueltiger Token',
      alreadyUsed: 'Dieser Link wurde bereits verwendet',
      expired: 'Dieser Link ist abgelaufen',
      keepSuccess: 'Dein Konto wurde behalten. Danke!',
      deleteSuccess: 'Dein Konto und alle Daten wurden geloescht. Auf Wiedersehen!',
      unknownAction: 'Unbekannte Aktion',
      serverError: 'Serverfehler',
    };
  }

  return {
    missingToken: 'Token hiányzik',
    invalidToken: 'Érvénytelen token',
    alreadyUsed: 'Ez a link már fel lett használva',
    expired: 'Ez a link lejárt',
    keepSuccess: 'A fiókod meg lett tartva. Köszönjük!',
    deleteSuccess: 'A fiókod és minden adatod törölve lett. Viszlát!',
    unknownAction: 'Ismeretlen művelet',
    serverError: 'Szerver hiba',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getAccountActionCopy(requestMarket);
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const auth = admin.auth();
    const { token, confirm } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: copy.missingToken },
        { status: 400 }
      );
    }

    // Token lekérése
    const tokenDoc = await db.collection('accountActionTokens').doc(token).get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: copy.invalidToken, code: 'INVALID_TOKEN' },
        { status: 404 }
      );
    }

    const tokenData = tokenDoc.data();

    // Ellenőrzések
    if (tokenData.used) {
      return NextResponse.json(
        { error: copy.alreadyUsed, code: 'ALREADY_USED' },
        { status: 400 }
      );
    }

    if (new Date() > tokenData.expiresAt.toDate()) {
      return NextResponse.json(
        { error: copy.expired, code: 'EXPIRED' },
        { status: 400 }
      );
    }

    // Ha csak információ kérés (még nem erősítette meg)
    if (!confirm) {
      return NextResponse.json({
        valid: true,
        action: tokenData.action,
        email: tokenData.email,
        name: tokenData.name
      });
    }

    // Végrehajtás
    if (tokenData.action === 'keep') {
      // Jelszó-aktiváló token generálása
      const passwordResetToken = randomBytes(32).toString('hex');

      // Fiók megtartása + jelszó token mentése
      await db.collection('users').doc(tokenData.userId).update({
        wantsToKeepAccount: true,
        accountKeptAt: new Date(),
        passwordResetToken: passwordResetToken,
        passwordResetTokenExpiry: null // Visszavonásig érvényes
      });

      // Token használtra állítása
      await db.collection('accountActionTokens').doc(token).update({
        used: true,
        usedAt: new Date()
      });

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.hu').trim();

      return NextResponse.json({
        success: true,
        action: 'keep',
        message: copy.keepSuccess,
        passwordSetUrl: `${appUrl}/set-password?token=${passwordResetToken}`
      });

    } else if (tokenData.action === 'delete') {
      // Fiók törlése
      // 1. Firestore user doc törlése
      await db.collection('users').doc(tokenData.userId).delete();

      // 2. Firebase Auth user törlése
      try {
        await auth.deleteUser(tokenData.userId);
      } catch (authError) {
        console.error('Firebase Auth törlési hiba:', authError);
        // Folytatjuk, lehet már törölve van
      }

      // 3. Kapcsolódó adatok törlése (opcionális)
      // Push subscriptions
      const subsSnapshot = await db.collection('pushSubscriptions')
        .where('userId', '==', tokenData.userId)
        .get();
      const deleteBatch = db.batch();
      subsSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();

      // 4. Token használtra állítása
      await db.collection('accountActionTokens').doc(token).update({
        used: true,
        usedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        action: 'delete',
        message: copy.deleteSuccess
      });

    } else {
      return NextResponse.json(
        { error: copy.unknownAction },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Account action hiba:', error);
    return NextResponse.json(
      { error: getAccountActionCopy(resolveMarketFromRequest(request)).serverError, details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint - token információ lekérése
export async function GET(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getAccountActionCopy(requestMarket);
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: copy.missingToken },
        { status: 400 }
      );
    }

    const tokenDoc = await db.collection('accountActionTokens').doc(token).get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: copy.invalidToken, code: 'INVALID_TOKEN' },
        { status: 404 }
      );
    }

    const tokenData = tokenDoc.data();

    if (tokenData.used) {
      return NextResponse.json(
        { error: copy.alreadyUsed, code: 'ALREADY_USED' },
        { status: 400 }
      );
    }

    if (new Date() > tokenData.expiresAt.toDate()) {
      return NextResponse.json(
        { error: copy.expired, code: 'EXPIRED' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      action: tokenData.action,
      email: tokenData.email,
      name: tokenData.name
    });

  } catch (error) {
    console.error('Token lekérési hiba:', error);
    return NextResponse.json(
      { error: getAccountActionCopy(resolveMarketFromRequest(request)).serverError, details: error.message },
      { status: 500 }
    );
  }
}
