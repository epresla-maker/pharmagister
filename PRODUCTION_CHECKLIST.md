# ✅ ANDROID PRODUCTION CHECKLIST - Google Play Release

**Projekt:** Pharmagister  
**URL:** https://pharmagister.hu  
**Utolsó frissítés:** 2026. február 10.

---

## 🎯 KRITIKUS (Google elutasítja nélkülük)

### 1. App Signing - Keystore 🔐
- [ ] Keystore generálva → [Útmutató](./ANDROID_KEYSTORE_SETUP.md)
- [ ] Keystore biztonságosan tárolva (Google Drive / 1Password)
- [ ] `keystore.properties` fájl létrehozva
- [ ] Release APK aláírva a keystore-ral
- [ ] Keystore jelszavak dokumentálva biztonságosan

### 2. Biztonsági Beállítások 🛡️
- [x] **Cleartext traffic kikapcsolva** (`usesCleartextTraffic="false"`)
- [x] **Development server URL törölve** a `capacitor.config.ts`-ből
- [ ] Csak HTTPS API endpoint-ok (nincs HTTP hívás!)
- [ ] Firebase Security Rules ellenőrizve
- [ ] Sensitive adatok nincsenek hardcode-olva

### 3. Privacy Policy & Compliance 📄
- [ ] **Privacy Policy elkészült** (KÖTELEZŐ!)
- [ ] Privacy Policy URL elérhető: `https://pharmagister.hu/privacy`
- [ ] Adatkezelési tájékoztató magyarul és angolul
- [ ] GDPR compliance ellenőrizve
- [ ] Firebase Analytics opt-out lehetőség
- [ ] Felhasználói adatok törlésének lehetősége

### 4. Content Rating 🔞
- [ ] Content rating kérdőív kitöltve a Google Play Console-on
- [ ] App kategorizálva (Medical / Health & Fitness)
- [ ] Target audience megadva (18+)

### 5. API Level & Kompatibilitás 📱
- [x] **minSdkVersion:** 24 (Android 7.0+)
- [x] **targetSdkVersion:** 36 (Android 14+)
- [x] **compileSdkVersion:** 36
- [ ] Tesztelve Android 7.0-on (minimum)
- [ ] Tesztelve Android 14-en (target)

---

## 🎨 VIZUÁLIS ELEMEK

### 6. App Icon (Launcher Icon) 🖼️
- [ ] **App ikon cserélve** (jelenleg Capacitor default!)
- [ ] Ikon méretei:
  - `mipmap-mdpi` - 48x48px
  - `mipmap-hdpi` - 72x72px
  - `mipmap-xhdpi` - 96x96px
  - `mipmap-xxhdpi` - 144x144px
  - `mipmap-xxxhdpi` - 192x192px
- [ ] Adaptive icon (Android 8.0+) beállítva
- [ ] Ikon átlátszó háttér nélkül
- [ ] Ikon JPG helyett PNG formátum

### 7. Splash Screen 🌅
- [ ] Splash screen testreszabva (egyedi dizájn)
- [ ] Splash screen háttérszín: `#6B46C1` (vagy egyedi)
- [ ] Logo középre igazítva
- [ ] Tesztelve különböző képernyőméreteken

### 8. Play Store Grafika 📸
- [ ] **Feature Graphic:** 1024x500px (KÖTELEZŐ!)
- [ ] App screenshotok:
  - Minimum **2 db**, maximum 8 db
  - **Phone:** 16:9 vagy 9:16 arány
  - Minimum felbontás: 320px
  - Maximum felbontás: 3840px
- [ ] Tablet screenshotok (opcionális, ajánlott)
- [ ] Promo video (opcionális)

---

## 📝 STORE LISTING (Google Play Console)

### 9. App Leírás & Metaadatok 📄
- [ ] **App név:** Pharmagister
- [ ] **Short description** (max. 80 karakter)
- [ ] **Full description** (max. 4000 karakter)
  - [ ] Magyarul
  - [ ] Angolul (ajánlott)
- [ ] **Kategória:** Medical / Health & Fitness
- [ ] **Tags/Keywords** optimalizálva (SEO)
- [ ] **Developer contact:**
  - [ ] Email cím
  - [ ] Weboldal URL
  - [ ] Telefon (opcionális)

### 10. Store Listing Assets 🖼️
- [ ] App ikon (512x512px, PNG)
- [ ] Feature graphic (1024x500px)
- [ ] Screenshotok (min. 2 db)
- [ ] Privacy Policy URL
- [ ] App category kiválasztva

---

## 🔧 FUNKCIONÁLIS TESZTEK

### 11. Alapfunkciók Tesztelése ✅
- [ ] **Login/Register** működik
- [ ] **Firebase Auth** működik
- [ ] **Firestore adatlekérés** működik
- [ ] **Képfeltöltés** működik (ha van)
- [ ] **Push notifications** működik (ha van)
- [ ] **Offline mode** működik (ha van)
- [ ] **Deep linking** működik (ha van)
- [ ] Minden menüpont elérhető
- [ ] Nincs crash a főbb funkcióknál

### 12. Engedélyek (Permissions) 🔓
- [ ] Engedélyek dokumentálva a Play Console-on
- [ ] Csak szükséges engedélyek kérve
- [ ] Engedély kérések indoklása az app-ban
- [ ] **Internet permission** - MEGVAN ✅
- [ ] **Camera** - ha használod
- [ ] **Storage** - ha használod
- [ ] **Location** - ha használod
- [ ] **Notifications** - ha használod

### 13. Performance & Stabilitás ⚡
- [ ] App méret < 150 MB (ideálisan < 50 MB)
- [ ] Startup time < 3 secundum
- [ ] Nincs memory leak
- [ ] ANR (App Not Responding) nincs
- [ ] Crash rate < 1%

---

## 🚀 BUILD & DEPLOY

### 14. Production Build 🏗️
- [ ] **Next.js production build:**
  ```bash
  npm run build
  ```
- [ ] **Static export ellenőrizve:** `out/` mappa létezik
- [ ] **Capacitor sync:**
  ```bash
  npx cap sync
  ```
- [ ] **Release APK/AAB build:**
  ```bash
  cd android
  ./gradlew assembleRelease
  # vagy
  ./gradlew bundleRelease
  ```

### 15. APK/AAB Validáció ✅
- [ ] APK/AAB aláírva signature-rel
- [ ] APK/AAB telepíthető fizikai eszközre:
  ```bash
  adb install android/app/build/outputs/apk/release/app-release.apk
  ```
- [ ] Nincs debug információ a release build-ben
- [ ] App méret elfogadható

---

## 📤 GOOGLE PLAY FELTÖLTÉS

### 16. Google Play Console Setup 🎮
- [ ] Google Play Developer account létrehozva ($25 egyszeri díj)
- [ ] Új app létrehozva a Console-on
- [ ] App kategória kiválasztva
- [ ] Default language beállítva

### 17. Release Management 🚀
- [ ] **Internal Testing** track létrehozva (ajánlott első körre)
- [ ] APK/AAB feltöltve
- [ ] Release notes írva
- [ ] Tester email címek hozzáadva (Internal Testing esetén)

### 18. Pre-launch Report Review 🧪
- [ ] Google automatikus tesztek futtatva
- [ ] Hibák javítva (ha vannak)
- [ ] Performance report átnézve

### 19. Production Release 🎉
- [ ] **Production** track kiválasztva
- [ ] Rollout százalék beállítva (pl. 10% → 50% → 100%)
- [ ] Release submitted for review
- [ ] Google review várakozás (1-7 nap)

---

## ✅ FINAL CHECKLIST - Feltöltés Előtt

**Menj végig ezen a listán mielőtt Submit!**

- [ ] Keystore biztonságosan tárolva
- [ ] Privacy Policy elérhető
- [ ] App ikon egyedi (nem default)
- [ ] Splash screen egyedi
- [ ] Screenshotok feltöltve (min. 2 db)
- [ ] Feature graphic feltöltve
- [ ] App leírás magyarul + angolul
- [ ] Engedélyek dokumentálva
- [ ] Release APK tesztelve eszközön
- [ ] Nincs HTTP connection (csak HTTPS)
- [ ] Firebase Security Rules production-ready
- [ ] Sensitive adatok nincsenek hardcode-olva
- [ ] VersionCode és VersionName correct
- [ ] Content rating kitöltve
- [ ] Target audience megadva

---

## 🐛 GYAKORI ELUTASÍTÁSI OKOK

### Google elutasíthatja az appot, ha:

1. ❌ **Nincs Privacy Policy**
2. ❌ **Cleartext traffic engedélyezve** (HTTP kapcsolat)
3. ❌ **Engedélyek nincsenek indokolva**
4. ❌ **Crashel az app induláskor**
5. ❌ **Content rating nincs kitöltve**
6. ❌ **App ikon/screenshotok hiányoznak**
7. ❌ **Sensitive permissions indoklás nélkül** (Location, Camera, stb.)
8. ❌ **Target API level túl régi** (minimum API 33 szükséges 2023 óta)
9. ❌ **Restricted content** (medical claims dokumentálás nélkül)
10. ❌ **Misleading app leírás vagy név**

---

## 📞 SUPPORT & HELP

### Hasznos linkek:
- [Google Play Console](https://play.google.com/console)
- [Android App Publishing Guide](https://developer.android.com/studio/publish)
- [Capacitor Android Docs](https://capacitorjs.com/docs/android)
- [Firebase Android Setup](https://firebase.google.com/docs/android/setup)

### Debug support:
- Android Logcat: `adb logcat`
- Crash reporting: Firebase Crashlytics
- Play Console Pre-launch Report

---

## 🎯 KÖVETKEZŐ LÉPÉSEK

1. ✅ Nézd át a teljes checklistet
2. 📝 Készítsd el a Privacy Policy-t
3. 🎨 Cseréld le az app ikont és splash screent
4. 🔐 Generáld le a keystore-t
5. 🏗️ Buildeld a release APK-t
6. 🧪 Teszteld eszközön
7. 📤 Töltsd fel a Play Console-ra Internal Testing-re
8. 🚀 Production release (miután Internal Testing OK)

---

**Készítette:** GitHub Copilot  
**Dátum:** 2026. február 10.
