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

async function checkNotActivatedUsers() {
  console.log('=== NEM AKTIVALT FELHASZNALOK ===\n');
  
  const usersSnap = await db.collection('users').get();
  
  const allUsers = usersSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const notActivated = allUsers.filter(u => !u.passwordActivated);
  const activated = allUsers.filter(u => u.passwordActivated);
  
  console.log('Osszes felhasznalo:', allUsers.length);
  console.log('Aktivalt:', activated.length);
  console.log('NEM aktivalt:', notActivated.length);
  console.log('\n--- NEM AKTIVALT FELHASZNALOK LISTAJA ---\n');
  
  notActivated.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} - ${user.name || user.displayName || 'N/A'}`);
  });
  
  console.log('\n--- RESZLETEK ---\n');
  notActivated.forEach((user, index) => {
    console.log(`\n${index + 1}. FELHASZNALO:`);
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Nev:', user.name || user.displayName || 'N/A');
    console.log('   passwordActivated:', user.passwordActivated);
    console.log('   passwordResetToken letezik:', !!user.passwordResetToken);
    console.log('   passwordResetTokenExpiry:', user.passwordResetTokenExpiry?.toDate?.() || user.passwordResetTokenExpiry || 'N/A');
  });
}

checkNotActivatedUsers().then(() => process.exit(0));
