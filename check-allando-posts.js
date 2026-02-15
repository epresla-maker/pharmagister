// Check duplicate posts in allandoKeresPosts
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

async function checkDuplicates() {
  try {
    console.log('🔍 Ellenőrzöm az allandoKeresPosts collection-t...\n');
    
    const snapshot = await db.collection('allandoKeresPosts').orderBy('createdAt', 'desc').get();
    
    console.log(`📊 Összesen ${snapshot.size} poszt található.\n`);
    
    const posts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      posts.push({
        id: doc.id,
        author: data.authorData?.displayName || 'Névtelen',
        text: data.text?.substring(0, 50) || 'Nincs szöveg',
        originalPostId: data.originalPostId,
        createdAt: data.createdAt?.toDate?.() || 'Ismeretlen'
      });
    });
    
    // Csoportosítás szerző neve szerint
    const grouped = {};
    posts.forEach(post => {
      if (!grouped[post.author]) {
        grouped[post.author] = [];
      }
      grouped[post.author].push(post);
    });
    
    console.log('📋 Posztok szerzők szerint:\n');
    Object.keys(grouped).forEach(author => {
      console.log(`👤 ${author} - ${grouped[author].length} poszt`);
      grouped[author].forEach((post, index) => {
        console.log(`   ${index + 1}. ID: ${post.id}`);
        console.log(`      Szöveg: ${post.text}...`);
        console.log(`      Létrehozva: ${post.createdAt}`);
        console.log(`      Original ID: ${post.originalPostId || 'nincs'}\n`);
      });
    });
    
    // Keresés duplikátumokra (ugyanaz az originalPostId)
    const byOriginalId = {};
    posts.forEach(post => {
      if (post.originalPostId) {
        if (!byOriginalId[post.originalPostId]) {
          byOriginalId[post.originalPostId] = [];
        }
        byOriginalId[post.originalPostId].push(post);
      }
    });
    
    console.log('\n🔍 Duplikátumok (ugyanaz az originalPostId):\n');
    let hasDuplicates = false;
    Object.keys(byOriginalId).forEach(originalId => {
      if (byOriginalId[originalId].length > 1) {
        hasDuplicates = true;
        console.log(`❌ ${byOriginalId[originalId][0].author} - ${byOriginalId[originalId].length} példány`);
        byOriginalId[originalId].forEach((post, index) => {
          console.log(`   ${index + 1}. ID: ${post.id} ${index === 0 ? '(MEGTARTANDÓ)' : '(TÖRÖLHETŐ)'}`);
        });
        console.log();
      }
    });
    
    if (!hasDuplicates) {
      console.log('✅ Nincsenek duplikátumok!\n');
    } else {
      console.log('\n💡 Futtasd: node cleanup-allando-duplicates.js --delete\n');
    }
    
  } catch (error) {
    console.error('❌ Hiba:', error);
  } finally {
    process.exit();
  }
}

checkDuplicates();
