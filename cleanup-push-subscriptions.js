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

(async () => {
  try {
    console.log('🧹 Cleaning up old push subscriptions...');
    
    const subsSnapshot = await db.collection('pushSubscriptions').get();
    console.log(`📱 Found ${subsSnapshot.size} subscriptions to delete`);
    
    const batch = db.batch();
    subsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('✅ All old subscriptions deleted!');
    console.log('👉 Users need to re-enable push notifications in the app.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
