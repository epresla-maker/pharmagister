# 📱 App Icon és Splash Screen Setup

## 🎨 App Ikonok

### Szükséges Méretek:

#### iOS:
- 1024x1024 px (App Store)
- Xcode Asset Catalog automatikusan generál minden méretet

#### Android:
- mdpi: 48x48 px
- hdpi: 72x72 px
- xhdpi: 96x96 px
- xxhdpi: 144x144 px
- xxxhdpi: 192x192 px

---

## 📲 Jelenlegi Ikonok Használata

A projektedben már vannak ikonok: `public/icons/icon-*.png`

### Automatikus Generálás (Capacitor Assets Plugin):

```bash
# Telepítsd a Capacitor Assets plugint
npm install -D @capacitor/assets

# Készíts egy icon.png fájlt (1024x1024) a projekt gyökerében
# Futtatsd:
npx capacitor-assets generate --iconBackgroundColor '#6B46C1' --iconBackgroundColorDark '#6B46C1'
```

Ez automatikusan generálja az összes app icon méretet iOS-re és Androidra!

---

## 🌅 Splash Screen

### iOS (Xcode):
1. Nyisd meg: `npx cap open ios`
2. Xcode-ban: `App` > `Assets.xcassets` > `Splash`
3. Húzz be egy 2732x2732 px képet (universal)

### Android (Android Studio):
1. Nyisd meg: `npx cap open android`
2. `res/drawable` mappába rakd: `splash.png` (Universal splash)
3. Vagy használj Android Asset Studio-t: File > New > Image Asset

---

## ⚙️ Splash Screen Konfiguráció

A `capacitor.config.ts`-ben már konfigurálva van:

```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 2000,
    backgroundColor: "#6B46C1",  // Pharmagister brand szín
    showSpinner: false,
  }
}
```

### Kézi Megjelenítés/Elrejtés a Kódból:

```javascript
import { SplashScreen } from '@capacitor/splash-screen';

// Splash megjelenítése
await SplashScreen.show({
  autoHide: false,
});

// Splash elrejtése
await SplashScreen.hide();
```

---

## 🚀 Gyors Setup - Meglévő Ikonok Használata

Ha most szeretnél gyorsan tesztelni a meglévő icon-okkal:

### iOS:
1. `public/icons/icon-512x512.png` vagy `icon-192x192.png`
2. Másold át `icon.png` néven a projekt gyökerébe (minimum 1024x1024)
3. Futtasd: `npx capacitor-assets generate`

### Android:
Ugyanígy működik - a Capacitor Assets automatikusan mindkettőt generálja.

---

## 📝 Tippek

- **Icon:** Egyszerű, felismerhető design (kicsi méretben is)
- **Splash:** Ne legyen túl komplex - gyorsan betöltődik
- **Brand konzisztencia:** Használd a Pharmagister lila színét (#6B46C1)
- **Safe area:** iOS-nél számolj a kijelző sarkokkal

---

## 🔗 Hasznos Linkek

- Capacitor Assets: https://github.com/ionic-team/capacitor-assets
- iOS Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/app-icons
- Android Icon Guidelines: https://developer.android.com/distribute/google-play/resources/icon-design-specifications
