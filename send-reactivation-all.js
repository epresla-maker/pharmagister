const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

// Initialize Firebase Admin
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

// Rate limiting - wait between emails to avoid spam filters
const DELAY_BETWEEN_EMAILS = 2000; // 2 seconds

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Email sablon - ékezetekkel, emoji nélkül
function generateEmailHtml(name, email, resetLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0; }
    .notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pharmagister</h1>
    </div>
    <div class="content">
      <p>Kedves <strong>${name}</strong>!</p>
      
      <div class="notice">
        <strong>Fontos tájékoztatás:</strong><br>
        Sajnos a rendszer 24 órás aktiváló linket küldött, ezért most kiküldünk újra egy visszavonásig érvényes aktiváló linket. Megértését köszönjük!
      </div>
      
      <p>Kattints az alábbi gombra az új jelszavad beállításához:</p>
      
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Új jelszó beállítása</a>
      </p>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>Belépési email:</strong> ${email}</p>
      </div>
      
      <p>Ha a gomb nem működik, másold be ezt a linket a böngésződbe:</p>
      <p style="font-size: 12px; word-break: break-all; color: #6b7280;">${resetLink}</p>
      
      <p>Ha bármilyen kérdésed van, keress minket bizalommal!</p>
      
      <p>Üdvözlettel,<br><strong>A Pharmagister csapata</strong></p>
    </div>
    <div class="footer">
      <p>Ez egy automatikus üzenet a Pharmagister rendszerből.</p>
      <p>© 2026 Pharmagister - Minden jog fenntartva</p>
    </div>
  </div>
</body>
</html>
  `;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.pharmagister.hu',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendReactivationEmailToUser(user) {
  try {
    // Generate reset token - VISSZAVONÁSIG ÉRVÉNYES (nincs lejárat)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Save token to Firestore - NEM állítunk be lejáratot!
    await db.collection('users').doc(user.id).update({
      passwordResetToken: resetToken,
      passwordResetTokenExpiry: null // Visszavonásig érvényes
    });
    
    const resetLink = `https://pharmagister.hu/set-password?token=${resetToken}`;
    const userName = user.name || user.displayName || 'Felhasználó';
    
    // Send email
    await transporter.sendMail({
      from: '"Pharmagister" <' + process.env.SMTP_USER + '>',
      to: user.email,
      subject: 'Pharmagister - Új aktiváló link',
      html: generateEmailHtml(userName, user.email, resetLink),
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendAllReactivationEmails() {
  console.log('=== TÖMEGES ÚJRAAKTIVÁLÓ EMAIL KÜLDÉS ===\n');
  
  // Lekérdezzük a nem aktivált felhasználókat
  const usersSnap = await db.collection('users').get();
  const allUsers = usersSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const notActivatedUsers = allUsers.filter(u => !u.passwordActivated);
  
  console.log(`Összesen ${notActivatedUsers.length} nem aktivált felhasználó\n`);
  console.log('Küldés indítása...\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  for (let i = 0; i < notActivatedUsers.length; i++) {
    const user = notActivatedUsers[i];
    const progress = `[${i + 1}/${notActivatedUsers.length}]`;
    
    console.log(`${progress} Küldés: ${user.email}...`);
    
    const result = await sendReactivationEmailToUser(user);
    
    if (result.success) {
      console.log(`${progress} OK - ${user.email}`);
      results.success.push({
        email: user.email,
        name: user.name || user.displayName || 'N/A'
      });
    } else {
      console.log(`${progress} HIBA - ${user.email}: ${result.error}`);
      results.failed.push({
        email: user.email,
        name: user.name || user.displayName || 'N/A',
        error: result.error
      });
    }
    
    // Wait between emails
    if (i < notActivatedUsers.length - 1) {
      await sleep(DELAY_BETWEEN_EMAILS);
    }
  }
  
  // Summary
  console.log('\n=== ÖSSZESÍTÉS ===\n');
  console.log(`Sikeres: ${results.success.length}`);
  console.log(`Sikertelen: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\nSikertelen küldések:');
    results.failed.forEach(f => {
      console.log(`  - ${f.email}: ${f.error}`);
    });
  }
  
  // Save results to file
  const resultsFile = `reactivation-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\nEredmények mentve: ${resultsFile}`);
}

sendAllReactivationEmails().then(() => process.exit(0));
