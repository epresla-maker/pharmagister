import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

function finalizeErrorResponse(message, appUrl) {
  const escaped = String(message || 'Hiba történt.').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pharmagister</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;background:#f3f4f6;padding:24px;"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.08)"><h1 style="margin:0 0 12px;color:#111827">A véglegesítés nem sikerült</h1><p style="color:#374151;line-height:1.6">${escaped}</p><p style="margin-top:18px"><a href="${appUrl}/forgot-password" style="display:inline-block;background:#059669;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:600">Új link kérése</a></p></div></body></html>`,
    {
      status: 400,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }
  );
}

export async function GET(request) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.hu').trim().replace(/\/$/, '');
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return finalizeErrorResponse('Hiányzó token.', appUrl);
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const tokenRef = db.collection('pharmacyRegistrationRecoveryTokens').doc(token);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      return finalizeErrorResponse('Érvénytelen véglegesítési link.', appUrl);
    }

    const tokenData = tokenSnap.data() || {};
    const now = new Date();
    const expiryDate = tokenData.expiresAt?.toDate?.() || null;

    if (expiryDate && now > expiryDate) {
      return finalizeErrorResponse('A véglegesítési link lejárt.', appUrl);
    }

    const userRef = db.collection('users').doc(tokenData.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return finalizeErrorResponse('A felhasználói profil nem található.', appUrl);
    }

    const userData = userSnap.data() || {};
    const savedResetToken = tokenData.generatedPasswordResetToken;
    const userHasSavedToken = savedResetToken && userData.passwordResetToken === savedResetToken;

    // Allow repeated clicks while password not yet set.
    if (tokenData.used && userHasSavedToken) {
      return NextResponse.redirect(`${appUrl}/set-password?token=${savedResetToken}`);
    }

    if (tokenData.used && !userHasSavedToken) {
      return finalizeErrorResponse('Ez a link már fel lett használva.', appUrl);
    }

    const passwordResetToken = randomBytes(32).toString('hex');
    const resetExpiry = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7));

    await userRef.set(
      {
        passwordResetToken,
        passwordResetTokenExpiry: resetExpiry,
        registrationFinalizeRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await tokenRef.set(
      {
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        clickedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedPasswordResetToken: passwordResetToken,
        redirectUrl: `${appUrl}/set-password?token=${passwordResetToken}`,
      },
      { merge: true }
    );

    return NextResponse.redirect(`${appUrl}/set-password?token=${passwordResetToken}`);
  } catch (error) {
    console.error('pharmacy registration finalize error:', error);
    return finalizeErrorResponse('Technikai hiba történt a véglegesítés közben.', appUrl);
  }
}
