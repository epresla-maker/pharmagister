import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sanitizeUrl } from '../../../lib/sanitize';
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit';
import { resolveMarketFromRequest } from '../../../lib/market';

const resend = new Resend(process.env.RESEND_API_KEY);

function getCustomVerificationApiCopy(market) {
  if (market === 'de') {
    return {
      tooManyRequests: 'Zu viele Anfragen. Bitte versuche es spaeter erneut.',
      emailSendError: 'E-Mail-Sendefehler',
      genericError: 'Fehler aufgetreten',
      subject: 'Bestaetige deine E-Mail-Adresse - Pharmagister',
      welcomeTitle: 'Willkommen!',
      intro: 'Danke fuer deine Registrierung! Es fehlt nur noch ein Schritt.',
      ctaLead: 'Bitte bestaetige deine E-Mail-Adresse ueber den folgenden Button:',
      ctaButton: 'E-Mail-Adresse bestaetigen',
      fallbackLead: 'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
      footerAuto: 'Diese E-Mail wurde automatisch erstellt. Bitte antworte nicht darauf.',
    };
  }

  return {
    tooManyRequests: 'Túl sok kérés. Kérjük próbálja újra később.',
    emailSendError: 'Email küldési hiba',
    genericError: 'Hiba történt',
    subject: 'Erősítsd meg az email címedet - Pharmagister',
    welcomeTitle: 'Üdvözlünk!',
    intro: 'Köszönjük a regisztrációt! Már csak egy lépés van hátra.',
    ctaLead: 'Kérjük, erősítsd meg az email címedet az alábbi gombra kattintva:',
    ctaButton: 'Email cím megerősítése',
    fallbackLead: 'Ha a gomb nem működik, másold be ezt a linket a böngésződbe:',
    footerAuto: 'Ez az email automatikusan lett generálva. Kérjük ne válaszolj rá.',
  };
}

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getCustomVerificationApiCopy(requestMarket);
    // Rate limit: 5 requests per 15 minutes
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`verification:${ip}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: copy.tooManyRequests }, { status: 429 });
    }

    const { email, verificationToken } = await request.json();
    
    console.log('📧 [send-custom-verification] Starting email send to:', email);
    console.log('🔑 Resend API Key present:', !!process.env.RESEND_API_KEY);
    console.log('🌐 App URL:', process.env.NEXT_PUBLIC_APP_URL);
    
    const verificationUrl = sanitizeUrl(`${process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.vercel.app'}/verify-email?token=${verificationToken}`);

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
                background: #f5f5f5;
              }
              .container {
                background: #ffffff;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .logo {
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-align: center;
                margin-bottom: 30px;
              }
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white !important;
                padding: 16px 40px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
                text-align: center;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                text-align: center;
                font-size: 12px;
                color: #999;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">Pharmagister</div>
              
              <h2 style="color: #333; margin-bottom: 20px;">${copy.welcomeTitle}</h2>
              
              <p>${copy.intro}</p>
              
              <p>${copy.ctaLead}</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" class="button">
                  ✅ ${copy.ctaButton}
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                ${copy.fallbackLead}
              </p>
              <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
                ${verificationUrl}
              </p>
              
              <div class="footer">
                <p>${copy.footerAuto}</p>
                <p>© ${new Date().getFullYear()} Pharmagister</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return NextResponse.json({ error: copy.emailSendError, details: error }, { status: 500 });
    }

    console.log('✅ Verification email sent via Resend:', data.id);
    return NextResponse.json({ success: true, emailId: data.id });

  } catch (error) {
    console.error('❌ Error in send-custom-verification:', error);
    console.error('Error stack:', error.stack);
    const copy = getCustomVerificationApiCopy(resolveMarketFromRequest(request));
    return NextResponse.json({ 
      error: copy.genericError, 
      details: error.message 
    }, { status: 500 });
  }
}
