import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const auth = admin.auth();
    const { token, confirm } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token hiányzik' },
        { status: 400 }
      );
    }

    // Token lekérése
    const tokenDoc = await db.collection('accountActionTokens').doc(token).get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'Érvénytelen token', code: 'INVALID_TOKEN' },
        { status: 404 }
      );
    }

    const tokenData = tokenDoc.data();

    // Ellenőrzések
    if (tokenData.used) {
      return NextResponse.json(
        { error: 'Ez a link már fel lett használva', code: 'ALREADY_USED' },
        { status: 400 }
      );
    }

    if (new Date() > tokenData.expiresAt.toDate()) {
      return NextResponse.json(
        { error: 'Ez a link lejárt', code: 'EXPIRED' },
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
      // Fiók megtartása - jelöljük meg, hogy aktív akar maradni
      await db.collection('users').doc(tokenData.userId).update({
        wantsToKeepAccount: true,
        accountKeptAt: new Date()
      });

      // Token használtra állítása
      await db.collection('accountActionTokens').doc(token).update({
        used: true,
        usedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        action: 'keep',
        message: 'A fiókod meg lett tartva. Köszönjük!'
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
        message: 'A fiókod és minden adatod törölve lett. Viszlát!'
      });

    } else {
      return NextResponse.json(
        { error: 'Ismeretlen művelet' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Account action hiba:', error);
    return NextResponse.json(
      { error: 'Szerver hiba', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint - token információ lekérése
export async function GET(request) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token hiányzik' },
        { status: 400 }
      );
    }

    const tokenDoc = await db.collection('accountActionTokens').doc(token).get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'Érvénytelen token', code: 'INVALID_TOKEN' },
        { status: 404 }
      );
    }

    const tokenData = tokenDoc.data();

    if (tokenData.used) {
      return NextResponse.json(
        { error: 'Ez a link már fel lett használva', code: 'ALREADY_USED' },
        { status: 400 }
      );
    }

    if (new Date() > tokenData.expiresAt.toDate()) {
      return NextResponse.json(
        { error: 'Ez a link lejárt', code: 'EXPIRED' },
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
      { error: 'Szerver hiba', details: error.message },
      { status: 500 }
    );
  }
}
