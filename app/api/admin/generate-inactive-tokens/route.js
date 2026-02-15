import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Inaktív felhasználók: nincs lastLogin ÉS nincs lastSeen ÉS nem aktiválta a jelszót
    const inactiveUsers = users.filter(user => 
      !user.lastLogin && !user.lastSeen && !user.passwordActivated
    );

    const tokens = [];
    const batch = db.batch();

    for (const user of inactiveUsers) {
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

      tokens.push({
        userId: user.id,
        email: user.email,
        name: user.name || user.displayName || 'Felhasználó',
        keepToken,
        deleteToken,
        keepLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.hu'}/account-action/${keepToken}`,
        deleteLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.hu'}/account-action/${deleteToken}`
      });
    }

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      count: inactiveUsers.length,
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
