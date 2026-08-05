import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';
import { resolveMarketFromRequest } from '@/lib/market';

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_FROM = 'Pharmagister <noreply@pharmagister.hu>';
const DEFAULT_REPLY_TO = 'epresla@icloud.com';

function getAdminSendEmailCopy(market) {
  if (market === 'de') {
    return {
      noAdminPermission: 'Keine Admin-Berechtigung',
      recipientsRequired: 'Mindestens ein Empfaenger ist erforderlich',
      subjectRequired: 'Betreff ist erforderlich',
      bodyRequired: 'Nachricht ist erforderlich',
      sendErrorPrefix: 'Fehler beim E-Mail-Versand: ',
      footerLine1: 'Diese Nachricht wurde vom Pharmagister-System gesendet.',
      footerLine2: '© 2026 Pharmagister - Alle Rechte vorbehalten',
    };
  }

  return {
    noAdminPermission: 'Nincs admin jogosultság',
    recipientsRequired: 'Legalább egy címzett megadása kötelező',
    subjectRequired: 'Tárgy megadása kötelező',
    bodyRequired: 'Üzenet megadása kötelező',
    sendErrorPrefix: 'Hiba történt az email küldés során: ',
    footerLine1: 'Ez az üzenet a Pharmagister rendszerből érkezett.',
    footerLine2: '© 2026 Pharmagister - Minden jog fenntartva',
  };
}

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getAdminSendEmailCopy(requestMarket);
    // Verify admin access
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: copy.noAdminPermission }, { status: 403 });
    }

    const { to, subject, body, isHtml } = await request.json();

    if (!to || !to.length) {
      return NextResponse.json({ error: copy.recipientsRequired }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: copy.subjectRequired }, { status: 400 });
    }
    if (!body) {
      return NextResponse.json({ error: copy.bodyRequired }, { status: 400 });
    }

    const results = [];
    const errors = [];
    const plainTextBody = isHtml ? htmlToText(body) : body;

    // Send emails individually to each recipient
    for (const recipient of to) {
      try {
        const htmlBody = isHtml ? body : body.replace(/\n/g, '<br>');
        await resend.emails.send({
          from: DEFAULT_FROM,
          to: recipient,
          subject: subject,
          html: generateHtmlEmail(subject, htmlBody, copy),
          text: plainTextBody,
          replyTo: DEFAULT_REPLY_TO,
        });
        results.push({ email: recipient, success: true });
      } catch (err) {
        console.error(`Failed to send to ${recipient}:`, err);
        errors.push({ email: recipient, error: err.message });
      }
    }

    // Save to Firestore
    try {
      const admin = getFirebaseAdmin();
      const db = admin.firestore();
      await db.collection('sentEmails').add({
        to: results.map(r => r.email),
        failedTo: errors.map(e => e.email),
        subject,
        body,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentCount: results.length,
        failedCount: errors.length,
        from: DEFAULT_FROM,
        replyTo: DEFAULT_REPLY_TO,
      });
    } catch (saveErr) {
      console.error('Failed to save sent email log:', saveErr);
    }

    return NextResponse.json({
      success: true,
      sent: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error) {
    console.error('Email send error:', error);
    const copy = getAdminSendEmailCopy(resolveMarketFromRequest(request));
    return NextResponse.json(
      { error: copy.sendErrorPrefix + error.message },
      { status: 500 }
    );
  }
}

// URL-ek automatikus linkesítése (plain text URL → kattintható <a> tag)
function autoLinkUrls(html) {
  return html.replace(
    /(https?:\/\/[^\s<>"']+)/gi,
    '<a href="$1" style="color: #7c3aed; text-decoration: underline; word-break: break-all;">$1</a>'
  );
}

function generateHtmlEmail(subject, bodyHtml, copy) {
  // URL-ek automatikus kattinthatóvá tétele
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
      <p>${copy.footerLine1}</p>
      <p>${copy.footerLine2}</p>
    </div>
  </div>
</body>
</html>`;
}

function htmlToText(value) {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
