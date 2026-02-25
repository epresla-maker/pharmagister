import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

// Email sablon generálása egy adott felhasználónak
function generateEmailBody(name, keepLink, deleteLink) {
  const subject = 'Fiók törlése - döntés szükséges';
  const body = `Kedves ${name}!

Észrevettük, hogy regisztráltál a Pharmagister oldalunkon, de még nem aktiváltad a fiókodat és nem is léptél be.

Kérjük, válaszd ki az alábbi opciók egyikét:

✅ FIÓK MEGTARTÁSA
Ha szeretnéd megtartani a fiókodat, kattints erre a linkre:
${keepLink}

❌ FIÓK TÖRLÉSE
Ha törölni szeretnéd a fiókodat és minden adatodat, kattints erre a linkre:
${deleteLink}

Ha 30 napon belül nem választasz, a fiókod automatikusan törlésre kerül.

A linkek 30 napig érvényesek és csak egyszer használhatók fel.

Üdvözlettel,
Pharmagister csapat`;

  return { subject, body };
}

// URL-ek automatikus linkesítése
function autoLinkUrls(html) {
  return html.replace(
    /(https?:\/\/[^\s<>"']+)/gi,
    '<a href="$1" style="color: #7c3aed; text-decoration: underline; word-break: break-all;">$1</a>'
  );
}

function generateHtmlEmail(subject, bodyHtml) {
  const linkedBody = autoLinkUrls(bodyHtml);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 30px 20px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px 20px; color: #1f2937; line-height: 1.6; font-size: 16px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
    a { color: #7c3aed; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pharmagister</h1>
    </div>
    <div class="content">
      ${linkedBody}
    </div>
    <div class="footer">
      <p>Ez az üzenet a Pharmagister rendszerből érkezett.</p>
      <p>© 2026 Pharmagister - Minden jog fenntartva</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request) {
  try {
    // Verify admin access
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Nincs admin jogosultság' }, { status: 403 });
    }

    const { tokens } = await request.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'Nincs küldendő token adat' }, { status: 400 });
    }

    // Max 10 email per request a Vercel timeout elkerüléséhez
    const batch = tokens.slice(0, 10);

    // SMTP transporter
    const transporter = nodemailer.createTransport({
      host: '185.51.191.40',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: {
        user: 'info@pharmagister.hu',
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: true,
        servername: 'mail.pharmagister.hu'
      }
    });

    const results = [];
    const errors = [];

    // Egyesével küldés - minden felhasználó személyre szabott emailt kap
    for (let i = 0; i < batch.length; i++) {
      const tokenData = batch[i];

      try {
        const { subject, body } = generateEmailBody(
          tokenData.name,
          tokenData.keepLink,
          tokenData.deleteLink
        );

        const mailOptions = {
          from: '"Pharmagister" <info@pharmagister.hu>',
          to: tokenData.email,
          subject,
          html: generateHtmlEmail(subject, body.replace(/\n/g, '<br>')),
        };

        await transporter.sendMail(mailOptions);
        results.push({ 
          email: tokenData.email, 
          name: tokenData.name, 
          success: true 
        });
      } catch (err) {
        console.error(`Failed to send to ${tokenData.email}:`, err);
        errors.push({ 
          email: tokenData.email, 
          name: tokenData.name, 
          error: err.message 
        });
      }

      // Kis szünet az SMTP szerver túlterhelésének elkerüléséhez
      if (i < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Mentés Firestore-ba
    try {
      const admin = getFirebaseAdmin();
      const db = admin.firestore();
      await db.collection('sentEmails').add({
        to: results.map(r => r.email),
        failedTo: errors.map(e => e.email),
        subject: 'Fiók törlése - döntés szükséges (tömeges)',
        body: `Tömeges token email küldés ${batch.length} felhasználónak (batch)`,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentCount: results.length,
        failedCount: errors.length,
        from: 'info@pharmagister.hu',
        type: 'bulk-token-email',
      });
    } catch (saveErr) {
      console.error('Failed to save sent email log:', saveErr);
    }

    return NextResponse.json({
      success: true,
      sent: results.length,
      failed: errors.length,
      total: tokens.length,
      results,
      errors,
    });
  } catch (error) {
    console.error('Bulk email send error:', error);
    return NextResponse.json(
      { error: 'Hiba történt a tömeges email küldés során: ' + error.message },
      { status: 500 }
    );
  }
}
