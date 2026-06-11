import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';
import { resolveMarketFromRequest } from '@/lib/market';

const resend = new Resend(process.env.RESEND_API_KEY);

function getBulkTokenEmailApiCopy(market) {
  if (market === 'de') {
    return {
      noAdminPermission: 'Keine Admin-Berechtigung',
      missingTokenData: 'Keine Token-Daten zum Senden',
      sendErrorPrefix: 'Fehler beim Massen-E-Mail-Versand: ',
      subjectSingle: 'Kontoloeschung - Entscheidung erforderlich',
      greeting: 'Hallo',
      intro: 'Wir haben bemerkt, dass du dich bei Pharmagister registriert hast, dein Konto aber noch nicht aktiviert und noch nicht genutzt wurde.',
      selectPrompt: 'Bitte waehle eine der folgenden Optionen:',
      keepTitle: '✅ KONTO BEHALTEN',
      keepText: 'Wenn du dein Konto behalten moechtest, nutze diesen Link:',
      deleteTitle: '❌ KONTO LOESCHEN',
      deleteText: 'Wenn du dein Konto samt Daten loeschen moechtest, nutze diesen Link:',
      autoDeleteInfo: 'Wenn du innerhalb von 30 Tagen keine Auswahl triffst, wird dein Konto automatisch geloescht.',
      linkValidityInfo: 'Die Links sind 30 Tage gueltig und koennen nur einmal verwendet werden.',
      signoff: 'Viele Gruesse,\nPharmagister Team',
      footerLine1: 'Diese Nachricht wurde vom Pharmagister-System gesendet.',
      footerLine2: '© 2026 Pharmagister - Alle Rechte vorbehalten',
      logSubject: 'Kontoloeschung - Entscheidung erforderlich (Massenversand)',
      logBodyPrefix: 'Massenversand von Token-E-Mails an',
      logBodySuffix: 'Benutzer/innen (Batch)',
    };
  }

  return {
    noAdminPermission: 'Nincs admin jogosultság',
    missingTokenData: 'Nincs küldendő token adat',
    sendErrorPrefix: 'Hiba történt a tömeges email küldés során: ',
    subjectSingle: 'Fiók törlése - döntés szükséges',
    greeting: 'Kedves',
    intro: 'Észrevettük, hogy regisztráltál a Pharmagister oldalunkon, de még nem aktiváltad a fiókodat és nem is léptél be.',
    selectPrompt: 'Kérjük, válaszd ki az alábbi opciók egyikét:',
    keepTitle: '✅ FIÓK MEGTARTÁSA',
    keepText: 'Ha szeretnéd megtartani a fiókodat, kattints erre a linkre:',
    deleteTitle: '❌ FIÓK TÖRLÉSE',
    deleteText: 'Ha törölni szeretnéd a fiókodat és minden adatodat, kattints erre a linkre:',
    autoDeleteInfo: 'Ha 30 napon belül nem választasz, a fiókod automatikusan törlésre kerül.',
    linkValidityInfo: 'A linkek 30 napig érvényesek és csak egyszer használhatók fel.',
    signoff: 'Üdvözlettel,\nPharmagister csapat',
    footerLine1: 'Ez az üzenet a Pharmagister rendszerből érkezett.',
    footerLine2: '© 2026 Pharmagister - Minden jog fenntartva',
    logSubject: 'Fiók törlése - döntés szükséges (tömeges)',
    logBodyPrefix: 'Tömeges token email küldés',
    logBodySuffix: 'felhasználónak (batch)',
  };
}

export const runtime = 'nodejs';

// Email sablon generálása egy adott felhasználónak
function generateEmailBody(name, keepLink, deleteLink, copy) {
  const subject = copy.subjectSingle;
  const body = `${copy.greeting} ${name}!

${copy.intro}

${copy.selectPrompt}

${copy.keepTitle}
${copy.keepText}
${keepLink}

${copy.deleteTitle}
${copy.deleteText}
${deleteLink}

${copy.autoDeleteInfo}

${copy.linkValidityInfo}

${copy.signoff}`;

  return { subject, body };
}

// URL-ek automatikus linkesítése
function autoLinkUrls(html) {
  return html.replace(
    /(https?:\/\/[^\s<>"']+)/gi,
    '<a href="$1" style="color: #7c3aed; text-decoration: underline; word-break: break-all;">$1</a>'
  );
}

function generateHtmlEmail(subject, bodyHtml, copy) {
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

export async function POST(request) {
  try {
    const requestMarket = resolveMarketFromRequest(request);
    const copy = getBulkTokenEmailApiCopy(requestMarket);
    // Verify admin access
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: copy.noAdminPermission }, { status: 403 });
    }

    const { tokens } = await request.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: copy.missingTokenData }, { status: 400 });
    }

    // Max 10 email per request a Vercel timeout elkerüléséhez
    const batch = tokens.slice(0, 10);

    const results = [];
    const errors = [];

    // Egyesével küldés - minden felhasználó személyre szabott emailt kap
    for (let i = 0; i < batch.length; i++) {
      const tokenData = batch[i];

      try {
        const { subject, body } = generateEmailBody(
          tokenData.name,
          tokenData.keepLink,
          tokenData.deleteLink,
          copy
        );

        await resend.emails.send({
          from: 'Pharmagister <noreply@pharmagister.hu>',
          to: tokenData.email,
          subject,
          html: generateHtmlEmail(subject, body.replace(/\n/g, '<br>'), copy),
        });
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
        subject: copy.logSubject,
        body: `${copy.logBodyPrefix} ${batch.length} ${copy.logBodySuffix}`,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentCount: results.length,
        failedCount: errors.length,
        from: 'noreply@pharmagister.hu',
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
    const copy = getBulkTokenEmailApiCopy(resolveMarketFromRequest(request));
    return NextResponse.json(
      { error: copy.sendErrorPrefix + error.message },
      { status: 500 }
    );
  }
}
