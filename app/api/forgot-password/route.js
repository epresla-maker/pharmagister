import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
import { randomBytes } from 'crypto';
import { escapeHtml } from '@/lib/sanitize';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { resolveMarketFromRequest } from '@/lib/market';

function getForgotPasswordCopy(market) {
  if (market === 'de') {
    return {
      tooManyRequests: 'Zu viele Anfragen. Bitte versuche es spaeter erneut.',
      emailRequired: 'E-Mail-Adresse ist erforderlich',
      genericSuccess: 'Wenn die E-Mail-Adresse im System existiert, haben wir einen Link zum Zuruecksetzen des Passworts gesendet.',
      fallbackUserName: 'Nutzer/in',
      genericError: 'Fehler. Bitte versuche es spaeter erneut.',
      subject: 'Pharmagister - Passwort zuruecksetzen',
      greeting: 'Hallo',
      intro: 'Wir haben eine Anfrage zum Zuruecksetzen deines Passworts erhalten.',
      ctaText: 'Neues Passwort setzen',
      accountEmailLabel: 'Konto-E-Mail',
      expiryText: 'Der Link ist 24 Stunden gueltig.',
      fallbackLinkText: 'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
      ignoreText: 'Wenn du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail bitte.',
      regards: 'Viele Gruesse,<br><strong>Dein Pharmagister Team</strong>',
      autoMessage: 'Dies ist eine automatische Nachricht aus dem Pharmagister-System.',
      rightsReserved: '© 2026 Pharmagister - Alle Rechte vorbehalten',
    };
  }

  return {
    tooManyRequests: 'Túl sok kérés. Kérjük próbálja újra később.',
    emailRequired: 'Email cím megadása kötelező',
    genericSuccess: 'Ha az email cím létezik a rendszerben, küldtünk egy jelszó-visszaállító linket.',
    fallbackUserName: 'Felhasználó',
    genericError: 'Hiba történt. Kérlek próbáld újra később.',
    subject: 'Pharmagister - Jelszó visszaállítás',
    greeting: 'Kedves',
    intro: 'Jelszó-visszaállítási kérelmet kaptunk a fiókodhoz.',
    ctaText: 'Új jelszó beállítása',
    accountEmailLabel: 'Fiók email',
    expiryText: 'A link 24 óráig érvényes.',
    fallbackLinkText: 'Ha a gomb nem működik, másold be ezt a linket a böngésződbe:',
    ignoreText: 'Ha nem te kérted a jelszó-visszaállítást, kérlek hagyd figyelmen kívül ezt az emailt.',
    regards: 'Üdvözlettel,<br><strong>A Pharmagister csapata</strong>',
    autoMessage: 'Ez egy automatikus üzenet a Pharmagister rendszerből.',
    rightsReserved: '© 2026 Pharmagister - Minden jog fenntartva',
  };
}

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

// Email sablon
function generateEmailHtml(name, email, resetLink, copy) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pharmagister</h1>
    </div>
    <div class="content">
      <p>${copy.greeting} <strong>${escapeHtml(name)}</strong>!</p>
      
      <p>${copy.intro}</p>
      
      <p>${copy.ctaText}:</p>
      
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">${copy.ctaText}</a>
      </p>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>${copy.accountEmailLabel}:</strong> ${escapeHtml(email)}</p>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">${copy.expiryText}</p>
      </div>
      
      <p>${copy.fallbackLinkText}</p>
      <p style="font-size: 12px; word-break: break-all; color: #6b7280;">${resetLink}</p>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
        ${copy.ignoreText}
      </p>
      
      <p>${copy.regards}</p>
    </div>
    <div class="footer">
      <p>${copy.autoMessage}</p>
      <p>${copy.rightsReserved}</p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getForgotPasswordCopy(requestMarket);
    // Rate limit: 5 requests per 15 minutes
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: copy.tooManyRequests }, { status: 429 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: copy.emailRequired }, { status: 400 });
    }

    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    // Security: always return success even if user not found (prevent email enumeration)
    if (usersSnapshot.empty) {
      console.log('Forgot password requested for non-existent email:', email);
      return NextResponse.json({ 
        success: true, 
        message: copy.genericSuccess 
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    
    // Token expires in 24 hours
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24);

    // Save token to Firestore (use Firestore Timestamp)
    await db.collection('users').doc(userId).update({
      passwordResetToken: resetToken,
      passwordResetTokenExpiry: admin.firestore.Timestamp.fromDate(tokenExpiry)
    });

    // Create reset link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pharmagister.hu';
    const resetLink = `${baseUrl}/set-password?token=${resetToken}`;
    const userName = userData.name || userData.displayName || copy.fallbackUserName;

    // Send email via Resend
    await resend.emails.send({
      from: 'Pharmagister <noreply@pharmagister.hu>',
      to: email,
      subject: copy.subject,
      html: generateEmailHtml(userName, email, resetLink, copy),
    });

    console.log('Password reset email sent to:', email);

    return NextResponse.json({ 
      success: true, 
      message: copy.genericSuccess 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    console.error('Error details:', error.message, error.stack);
    const copy = getForgotPasswordCopy(resolveMarketFromRequest(request));
    return NextResponse.json({ 
      error: copy.genericError,
      details: error.message 
    }, { status: 500 });
  }
}
