import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();
const auth = admin.auth();

export async function POST(request) {
  try {
    // Rate limit: 10 requests per 15 minutes
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: 'Túl sok kérés. Kérjük próbálja újra később.' }, { status: 429 });
    }

    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token és jelszó megadása kötelező' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'A jelszónak legalább 8 karakter hosszúnak kell lennie' }, { status: 400 });
    }

    // Find user by reset token
    const usersSnapshot = await db.collection('users')
      .where('passwordResetToken', '==', token)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ error: 'Érvénytelen vagy lejárt token' }, { status: 400 });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    // Check token expiry - null means never expires (visszavonásig érvényes)
    const tokenExpiry = userData.passwordResetTokenExpiry?.toDate?.() || userData.passwordResetTokenExpiry;
    if (tokenExpiry && new Date() > new Date(tokenExpiry)) {
      return NextResponse.json({ error: 'A token lejárt. Kérj új jelszó-visszaállító linket!' }, { status: 400 });
    }

    // Update password in Firebase Auth + email megerősítése
    await auth.updateUser(userId, {
      password: newPassword,
      emailVerified: true
    });

    // Update Firestore - mark password as activated, remove token
    await db.collection('users').doc(userId).update({
      passwordActivated: true,
      passwordActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastPasswordChange: admin.firestore.FieldValue.serverTimestamp(),
      emailVerified: true,
      passwordResetToken: admin.firestore.FieldValue.delete(),
      passwordResetTokenExpiry: admin.firestore.FieldValue.delete()
    });

    // Return user info for sending confirmation email
    return NextResponse.json({ 
      success: true, 
      message: 'Jelszó sikeresen beállítva!',
      user: {
        email: userData.email,
        displayName: userData.displayName || userData.name
      }
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Hiba történt: ' + error.message }, { status: 500 });
  }
}
