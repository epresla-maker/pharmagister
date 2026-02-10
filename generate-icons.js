#!/usr/bin/env node
// Android app ikon generáló
// Pm monogram - zöld háttér, fehér betűk, NINCS felirat

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Android mipmap méretek
const iconSizes = [
  { folder: 'mipmap-mdpi', size: 48, foregroundSize: 108 },
  { folder: 'mipmap-hdpi', size: 72, foregroundSize: 162 },
  { folder: 'mipmap-xhdpi', size: 96, foregroundSize: 216 },
  { folder: 'mipmap-xxhdpi', size: 144, foregroundSize: 324 },
  { folder: 'mipmap-xxxhdpi', size: 192, foregroundSize: 432 },
];

const androidResPath = 'android/app/src/main/res';

// Háttér szín és betű szín
const BG_COLOR = '#16A34A';  // Zöld
const FG_COLOR = 'white';    // Fehér betű

console.log('🎨 App ikonok generálása...');
console.log('   Pm monogram - zöld háttér, fehér betűk, NINCS felirat\n');

iconSizes.forEach(({ folder, size, foregroundSize }) => {
  const outputFolder = path.join(androidResPath, folder);
  
  // 1. ic_launcher.png - Teljes ikon (régebbi eszközökhöz)
  const launcherCanvas = createCanvas(size, size);
  const launcherCtx = launcherCanvas.getContext('2d');
  
  // Zöld háttér
  launcherCtx.fillStyle = BG_COLOR;
  launcherCtx.fillRect(0, 0, size, size);
  
  // Fehér "Pm" szöveg - a méret 45%-a
  const fontSize = size * 0.45;
  launcherCtx.fillStyle = FG_COLOR;
  launcherCtx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
  launcherCtx.textAlign = 'center';
  launcherCtx.textBaseline = 'middle';
  launcherCtx.fillText('Pm', size / 2, size / 2);
  
  fs.writeFileSync(
    path.join(outputFolder, 'ic_launcher.png'),
    launcherCanvas.toBuffer('image/png')
  );
  
  // 2. ic_launcher_round.png - Kerek ikon
  const roundCanvas = createCanvas(size, size);
  const roundCtx = roundCanvas.getContext('2d');
  
  // Kerek klip
  roundCtx.beginPath();
  roundCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  roundCtx.closePath();
  roundCtx.clip();
  
  // Zöld háttér
  roundCtx.fillStyle = BG_COLOR;
  roundCtx.fillRect(0, 0, size, size);
  
  // Fehér "Pm" szöveg
  roundCtx.fillStyle = FG_COLOR;
  roundCtx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
  roundCtx.textAlign = 'center';
  roundCtx.textBaseline = 'middle';
  roundCtx.fillText('Pm', size / 2, size / 2);
  
  fs.writeFileSync(
    path.join(outputFolder, 'ic_launcher_round.png'),
    roundCanvas.toBuffer('image/png')
  );
  
  // 3. ic_launcher_foreground.png - Adaptive icon előtér (nagyobb, safe zone-nal)
  // Android adaptive icon: 108dp, de a tartalom a belső 72dp-ben (66%) legyen
  const fgCanvas = createCanvas(foregroundSize, foregroundSize);
  const fgCtx = fgCanvas.getContext('2d');
  
  // Átlátszó háttér
  fgCtx.clearRect(0, 0, foregroundSize, foregroundSize);
  
  // "Pm" szöveg középen - kisebb, hogy beleférjen a safe zone-ba
  const fgFontSize = foregroundSize * 0.30;  // Kisebb, hogy ne lógjon ki
  fgCtx.fillStyle = FG_COLOR;
  fgCtx.font = `bold ${fgFontSize}px Arial, Helvetica, sans-serif`;
  fgCtx.textAlign = 'center';
  fgCtx.textBaseline = 'middle';
  fgCtx.fillText('Pm', foregroundSize / 2, foregroundSize / 2);
  
  fs.writeFileSync(
    path.join(outputFolder, 'ic_launcher_foreground.png'),
    fgCanvas.toBuffer('image/png')
  );
  
  console.log(`✅ ${folder}/ (${size}x${size}, fg: ${foregroundSize}x${foregroundSize})`);
});

// Háttér szín beállítása colors.xml-ben
const valuesPath = path.join(androidResPath, 'values');
if (!fs.existsSync(valuesPath)) {
  fs.mkdirSync(valuesPath, { recursive: true });
}
const colorsXmlPath = path.join(valuesPath, 'colors.xml');
const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#16A34A</color>
</resources>`;

fs.writeFileSync(colorsXmlPath, colorsXml);
console.log(`✅ values/colors.xml (zöld háttér)`);

console.log('\n✨ App ikonok generálás kész!');
console.log('📱 Futtasd: npx cap sync android');
