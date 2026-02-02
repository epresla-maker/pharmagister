const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function testSMTP() {
  console.log('SMTP teszt kuldes...');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('User:', process.env.SMTP_USER);
  
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
    const info = await transporter.sendMail({
      from: '"Pharmagister" <' + process.env.SMTP_USER + '>',
      to: 'epresl@gmail.com',
      subject: 'SMTP Teszt - Pharmagister ' + new Date().toLocaleTimeString(),
      html: '<h1>SMTP Teszt</h1><p>Ha ezt latod, az SMTP mukodik!</p><p>Kuldve: ' + new Date().toLocaleString('hu-HU') + '</p>',
    });

    console.log('Email elkuldve!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('Hiba:', error.message);
  }
}

testSMTP();
