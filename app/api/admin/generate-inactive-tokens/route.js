import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';
import { verifyAdmin } from '@/lib/apiAuth';

export async function POST(request) {
  try {
    // Verify admin access
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Nincs admin jogosultság' }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Opcionális: ha body-ban jön userId lista, azokat használjuk
    let targetUserIds = null;
    try {
      const body = await request.json();
      if (body.userIds && Array.isArray(body.userIds) && body.userIds.length > 0) {
        targetUserIds = body.userIds;
      }
    } catch {}

    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    let targetUsers;
    if (targetUserIds) {
      // Kiválasztott felhasználók (admin által)
      targetUsers = users.filter(user => targetUserIds.includes(user.id));
    } else {
      // Alapértelmezett: inaktív felhasználók
      targetUsers = users.filter(user => 
        !user.lastLogin && !user.lastSeen && !user.passwordActivated
      );
    }

    const tokens = [];
    const batch = db.batch();

    for (const user of targetUsers) {
      // Keep token
      const keepToken = uuidv4();
      const keepRef = db.collection('accountActionTokens').doc(keepToken);
      const keepData = {
        token: keepToken,
        userId: user.id,
        email: user.email,
        name: user.name || user.displayName || 'Felhasználó',
        action: 'keep',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 nap
        used: false
      };
      batch.set(keepRef, keepData);

      // Delete token
      const deleteToken = uuidv4();
      const deleteRef = db.collection('accountActionTokens').doc(deleteToken);
      const deleteData = {
        token: deleteToken,
        userId: user.id,
        email: user.email,
        name: user.name || user.displayName || 'Felhasználó',
        action: 'delete',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 nap
        used: false
      };
      batch.set(deleteRef, deleteData);

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.hu').trim();
      tokens.push({
        userId: user.id,
        email: user.email,
        name: user.name || user.displayName || 'Felhasználó',
        keepToken,
        deleteToken,
        keepLink: `${appUrl}/account-action/${keepToken}`,
        deleteLink: `${appUrl}/account-action/${deleteToken}`
      });
    }

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      count: targetUsers.length,
      tokens 
    });
  } catch (error) {
    console.error('Token generálási hiba:', error);
    return NextResponse.json(
      { error: 'Token generálási hiba', details: error.message },
      { status: 500 }
    );
  }
}
