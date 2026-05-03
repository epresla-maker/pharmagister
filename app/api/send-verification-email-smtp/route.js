export const dynamic = "force-dynamic";
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, displayName, verificationToken } = await request.json();
    
    const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.vercel.app'}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: 'Pharmagister <noreply@pharmagister.hu>',
      to: email,
      subject: 'Erősítsd meg az email címedet - Pharmagister',
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
                <p style="color: #666; margin: 0;">Gyógyszertári helyettesítés platform</p>
              </div>
              
              <h2 style="color: #333; margin-bottom: 20px;">Üdvözlünk!</h2>
              
              <p>Köszönjük, hogy regisztráltál a Pharmagister platformon!</p>
              
              <p>Az email címed megerősítéséhez kattints az alábbi gombra:</p>
              
              <div style="text-align: center;">
                <a href="${verificationLink}" class="button" style="color: white;">
                  ✉️ Email cím megerősítése
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                Ha a gomb nem működik, másold be ezt a linket a böngésződbe:<br>
                <a href="${verificationLink}" class="link">${verificationLink}</a>
              </p>
              
              <p style="font-size: 14px; color: #666;">
                Ez a link 24 órán belül lejár.
              </p>
              
              <div class="footer">
                <p>Ha nem te regisztráltál, nyugodtan hagyd figyelmen kívül ezt az emailt.</p>
                <p>© ${new Date().getFullYear()} Pharmagister - Minden jog fenntartva</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    await resend.emails.send(mailOptions);

    return NextResponse.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
