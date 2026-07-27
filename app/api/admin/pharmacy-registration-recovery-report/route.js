import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { resolveMarketFromRequest } from '@/lib/market';

const ADMIN_EMAILS = ['epresla@icloud.com', 'etinatina22@gmail.com'];

function getCopy(market) {
  if (market === 'de') {
    return {
      noAdminPermission: 'Keine Admin-Berechtigung',
      noCampaign: 'Keine Wiederherstellungskampagne gefunden',
      genericError: 'Fehler beim Laden des Berichts',
    };
  }
  return {
    noAdminPermission: 'Nincs admin jogosultság',
    noCampaign: 'Nincs helyreállítási kampány',
    genericError: 'Hiba a riport betöltésekor',
  };
}

function tsToIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function hasCompletedActivation(userData) {
  return Boolean(userData?.emailVerified && userData?.passwordActivated);
}

async function loadLatestCampaign(db, campaignId) {
  if (campaignId) {
    const snap = await db.collection('pharmacyRegistrationRecoveryCampaigns').doc(campaignId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  const snap = await db.collection('pharmacyRegistrationRecoveryCampaigns').get();
  const candidates = snap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((entry) => entry.type === 'pharmacy_registration_recovery')
    .sort((left, right) => {
      const leftTs = left.createdAt?.toMillis?.() || 0;
      const rightTs = right.createdAt?.toMillis?.() || 0;
      return rightTs - leftTs;
    });

  return candidates[0] || null;
}

export async function GET(request) {
  const requestMarket = resolveMarketFromRequest(request);
  const copy = getCopy(requestMarket);

  try {
    const authUser = await verifyAuth(request);
    const isAllowed = ADMIN_EMAILS.includes(String(authUser?.email || '').toLowerCase());
    if (!isAllowed) {
      return NextResponse.json({ error: copy.noAdminPermission }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');

    const campaign = await loadLatestCampaign(db, campaignId);
    if (!campaign) {
      return NextResponse.json({ error: copy.noCampaign }, { status: 404 });
    }

    const recipients = Array.isArray(campaign.recipients) ? campaign.recipients : [];
    const tokenSnap = await db.collection('pharmacyRegistrationRecoveryTokens').where('campaignId', '==', campaign.id).get();
    const tokenMap = new Map();
    tokenSnap.docs.forEach((docSnap) => {
      const tokenData = docSnap.data() || {};
      if (tokenData.userId) tokenMap.set(tokenData.userId, tokenData);
    });

    const rows = await Promise.all(
      recipients.map(async (recipient) => {
        const userSnap = await db.collection('users').doc(recipient.userId).get();
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const tokenData = tokenMap.get(recipient.userId) || {};

        const clickedAtDate = tokenData.usedAt?.toDate?.() || tokenData.clickedAt?.toDate?.() || null;
        const lastLoginDate = userData.lastLogin?.toDate?.() || null;

        return {
          userId: recipient.userId,
          email: recipient.email,
          displayName: userData.displayName || userData.pharmacyName || recipient.displayName || null,
          emailVerified: Boolean(userData.emailVerified),
          passwordActivated: Boolean(userData.passwordActivated),
          role: userData.pharmagisterRole || null,
          clicked: Boolean(tokenData.used),
          clickedAt: tsToIso(tokenData.usedAt || tokenData.clickedAt),
          lastLogin: tsToIso(userData.lastLogin),
          lastSeen: tsToIso(userData.lastSeen),
          completedActivation: hasCompletedActivation(userData),
          loggedInAfterClick: Boolean(clickedAtDate && lastLoginDate && lastLoginDate > clickedAtDate),
          tokenExpiredAt: tsToIso(tokenData.expiresAt),
        };
      })
    );

    const summary = {
      campaignId: campaign.id,
      createdAt: tsToIso(campaign.createdAt),
      recipientCount: rows.length,
      clickedCount: rows.filter((row) => row.clicked).length,
      completedActivationCount: rows.filter((row) => row.completedActivation).length,
      loggedInAfterClickCount: rows.filter((row) => row.loggedInAfterClick).length,
      notClickedCount: rows.filter((row) => !row.clicked).length,
      stillNotActivatedCount: rows.filter((row) => !row.completedActivation).length,
    };

    return NextResponse.json({ summary, rows });
  } catch (error) {
    console.error('pharmacy recovery report error:', error);
    return NextResponse.json({ error: copy.genericError, details: error.message }, { status: 500 });
  }
}
