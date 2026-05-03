import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { escapeHtml } from '@/lib/sanitize';

const resend = new Resend(process.env.RESEND_API_KEY);
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request) {
  try {
    // Rate limit: 3 requests per 15 minutes
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`delete-account:${ip}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: 'Túl sok kérés. Kérjük próbálja újra később.' }, { status: 429 });
    }

    const { email, reason, timestamp } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email cím kötelező' },
        { status: 400 }
      );
    }

    // Email tartalom
    const mailOptions = {
      from: 'Pharmagister <onboarding@resend.dev>',
      to: process.env.ADMIN_EMAIL || 'epresla@icloud.com',
      subject: '🗑️ Új fiók törlési kérelem - Pharmagister',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6b46c1 0%, #8b5cf6 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
            .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444; }
            .label { font-weight: bold; color: #6b46c1; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            .action-box { background: #fef3c7; border: 2px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">🗑️ Fiók törlési kérelem</h2>
            </div>
            <div class="content">
              <p>Új fiók törlési kérelem érkezett a Pharmagister platformon.</p>
              
              <div class="info-box">
                <p><span class="label">Email cím:</span><br>${escapeHtml(email)}</p>
                <p><span class="label">Időpont:</span><br>${new Date(timestamp).toLocaleString('hu-HU')}</p>
                ${reason ? `<p><span class="label">Törlés oka:</span><br>${escapeHtml(reason)}</p>` : ''}
              </div>

              <div class="action-box">
                <strong>⚠️ Teendők:</strong>
                <ol style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>Ellenőrizd a felhasználó létezését a Firebase-ben</li>
                  <li>Küldj megerősítő emailt a felhasználónak (${escapeHtml(email)})</li>
                  <li>Megerősítés után töröld:
                    <ul style="margin: 5px 0;">
                      <li>Firebase Authentication fiók</li>
                      <li>Firestore users dokumentum</li>
                      <li>Kapcsolódó demands, applications, chats</li>
                      <li>Cloudinary képek (ha vannak)</li>
                    </ul>
                  </li>
                  <li>Dokumentáld a törlést (GDPR compliance)</li>
                </ol>
              </div>

              <p style="margin-top: 20px;"><strong>GDPR határidő:</strong> 30 nap a megerősítéstől számítva</p>
            </div>
            <div class="footer">
              <p>Pharmagister Admin Értesítés<br>
              <a href="https://pharmagister.hu">pharmagister.hu</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await resend.emails.send(mailOptions);

    return NextResponse.json({ 
      success: true, 
      message: 'Fiók törlési kérelem elküldve' 
    });

  } catch (error) {
    console.error('Delete account request error:', error);
    return NextResponse.json(
      { error: 'Hiba történt a kérés feldolgozása során' },
      { status: 500 }
    );
  }
}
