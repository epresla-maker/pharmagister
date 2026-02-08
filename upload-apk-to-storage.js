require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: 'pharmacare-dfa3c.firebasestorage.app'
  });
}

async function uploadAPK() {
  try {
    const apkPath = path.join(require('os').homedir(), 'Desktop', 'app-debug.apk');
    
    // Check if APK exists
    if (!fs.existsSync(apkPath)) {
      console.error('❌ APK file not found:', apkPath);
      process.exit(1);
    }

    const bucket = admin.storage().bucket();
    const destination = 'apps/pharmagister-android.apk';
    
    console.log('📤 Uploading APK to Firebase Storage...');
    console.log('   Source:', apkPath);
    console.log('   Destination:', destination);
    
    // Upload file
    await bucket.upload(apkPath, {
      destination: destination,
      metadata: {
        contentType: 'application/vnd.android.package-archive',
        metadata: {
          uploadedAt: new Date().toISOString(),
          version: '1.0.0',
          description: 'Pharmagister Android APK'
        }
      }
    });

    // Make file publicly accessible
    const file = bucket.file(destination);
    await file.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
    
    console.log('\n✅ APK uploaded successfully!');
    console.log('📱 Public Download URL:');
    console.log(publicUrl);
    console.log('\n💾 File size:', (fs.statSync(apkPath).size / 1024 / 1024).toFixed(2), 'MB');
    
    // Save URL to a file for easy access
    fs.writeFileSync('apk-download-url.txt', publicUrl);
    console.log('\n📝 URL saved to: apk-download-url.txt');
    
  } catch (error) {
    console.error('❌ Error uploading APK:', error);
    process.exit(1);
  }
}

uploadAPK();
