/**
 * WordPress → Firebase Migráció Script
 * 
 * FONTOS: Ez a script NEM küld emailt!
 * A felhasználók migrálása után manuálisan kell értesíteni őket.
 * 
 * Használat:
 *   node migrate-wp-users.js --dry-run     // Csak szimuláció, nem hoz létre semmit
 *   node migrate-wp-users.js               // Éles migráció
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase Admin inicializálás
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
const auth = admin.auth();

// Dry run mód ellenőrzés
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  console.log('🔵 DRY RUN MÓD - Nem történik valós változás!\n');
} else {
  console.log('🔴 ÉLŐ MIGRÁCIÓ MÓD - Felhasználók létrehozása!\n');
}

// CSV parser (egyszerű, mert a phpMyAdmin formátumot használjuk)
function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    data.push(row);
  }
  return data;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Jelszó generálás (12 karakter, biztonságos)
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function migrate() {
  console.log('📂 CSV fájlok beolvasása...\n');
  
  // Users beolvasás
  const usersCSV = fs.readFileSync(path.join(__dirname, 'wpk2_users.csv'), 'utf-8');
  const users = parseCSV(usersCSV);
  console.log(`✅ ${users.length} felhasználó betöltve a wpk2_users.csv-ből`);
  
  // Usermeta beolvasás
  const usermetaCSV = fs.readFileSync(path.join(__dirname, 'wpk2_usermeta.csv'), 'utf-8');
  const usermeta = parseCSV(usermetaCSV);
  console.log(`✅ ${usermeta.length} meta rekord betöltve a wpk2_usermeta.csv-ből\n`);
  
  // Usermeta feldolgozás user_id szerint
  const metaByUserId = {};
  for (const meta of usermeta) {
    const userId = meta.user_id;
    if (!metaByUserId[userId]) {
      metaByUserId[userId] = {};
    }
    metaByUserId[userId][meta.meta_key] = meta.meta_value;
  }
  
  // Statisztikák
  const stats = {
    total: users.length,
    created: 0,
    skipped: 0,
    errors: 0,
    existingEmails: [],
    byRole: {
      pharmacist: 0,
      assistant: 0,
      pharmacy: 0,
      admin: 0,
      other: 0
    }
  };
  
  // Jelszavak mentése (csak lokálisan, NEM küldünk emailt!)
  const passwords = [];
  
  console.log('🚀 Migráció indítása...\n');
  console.log('=' .repeat(60));
  
  for (const wpUser of users) {
    const email = wpUser.user_email?.toLowerCase().trim();
    const wpId = wpUser.ID;
    const meta = metaByUserId[wpId] || {};
    
    // Email validálás
    if (!email || !email.includes('@')) {
      console.log(`⚠️  [${wpId}] Érvénytelen email, kihagyva: "${email}"`);
      stats.skipped++;
      continue;
    }
    
    // Display name összeállítás
    let displayName = wpUser.display_name || '';
    if (!displayName && meta.first_name && meta.last_name) {
      displayName = `${meta.first_name} ${meta.last_name}`;
    }
    if (!displayName) {
      displayName = wpUser.user_login || email.split('@')[0];
    }
    
    // WordPress szerepkör kiolvasása
    const wpCapabilities = meta.wpk2_capabilities || '';
    let pharmagisterRole = null;
    let role = 'user';
    
    // WordPress role → Firebase role mapping
    if (wpCapabilities.includes('pharmacist')) {
      pharmagisterRole = 'pharmacist'; // Gyógyszerész
    } else if (wpCapabilities.includes('specialist_assistant')) {
      pharmagisterRole = 'assistant'; // Szakasszisztens
    } else if (wpCapabilities.includes('pharmacy')) {
      pharmagisterRole = 'pharmacy'; // Gyógyszertár tulajdonos
    } else if (wpCapabilities.includes('administrator')) {
      role = 'admin';
      pharmagisterRole = 'pharmacist';
    } else if (wpCapabilities.includes('pss_moderator')) {
      role = 'moderator';
    }
    
    // Felhasználó adatok
    const userData = {
      email: email,
      name: displayName,
      displayName: displayName,
      firstName: meta.first_name || '',
      lastName: meta.last_name || '',
      phone: meta.phone_number || '',
      city: meta.city || '',
      address: meta.street_address || '',
      zipCode: meta.zip_code || '',
      yearsOfExperience: meta.years_of_experience ? parseInt(meta.years_of_experience) : null,
      hourlyWage: meta.hourly_wage || '',
      softwareKnowledge: meta.software_knowledge || '',
      introductionText: meta.introduction_text || '',
      profileComplete: meta.profile_complete === '1',
      wpUserId: wpId, // Eredeti WP ID referencia
      wpUsername: wpUser.user_login,
      wpRegistered: wpUser.user_registered,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedFrom: 'wordpress',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      role: role,
      pharmagisterRole: pharmagisterRole,
      wpRole: wpCapabilities, // Eredeti WP role mentése
      emailVerified: true, // WP-ben már regisztráltak voltak
      isApproved: pharmagisterRole ? true : false, // Ha van szerepköre, jóváhagyott
    };
    
    // Üres mezők törlése
    Object.keys(userData).forEach(key => {
      if (userData[key] === '' || userData[key] === null || userData[key] === undefined) {
        delete userData[key];
      }
    });
    
    if (DRY_RUN) {
      const roleLabel = pharmagisterRole || 'nincs';
      console.log(`[DRY RUN] ${email} | ${displayName} | Szerepkör: ${roleLabel}`);
      stats.created++;
      if (pharmagisterRole === 'pharmacist') stats.byRole.pharmacist++;
      else if (pharmagisterRole === 'assistant') stats.byRole.assistant++;
      else if (pharmagisterRole === 'pharmacy') stats.byRole.pharmacy++;
      else if (role === 'admin') stats.byRole.admin++;
      else stats.byRole.other++;
      continue;
    }
    
    try {
      // Ellenőrizzük, hogy létezik-e már ez az email Firebase Auth-ban
      let existingUser = null;
      try {
        existingUser = await auth.getUserByEmail(email);
      } catch (e) {
        // Nem létezik - ez jó!
      }
      
      if (existingUser) {
        console.log(`⏭️  [${wpId}] Már létezik: ${email}`);
        stats.existingEmails.push(email);
        stats.skipped++;
        continue;
      }
      
      // Új jelszó generálás
      const password = generatePassword();
      
      // Firebase Auth user létrehozása
      const newUser = await auth.createUser({
        email: email,
        password: password,
        displayName: displayName,
        emailVerified: true, // Már létező felhasználók
      });
      
      // Firestore document létrehozása
      await db.collection('users').doc(newUser.uid).set(userData);
      
      // Jelszó mentése a listába
      passwords.push({
        email: email,
        name: displayName,
        password: password,
        firebaseUid: newUser.uid,
        wpId: wpId
      });
      
      console.log(`✅ [${wpId}] Létrehozva: ${email} (${displayName})`);
      stats.created++;
      
    } catch (error) {
      console.log(`❌ [${wpId}] Hiba: ${email} - ${error.message}`);
      stats.errors++;
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 MIGRÁCIÓ ÖSSZESÍTŐ:\n');
  console.log(`   Összes WP felhasználó: ${stats.total}`);
  console.log(`   Sikeresen létrehozva:  ${stats.created}`);
  console.log(`   Kihagyva (már létezett/érvénytelen): ${stats.skipped}`);
  console.log(`   Hibák: ${stats.errors}`);
  
  console.log('\n📋 SZEREPKÖRÖK SZERINTI BONTÁS:');
  console.log(`   👨‍⚕️  Gyógyszerész (pharmacist):    ${stats.byRole.pharmacist}`);
  console.log(`   👩‍⚕️  Szakasszisztens (assistant):  ${stats.byRole.assistant}`);
  console.log(`   🏥 Gyógyszertár (pharmacy):       ${stats.byRole.pharmacy}`);
  console.log(`   👑 Admin:                         ${stats.byRole.admin}`);
  console.log(`   ❓ Egyéb/nincs:                   ${stats.byRole.other}`);
  
  if (stats.existingEmails.length > 0) {
    console.log(`\n⚠️  Már létező emailek (${stats.existingEmails.length}):`);
    stats.existingEmails.slice(0, 10).forEach(e => console.log(`   - ${e}`));
    if (stats.existingEmails.length > 10) {
      console.log(`   ... és még ${stats.existingEmails.length - 10} további`);
    }
  }
  
  // Jelszavak mentése fájlba (TITKOS!)
  if (!DRY_RUN && passwords.length > 0) {
    const passwordFile = path.join(__dirname, 'MIGRATED_PASSWORDS.json');
    fs.writeFileSync(passwordFile, JSON.stringify(passwords, null, 2));
    console.log(`\n🔐 Jelszavak mentve: ${passwordFile}`);
    console.log('   ⚠️  EZT A FÁJLT TARTSD TITOKBAN ÉS TÖRÖLD MIUTÁN FELDOLGOZTAD!');
    
    // CSV verzió is (könnyebb kezeléshez)
    const passwordCSV = path.join(__dirname, 'MIGRATED_PASSWORDS.csv');
    const csvContent = 'Email,Név,Jelszó,Firebase UID,WP ID\n' + 
      passwords.map(p => `"${p.email}","${p.name}","${p.password}","${p.firebaseUid}","${p.wpId}"`).join('\n');
    fs.writeFileSync(passwordCSV, csvContent);
    console.log(`   CSV verzió: ${passwordCSV}`);
  }
  
  console.log('\n✅ Migráció befejezve!\n');
  console.log('📝 KÖVETKEZŐ LÉPÉSEK:');
  console.log('   1. Ellenőrizd a Firebase Console-ban a létrehozott felhasználókat');
  console.log('   2. Döntsd el hogyan értesíted a felhasználókat (email, SMS, stb.)');
  console.log('   3. A MIGRATED_PASSWORDS.json fájlt töröld miután feldolgoztad!');
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Kritikus hiba:', err);
    process.exit(1);
  });
