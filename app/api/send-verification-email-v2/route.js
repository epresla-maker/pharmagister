export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { Resend } from 'resend';
import { resolveMarketFromRequest } from '@/lib/market';

const resend = new Resend(process.env.RESEND_API_KEY);

function getVerificationV2ApiCopy(market) {
  if (market === 'de') {
    return {
      serverConfigError: 'Server-Konfigurationsfehler',
      emailSendError: 'E-Mail-Sendefehler',
      genericError: 'Fehler aufgetreten',
      subject: 'Bestaetige deine E-Mail-Adresse - Pharmagister',
      heading: 'Willkommen!',
      intro: 'Danke fuer deine Registrierung bei Pharmagister!',
      ctaLead: 'Bitte bestaetige deine E-Mail-Adresse:',
      ctaButton: '✅ E-Mail-Adresse bestaetigen',
      fallbackLead: 'Falls der Button nicht funktioniert, kopiere diesen Link:',
    };
  }

  return {
    serverConfigError: 'Server konfigurációs hiba',
    emailSendError: 'Email küldési hiba',
    genericError: 'Hiba történt',
    subject: 'Erősítsd meg az email címedet - Pharmagister',
    heading: 'Üdvözlünk!',
    intro: 'Köszönjük, hogy regisztráltál a Pharmagister platformon!',
    ctaLead: 'Kérjük, erősítsd meg az email címedet:',
    ctaButton: '✅ Email cím megerősítése',
    fallbackLead: 'Ha a gomb nem működik, másold be ezt a linket:',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getVerificationV2ApiCopy(requestMarket);
    // Initialize Firebase Admin
    let admin;
    try {
      admin = getFirebaseAdmin();
    } catch (initError) {
      console.error('❌ Firebase Admin initialization error:', initError);
      return NextResponse.json({ 
        error: copy.serverConfigError,
        details: initError.message 
      }, { status: 500 });
    }

    const { email, displayName, userId } = await request.json();

    // Generálj Firebase email verification linket
    const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.vercel.app'}/login?verified=true`,
    });

    console.log('📧 Verification link generated for:', email);

    // Email küldése Resend-del
    const { data, error } = await resend.emails.send({
      from: 'Pharmagister VF <noreply@valifriend.com>',
      to: [email],
      subject: copy.subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white !important;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>${copy.heading}</h2>
              <p>${copy.intro}</p>
              <p>${copy.ctaLead}</p>
              <div style="text-align: center;">
                <a href="${verificationLink}" class="button">
                  ${copy.ctaButton}
                </a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                ${copy.fallbackLead}
              </p>
              <p style="font-size: 12px; word-break: break-all;">
                <a href="${verificationLink}">${verificationLink}</a>
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return NextResponse.json({ error: copy.emailSendError, details: error }, { status: 500 });
    }

    console.log('✅ Email sent:', data.id);
    return NextResponse.json({ success: true, emailId: data.id });

  } catch (error) {
    console.error('❌ Error:', error);
    const copy = getVerificationV2ApiCopy(resolveMarketFromRequest(request));
    return NextResponse.json({ 
      error: copy.genericError, 
      details: error.message 
    }, { status: 500 });
  }
}
