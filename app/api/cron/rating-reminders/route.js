import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

// Vercel Cron Job - naponta 19:00-kor CET
// cron: 0 18 * * * (UTC, ami CET 19:00)
//
// OPTIMALIZÁLT: Minimális Firestore olvasás
// - 1 query: tegnapi igények (date range + status szűrés)
// - 1 query: összes rating a releváns demandId-kre
// - 1 query: összes reminder notification a releváns demandId-kre
// - N query: csak az érintett userek (batch-elve ahol lehet)

export async function GET(request) {
  try {
    // Verify cron secret (Vercel automatically adds this header)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Allow manual testing in development
      if (process.env.NODE_ENV === 'production') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('🔔 Rating reminder cron started');

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Tegnapi dátum számítása (CET időzónához igazítva)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Tegnapi dátum YYYY-MM-DD formátumban (a date mező string formátumú)
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // '2026-04-09'

    console.log(`📅 Looking for demands with date: ${yesterdayStr}`);

    // 1. QUERY: Tegnapi igények (exact date match, mert string mező)
    // Status szűrés memóriában, mert equality + in filter problémás lehet
    const demandsSnapshot = await db.collection('pharmaDemands')
      .where('date', '==', yesterdayStr)
      .get();

    console.log(`📋 Found ${demandsSnapshot.size} demands from yesterday`);

    // Ha nincs tegnapi igény, kész vagyunk (0 extra olvasás)
    if (demandsSnapshot.empty) {
      return Response.json({
        success: true,
        sent: 0,
        skipped: 0,
        message: 'No demands from yesterday',
        timestamp: new Date().toISOString(),
      });
    }

    // Előkészítjük az adatokat memóriában
    const eligibleDemands = [];
    const demandIds = [];
    const substituteIds = new Set();
    const pharmacyIds = new Set();

    for (const doc of demandsSnapshot.docs) {
      const demand = doc.data();
      
      // Status szűrés memóriában
      if (!['accepted', 'completed'].includes(demand.status)) continue;
      
      // Kell elfogadott jelentkező
      if (!demand.acceptedApplicantId) continue;
      
      const pharmacyId = demand.userId || demand.pharmacyId;
      if (!pharmacyId) continue;

      demandIds.push(doc.id);
      substituteIds.add(demand.acceptedApplicantId);
      pharmacyIds.add(pharmacyId);
      eligibleDemands.push({
        id: doc.id,
        pharmacyId,
        substituteId: demand.acceptedApplicantId,
      });
    }

    if (eligibleDemands.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        skipped: 0,
        message: 'No eligible demands (no accepted applicants)',
        timestamp: new Date().toISOString(),
      });
    }

    // 2. QUERY: Már létező értékelések (1 query az összes demandId-re)
    // Firestore 'in' max 30 elemet támogat, szükség esetén chunk-oljuk
    const existingRatingIds = new Set();
    const demandIdChunks = chunkArray(demandIds, 30);
    
    for (const chunk of demandIdChunks) {
      const ratingsSnap = await db.collection('ratings')
        .where('demandId', 'in', chunk)
        .select() // Csak a document ID kell, nem az adat
        .get();
      ratingsSnap.docs.forEach(d => existingRatingIds.add(d.data().demandId || d.id));
    }

    // 3. QUERY: Már küldött emlékeztetők (1 query az összes demandId-re)
    const existingReminderIds = new Set();
    for (const chunk of demandIdChunks) {
      const remindersSnap = await db.collection('notifications')
        .where('relatedId', 'in', chunk)
        .where('type', '==', 'rating_reminder')
        .select('relatedId')
        .get();
      remindersSnap.docs.forEach(d => existingReminderIds.add(d.data().relatedId));
    }

    // Szűrjük ki ahol már van értékelés vagy emlékeztető
    const demandsToNotify = eligibleDemands.filter(d => 
      !existingRatingIds.has(d.id) && !existingReminderIds.has(d.id)
    );

    if (demandsToNotify.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        skipped: eligibleDemands.length,
        message: 'All demands already rated or reminded',
        timestamp: new Date().toISOString(),
      });
    }

    // 4. QUERY: Helyettesítők nevei (batch get - 1 query)
    const substituteIdsToFetch = [...new Set(demandsToNotify.map(d => d.substituteId))];
    const substituteNames = {};
    
    if (substituteIdsToFetch.length > 0) {
      const substituteRefs = substituteIdsToFetch.map(id => db.collection('users').doc(id));
      const substituteDocs = await db.getAll(...substituteRefs);
      substituteDocs.forEach(doc => {
        if (doc.exists) {
          const data = doc.data();
          substituteNames[doc.id] = data.displayName || data.name || 'a helyettesítő';
        }
      });
    }

    // 5. QUERY: Push subscriptions a gyógyszertárakhoz (batch)
    const pharmacyIdsToNotify = [...new Set(demandsToNotify.map(d => d.pharmacyId))];
    const pharmacySubscriptions = {};
    
    const pharmacyChunks = chunkArray(pharmacyIdsToNotify, 30);
    for (const chunk of pharmacyChunks) {
      const subsSnap = await db.collection('pushSubscriptions')
        .where('userId', 'in', chunk)
        .get();
      subsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!pharmacySubscriptions[data.userId]) {
          pharmacySubscriptions[data.userId] = [];
        }
        if (data.fcmToken) {
          pharmacySubscriptions[data.userId].push(data.fcmToken);
        }
      });
    }

    // Értesítések küldése (batch write)
    const batch = db.batch();
    let sentCount = 0;
    const results = [];

    for (const demand of demandsToNotify) {
      const substituteName = substituteNames[demand.substituteId] || 'a helyettesítő';
      
      // In-app értesítés batch-be
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        userId: demand.pharmacyId,
        type: 'rating_reminder',
        title: 'Értékeld a helyettesítőt!',
        body: `Hogy dolgoztatok együtt? Értékeld ${substituteName} munkáját!`,
        url: `/ertekeles/${demand.id}`,
        relatedId: demand.id,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Push notification küldése (nem batch-elhető)
      const tokens = pharmacySubscriptions[demand.pharmacyId] || [];
      for (const token of tokens) {
        try {
          await admin.messaging().send({
            token,
            notification: {
              title: 'Értékeld a helyettesítőt!',
              body: `Hogy dolgoztatok együtt? Értékeld ${substituteName} munkáját!`,
            },
            data: {
              url: `/ertekeles/${demand.id}`,
              type: 'rating_reminder',
            },
            android: {
              priority: 'high',
              notification: { channelId: 'pharmagister_channel' },
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: 'Értékeld a helyettesítőt!',
                    body: `Hogy dolgoztatok együtt? Értékeld ${substituteName} munkáját!`,
                  },
                  sound: 'default',
                },
              },
            },
          });
        } catch (pushErr) {
          console.warn('Push send failed:', pushErr.message);
        }
      }

      sentCount++;
      results.push({ demandId: demand.id, status: 'sent' });
    }

    // Batch commit (1 write művelet az összes notification-re)
    await batch.commit();

    const skippedCount = eligibleDemands.length - sentCount;
    console.log(`✅ Rating reminders: ${sentCount} sent, ${skippedCount} skipped`);

    return Response.json({
      success: true,
      sent: sentCount,
      skipped: skippedCount,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Rating reminder cron error:', error);
    return Response.json({ 
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Helper: tömb darabolása
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
