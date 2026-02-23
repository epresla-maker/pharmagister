require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

/**
 * Automatikus tisztítás: múltbeli dátumú igények törlése
 * 
 * Ez a script törli:
 * - pharmaDemands collection-ből a múltbeli dátumú igényeket
 * - serviceFeedPosts collection-ből a kapcsolódó bejegyzéseket
 * 
 * Futtatható manuálisan vagy ütemezve (pl. cron job-ként naponta egyszer)
 */
async function cleanupPastDemands() {
  console.log('\n🧹 Múltbeli dátumú igények automatikus törlése...\n');
  
  // Mai dátum YYYY-MM-DD formátumban (lokális időzóna!)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  console.log(`📅 Mai dátum: ${todayStr}`);
  console.log('⏰ Minden ennél régebbi dátumú igény törölve lesz.\n');
  
  try {
    // 1. Keresés a múltbeli igényekre a pharmaDemands collection-ben
    const demandsSnapshot = await db.collection('pharmaDemands').get();
    
    const pastDemands = demandsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.date && data.date < todayStr;
    });
    
    console.log(`📊 Talált múltbeli igények: ${pastDemands.length}\n`);
    
    if (pastDemands.length === 0) {
      console.log('✅ Nincs törlendő múltbeli igény!\n');
      return;
    }
    
    // 2. Törlés a pharmaDemands collection-ből
    let deletedDemands = 0;
    const batch = db.batch();
    
    for (const demandDoc of pastDemands) {
      const data = demandDoc.data();
      console.log(`   🗑️  Törlés: ${demandDoc.id} | ${data.date} | ${data.pharmacyName || 'N/A'}`);
      batch.delete(demandDoc.ref);
      deletedDemands++;
    }
    
    await batch.commit();
    console.log(`\n✅ ${deletedDemands} múltbeli igény törölve a pharmaDemands-ból!\n`);
    
    // 3. Kapcsolódó serviceFeedPosts törlése
    console.log('🧹 Kapcsolódó feed postok törlése...\n');
    
    const pastDemandIds = pastDemands.map(d => d.id);
    const feedPostsSnapshot = await db.collection('serviceFeedPosts')
      .where('postType', '==', 'pharmaDemand')
      .get();
    
    const pastFeedPosts = feedPostsSnapshot.docs.filter(doc => {
      const data = doc.data();
      // Töröljük, ha a pharmaDemandId megegyezik egy törölt igény ID-jével
      // VAGY ha a dátum múltbeli
      return (data.pharmaDemandId && pastDemandIds.includes(data.pharmaDemandId)) ||
             (data.date && data.date < todayStr);
    });
    
    if (pastFeedPosts.length > 0) {
      const feedBatch = db.batch();
      
      for (const feedDoc of pastFeedPosts) {
        console.log(`   🗑️  Feed post törlése: ${feedDoc.id}`);
        feedBatch.delete(feedDoc.ref);
      }
      
      await feedBatch.commit();
      console.log(`\n✅ ${pastFeedPosts.length} kapcsolódó feed post törölve!\n`);
    } else {
      console.log('✅ Nincs törlendő feed post.\n');
    }
    
    // 4. Összesítés
    console.log('═'.repeat(60));
    console.log('📊 ÖSSZESÍTÉS:');
    console.log(`   - Törölt igények: ${deletedDemands}`);
    console.log(`   - Törölt feed postok: ${pastFeedPosts.length}`);
    console.log(`   - Összes törölt elem: ${deletedDemands + pastFeedPosts.length}`);
    console.log('═'.repeat(60));
    console.log('\n✅ Tisztítás sikeresen befejezve!\n');
    
  } catch (error) {
    console.error('❌ Hiba történt a tisztítás során:', error);
    process.exit(1);
  }
}

cleanupPastDemands().then(() => process.exit(0));
