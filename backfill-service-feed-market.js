require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const PAGE_SIZE = 500;
const WRITE_BATCH_SIZE = 400;

function normalizeMarket(value) {
  return String(value || '').toLowerCase() === 'de' ? 'de' : 'hu';
}

async function backfillServiceFeedMarket({ commit = false } = {}) {
  const userMarketCache = new Map();
  const demandMarketCache = new Map();

  let scanned = 0;
  let missing = 0;
  let updated = 0;
  let lastDoc = null;

  const reasonStats = {
    demandMarket: 0,
    userMarket: 0,
    wordpressDefaultHu: 0,
    fallbackHu: 0,
  };

  const resolveUserMarket = async (userId) => {
    if (!userId) return null;
    if (userMarketCache.has(userId)) return userMarketCache.get(userId);

    const snap = await db.collection('users').doc(userId).get();
    const market = snap.exists && snap.data()?.market ? normalizeMarket(snap.data().market) : null;
    userMarketCache.set(userId, market);
    return market;
  };

  const resolveDemandMarket = async (demandId) => {
    if (!demandId) return null;
    if (demandMarketCache.has(demandId)) return demandMarketCache.get(demandId);

    const snap = await db.collection('pharmaDemands').doc(demandId).get();
    const market = snap.exists && snap.data()?.market ? normalizeMarket(snap.data().market) : null;
    demandMarketCache.set(demandId, market);
    return market;
  };

  const bufferedUpdates = [];

  while (true) {
    let q = db
      .collection('serviceFeedPosts')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(PAGE_SIZE);

    if (lastDoc) {
      q = q.startAfter(lastDoc.id);
    }

    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      scanned += 1;
      const data = docSnap.data() || {};

      if (data.market) continue;

      missing += 1;

      let market = null;
      let reason = 'fallbackHu';

      const demandId = data.pharmaDemandId || null;
      if (demandId) {
        const demandMarket = await resolveDemandMarket(demandId);
        if (demandMarket) {
          market = demandMarket;
          reason = 'demandMarket';
        }
      }

      if (!market) {
        const userId = data.userId || data.pharmacyId || null;
        const userMarket = await resolveUserMarket(userId);
        if (userMarket) {
          market = userMarket;
          reason = 'userMarket';
        }
      }

      if (!market) {
        if (data.migratedFrom === 'wordpress') {
          market = 'hu';
          reason = 'wordpressDefaultHu';
        } else {
          market = 'hu';
          reason = 'fallbackHu';
        }
      }

      reasonStats[reason] += 1;
      bufferedUpdates.push({ ref: docSnap.ref, market });
    }

    if (commit && bufferedUpdates.length >= WRITE_BATCH_SIZE) {
      while (bufferedUpdates.length > 0) {
        const chunk = bufferedUpdates.splice(0, WRITE_BATCH_SIZE);
        const batch = db.batch();
        chunk.forEach(({ ref, market }) => {
          batch.update(ref, { market });
        });
        await batch.commit();
        updated += chunk.length;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  if (commit && bufferedUpdates.length > 0) {
    while (bufferedUpdates.length > 0) {
      const chunk = bufferedUpdates.splice(0, WRITE_BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach(({ ref, market }) => {
        batch.update(ref, { market });
      });
      await batch.commit();
      updated += chunk.length;
    }
  }

  console.log('\n=== serviceFeedPosts market backfill ===');
  console.log(`Mode: ${commit ? 'COMMIT' : 'DRY RUN'}`);
  console.log(`Scanned posts: ${scanned}`);
  console.log(`Posts missing market: ${missing}`);
  console.log(`Would/Did update: ${commit ? updated : missing}`);
  console.log('Reason breakdown:');
  console.log(`- demandMarket: ${reasonStats.demandMarket}`);
  console.log(`- userMarket: ${reasonStats.userMarket}`);
  console.log(`- wordpressDefaultHu: ${reasonStats.wordpressDefaultHu}`);
  console.log(`- fallbackHu: ${reasonStats.fallbackHu}`);
  console.log('======================================\n');
}

const commit = process.argv.includes('--commit');

backfillServiceFeedMarket({ commit })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
