export const dynamic = "force-dynamic";
import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { sanitizeUrl } from '@/lib/sanitize';
import { resolveMarketFromRequest } from '@/lib/market';

function getVerificationApiCopy(market) {
  if (market === 'de') {
    return {
      success: 'Bestaetigungs-E-Mail erfolgreich gesendet',
      error: 'Senden der E-Mail fehlgeschlagen',
      subject: 'Bestaetige deine E-Mail-Adresse - Pharmagister',
      tagline: 'Vertretungsplattform fuer Apotheken',
      heading: 'Willkommen!',
      intro: 'Danke fuer deine Registrierung bei Pharmagister!',
      actionPrompt: 'Bitte bestaetige deine E-Mail-Adresse ueber den folgenden Button:',
      button: '✅ E-Mail-Adresse bestaetigen',
      fallbackPrompt: 'Wenn der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
      postActivation: 'Nach der Aktivierung kannst du das System vollumfaenglich nutzen und auf alle Funktionen zugreifen.',
      ignoreNote: 'Wenn du dich nicht registriert hast, ignoriere diese E-Mail bitte.',
      regards: 'Viele Gruesse,<br>Dein Pharmagister Team',
    };
  }

  return {
    success: 'Megerősítő email sikeresen elküldve',
    error: 'Nem sikerült elküldeni az emailt',
    subject: 'Erősítsd meg az email címedet - Pharmagister',
    tagline: 'Gyógyszertári helyettesítés platform',
    heading: 'Üdvözlünk!',
    intro: 'Köszönjük, hogy regisztráltál a Pharmagister platformon!',
    actionPrompt: 'Kérjük, erősítsd meg az email címedet az alábbi gombra kattintva:',
    button: '✅ Email cím megerősítése',
    fallbackPrompt: 'Ha a gomb nem működik, másold be ezt a linket a böngésződbe:',
    postActivation: 'Az aktiválás után már teljes mértékben használhatod a rendszert és hozzáférhetsz az összes funkcióhoz.',
    ignoreNote: 'Ha nem te regisztráltál, kérjük, hagyd figyelmen kívül ezt az emailt.',
    regards: 'Üdvözlettel,<br>A Pharmagister csapata',
  };
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getVerificationApiCopy(requestMarket);
    const { email, displayName, verificationLink } = await request.json();

    const mailOptions = {
      from: 'Pharmagister <noreply@pharmagister.hu>',
      to: email,
      subject: copy.subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: #ffffff;
                border-radius: 8px;
                padding: 40px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                color: #7c3aed;
                margin-bottom: 10px;
              }
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
                text-align: center;
              }
              .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 14px;
                color: #666;
                border-top: 1px solid #eee;
                padding-top: 20px;
              }
              .link {
                color: #667eea;
                word-break: break-all;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">Pharmagister</div>
                <p style="color: #666; margin: 0;">${copy.tagline}</p>
              </div>
              
              <h2 style="color: #333; margin-bottom: 20px;">${copy.heading}</h2>
              
              <p>${copy.intro}</p>
              
              <p>${copy.actionPrompt}</p>
              
              <div style="text-align: center;">
                <a href="${sanitizeUrl(verificationLink)}" class="button">
                  ${copy.button}
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                ${copy.fallbackPrompt}
              </p>
              <p style="font-size: 12px;">
                <a href="${sanitizeUrl(verificationLink)}" class="link">${sanitizeUrl(verificationLink)}</a>
              </p>
              
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                ${copy.postActivation}
              </p>
              
              <div class="footer">
                <p>${copy.ignoreNote}</p>
                <p style="margin-top: 15px; font-weight: 600;">${copy.regards}</p>
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
    console.error('Error sending email:', error);
    const copy = getVerificationApiCopy(resolveMarketFromRequest(request));
    return NextResponse.json({ 
      error: copy.error,
      details: error.message 
    }, { status: 500 });
  }
}
