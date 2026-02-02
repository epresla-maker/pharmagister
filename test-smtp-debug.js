const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function test() {
  console.log('SMTP Config:');
  console.log('  Host:', process.env.SMTP_HOST);
  console.log('  Port:', process.env.SMTP_PORT || 465);
  console.log('  User:', process.env.SMTP_USER);
  console.log('  Pass:', process.env.SMTP_PASS ? '***set***' : 'NOT SET');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    debug: true,
    logger: true
  });

  try {
    // Először teszteljük a kapcsolatot
    await transporter.verify();
    console.log('\n✅ SMTP kapcsolat OK!');
    
    const info = await transporter.sendMail({
      from: '"Pharmagister" <' + process.env.SMTP_USER + '>',
      to: 'epresla@icloud.com',
      subject: 'SMTP Teszt DEBUG - ' + new Date().toLocaleTimeString('hu-HU'),
      html: '<h1>SMTP Teszt</h1><p>Ha ezt latod, az SMTP mukodik!</p><p>Kuldve: ' + new Date().toLocaleString('hu-HU') + '</p>',
    });

    console.log('\n✅ Email elkuldve!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    console.log('Accepted:', info.accepted);
    console.log('Rejected:', info.rejected);
  } catch (error) {
    console.error('\n❌ Hiba:', error.message);
    console.error('Full error:', error);
  }
}
test();
