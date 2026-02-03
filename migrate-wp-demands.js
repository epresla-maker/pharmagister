/**
 * WordPress Igények → Firebase Migráció Script
 * 
 * FONTOS: Ez a script NEM küld emailt!
 * Csak az aktív ("publish") igényeket migrálja.
 * 
 * Használat:
 *   node migrate-wp-demands.js --dry-run     // Csak szimuláció
 *   node migrate-wp-demands.js               // Éles migráció
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

// Dry run mód ellenőrzés
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  console.log('🔵 DRY RUN MÓD - Nem történik valós változás!\n');
} else {
  console.log('🔴 ÉLŐ MIGRÁCIÓ MÓD - Igények létrehozása!\n');
}

// CSV parser
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

// Dátum konvertálás (WP: "2026-02-15" -> Firebase Date)
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d;
}

async function migrate() {
  console.log('📂 CSV fájlok beolvasása...\n');
  
  // Posts beolvasás
  const postsCSV = fs.readFileSync(path.join(__dirname, 'wpk2_posts.csv'), 'utf-8');
  const allPosts = parseCSV(postsCSV);
  console.log(`✅ ${allPosts.length} post betöltve`);
  
  // Csak substitution_request és publish státusz
  const demands = allPosts.filter(p => 
    p.post_type === 'substitution_request' && p.post_status === 'publish'
  );
  console.log(`✅ ${demands.length} aktív igény találva\n`);
  
  // Postmeta beolvasás
  const postmetaCSV = fs.readFileSync(path.join(__dirname, 'wpk2_postmeta.csv'), 'utf-8');
  const postmeta = parseCSV(postmetaCSV);
  console.log(`✅ ${postmeta.length} postmeta rekord betöltve\n`);
  
  // Postmeta feldolgozás post_id szerint
  const metaByPostId = {};
  for (const meta of postmeta) {
    const postId = meta.post_id;
    if (!metaByPostId[postId]) {
      metaByPostId[postId] = {};
    }
    metaByPostId[postId][meta.meta_key] = meta.meta_value;
  }
  
  // WP user ID → Firebase UID mapping betöltése (ha létezik)
  let wpToFirebaseMap = {};
  const mapFile = path.join(__dirname, 'MIGRATED_PASSWORDS.json');
  if (fs.existsSync(mapFile)) {
    const passwords = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
    for (const p of passwords) {
      wpToFirebaseMap[p.wpId] = p.firebaseUid;
    }
    console.log(`📋 ${Object.keys(wpToFirebaseMap).length} WP→Firebase user mapping betöltve\n`);
  } else {
    console.log('⚠️  MIGRATED_PASSWORDS.json nem található!');
    console.log('   Futtasd előbb a migrate-wp-users.js scriptet!\n');
    
    // Próbáljuk meg a Firestore-ból betölteni a wpUserId alapján
    console.log('🔍 Firestore users lekérdezése wpUserId alapján...');
    const usersSnap = await db.collection('users').where('migratedFrom', '==', 'wordpress').get();
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      if (data.wpUserId) {
        wpToFirebaseMap[data.wpUserId] = doc.id;
      }
    }
    console.log(`📋 ${Object.keys(wpToFirebaseMap).length} WP→Firebase user mapping Firestore-ból\n`);
  }
  
  // Statisztikák
  const stats = {
    total: demands.length,
    created: 0,
    skipped: 0,
    errors: 0,
    byRole: {
      pharmacist: 0,
      assistant: 0
    }
  };
  
  console.log('🚀 Igények migrálása...\n');
  console.log('=' .repeat(70));
  
  for (const demand of demands) {
    const postId = demand.ID;
    const meta = metaByPostId[postId] || {};
    const wpAuthorId = demand.post_author || meta._request_author_id;
    
    // Post title formátum: "Gyógyszertár neve - 2026-02-15 - Gyógyszerész"
    const title = demand.post_title || '';
    const titleParts = title.split(' - ');
    
    // Firebase owner ID keresése
    const ownerFirebaseId = wpToFirebaseMap[wpAuthorId];
    if (!ownerFirebaseId) {
      console.log(`⚠️  [${postId}] Nem található Firebase user a WP author ${wpAuthorId}-hoz: "${title}"`);
      stats.skipped++;
      continue;
    }
    
    // Dátum parse
    const dateStr = meta.substitution_date || '';
    const demandDate = parseDate(dateStr);
    
    // Csak jövőbeli igényeket migrálunk
    if (demandDate && demandDate < new Date()) {
      console.log(`⏭️  [${postId}] Múltbeli igény kihagyva: ${dateStr} - "${title}"`);
      stats.skipped++;
      continue;
    }
    
    // Szerepkör
    const roleStr = (meta.substitution_role || '').toLowerCase();
    let role = 'pharmacist';
    if (roleStr.includes('asszisztens') || roleStr.includes('assistant')) {
      role = 'assistant';
    }
    
    // Igény adatok összeállítása (az új rendszer struktúrája szerint)
    const demandData = {
      userId: ownerFirebaseId,
      date: demandDate ? admin.firestore.Timestamp.fromDate(demandDate) : null,
      role: role,
      requirements: meta.substitution_requirements || '',
      status: 'open',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      wpPostId: postId, // Eredeti WP ID referencia
      wpTitle: title,
      migratedFrom: 'wordpress',
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Üres mezők törlése
    Object.keys(demandData).forEach(key => {
      if (demandData[key] === '' || demandData[key] === null || demandData[key] === undefined) {
        delete demandData[key];
      }
    });
    
    const dateDisplay = demandDate ? demandDate.toISOString().split('T')[0] : 'N/A';
    
    if (DRY_RUN) {
      console.log(`[DRY RUN] ${title} | Dátum: ${dateDisplay} | Role: ${role}`);
      stats.created++;
      if (role === 'pharmacist') stats.byRole.pharmacist++;
      else stats.byRole.assistant++;
      continue;
    }
    
    try {
      // Firestore document létrehozása
      const docRef = await db.collection('pharmaDemands').add(demandData);
      
      console.log(`✅ [${postId}] Létrehozva: ${title} → ${docRef.id}`);
      stats.created++;
      if (role === 'pharmacist') stats.byRole.pharmacist++;
      else stats.byRole.assistant++;
      
    } catch (error) {
      console.log(`❌ [${postId}] Hiba: ${title} - ${error.message}`);
      stats.errors++;
    }
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 IGÉNYEK MIGRÁCIÓ ÖSSZESÍTŐ:\n');
  console.log(`   Összes aktív WP igény: ${stats.total}`);
  console.log(`   Sikeresen létrehozva:  ${stats.created}`);
  console.log(`   Kihagyva (múltbeli/nincs owner): ${stats.skipped}`);
  console.log(`   Hibák: ${stats.errors}`);
  
  console.log('\n📋 KERESETT POZÍCIÓ SZERINT:');
  console.log(`   👨‍⚕️  Gyógyszerész: ${stats.byRole.pharmacist}`);
  console.log(`   👩‍⚕️  Szakasszisztens: ${stats.byRole.assistant}`);
  
  console.log('\n✅ Igények migráció befejezve!\n');
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Kritikus hiba:', err);
    process.exit(1);
  });
