export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { escapeHtml } from '@/lib/sanitize';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, displayName } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email megadása kötelező' }, { status: 400 });
    }

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
        <h2 style="color: #059669; margin: 10px 0;">Jelszó sikeresen beállítva!</h2>
      </div>
      
      <p>Kedves <strong>${escapeHtml(displayName || 'Felhasználó')}</strong>!</p>
      
      <p>Az új jelszavad sikeresen be lett állítva. Mostantól ezzel tudsz belépni a Pharmagister rendszerbe.</p>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>Belépési email:</strong> ${escapeHtml(email)}</p>
      </div>
      
      <p style="text-align: center;">
        <a href="https://pharmagister.hu/login" class="button">Belépés a Pharmagister-be</a>
      </p>
      
      <p>Ha nem te állítottad be ezt a jelszót, kérjük azonnal vedd fel velünk a kapcsolatot!</p>
      
      <p>Üdvözlettel,<br><strong>A Pharmagister csapata</strong></p>
    </div>
    <div class="footer">
      <p>Ez egy automatikus üzenet a Pharmagister rendszerből.</p>
      <p>© 2026 Pharmagister - Minden jog fenntartva</p>
    </div>
  </div>
</body>
</html>
    `;

    await resend.emails.send({
      from: 'Pharmagister <noreply@pharmagister.hu>',
      to: email,
      subject: '✅ Pharmagister - Jelszó sikeresen beállítva',
      html: htmlContent,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: 'Hiba történt az email küldésekor' }, { status: 500 });
  }
}
