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

async function sendPasswordEmail() {
  // Felhasználó adatok a MIGRATED_PASSWORDS.json-ból
  const user = {
    email: 'jeklibettinorbi@gmail.com',
    name: 'Jékliné Epres Bettina',
    firebaseUid: '6cVbO6kbk6d9H1GpaEcSzZw5vW82'
  };

  console.log('📧 Email küldése...');
  console.log('Címzett:', user.email);
  console.log('Név:', user.name);
  
  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  // Save token to Firestore
  await db.collection('users').doc(user.firebaseUid).update({
    passwordResetToken: resetToken,
    passwordResetTokenExpiry: tokenExpiry
  });
  
  console.log('✅ Token mentve a Firestore-ba');
  
  const resetLink = `https://pharmagister.hu/set-password?token=${resetToken}`;
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.pharmagister.hu',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const htmlContent = `
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
      <p>Kedves <strong>${user.name}</strong>!</p>
      
      <p>A Pharmagister rendszer megújult! Az új platformra történő átállás során új jelszó beállítása szükséges a fiókodhoz.</p>
      
      <p>Kattints az alábbi gombra az új jelszavad beállításához:</p>
      
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Új jelszó beállítása</a>
      </p>
      
      <div class="warning">
        <strong>⚠️ Fontos:</strong> Ez a link 24 óráig érvényes. Ha lejár, kérj új linket!
      </div>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>Belépési email:</strong> ${user.email}</p>
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

  try {
    const info = await transporter.sendMail({
      from: '"Pharmagister" <' + process.env.SMTP_USER + '>',
      to: user.email,
      subject: '🔐 Pharmagister - Állítsd be az új jelszavad',
      html: htmlContent,
    });

    console.log('');
    console.log('✅ Email sikeresen elküldve!');
    console.log('Message ID:', info.messageId);
    console.log('');
    console.log('📋 Összefoglaló:');
    console.log('   Címzett:', user.email);
    console.log('   Név:', user.name);
    console.log('   Reset link:', resetLink);
    process.exit(0);
  } catch (error) {
    console.error('❌ Hiba az email küldésekor:', error.message);
    process.exit(1);
  }
}

sendPasswordEmail();
