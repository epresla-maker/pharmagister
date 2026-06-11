export const dynamic = "force-dynamic";
import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { normalizeMarket, resolveMarketFromRequest } from '@/lib/market';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

function getVerificationSmtpApiSuccess(market) {
  return market === 'de' ? 'Bestaetigungs-E-Mail gesendet' : 'Megerősítő email elküldve';
}

function getVerificationSmtpEmailCopy(market) {
  if (market === 'de') {
    return {
      subject: 'Bestaetige deine E-Mail-Adresse - Pharmagister',
      tagline: 'Vertretungsplattform fuer Apotheken',
      heading: 'Willkommen!',
      intro: 'Danke fuer deine Registrierung bei Pharmagister!',
      actionPrompt: 'Klicke auf den Button unten, um deine E-Mail-Adresse zu bestaetigen:',
      button: '✉️ E-Mail-Adresse bestaetigen',
      fallbackPrompt: 'Wenn der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
      expiryNote: 'Dieser Link laeuft innerhalb von 24 Stunden ab.',
      ignoreNote: 'Wenn du dich nicht registriert hast, kannst du diese E-Mail ignorieren.',
      rightsReserved: 'Alle Rechte vorbehalten',
    };
  }

  return {
    subject: 'Erősítsd meg az email címedet - Pharmagister',
    tagline: 'Gyógyszertári helyettesítés platform',
    heading: 'Üdvözlünk!',
    intro: 'Köszönjük, hogy regisztráltál a Pharmagister platformon!',
    actionPrompt: 'Az email címed megerősítéséhez kattints az alábbi gombra:',
    button: '✉️ Email cím megerősítése',
    fallbackPrompt: 'Ha a gomb nem működik, másold be ezt a linket a böngésződbe:',
    expiryNote: 'Ez a link 24 órán belül lejár.',
    ignoreNote: 'Ha nem te regisztráltál, nyugodtan hagyd figyelmen kívül ezt az emailt.',
    rightsReserved: 'Minden jog fenntartva',
  };
}

export async function POST(request) {
  try {
    const { email, displayName, verificationToken, market } = await request.json();
    const requestMarket = normalizeMarket(market || resolveMarketFromRequest(request));
    const emailCopy = getVerificationSmtpEmailCopy(requestMarket);
    
    const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.vercel.app'}/verify-email?token=${verificationToken}&market=${requestMarket}`;

    const mailOptions = {
      from: 'Pharmagister <noreply@pharmagister.hu>',
      to: email,
      subject: emailCopy.subject,
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
                <p style="color: #666; margin: 0;">${emailCopy.tagline}</p>
              </div>
              
              <h2 style="color: #333; margin-bottom: 20px;">${emailCopy.heading}</h2>
              
              <p>${emailCopy.intro}</p>
              
              <p>${emailCopy.actionPrompt}</p>
              
              <div style="text-align: center;">
                <a href="${verificationLink}" class="button" style="color: white;">
                  ${emailCopy.button}
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                ${emailCopy.fallbackPrompt}<br>
                <a href="${verificationLink}" class="link">${verificationLink}</a>
              </p>
              
              <p style="font-size: 14px; color: #666;">
                ${emailCopy.expiryNote}
              </p>
              
              <div class="footer">
                <p>${emailCopy.ignoreNote}</p>
                <p>© ${new Date().getFullYear()} Pharmagister - ${emailCopy.rightsReserved}</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    await resend.emails.send(mailOptions);

    return NextResponse.json({ success: true, message: getVerificationSmtpApiSuccess(requestMarket) });
  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
