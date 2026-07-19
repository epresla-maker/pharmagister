export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { escapeHtml } from '../../../lib/sanitize';
import { resolveMarketFromRequest } from '../../../lib/market';

const resend = new Resend(process.env.RESEND_API_KEY);

function getPasswordConfirmationApiCopy(market) {
  if (market === 'de') {
    return {
      emailRequired: 'E-Mail-Adresse ist erforderlich',
      sendError: 'Fehler beim Senden der E-Mail',
      fallbackUserName: 'Nutzer/in',
      subject: '✅ Pharmagister - Passwort erfolgreich gesetzt',
      successTitle: 'Passwort erfolgreich gesetzt!',
      greeting: 'Hallo',
      intro: 'Dein neues Passwort wurde erfolgreich gesetzt. Ab jetzt kannst du dich damit bei Pharmagister anmelden.',
      loginEmailLabel: 'Anmelde-E-Mail',
      loginButton: 'Bei Pharmagister anmelden',
      warning: 'Falls du dieses Passwort nicht selbst gesetzt hast, kontaktiere uns bitte sofort.',
      regards: 'Viele Gruesse,<br><strong>Dein Pharmagister Team</strong>',
      autoMessage: 'Dies ist eine automatische Nachricht aus dem Pharmagister-System.',
      rightsReserved: '© 2026 Pharmagister - Alle Rechte vorbehalten',
    };
  }

  return {
    emailRequired: 'Email megadása kötelező',
    sendError: 'Hiba történt az email küldésekor',
    fallbackUserName: 'Felhasználó',
    subject: '✅ Pharmagister - Jelszó sikeresen beállítva',
    successTitle: 'Jelszó sikeresen beállítva!',
    greeting: 'Kedves',
    intro: 'Az új jelszavad sikeresen be lett állítva. Mostantól ezzel tudsz belépni a Pharmagister rendszerbe.',
    loginEmailLabel: 'Belépési email',
    loginButton: 'Belépés a Pharmagister-be',
    warning: 'Ha nem te állítottad be ezt a jelszót, kérjük azonnal vedd fel velünk a kapcsolatot!',
    regards: 'Üdvözlettel,<br><strong>A Pharmagister csapata</strong>',
    autoMessage: 'Ez egy automatikus üzenet a Pharmagister rendszerből.',
    rightsReserved: '© 2026 Pharmagister - Minden jog fenntartva',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getPasswordConfirmationApiCopy(requestMarket);
    const { email, displayName } = await request.json();

    if (!email) {
      return NextResponse.json({ error: copy.emailRequired }, { status: 400 });
    }

    const userName = displayName || copy.fallbackUserName;
    const htmlContent = `
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
    .success-box { background: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .success-icon { font-size: 48px; }
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
      <div class="success-box">
        <div class="success-icon">✅</div>
        <h2 style="color: #059669; margin: 10px 0;">${copy.successTitle}</h2>
      </div>
      
      <p>${copy.greeting} <strong>${escapeHtml(userName)}</strong>!</p>
      
      <p>${copy.intro}</p>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>${copy.loginEmailLabel}:</strong> ${escapeHtml(email)}</p>
      </div>
      
      <p style="text-align: center;">
        <a href="https://pharmagister.hu/login" class="button">${copy.loginButton}</a>
      </p>
      
      <p>${copy.warning}</p>
      
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

    await resend.emails.send({
      from: 'Pharmagister <noreply@pharmagister.hu>',
      to: email,
      subject: copy.subject,
      html: htmlContent,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Email send error:', error);
    const copy = getPasswordConfirmationApiCopy(resolveMarketFromRequest(request));
    return NextResponse.json({ error: copy.sendError }, { status: 500 });
  }
}
