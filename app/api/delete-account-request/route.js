import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { escapeHtml } from '@/lib/sanitize';
import { resolveMarketFromRequest } from '@/lib/market';

const resend = new Resend(process.env.RESEND_API_KEY);
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

function getDeleteAccountRequestCopy(market) {
  if (market === 'de') {
    return {
      tooManyRequests: 'Zu viele Anfragen. Bitte versuche es spaeter erneut.',
      emailRequired: 'E-Mail-Adresse ist erforderlich',
      success: 'Anfrage zur Kontoloeschung gesendet',
      genericError: 'Fehler bei der Verarbeitung der Anfrage',
      emailSubject: '🗑️ Neue Kontoloeschungsanfrage - Pharmagister',
      headerTitle: '🗑️ Kontoloeschungsanfrage',
      intro: 'Eine neue Anfrage zur Kontoloeschung ist auf Pharmagister eingegangen.',
      emailLabel: 'E-Mail-Adresse',
      timeLabel: 'Zeitpunkt',
      reasonLabel: 'Loeschgrund',
      actionTitle: '⚠️ Schritte:',
      gdprLabel: 'DSGVO-Frist',
      gdprText: '30 Tage ab Bestaetigung',
      footerTitle: 'Pharmagister Admin-Benachrichtigung',
      locale: 'de-DE',
      step1: 'Pruefe, ob der Benutzer in Firebase existiert',
      step2: 'Sende eine Bestaetigungs-E-Mail an den Benutzer',
      step3Lead: 'Nach Bestaetigung bitte loeschen:',
      subStepAuth: 'Firebase Authentication Konto',
      subStepUserDoc: 'Firestore users Dokument',
      subStepRelated: 'Zugehoerige demands, applications und chats',
      subStepCloudinary: 'Cloudinary Bilder (falls vorhanden)',
      step4: 'Loeschung dokumentieren (DSGVO-Compliance)',
    };
  }

  return {
    tooManyRequests: 'Túl sok kérés. Kérjük próbálja újra később.',
    emailRequired: 'Email cím kötelező',
    success: 'Fiók törlési kérelem elküldve',
    genericError: 'Hiba történt a kérés feldolgozása során',
    emailSubject: '🗑️ Új fiók törlési kérelem - Pharmagister',
    headerTitle: '🗑️ Fiók törlési kérelem',
    intro: 'Új fiók törlési kérelem érkezett a Pharmagister platformon.',
    emailLabel: 'Email cím',
    timeLabel: 'Időpont',
    reasonLabel: 'Törlés oka',
    actionTitle: '⚠️ Teendők:',
    gdprLabel: 'GDPR határidő',
    gdprText: '30 nap a megerősítéstől számítva',
    footerTitle: 'Pharmagister Admin Értesítés',
    locale: 'hu-HU',
    step1: 'Ellenőrizd a felhasználó létezését a Firebase-ben',
    step2: 'Küldj megerősítő emailt a felhasználónak',
    step3Lead: 'Megerősítés után töröld:',
    subStepAuth: 'Firebase Authentication fiók',
    subStepUserDoc: 'Firestore users dokumentum',
    subStepRelated: 'Kapcsolódó demands, applications, chats',
    subStepCloudinary: 'Cloudinary képek (ha vannak)',
    step4: 'Dokumentáld a törlést (GDPR compliance)',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getDeleteAccountRequestCopy(requestMarket);
    // Rate limit: 3 requests per 15 minutes
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`delete-account:${ip}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: copy.tooManyRequests }, { status: 429 });
    }

    const { email, reason, timestamp } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: copy.emailRequired },
        { status: 400 }
      );
    }

    // Email tartalom
    const mailOptions = {
      from: 'Pharmagister <noreply@pharmagister.hu>',
      to: process.env.ADMIN_EMAIL || 'epresla@icloud.com',
      subject: copy.emailSubject,
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
              <h2 style="margin: 0;">${copy.headerTitle}</h2>
            </div>
            <div class="content">
              <p>${copy.intro}</p>
              
              <div class="info-box">
                <p><span class="label">${copy.emailLabel}:</span><br>${escapeHtml(email)}</p>
                <p><span class="label">${copy.timeLabel}:</span><br>${new Date(timestamp).toLocaleString(copy.locale)}</p>
                ${reason ? `<p><span class="label">${copy.reasonLabel}:</span><br>${escapeHtml(reason)}</p>` : ''}
              </div>

              <div class="action-box">
                <strong>${copy.actionTitle}</strong>
                <ol style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>${copy.step1}</li>
                  <li>${copy.step2} (${escapeHtml(email)})</li>
                  <li>${copy.step3Lead}
                    <ul style="margin: 5px 0;">
                      <li>${copy.subStepAuth}</li>
                      <li>${copy.subStepUserDoc}</li>
                      <li>${copy.subStepRelated}</li>
                      <li>${copy.subStepCloudinary}</li>
                    </ul>
                  </li>
                  <li>${copy.step4}</li>
                </ol>
              </div>

              <p style="margin-top: 20px;"><strong>${copy.gdprLabel}:</strong> ${copy.gdprText}</p>
            </div>
            <div class="footer">
              <p>${copy.footerTitle}<br>
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
      message: copy.success 
    });

  } catch (error) {
    console.error('Delete account request error:', error);
    const copy = getDeleteAccountRequestCopy(resolveMarketFromRequest(request));
    return NextResponse.json(
      { error: copy.genericError },
      { status: 500 }
    );
  }
}
