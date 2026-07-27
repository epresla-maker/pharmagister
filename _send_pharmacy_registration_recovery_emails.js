require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');
const { Resend } = require('resend');
const { randomBytes } = require('crypto');

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://pharmagister.hu').trim().replace(/\/$/, '');
const SAMPLE_RECIPIENT = 'epresla@icloud.com';

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

function isPharmacyRole(role) {
  return role === 'pharmacy' || role === 'gyógyszertár';
}

function isNotFullyActivated(user) {
  return !(user.emailVerified && user.passwordActivated);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml({ displayName, finalizeUrl }) {
  const hello = displayName ? `Kedves ${escapeHtml(displayName)}!` : 'Kedves Gyógyszertár!';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 24px; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937; }
    .wrap { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08); }
    .hero { background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 28px 24px; color: #ffffff; }
    .hero h1 { margin: 0; font-size: 24px; }
    .hero p { margin: 8px 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 28px 24px; line-height: 1.65; font-size: 16px; }
    .button { display: inline-block; margin: 18px 0; padding: 14px 22px; border-radius: 999px; background: #059669; color: #ffffff !important; text-decoration: none; font-weight: 600; }
    .box { margin-top: 18px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; }
    .mono { word-break: break-all; color: #047857; font-size: 14px; }
    .muted { color: #6b7280; font-size: 14px; }
    .footer { padding: 20px 24px 28px; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Pharmagister</h1>
      <p>Regisztráció véglegesítése</p>
    </div>
    <div class="content">
      <p>${hello}</p>
      <p>Látjuk, hogy a gyógyszertári fiók regisztrációja még nincs teljesen aktiválva.</p>
      <p>Kattints az alábbi gombra, és egy lépésben folytathatod a véglegesítést:</p>
      <a class="button" href="${finalizeUrl}">Regisztráció véglegesítése</a>
      <div class="box">
        <div class="muted">Ha a gomb nem működik, másold be ezt a linket a böngészőbe:</div>
        <div class="mono">${escapeHtml(finalizeUrl)}</div>
      </div>
      <p class="muted">Biztonsági okból nem küldünk és nem állítunk be előre jelszót. A gomb után saját jelszót tudsz megadni.</p>
    </div>
    <div class="footer">
      Ez az üzenet a Pharmagister rendszerből érkezett.<br>
      © ${new Date().getFullYear()} Pharmagister
    </div>
  </div>
</body>
</html>`;
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

async function main() {
  initFirebase();
  const db = admin.firestore();

  const sample = hasFlag('sample');
  const send = hasFlag('send');
  if (!sample && !send) {
    throw new Error('Hasznalat: node _send_pharmacy_registration_recovery_emails.js --sample vagy --send');
  }

  const usersSnap = await db.collection('users').get();
  const users = usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  const targets = users
    .filter((user) => isPharmacyRole(user.pharmagisterRole))
    .filter((user) => isNotFullyActivated(user))
    .filter((user) => user.email)
    .sort((a, b) => String(a.email).localeCompare(String(b.email), 'hu'));

  console.log(`Target pharmacies found: ${targets.length}`);
  if (!targets.length) return;

  const campaignRef = db.collection('pharmacyRegistrationRecoveryCampaigns').doc();
  const campaignId = campaignRef.id;
  const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 14));
  const createdAt = admin.firestore.FieldValue.serverTimestamp();

  const tokens = targets.map((user) => {
    const token = randomBytes(32).toString('hex');
    return {
      token,
      userId: user.id,
      email: user.email,
      displayName: user.displayName || user.pharmacyName || null,
      finalizeUrl: `${APP_URL}/api/pharmacy-registration-finalize?token=${token}`,
      emailVerified: Boolean(user.emailVerified),
      passwordActivated: Boolean(user.passwordActivated),
    };
  });

  const batch = db.batch();
  tokens.forEach((entry) => {
    const tokenRef = db.collection('pharmacyRegistrationRecoveryTokens').doc(entry.token);
    batch.set(tokenRef, {
      token: entry.token,
      campaignId,
      userId: entry.userId,
      email: entry.email,
      displayName: entry.displayName,
      used: false,
      expiresAt,
      createdAt,
    });
  });

  batch.set(campaignRef, {
    type: 'pharmacy_registration_recovery',
    status: sample ? 'sample' : 'sent',
    recipientCount: tokens.length,
    sentCount: 0,
    failedCount: 0,
    recipients: tokens.map((entry) => ({
      userId: entry.userId,
      email: entry.email,
      displayName: entry.displayName,
      emailVerified: entry.emailVerified,
      passwordActivated: entry.passwordActivated,
      token: entry.token,
    })),
    subject: 'Regisztráció véglegesítése a Pharmagisteren',
    createdAt,
    createdBy: 'script:_send_pharmacy_registration_recovery_emails.js',
  });

  await batch.commit();

  if (sample) {
    const preview = tokens[0];
    const html = buildEmailHtml({ displayName: preview.displayName, finalizeUrl: preview.finalizeUrl });
    const result = await sendEmail({
      to: [SAMPLE_RECIPIENT],
      subject: '[MINTA] Regisztráció véglegesítése a Pharmagisteren',
      html,
    });

    await campaignRef.update({
      sampleRecipient: SAMPLE_RECIPIENT,
      sampleResendId: result?.data?.id || null,
      sentCount: 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(JSON.stringify({
      mode: 'sample',
      campaignId,
      targetCount: tokens.length,
      sampleRecipient: SAMPLE_RECIPIENT,
      sampleResendId: result?.data?.id || null,
    }, null, 2));
    return;
  }

  let sentCount = 0;
  const failed = [];

  for (const target of tokens) {
    const html = buildEmailHtml({ displayName: target.displayName, finalizeUrl: target.finalizeUrl });
    try {
      const result = await sendEmail({
        to: [target.email],
        subject: 'Regisztráció véglegesítése a Pharmagisteren',
        html,
      });
      sentCount += 1;
      await db.collection('pharmacyRegistrationRecoveryTokens').doc(target.token).update({
        sent: true,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        resendId: result?.data?.id || null,
      });
      console.log(`Sent: ${target.email}`);
    } catch (error) {
      failed.push({ email: target.email, error: error.message });
      await db.collection('pharmacyRegistrationRecoveryTokens').doc(target.token).update({
        sent: false,
        sendError: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Failed: ${target.email} - ${error.message}`);
    }
  }

  await campaignRef.update({
    sentCount,
    failedCount: failed.length,
    failed,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(JSON.stringify({ campaignId, targetCount: tokens.length, sentCount, failed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
