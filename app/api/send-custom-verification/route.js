import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, verificationToken } = await request.json();
    
    console.log('📧 [send-custom-verification] Starting email send to:', email);
    console.log('🔑 Resend API Key present:', !!process.env.RESEND_API_KEY);
    console.log('🌐 App URL:', process.env.NEXT_PUBLIC_APP_URL);
    
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.vercel.app'}/verify-email?token=${verificationToken}`;

    const { data, error } = await resend.emails.send({
      from: 'Pharmagister VF <noreply@valifriend.com>',
      to: [email],
      subject: 'Erősítsd meg az email címedet - Pharmagister',
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
              
              <h2 style="color: #333; margin-bottom: 20px;">Üdvözlünk!</h2>
              
              <p>Köszönjük a regisztrációt! Már csak egy lépés van hátra.</p>
              
              <p>Kérjük, erősítsd meg az email címedet az alábbi gombra kattintva:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" class="button">
                  ✅ Email cím megerősítése
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                Ha a gomb nem működik, másold be ezt a linket a böngésződbe:
              </p>
              <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
                ${verificationUrl}
              </p>
              
              <div class="footer">
                <p>Ez az email automatikusan lett generálva. Kérjük ne válaszolj rá.</p>
                <p>© ${new Date().getFullYear()} Pharmagister</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return NextResponse.json({ error: 'Email küldési hiba', details: error }, { status: 500 });
    }

    console.log('✅ Verification email sent via Resend:', data.id);
    return NextResponse.json({ success: true, emailId: data.id });

  } catch (error) {
    console.error('❌ Error in send-custom-verification:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      error: 'Hiba történt', 
      details: error.message 
    }, { status: 500 });
  }
}
