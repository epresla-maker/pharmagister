#!/usr/bin/env node
// Splash screen generáló script
// Pm monogram - zöld háttér, fehér betűk

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Android splash méretek
const androidSplashes = [
  { folder: 'drawable', width: 480, height: 800 },
  { folder: 'drawable-land-hdpi', width: 800, height: 480 },
  { folder: 'drawable-land-mdpi', width: 480, height: 320 },
  { folder: 'drawable-land-xhdpi', width: 1280, height: 720 },
  { folder: 'drawable-land-xxhdpi', width: 1600, height: 960 },
  { folder: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
  { folder: 'drawable-port-hdpi', width: 480, height: 800 },
  { folder: 'drawable-port-mdpi', width: 320, height: 480 },
  { folder: 'drawable-port-xhdpi', width: 720, height: 1280 },
  { folder: 'drawable-port-xxhdpi', width: 960, height: 1600 },
  { folder: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
];

const androidResPath = 'android/app/src/main/res';

console.log('🎨 Splash screen generálása...');
console.log('   Pm monogram - zöld háttér (#16A34A), fehér betűk\n');

androidSplashes.forEach(({ folder, width, height }) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Zöld háttér
  ctx.fillStyle = '#16A34A';
  ctx.fillRect(0, 0, width, height);
  
  // Fehér "Pm" szöveg
  const fontSize = Math.min(width, height) * 0.35;
  ctx.fillStyle = 'white';
  ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Pm', width / 2, height / 2);
  
  // Mentés
  const outputFolder = path.join(androidResPath, folder);
  const pngPath = path.join(outputFolder, 'splash.png');
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(pngPath, buffer);
  console.log(`✅ ${folder}/splash.png (${width}x${height})`);
});

console.log('\n✨ Splash screen generálás kész!');
console.log('📱 Futtasd: npx cap sync android');
