require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}
const db = admin.firestore();

async function check() {
  const posts = await db.collection('communityPosts').get();
  for (const p of posts.docs) {
    const d = p.data();
    console.log('Post:', p.id, '| text:', (d.text || '').substring(0, 30), '| commentCount:', d.commentCount, '| old comments array:', (d.comments || []).length);
    const subs = await db.collection('communityPosts').doc(p.id).collection('comments').get();
    console.log('  Subcollection size:', subs.size);
    for (const c of subs.docs.slice(0, 3)) {
      const cd = c.data();
      console.log('  Comment:', c.id, '| parentCommentId:', JSON.stringify(cd.parentCommentId), '| type:', typeof cd.parentCommentId, '| text:', (cd.text || '').substring(0, 40));
    }
  }
}

check().catch(console.error);
