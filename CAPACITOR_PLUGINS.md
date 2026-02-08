# 🔌 Capacitor Pluginok Használata

## ⚡ Telepített Core Plugin

A Capacitor Core már telepítve van, és tartalmazza az alapvető funkciókat.

---

## 📦 Opcionális Hasznos Pluginok

### 1. **App Info & State Management**
```bash
npm install @capacitor/app
```

**Mit tud:**
- App verzió, build number lekérése
- App state (foreground/background) figyelése
- Deep linking
- Back button kezelése (Android)

---

### 2. **Device Info**
```bash
npm install @capacitor/device
```

**Mit tud:**
- Device modell, OS verzió
- Platform info
- UUID, manufacturer

---

### 3. **Network Status**
```bash
npm install @capacitor/network
```

**Mit tud:**
- Internet kapcsolat figyelése
- Connection type (wifi/cellular/none)
- Offline/online események

---

### 4. **Haptic Feedback (Rezgés)**
```bash
npm install @capacitor/haptics
```

**Mit tud:**
- Érintési feedback
- Különböző rezgés intenzitások
- Selection changed feedback

---

### 5. **Toast Notifications**
```bash
npm install @capacitor/toast
```

**Mit tud:**
- Natív toast üzenetek
- Pozíció (top/center/bottom)
- Időzítés

---

### 6. **Status Bar**
```bash
npm install @capacitor/status-bar
```

**Mit tud:**
- Status bar szín beállítása
- Hide/show status bar
- Light/dark style

---

### 7. **Share API**
```bash
npm install @capacitor/share
```

**Mit tud:**
- Natív share dialog
- Text, URL, fájlok megosztása
- Platform-specifikus share target-ek

---

### 8. **Camera**
```bash
npm install @capacitor/camera
```

**Mit tud:**
- Kép készítése kamerával
- Galéria hozzáférés
- Képszerkesztés

---

### 9. **Geolocation**
```bash
npm install @capacitor/geolocation
```

**Mit tud:**
- GPS koordináták lekérése
- Position tracking
- Engedélykérés kezelése

---

### 10. **Local Notifications**
```bash
npm install @capacitor/local-notifications
```

**Mit tud:**
- Lokális push értesítések
- Ütemezett notification-ok
- Action button-ok

---

## 🛠️ Utility Library Használata

A `lib/capacitorUtils.js` már tartalmaz helper függvényeket!

### Példa Használat:

```javascript
import {
  isNativePlatform,
  isIOS,
  isAndroid,
  getAppInfo,
  hapticImpact,
  showToast,
  shareContent,
} from '@/lib/capacitorUtils';

// Komponensben:
const MyComponent = () => {
  const handleShare = async () => {
    // Haptic feedback
    await hapticImpact('light');
    
    // Share
    const shared = await shareContent({
      title: 'Pharmagister',
      text: 'Nézd meg ezt az igényt!',
      url: 'https://pharmagister.app/demand/123'
    });
    
    if (shared) {
      await showToast('Megosztva!');
    }
  };
  
  useEffect(() => {
    const init = async () => {
      const info = await getAppInfo();
      console.log('App verzió:', info.version);
      
      // Platform-specifikus logika
      if (isIOS()) {
        // iOS-specifikus
      } else if (isAndroid()) {
        // Android-specifikus
      }
    };
    
    init();
  }, []);
  
  return (
    <button onClick={handleShare}>
      {isNativePlatform() ? 'Megosztás' : 'Megosztás (web)'}
    </button>
  );
};
```

---

## 📱 Platform Detection CSS

A utility automatikusan hozzáadja a platform class-okat:

```css
/* globals.css vagy komponens CSS */

/* Natív platform */
.platform-native .some-element {
  padding-top: var(--safe-area-inset-top);
}

/* iOS-specifikus */
.platform-ios .some-element {
  /* iOS style */
}

/* Android-specifikus */
.platform-android .some-element {
  /* Android style */
}

/* Web */
.platform-web .some-element {
  /* Web style */
}
```

---

## 🔐 Permissions (Engedélyek)

Egyes pluginok engedélyt kérnek:

### iOS (Info.plist):
`ios/App/App/Info.plist`-ben add hozzá:

```xml
<!-- Camera -->
<key>NSCameraUsageDescription</key>
<string>Képek készítéséhez szükséges</string>

<!-- Photo Library -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Képek feltöltéséhez szükséges</string>

<!-- Location -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Helymeghatározáshoz szükséges</string>
```

### Android (AndroidManifest.xml):
`android/app/src/main/AndroidManifest.xml`-ben:

```xml
<!-- Internet -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Camera -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Location -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

---

## 🚀 Gyors Start

### 1. Telepítsd a hasznos pluginokat:
```bash
npm install @capacitor/app @capacitor/device @capacitor/network @capacitor/haptics @capacitor/toast @capacitor/status-bar @capacitor/share
```

### 2. Sync:
```bash
npx cap sync
```

### 3. Használd a utility-t:
```javascript
import capacitorUtils from '@/lib/capacitorUtils';
```

---

## 📚 További Pluginok

Teljes lista: https://capacitorjs.com/docs/plugins

**Népszerű community pluginok:**
- `@capacitor-community/firebase-analytics`
- `@capacitor-community/sqlite`
- `@capacitor-community/barcode-scanner`
- `@capacitor-community/stripe`

---

## 💡 Best Practices

1. **Mindig ellenőrizd a platformot** - Ne hívj natív API-t web-en
2. **Használd a `safePluginCall`-t** - Graceful degradation
3. **Async/Await** - Minden plugin call aszinkron
4. **Error handling** - Try-catch minden plugin hívásnál
5. **Engedélyek** - Mindig kérj engedélyt, mielőtt használod a funkciót

---

Jó pluginolást! 🎉
