require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

const CAMPAIGN_COLLECTION = 'emailCampaigns';
const CAMPAIGN_TYPE = 'incomplete_registration_reminder';

function getArgValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
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

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function hasCompletedRole(data) {
  return Boolean(data?.pharmagisterRole || data?.role || data?.pharmaProfileComplete);
}

async function loadCampaign(db, campaignId) {
  if (campaignId) {
    const snap = await db.collection(CAMPAIGN_COLLECTION).doc(campaignId).get();
    if (!snap.exists) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    return { id: snap.id, ...snap.data() };
  }

  const snap = await db.collection(CAMPAIGN_COLLECTION).get();
  const matches = snap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((entry) => entry.type === CAMPAIGN_TYPE)
    .sort((left, right) => {
      const leftTs = left.sentAt?.toMillis?.() || 0;
      const rightTs = right.sentAt?.toMillis?.() || 0;
      return rightTs - leftTs;
    });

  if (!matches.length) {
    throw new Error('No incomplete registration campaign found');
  }

  return matches[0];
}

async function main() {
  initFirebase();
  const db = admin.firestore();
  const campaignId = getArgValue('campaignId');
  const campaign = await loadCampaign(db, campaignId);
  const sentAtDate = campaign.sentAt.toDate();
  const recipients = Array.isArray(campaign.recipients) ? campaign.recipients : [];

  const rows = await Promise.all(
    recipients.map(async (recipient) => {
      const userSnap = await db.collection('users').doc(recipient.userId).get();
      const data = userSnap.exists ? userSnap.data() || {} : {};
      const lastLogin = data.lastLogin?.toDate?.() || null;
      const lastSeen = data.lastSeen?.toDate?.() || null;
      const completedRole = hasCompletedRole(data);
      const loggedInAfterSend = Boolean(lastLogin && lastLogin > sentAtDate);
      const seenAfterSend = Boolean(lastSeen && lastSeen > sentAtDate);

      return {
        userId: recipient.userId,
        email: recipient.email,
        displayName: data.displayName || data.pharmacyName || recipient.displayName || null,
        pharmagisterRole: data.pharmagisterRole || data.role || null,
        pharmaProfileComplete: Boolean(data.pharmaProfileComplete),
        lastLogin: toIso(data.lastLogin),
        lastSeen: toIso(data.lastSeen),
        createdAt: toIso(data.createdAt),
        completedRole,
        loggedInAfterSend,
        seenAfterSend,
      };
    })
  );

  const summary = {
    campaignId: campaign.id,
    sentAt: sentAtDate.toISOString(),
    recipientCount: rows.length,
    completedRoleCount: rows.filter((row) => row.completedRole).length,
    loggedInAfterSendCount: rows.filter((row) => row.loggedInAfterSend).length,
    seenAfterSendCount: rows.filter((row) => row.seenAfterSend).length,
    completedAndLoggedInAfterSendCount: rows.filter((row) => row.completedRole && row.loggedInAfterSend).length,
    stillIncompleteCount: rows.filter((row) => !row.completedRole).length,
    stillIncompleteButLoggedInAfterSendCount: rows.filter((row) => !row.completedRole && row.loggedInAfterSend).length,
  };

  console.log(JSON.stringify({
    summary,
    completedRoleUsers: rows.filter((row) => row.completedRole),
    activeAfterSendUsers: rows.filter((row) => row.loggedInAfterSend || row.seenAfterSend),
    stillIncompleteUsers: rows.filter((row) => !row.completedRole),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});