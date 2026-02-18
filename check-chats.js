// Egyszer futtatandó script: chat-ok és üzeneteik ellenőrzése
require('dotenv').config({ path: '.env.local' });

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: 'pharmacare-dfa3c',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});

const db = getFirestore(app);

(async () => {
  const chatsSnap = await db.collection('chats').get();
  console.log('Összes chat:', chatsSnap.size);
  console.log('');
  
  for (const chatDoc of chatsSnap.docs) {
    const data = chatDoc.data();
    const msgsSnap = await db.collection('chats').doc(chatDoc.id).collection('messages').get();
    
    // Member nevek
    const memberNames = [];
    for (const uid of (data.members || [])) {
      const uSnap = await db.collection('users').doc(uid).get();
      if (uSnap.exists) {
        const u = uSnap.data();
        memberNames.push(u.displayName || u.pharmacyName || u.name || uid);
      } else {
        memberNames.push('(törölve: ' + uid + ')');
      }
    }
    
    console.log('---');
    console.log('Chat ID:', chatDoc.id);
    console.log('Résztvevők:', memberNames.join(' ↔ '));
    console.log('Üzenetek száma:', msgsSnap.size);
    console.log('lastMessage:', data.lastMessage || '(nincs)');
    
    if (msgsSnap.size > 0) {
      msgsSnap.docs.slice(0, 3).forEach(m => {
        const md = m.data();
        console.log('  > Üzenet:', (md.text || '(kép/üres)').substring(0, 80), '| mező:', md.createdAt ? 'createdAt' : (md.timestamp ? 'timestamp' : 'NINCS DÁTUM'));
      });
    }
  }
  
  process.exit(0);
})();
