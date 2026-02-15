// Move specific posts to Állandóra Keres collection
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

async function movePostsToAllandoKeres() {
  try {
    console.log('🔍 Keresem Dr. Benedek Gábor és Németh Melinda posztjait...\n');

    // Keresés a serviceFeedPosts collection-ben
    const postsSnapshot = await db.collection('serviceFeedPosts')
      .where('postType', '==', 'userPost')
      .get();

    const foundPosts = [];
    
    postsSnapshot.forEach(doc => {
      const data = doc.data();
      const displayName = data.authorData?.displayName || '';
      
      // Ellenőrizzük, hogy a névben szerepel-e Benedek Gábor vagy Németh Melinda
      if (displayName.includes('Benedek') || displayName.includes('Gábor') || 
          displayName.includes('Németh') || displayName.includes('Melinda')) {
        foundPosts.push({
          id: doc.id,
          ...data
        });
      }
    });

    if (foundPosts.length === 0) {
      console.log('❌ Nem találtam ilyen posztokat.');
      return;
    }

    console.log(`✅ Találtam ${foundPosts.length} posztot:\n`);
    
    foundPosts.forEach((post, index) => {
      console.log(`${index + 1}. ${post.authorData?.displayName || 'Névtelen'}`);
      console.log(`   ID: ${post.id}`);
      console.log(`   Szöveg: ${post.text?.substring(0, 100) || 'Nincs szöveg'}...`);
      console.log(`   Létrehozva: ${post.createdAt?.toDate?.() || 'Ismeretlen'}\n`);
    });

    console.log('📋 Átmásolás az allandoKeresPosts collection-be...\n');

    // Mentjük az ID-kat törléshez
    const postIds = foundPosts.map(post => ({ id: post.id, name: post.authorData?.displayName }));

    // Átmásolás
    for (const post of foundPosts) {
      const postId = post.id;
      delete post.id; // Nem mentjük az eredeti ID-t a data-ban
      
      // Új poszt létrehozása az allandoKeresPosts collection-ben
      await db.collection('allandoKeresPosts').add({
        ...post,
        postType: 'allandoKeres',
        movedFrom: 'serviceFeedPosts',
        movedAt: admin.firestore.FieldValue.serverTimestamp(),
        originalPostId: postId
      });
      
      console.log(`✅ Átmásolva: ${post.authorData?.displayName}`);
    }

    console.log('\n🎉 Sikeres átmásolás!');
    console.log('\n❓ Töröljem az eredeti posztokat a serviceFeedPosts collection-ből?');
    console.log('   (Futtasd újra a scriptet a --delete flaggel ha törölni szeretnéd)');
    
    // Ha --delete flag van, töröljük az eredetit
    if (process.argv.includes('--delete')) {
      console.log('\n🗑️  Eredeti posztok törlése...');
      for (const postData of postIds) {
        await db.collection('serviceFeedPosts').doc(postData.id).delete();
        console.log(`✅ Törölve: ${postData.name}`);
      }
      console.log('\n✅ Összes eredeti poszt törölve!');
    }

  } catch (error) {
    console.error('❌ Hiba történt:', error);
  } finally {
    process.exit();
  }
}

movePostsToAllandoKeres();
