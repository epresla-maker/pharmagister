const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.pharmagister.hu',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Rate limiting - wait between emails to avoid spam filters
const DELAY_BETWEEN_EMAILS = 2000; // 2 seconds

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
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
      
      <p>A Pharmagister rendszer megújult! Az új platformra történő átállás során új jelszó beállítása szükséges a fiókodhoz.</p>
      
      <p>Kattints az alábbi gombra az új jelszavad beállításához:</p>
      
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Új jelszó beállítása</a>
      </p>
      
      <div class="warning">
        <strong>⚠️ Fontos:</strong> Ez a link 24 óráig érvényes. Ha lejár, kérj új linket!
      </div>
      
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

async function sendPasswordEmailToUser(user) {
  try {
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Save token to Firestore
    await db.collection('users').doc(user.firebaseUid).update({
      passwordResetToken: resetToken,
      passwordResetTokenExpiry: tokenExpiry
    });
    
    const resetLink = `https://pharmagister.hu/set-password?token=${resetToken}`;
    
    // Send email
    await transporter.sendMail({
      from: '"Pharmagister" <' + process.env.SMTP_USER + '>',
      to: user.email,
      subject: '🔐 Pharmagister - Állítsd be az új jelszavad',
      html: generateEmailHtml(user.name, user.email, resetLink),
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendAllPasswordEmails() {
  console.log('📧 Tömeges jelszó-beállító email küldés indítása...\n');
  
  // Load migrated users
  const passwordsFile = path.join(__dirname, 'MIGRATED_PASSWORDS.json');
  const users = JSON.parse(fs.readFileSync(passwordsFile, 'utf8'));
  
  console.log(`📋 Összesen ${users.length} felhasználó található\n`);
  
  // Skip the user we already sent to
  const alreadySent = ['jeklibettinorbi@gmail.com'];
  const usersToSend = users.filter(u => !alreadySent.includes(u.email.toLowerCase()));
  
  console.log(`📤 ${usersToSend.length} felhasználónak küldünk emailt (${alreadySent.length} már megkapta)\n`);
  
  const results = {
    success: [],
    failed: []
  };
  
  for (let i = 0; i < usersToSend.length; i++) {
    const user = usersToSend[i];
    const progress = `[${i + 1}/${usersToSend.length}]`;
    
    process.stdout.write(`${progress} ${user.email}... `);
    
    const result = await sendPasswordEmailToUser(user);
    
    if (result.success) {
      console.log('✅');
      results.success.push(user.email);
    } else {
      console.log(`❌ ${result.error}`);
      results.failed.push({ email: user.email, error: result.error });
    }
    
    // Rate limiting
    if (i < usersToSend.length - 1) {
      await sleep(DELAY_BETWEEN_EMAILS);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 ÖSSZEFOGLALÓ');
  console.log('='.repeat(50));
  console.log(`✅ Sikeres: ${results.success.length}`);
  console.log(`❌ Sikertelen: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Sikertelen küldések:');
    results.failed.forEach(f => {
      console.log(`   - ${f.email}: ${f.error}`);
    });
  }
  
  // Save results
  const resultsFile = path.join(__dirname, 'email-send-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalSent: results.success.length,
    totalFailed: results.failed.length,
    success: results.success,
    failed: results.failed
  }, null, 2));
  
  console.log(`\n📁 Eredmények mentve: ${resultsFile}`);
  
  process.exit(results.failed.length > 0 ? 1 : 0);
}

sendAllPasswordEmails();
