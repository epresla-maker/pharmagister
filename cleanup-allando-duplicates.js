// Cleanup duplicate posts in allandoKeresPosts
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pharmacare-dfa3c',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: key
    })
  });
}

const db = admin.firestore();

async function cleanupDuplicates() {
  try {
    console.log('🔍 Keresem a duplikátumokat...\n');
    
    const snapshot = await db.collection('allandoKeresPosts').orderBy('createdAt', 'desc').get();
    
    const posts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      posts.push({
        id: doc.id,
        author: data.authorData?.displayName || 'Névtelen',
        originalPostId: data.originalPostId,
        createdAt: data.createdAt
      });
    });
    
    // Csoportosítás originalPostId szerint
    const byOriginalId = {};
    posts.forEach(post => {
      if (post.originalPostId) {
        if (!byOriginalId[post.originalPostId]) {
          byOriginalId[post.originalPostId] = [];
        }
        byOriginalId[post.originalPostId].push(post);
      }
    });
    
    // Keresés duplikátumokra
    const toDelete = [];
    Object.keys(byOriginalId).forEach(originalId => {
      const duplicates = byOriginalId[originalId];
      if (duplicates.length > 1) {
        // Megtartjuk az elsőt, töröljük a többit
        for (let i = 1; i < duplicates.length; i++) {
          toDelete.push(duplicates[i]);
        }
      }
    });
    
    if (toDelete.length === 0) {
      console.log('✅ Nincsenek duplikátumok!\n');
      process.exit();
      return;
    }
    
    console.log(`📋 ${toDelete.length} duplikátum poszt törölhető:\n`);
    toDelete.forEach((post, index) => {
      console.log(`${index + 1}. ${post.author} - ID: ${post.id}`);
    });
    
    if (process.argv.includes('--delete')) {
      console.log('\n🗑️  Duplikátumok törlése...\n');
      
      for (const post of toDelete) {
        await db.collection('allandoKeresPosts').doc(post.id).delete();
        console.log(`✅ Törölve: ${post.author} (${post.id})`);
      }
      
      console.log(`\n✅ ${toDelete.length} duplikátum törölve!`);
      console.log(`✅ Minden szerzőnek pontosan 1 posztja maradt.\n`);
    } else {
      console.log('\n💡 Törléshez futtasd: node cleanup-allando-duplicates.js --delete\n');
    }
    
  } catch (error) {
    console.error('❌ Hiba:', error);
  } finally {
    process.exit();
  }
}

cleanupDuplicates();
