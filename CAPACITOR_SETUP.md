# 📱 Pharmagister - Mobil App (Capacitor) Útmutató

## ⚡ Gyors Áttekintés

Ez a dokumentáció leírja, hogyan buildelj iOS és Android alkalmazást a Pharmagister Next.js PWA projektből Capacitor használatával.

**FONTOS:** A Capacitor integráció **NEM ÉRINTI** a meglévő web deployment-et!

---

## 📂 Projekt Struktúra

### Új Fájlok (Capacitor-specifikus):
```
pharmagister/
├── capacitor.config.ts          # Capacitor konfiguráció
├── next.config.mobile.js        # Next.js config CSAK mobilhoz
├── build-mobile.sh              # Mobil build szkript
├── ios/                         # iOS natív projekt (gitignore-ban)
├── android/                     # Android natív projekt (gitignore-ban)
└── out/                         # Static export output (gitignore-ban)
```

### Meglévő Fájlok (VÁLTOZATLANOK):
```
pharmagister/
├── next.config.js               # ✅ Eredeti web config (érintetlen)
├── package.json                 # ✅ Csak új dependencies (scripts változatlanok)
├── public/manifest.json         # ✅ PWA manifest (érintetlen)
└── app/                         # ✅ Minden komponens (érintetlen)
```

---

## 🔧 Build Folyamatok

### 1️⃣ **Web/PWA Deployment (VÁLTOZATLAN)**
```bash
# A megszokott workflow - semmi változás!
npm run dev          # Development
npm run build        # Production build
npm run start        # Production server
```

#### ➡️ Ez továbbra is:
- Használja a `next.config.js`-t
- Server-side renderinget támogat
- Vercel-re vagy bárhova deployolható
- PWA-ként működik

---

### 2️⃣ **Mobil App Deployment (ÚJ)**
```bash
# Mobil app build
./build-mobile.sh
```

#### ➡️ Ez:
- Használja a `next.config.mobile.js`-t
- Static export-ot generál (`output: 'export'`)
- Az `out/` mappába buildel
- Capacitor sync-et futtat

---

## 🚀 Mobil App Build Részletes Lépések

### **1. lépés: Static Export Generálása**
```bash
NEXT_CONFIG_FILE=next.config.mobile.js next build
```

Ez létrehozza az `out/` mappát statikus HTML/CSS/JS fájlokkal.

### **2. lépés: Capacitor Sync**
```bash
npx cap sync
```

Ez:
- Átmásolja az `out/` tartalmát az iOS/Android projektekbe
- Frissíti a natív plugin dependency-ket
- Szinkronizálja a konfigurációkat

### **3. lépés: Natív Projekt Megnyitása**

#### iOS:
```bash
npx cap open ios
```
- Megnyílik Xcode
- Válassz device/simulatort
- Nyomj Command+R-t a futtatáshoz
- Vagy Archive-olj production buildhez

#### Android:
```bash
npx cap open android
```
- Megnyílik Android Studio
- Válassz device/emulatort
- Nyomj Shift+F10-et a futtatáshoz
- Vagy Build > Generate Signed Bundle / APK

---

## 🔄 Fejlesztési Workflow

### **Live Reload Teszteléshez**

Ha lokálisan tesztelsz a natív appon:

1. **Indítsd el a Next.js dev servert:**
   ```bash
   npm run dev
   ```

2. **Módosítsd a `capacitor.config.ts`-t:**
   ```typescript
   server: {
     url: 'http://localhost:3000',  // Dev server
     cleartext: true
   }
   ```

3. **Sync és futtatás:**
   ```bash
   npx cap sync
   npx cap run ios    # vagy android
   ```

Most az app a dev szerverről tölti be a tartalmat - live reload! 🎉

### **Production Buildhez**

1. **Állítsd vissza a production URL-t a `capacitor.config.ts`-ben:**
   ```typescript
   server: {
     url: 'https://pharmagister.vercel.app',
     cleartext: true
   }
   ```

2. **Futtasd a build szkriptet:**
   ```bash
   ./build-mobile.sh
   ```

---

## 📱 Telefonon Tesztelés

### iOS (Fizikai Device):
1. Csatlakoztasd az iPhone-t USB-n
2. Xcode-ban válaszd ki a deviceot
3. "Signing & Capabilities" > Add Apple Developer account
4. Command+R

### Android (Fizikai Device):
1. Engedélyezd USB debugging-ot a telefonon
2. Csatlakoztasd USB-n
3. Android Studio-ban válaszd ki a deviceot
4. Shift+F10

---

## 🔧 Hasznos Capacitor Parancsok

```bash
# Platformok sync-je (változások átmásolása)
npx cap sync

# Csak iOS sync
npx cap sync ios

# Csak Android sync
npx cap sync android

# Platform megnyitása IDE-ben
npx cap open ios
npx cap open android

# Futtatás egyből (build + telepítés + indítás)
npx cap run ios
npx cap run android

# Plugin lista
npx cap ls

# Doctor (problémák ellenőrzése)
npx cap doctor
```

---

## 🔌 Capacitor Pluginok

A `capacitor.config.ts`-ben már konfigurálva van:
- **SplashScreen** - Üdvözlő képernyő
- **PushNotifications** - Push értesítések

### További pluginok hozzáadása:

```bash
npm install @capacitor/camera
npm install @capacitor/geolocation
npm install @capacitor/storage
# ... stb.

# Majd sync
npx cap sync
```

---

## 📦 App Store / Play Store Build

### iOS (App Store):
1. Xcode-ban: Product > Archive
2. Window > Organizer
3. Distribute App > App Store Connect
4. App Store Connect-ben teszteld és publish-old

### Android (Play Store):
1. Hozz létre signing key-t:
   ```bash
   keytool -genkey -v -keystore pharmagister.keystore -alias pharmagister -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Frissítsd a `capacitor.config.ts`-t:
   ```typescript
   android: {
     buildOptions: {
       keystorePath: '/path/to/pharmagister.keystore',
       keystoreAlias: 'pharmagister',
     }
   }
   ```
3. Android Studio-ban: Build > Generate Signed Bundle / APK
4. Play Console-ban upload-old és publish-old

---

## 🐛 Troubleshooting

### "Error: webDir does not exist"
```bash
# Futtasd a mobile build-et először:
./build-mobile.sh
```

### iOS build hibák
```bash
# Xcode command line tools telepítése:
xcode-select --install

# CocoaPods install (ha kell):
cd ios/App && pod install
```

### Android build hibák
```bash
# Gradle wrapper permissions:
cd android && chmod +x gradlew

# Gradle clean:
cd android && ./gradlew clean
```

### Live reload nem működik
- Ellenőrizd, hogy a telefon és a gép **ugyanazon a WiFi hálózaton** van-e
- `capacitor.config.ts`-ben a `url` legyen a gép lokális IP-je (nem localhost!)
- Példa: `url: 'http://192.168.1.100:3000'`

---

## ✅ Checklist Production Release Előtt

- [ ] `capacitor.config.ts` > `server.url` = production URL
- [ ] App név és ID ellenőrzése (`capacitor.config.ts`)
- [ ] Icon-ok és splash screen-ek cseréje
- [ ] Bundle identifier (iOS) és package name (Android) egyedi
- [ ] Signing certificates létrehozva
- [ ] Privacy policy és terms of service linkek
- [ ] Push notification setup (ha használod)
- [ ] Tesztelés több deviceon és OS verzión
- [ ] Performance audit
- [ ] App Store / Play Store metaadatok felkészítése

---

## 🆘 További Segítség

- **Capacitor Docs:** https://capacitorjs.com/docs
- **Next.js Static Export:** https://nextjs.org/docs/app/building-your-application/deploying/static-exports
- **iOS Deployment:** https://capacitorjs.com/docs/ios/deploying-to-app-store
- **Android Deployment:** https://capacitorjs.com/docs/android/deploying-to-google-play

---

## 🎉 Összefoglalás

**Web deployment:** Minden marad ugyanaz ✅  
**Mobil app:** Új, elkülönített build folyamat ✅  
**Fejlesztés:** Mindkét platform zökkenőmentesen működik ✅

Jó buildelést! 🚀
