# Android Safe Area / System Inset Javítás 🔧

## Probléma leírása

Az Android Capacitor alkalmazásban az alsó navigációs sáv belecsúszott a rendszer alsó kezelőfelületébe (gesture bar / navigációs sáv):
- **PWA módban**: Megfelelő működés ✅
- **Telepített Capacitor build**: Layout probléma ❌
- **Különböző készülékek**: Eltérő mértékű elcsúszás
- **Gesture vs. 3 gombos navigáció**: Különböző viselkedés

## Megoldás összefoglalója

### 1. ✅ CSS Safe Area Support (globals.css)

Hozzáadtuk a CSS változókat a safe area inset értékekhez:

```css
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);
}
```

**Utility osztályok** a következetes használathoz:
- `.pb-safe` - 5rem + safe-area-inset-bottom (normál oldal padding)
- `.pb-safe-small` - 1.25rem + safe-area-inset-bottom (kis padding)
- `.mb-safe` - margin-bottom a safe area méretével
- `.h-safe-navbar` - navbar magasság safe area-val

### 2. ✅ Navbar Komponensek Frissítése

Minden alsó navigációs komponenshez hozzáadtuk a `paddingBottom` style-t:

**BottomNavigation.js**, **ChatBottomNavigation.js**, **PharmaNavbar.js**:
```jsx
style={{
  paddingBottom: 'env(safe-area-inset-bottom, 0px)'
}}
```

A **PharmaNavbar** esetében a bottom pozíciót is módosítottuk:
```jsx
style={{ 
  bottom: 'calc(73px + env(safe-area-inset-bottom, 0px))',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)'
}}
```

### 3. ✅ Capacitor Android Konfiguráció

Frissítettük a `capacitor.config.ts` fájlt:

```typescript
android: {
  buildOptions: {
    keystorePath: undefined,
    keystoreAlias: undefined,
  },
  allowMixedContent: true // Edge-to-edge layout support
},
plugins: {
  StatusBar: {
    style: 'DEFAULT',
    backgroundColor: '#6B46C1',
    overlaysWebView: false // Ne fedje el a webview-t
  },
  Keyboard: {
    resize: 'native', // Natív billentyűzet kezelés
    style: 'DARK'
  }
}
```

### 4. ⚠️ Viewport Beállítás (layout.js)

A viewport már megfelelően be volt állítva:
```javascript
export const viewport = {
  themeColor: "#6B46C1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // ✅ Fontos az edge-to-edge layouthoz!
};
```

## Telepítési lépések 📦

### 1. Capacitor Pluginek Telepítése

Ezek a pluginek szükségesek a megfelelő működéshez:

```bash
npm install @capacitor/status-bar @capacitor/keyboard
```

### 2. Capacitor Sync

Szinkronizáld a változtatásokat az Android projekttel:

```bash
npx cap sync android
```

### 3. Web Build

Build-eld újra a Next.js projektet:

```bash
npm run build
```

### 4. Android Build

Újraépítsd az Android APK-t:

```bash
npx cap open android
# Android Studio-ban: Build > Build Bundle(s) / APK(s) > Build APK(s)
```

Vagy használd a meglévő script-et:
```bash
./build-mobile.sh
```

## Tesztelési útmutató 🧪

### Ellenőrizendő készülékek:

1. **Különböző képernyőméretek**:
   - Kis képernyő (5.5")
   - Közepes képernyő (6.1-6.5")
   - Nagy képernyő (6.7"+)

2. **Különböző navigációs módok**:
   - ✅ Gesture navigation (modern Android 10+)
   - ✅ 3 gombos navigáció (klasszikus)
   - ✅ 2 gombos navigáció (ritka)

3. **Különböző Android verziók**:
   - Android 10-11
   - Android 12-13  
   - Android 14+

### Tesztelendő funkciók:

- [ ] Alsó navbar nem csúszik bele a gesture bar-ba
- [ ] Navbar gombok mind elérhetőek
- [ ] Különböző oldalakon (Főoldal, Chat, Pharmagister, stb.)
- [ ] Képernyő forgatás után (portrait/landscape)
- [ ] Billentyűzet megjelenésekor

## Műszaki részletek 🔍

### env() CSS függvény

Az `env()` CSS függvény lekéri a rendszer által biztosított környezeti változókat:

```css
padding-bottom: env(safe-area-inset-bottom, 0px);
                     ^^^^^^^^^^^^^^^^^^^^^^^^  ^^^^
                     Változó neve               Fallback érték
```

### viewport-fit="cover"

Ez az érték engedi az alkalmazásnak, hogy edge-to-edge módon elterjedjen:
- **auto**: Alapértelmezett, biztonságos területen belül marad
- **contain**: Behatárolt a safe area-ra
- **cover**: Kitölti az egész képernyőt, beleértve a notch/inset területeket is ✅

## Hibakeresés 🐛

### Ha nem működik:

1. **Ellenőrizd a Capacitor verziókat**:
```bash
npx cap doctor
```

2. **Tisztítsd meg a cache-t**:
```bash
rm -rf .next
rm -rf android/app/build
rm -rf android/.gradle
npm run build
npx cap sync android
```

3. **Android WebView verzió**:
   - Minimum Android WebView 90+ szükséges
   - Frissítsd a Google Play-en keresztül

4. **Chrome DevTools remote debugging**:
   - chrome://inspect a Chrome-ban
   - Válaszd ki a készüléket
   - Console-ban ellenőrizd: `getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')`

## Kapcsolódó dokumentumok 📚

- [CAPACITOR_SETUP.md](./CAPACITOR_SETUP.md) - Alap Capacitor beállítások
- [CAPACITOR_PLUGINS.md](./CAPACITOR_PLUGINS.md) - Plugin konfiguráció
- [MOBILE_QUICKSTART.md](./MOBILE_QUICKSTART.md) - Gyors használati útmutató

## Changelog 📝

### 2026-02-12
- ✅ Safe area CSS változók hozzáadása
- ✅ Navbar komponensek frissítése safe area padding-gel
- ✅ Capacitor StatusBar és Keyboard plugin konfiguráció
- ✅ Utility osztályok létrehozása (.pb-safe, .pb-safe-small, stb.)
- 📦 Plugin telepítési útmutató

---

**Készítette**: GitHub Copilot  
**Dátum**: 2026. február 12.
