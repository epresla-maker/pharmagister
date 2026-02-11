import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const { reportType, reportedUserName, reason, details } = await request.json();

    // SMTP transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .info-row { margin: 15px 0; padding: 10px; background: white; border-radius: 4px; }
          .info-label { font-weight: bold; color: #6b7280; }
          .footer { background: #374151; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">⚠️ Új jelentés érkezett</h1>
          </div>
          
          <div class="content">
            <h2>Pharmagister - Tartalom jelentés</h2>
            
            <div class="info-row">
              <span class="info-label">Típus:</span> ${reportType === 'user' ? 'Felhasználó' : reportType === 'message' ? 'Üzenet' : 'Igény'}
            </div>
            
            <div class="info-row">
              <span class="info-label">Jelentett:</span> ${reportedUserName}
            </div>
            
            <div class="info-row">
              <span class="info-label">Ok:</span> ${reason}
            </div>
            
            ${details ? `
            <div class="info-row">
              <span class="info-label">Részletek:</span><br/>
              ${details}
            </div>
            ` : ''}
            
            <div class="info-row">
              <span class="info-label">Időpont:</span> ${new Date().toLocaleString('hu-HU')}
            </div>
            
            <p style="margin-top: 25px;">
              <strong>Teendő:</strong> Kérjük, ellenőrizd a jelentett tartalmat a Firebase Console-ban és hozd meg a szükséges intézkedéseket.
            </p>
          </div>
          
          <div class="footer">
            Pharmagister Admin Értesítés
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Pharmagister Reports" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || 'info@pharmagister.hu',
      subject: `⚠️ Új jelentés: ${reportedUserName}`,
      html: emailHTML,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Report notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
