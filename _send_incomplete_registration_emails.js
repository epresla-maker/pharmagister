require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');
const { Resend } = require('resend');

const SAMPLE_RECIPIENT = 'epresla@icloud.com';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.hu').trim().replace(/\/$/, '');
const CAMPAIGN_COLLECTION = 'emailCampaigns';
const CAMPAIGN_TYPE = 'incomplete_registration_reminder';

function getArgValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function initFirebase() {
  if (admin.apps.length) return;

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml({ intro, lead, ctaUrl, ctaLabel, footerNote, extraHtml = '' }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 24px; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937; }
    .wrap { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08); }
    .hero { background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 28px 24px; color: #ffffff; }
    .hero h1 { margin: 0; font-size: 24px; }
    .hero p { margin: 8px 0 0; font-size: 14px; opacity: 0.92; }
    .content { padding: 28px 24px; line-height: 1.65; font-size: 16px; }
    .button { display: inline-block; margin: 18px 0; padding: 14px 22px; border-radius: 999px; background: #059669; color: #ffffff !important; text-decoration: none; font-weight: 600; }
    .muted { color: #6b7280; font-size: 14px; }
    .box { margin-top: 18px; padding: 16px 18px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 14px; }
    .footer { padding: 20px 24px 28px; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
    .mono { word-break: break-all; color: #047857; }
    ul { margin: 12px 0 0; padding-left: 20px; }
    li { margin: 6px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Pharmagister</h1>
      <p>Gyógyszertári helyettesítés és szakmai platform</p>
    </div>
    <div class="content">
      <p>${intro}</p>
      <p>${lead}</p>
      <a class="button" href="${ctaUrl}">${ctaLabel}</a>
      <div class="box">
        <div class="muted">Ha a gomb nem működik, másold be ezt a linket a böngészőbe:</div>
        <div class="mono">${escapeHtml(ctaUrl)}</div>
      </div>
      ${extraHtml}
      <p class="muted">${footerNote}</p>
    </div>
    <div class="footer">
      Ez az üzenet a Pharmagister rendszerből érkezett.<br>
      © ${new Date().getFullYear()} Pharmagister
    </div>
  </div>
</body>
</html>`;
}

function buildRecipientEmail(user) {
  const intro = user.displayName
    ? `Szia ${escapeHtml(user.displayName)}!`
    : 'Szia!';

  return {
    subject: 'Fejezd be a regisztrációdat a Pharmagisteren',
    html: buildEmailHtml({
      intro,
      lead: 'Látjuk, hogy a regisztrációdat már elindítottad, de a szerepkör kiválasztása még nem fejeződött be. A folytatáshoz csak jelentkezz be, és válaszd ki, hogy gyógyszertár, gyógyszerész vagy szakasszisztens profillal szeretnéd használni a Pharmagistert.',
      ctaUrl: `${APP_URL}/pharmagister`,
      ctaLabel: 'Regisztráció folytatása',
      footerNote: 'Ha már befejezted a regisztrációdat, ezt az üzenetet figyelmen kívül hagyhatod.',
    }),
  };
}

function buildSampleEmail(recipients, hours) {
  const recipientLines = recipients
    .map((user) => `<li><strong>${escapeHtml(user.email)}</strong> <span class="muted">(${escapeHtml(user.id)})</span></li>`)
    .join('');

  return {
    subject: `[MINTA] Félbehagyott regisztráció emlékeztető (${recipients.length} címzett)`,
    html: buildEmailHtml({
      intro: 'Szia!',
      lead: `Ez a minta email a félbehagyott regisztráció emlékeztető kampányhoz. A jelenlegi lista az elmúlt ${hours} órában belépett, szerepkör nélküli felhasználókat tartalmazza.`,
      ctaUrl: `${APP_URL}/pharmagister`,
      ctaLabel: 'Regisztráció folytatása',
      footerNote: 'A végleges kiküldés előtt ezt a mintát kapod meg ellenőrzésre.',
      extraHtml: `<div class="box"><div><strong>Tervezett címzettek:</strong></div><ul>${recipientLines}</ul></div>`,
    }),
  };
}

async function loadIncompleteUsers(hours, includeAll) {
  const db = admin.firestore();
  const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - hours * 60 * 60 * 1000));
  const snap = includeAll
    ? await db.collection('users').get()
    : await db.collection('users').where('lastLogin', '>=', cutoff).get();

  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        email: data.email || null,
        displayName: data.displayName || data.pharmacyName || null,
        pharmagisterRole: data.pharmagisterRole || null,
        role: data.role || null,
        pharmaProfileComplete: Boolean(data.pharmaProfileComplete),
      };
    })
    .filter((user) => user.email && !user.pharmagisterRole && !user.role && !user.pharmaProfileComplete)
    .sort((left, right) => String(left.email).localeCompare(String(right.email), 'hu'));
}

async function sendEmail({ to, subject, html }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  return resend.emails.send({
    from: 'Pharmagister <noreply@pharmagister.hu>',
    to,
    subject,
    html,
  });
}

async function createCampaignLog({ recipients, includeAll, hours, subject, mode }) {
  const db = admin.firestore();
  const campaignRef = db.collection(CAMPAIGN_COLLECTION).doc();
  const sentAt = admin.firestore.Timestamp.now();

  await campaignRef.set({
    type: CAMPAIGN_TYPE,
    subject,
    audienceMode: includeAll ? 'all' : 'recent',
    lookbackHours: includeAll ? null : hours,
    mode,
    recipientCount: recipients.length,
    recipients: recipients.map((user) => ({
      userId: user.id,
      email: user.email,
      displayName: user.displayName || null,
    })),
    sentAt,
    createdAt: sentAt,
    appUrl: `${APP_URL}/pharmagister`,
    createdBy: 'script:_send_incomplete_registration_emails.js',
  });

  return { campaignId: campaignRef.id, sentAt };
}

async function main() {
  initFirebase();

  const hours = Number(getArgValue('hours') || '24');
  const includeAll = hasFlag('all');
  const sampleOnly = hasFlag('sample');
  const previewLive = hasFlag('preview-live');
  const logOnly = hasFlag('log-only');
  const sendBulk = hasFlag('send');

  if (!sampleOnly && !previewLive && !logOnly && !sendBulk) {
    throw new Error('Hasznalat: node _send_incomplete_registration_emails.js --sample vagy --preview-live vagy --log-only vagy --send [--hours=24] [--all]');
  }

  const recipients = await loadIncompleteUsers(hours, includeAll);
  console.log(`Incomplete registrations found: ${recipients.length}${includeAll ? ' (all users)' : ` (last ${hours}h)`}`);

  if (!recipients.length) {
    return;
  }

  if (sampleOnly) {
    const sampleEmail = buildSampleEmail(recipients, hours);
    const result = await sendEmail({
      to: [SAMPLE_RECIPIENT],
      subject: sampleEmail.subject,
      html: sampleEmail.html,
    });
    console.log(`Sample sent to ${SAMPLE_RECIPIENT}`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (previewLive) {
    const previewTarget = recipients[0];
    const email = buildRecipientEmail(previewTarget);
    const result = await sendEmail({
      to: [SAMPLE_RECIPIENT],
      subject: `[MINTA] ${email.subject}`,
      html: email.html,
    });
    console.log(`Live preview sent to ${SAMPLE_RECIPIENT}`);
    console.log(`Preview based on recipient: ${previewTarget.email}`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (logOnly) {
    const email = buildRecipientEmail(recipients[0]);
    const campaign = await createCampaignLog({
      recipients,
      includeAll,
      hours,
      subject: email.subject,
      mode: 'log-only',
    });
    console.log(JSON.stringify({
      logged: true,
      campaignId: campaign.campaignId,
      recipientCount: recipients.length,
      sentAt: campaign.sentAt.toDate().toISOString(),
    }, null, 2));
    return;
  }

  const email = buildRecipientEmail(recipients[0]);
  const campaign = await createCampaignLog({
    recipients,
    includeAll,
    hours,
    subject: email.subject,
    mode: 'send',
  });

  let sent = 0;
  const failed = [];

  for (const user of recipients) {
    const email = buildRecipientEmail(user);
    try {
      await sendEmail({
        to: [user.email],
        subject: email.subject,
        html: email.html,
      });
      sent += 1;
      console.log(`Sent: ${user.email}`);
    } catch (error) {
      failed.push({ email: user.email, error: error.message });
      console.log(`Failed: ${user.email} - ${error.message}`);
    }
  }

  console.log(JSON.stringify({ sent, failed, campaignId: campaign.campaignId }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});