const nodemailer = require('nodemailer');
const crypto = require('crypto');
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

async function sendTestEmail() {
  const testEmail = 'epresla@icloud.com';
  const testName = 'Teszt Felhasznalo';
  
  console.log('=== TESZT EMAIL KULDES ===\n');
  console.log('Cimzett:', testEmail);
  console.log('Nev:', testName);
  
  // Generate token - visszavonasig ervenyes (nincs lejarat, vagy nagyon hosszu ido)
  const resetToken = crypto.randomBytes(32).toString('hex');
  // Nincs tokenExpiry - visszavonasig ervenyes
  
  const resetLink = `https://pharmagister.hu/set-password?token=${resetToken}`;
  
  console.log('\n--- EMAIL TARTALOM ELŐNÉZET ---\n');
  console.log('Tárgy: Pharmagister - Új aktiváló link');
  console.log('\nÜzenet:');
  console.log('--------');
  console.log(`Kedves ${testName}!`);
  console.log('');
  console.log('Fontos tájékoztatás:');
  console.log('Sajnos a rendszer 24 órás aktiváló linket küldött, ezért most kiküldünk újra egy visszavonásig érvényes aktiváló linket. Megértését köszönjük!');
  console.log('');
  console.log('Kattints az alábbi gombra az új jelszavad beállításához:');
  console.log('[Új jelszó beállítása gomb]');
  console.log('');
  console.log('Belépési email:', testEmail);
  console.log('');
  console.log('Üdvözlettel,');
  console.log('A Pharmagister csapata');
  console.log('--------\n');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.pharmagister.hu',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: '"Pharmagister" <' + process.env.SMTP_USER + '>',
      to: testEmail,
      subject: 'Pharmagister - Új aktiváló link',
      html: generateEmailHtml(testName, testEmail, resetLink),
    });
    
    console.log('TESZT EMAIL SIKERESEN ELKÜLDVE!');
    console.log('Cím:', testEmail);
    console.log('\nKérlek ellenőrizd az email tartalmát, és ha megfelelő, futtasd a send-reactivation-all.js scriptet!');
  } catch (error) {
    console.error('Hiba tortent az email kuldes soran:', error.message);
  }
}

sendTestEmail().then(() => process.exit(0));
